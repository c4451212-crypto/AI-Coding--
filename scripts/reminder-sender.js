/* eslint-disable no-console */
/**
 * Cron 用提醒发送实现（JS 版本，避免 standalone 镜像缺少 TS 运行时）。
 *
 * 注意：逻辑与 `lib/services/reminder-sender.ts` 保持一致（可按需抽离/构建时编译）。
 */

const { and, eq, inArray, lte, sql } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');

const schema = require('../lib/db/schema');
const { WeComService } = require('../lib/wecom');

function getSqliteFilePath(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith('file:')) return databaseUrl || './dev.db';
  return databaseUrl.replace(/^file:/, '');
}

const sqlitePath = getSqliteFilePath(process.env.DATABASE_URL || 'file:./dev.db');
const sqlite = new Database(sqlitePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema });

const wecom = new WeComService();

function uniq(arr) {
  return Array.from(new Set(arr));
}

function normalizeWebhook(webhook) {
  const s = String(webhook || '').trim();
  if (!s) return '';
  if (s.startsWith('http')) return s;
  const key = s.includes('key=') ? s.split('key=').pop() : s;
  return `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(key || '')}`;
}

async function sendGroupMarkdown(webhook, markdown, opts) {
  const url = normalizeWebhook(webhook);
  if (!url) return { ok: false, status: 0, message: '企业微信群机器人未配置' };

  const payload = {
    msgtype: 'markdown',
    markdown: { content: markdown },
  };
  if (opts?.mentionAll) {
    payload.markdown.mentioned_list = ['@all'];
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, message: (j && j.errmsg) || res.statusText };
    if (!j || j.errcode !== 0) return { ok: false, status: res.status, message: (j && j.errmsg) || '发送失败' };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
}

function getWebhookFromDbScoped(purposeKey, companyId) {
  const scoped = sqlite
    .prepare(
      'select webhook_url as webhookUrl, mention_all_default as mentionAllDefault from wecom_group_webhooks where purpose_key = ? and company_id = ? and is_active = 1 limit 1',
    )
    .get(purposeKey, companyId);
  if (scoped) return scoped;
  if (companyId && companyId !== 0) {
    return sqlite
      .prepare(
        'select webhook_url as webhookUrl, mention_all_default as mentionAllDefault from wecom_group_webhooks where purpose_key = ? and company_id = 0 and is_active = 1 limit 1',
      )
      .get(purposeKey);
  }
  return null;
}

function resolveGroupWebhookCfg(purposeKey, companyId) {
  const row = getWebhookFromDbScoped(purposeKey, companyId);
  let url = row?.webhookUrl ? String(row.webhookUrl).trim() : '';
  let mentionAllDefault = !!row?.mentionAllDefault;
  if (!url) {
    const envKey = `WECOM_BOT_WEBHOOK_${purposeKey}`;
    url = String(process.env[envKey] || '').trim();
    mentionAllDefault = false;
  }
  return { url, mentionAllDefault };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDueAt(remindDate, remindTime) {
  const d = new Date(remindDate);
  const t = String(remindTime || '00:00').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return d;
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  d.setHours(hh, mm, 0, 0);
  return d;
}

async function usernamesToWecomUserIds(usernames) {
  const list = uniq(usernames).filter(Boolean);
  if (list.length === 0) return [];

  const rows = await db
    .select({ username: schema.users.username, wecomUserid: schema.users.wecomUserid })
    .from(schema.users)
    .where(and(eq(schema.users.isActive, true), inArray(schema.users.username, list)));

  return rows.map((r) => r.wecomUserid).filter(Boolean);
}

async function usernamesToUserIds(usernames) {
  const list = uniq(usernames).filter(Boolean);
  if (list.length === 0) return [];
  const rows = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(and(eq(schema.users.isActive, true), inArray(schema.users.username, list)));
  return rows.map((r) => r.id);
}

function safeParseRecipients(raw) {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function sendGeneralReminders() {
  const now = new Date();
  const upper = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const pending = await db
    .select({ reminder: schema.reminders, creatorName: schema.users.name })
    .from(schema.reminders)
    .leftJoin(schema.users, eq(schema.reminders.creatorId, schema.users.id))
    .where(and(eq(schema.reminders.status, '待发送'), lte(schema.reminders.remindDate, upper)));

  for (const row of pending) {
    const reminder = row.reminder;
    const dueAt = buildDueAt(reminder.remindDate, reminder.remindTime);
    if (dueAt.getTime() > now.getTime()) continue;

    const usernames = safeParseRecipients(reminder.recipients);
    const wecomUserIds = await usernamesToWecomUserIds(usernames);
    if (wecomUserIds.length === 0) continue;

    const title = `事项提醒：${reminder.title}`;
    const description = [
      reminder.description || '',
      '',
      `创建人：${row.creatorName || '未知'}`,
      `提醒时间：${dueAt.toLocaleString('zh-CN')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const url = reminder.relatedContractId ? `/contracts/${reminder.relatedContractId}` : '/reminders';

    const result = await wecom.sendCardMessage(wecomUserIds, title, description, url, '查看详情');
    if (result.errcode === 0) {
      const recipientUserIds = await usernamesToUserIds(usernames);

      db.transaction((tx) => {
        tx.update(schema.reminders)
          .set({ status: '已发送', wecomMsgId: result.msgid || null })
          .where(eq(schema.reminders.id, reminder.id));

        if (recipientUserIds.length > 0) {
          tx.insert(schema.reminderConfirmations)
            .values(
              recipientUserIds.map((uid) => ({
                reminderId: reminder.id,
                userId: uid,
                confirmedAt: null,
              })),
            )
            .onConflictDoNothing({
              target: [
                schema.reminderConfirmations.reminderId,
                schema.reminderConfirmations.userId,
              ],
            });
        }
      });
    }
  }
}

async function sendContractExpiringReminders() {
  const now = new Date();
  const today0 = startOfToday();
  const in30 = new Date(today0.getTime() + 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      contract: schema.contracts,
      companyShortName: schema.companies.shortName,
      holderWecomId: schema.users.wecomUserid,
      holderName: schema.users.name,
    })
    .from(schema.contracts)
    .leftJoin(schema.companies, eq(schema.contracts.companyId, schema.companies.id))
    .leftJoin(schema.users, eq(schema.contracts.currentHolder, schema.users.username))
    .where(
      and(
        inArray(schema.contracts.status, ['履行中', '生效']),
        lte(schema.contracts.endDate, in30),
        sql`(${schema.contracts.lastReminderSent} IS NULL OR ${schema.contracts.lastReminderSent} < ${today0})`,
      ),
    );

  if (rows.length === 0) return;

  for (const r of rows) {
    const c = r.contract;
    const end = new Date(c.endDate);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const urgency = daysLeft < 0 ? '【已逾期】' : daysLeft <= 7 ? '【7天内到期】' : '【30天内到期】';

    const recipients = uniq([r.holderWecomId].filter(Boolean));
    if (recipients.length === 0) continue;

    const title = `${urgency} ${c.contractNo}`;
    const amountText = c.totalAmount != null ? `¥${(Number(c.totalAmount) / 100).toLocaleString('zh-CN')}` : '¥0';
    const description = [
      `公司：${r.companyShortName || '未知'}`,
      `负责人：${r.holderName || c.currentHolder || '未知'}`,
      `合作方：${c.partyCompany || c.partyPerson || '未知'}`,
      `金额：${amountText}`,
      `到期日：${end.toLocaleDateString('zh-CN')}（剩余 ${daysLeft} 天）`,
      `纸质件位置：${c.storageLocation || '未登记'}`,
    ].join('\n');

    const result = await wecom.sendCardMessage(recipients, title, description, `/contracts/${c.id}`, '立即处理');

    try {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
      const finance = resolveGroupWebhookCfg('FINANCE', c.companyId);
      const hr = resolveGroupWebhookCfg('HR', c.companyId);

      const md = [
        `${urgency} **合同到期提醒**`,
        `> 合同：${c.contractNo}`,
        `> 公司：${r.companyShortName || '未知'}`,
        `> 到期日：${end.toLocaleDateString('zh-CN')}（剩余 ${daysLeft} 天）`,
        `> 负责人：${r.holderName || c.currentHolder || '未知'}`,
        '',
        `打开系统：${baseUrl}/contracts/${c.id}`,
      ].join('\n');

      if (finance.url) {
        await sendGroupMarkdown(finance.url, md, {
          mentionAll: finance.mentionAllDefault || daysLeft <= 7 || daysLeft < 0,
        });
      }
      if (hr.url && (daysLeft <= 7 || daysLeft < 0)) {
        await sendGroupMarkdown(hr.url, md, {
          mentionAll: hr.mentionAllDefault || daysLeft <= 7 || daysLeft < 0,
        });
      }
    } catch {
      // ignore
    }

    if (result.errcode === 0) {
      const newStatus = daysLeft < 0 ? '已到期' : daysLeft <= 7 ? '即将到期' : c.status;
      await db
        .update(schema.contracts)
        .set({ status: newStatus, lastReminderSent: new Date() })
        .where(eq(schema.contracts.id, c.id));
    }
  }
}

async function sendPaymentBudgetReminders() {
  const today0 = startOfToday();
  const day30 = new Date(today0.getTime() + 30 * 24 * 60 * 60 * 1000);
  const day30End = new Date(day30.getTime() + 24 * 60 * 60 * 1000 - 1);

  const financeUsers = await db
    .select({ wecomUserid: schema.users.wecomUserid })
    .from(schema.users)
    .where(and(eq(schema.users.isActive, true), eq(schema.users.role, 'finance')));
  const financeWecom = financeUsers.map((u) => u.wecomUserid).filter(Boolean);

  const rows = await db
    .select({
      payment: schema.paymentSchedules,
      contract: schema.contracts,
      companyShortName: schema.companies.shortName,
      holderWecomId: schema.users.wecomUserid,
    })
    .from(schema.paymentSchedules)
    .leftJoin(schema.contracts, eq(schema.paymentSchedules.contractId, schema.contracts.id))
    .leftJoin(schema.companies, eq(schema.contracts.companyId, schema.companies.id))
    .leftJoin(schema.users, eq(schema.contracts.currentHolder, schema.users.username))
    .where(
      and(
        eq(schema.paymentSchedules.status, '待预算'),
        eq(schema.paymentSchedules.remindedBudget, false),
        sql`${schema.paymentSchedules.dueDate} >= ${day30} AND ${schema.paymentSchedules.dueDate} <= ${day30End}`,
      ),
    );

  for (const r of rows) {
    const p = r.payment;
    const c = r.contract;
    if (!c) continue;
    const recipients = uniq([...financeWecom, r.holderWecomId].filter(Boolean));
    if (recipients.length === 0) continue;

    const title = `【预算提醒】第${p.sequence}期 ${p.nodeName}`;
    const description = [
      `合同：${c.contractNo}`,
      `公司：${r.companyShortName || '未知'} → ${c.partyCompany || '未知'}`,
      `金额：¥${(Number(p.amount) / 100).toLocaleString('zh-CN')}`,
      `付款截止：${new Date(p.dueDate).toLocaleDateString('zh-CN')}（30天后）`,
      '请提前安排资金预算。',
    ].join('\n');

    const result = await wecom.sendCardMessage(recipients, title, description, `/contracts/${c.id}`, '查看合同');

    try {
      const finance = resolveGroupWebhookCfg('FINANCE', c.companyId);
      const md = [
        `**预算提醒**（30天后付款）`,
        `> 合同：${c.contractNo}`,
        `> 公司：${r.companyShortName || '未知'}`,
        `> 节点：第${p.sequence}期 ${p.nodeName}`,
        `> 金额：¥${(Number(p.amount) / 100).toLocaleString('zh-CN')}`,
        `> 付款截止：${new Date(p.dueDate).toLocaleDateString('zh-CN')}`,
      ].join('\n');
      if (finance.url) {
        await sendGroupMarkdown(finance.url, md, { mentionAll: finance.mentionAllDefault });
      }
    } catch {
      // ignore
    }

    if (result.errcode === 0) {
      await db
        .update(schema.paymentSchedules)
        .set({ remindedBudget: true })
        .where(eq(schema.paymentSchedules.id, p.id));
    }
  }
}

async function sendPaymentDueReminders() {
  const today0 = startOfToday();
  const day1 = new Date(today0.getTime() + 1 * 24 * 60 * 60 * 1000);
  const day1End = new Date(day1.getTime() + 24 * 60 * 60 * 1000 - 1);

  const financeUsers = await db
    .select({ wecomUserid: schema.users.wecomUserid })
    .from(schema.users)
    .where(and(eq(schema.users.isActive, true), eq(schema.users.role, 'finance')));
  const financeWecom = financeUsers.map((u) => u.wecomUserid).filter(Boolean);

  const rows = await db
    .select({
      payment: schema.paymentSchedules,
      contract: schema.contracts,
      companyShortName: schema.companies.shortName,
      holderWecomId: schema.users.wecomUserid,
    })
    .from(schema.paymentSchedules)
    .leftJoin(schema.contracts, eq(schema.paymentSchedules.contractId, schema.contracts.id))
    .leftJoin(schema.companies, eq(schema.contracts.companyId, schema.companies.id))
    .leftJoin(schema.users, eq(schema.contracts.currentHolder, schema.users.username))
    .where(
      and(
        eq(schema.paymentSchedules.status, '待支付'),
        eq(schema.paymentSchedules.remindedPayment, false),
        sql`${schema.paymentSchedules.dueDate} >= ${day1} AND ${schema.paymentSchedules.dueDate} <= ${day1End}`,
      ),
    );

  for (const r of rows) {
    const p = r.payment;
    const c = r.contract;
    if (!c) continue;
    const recipients = uniq([...financeWecom, r.holderWecomId].filter(Boolean));
    if (recipients.length === 0) continue;

    const title = `【付款提醒】第${p.sequence}期 ${p.nodeName}`;
    const description = [
      `合同：${c.contractNo}`,
      `公司：${r.companyShortName || '未知'} → ${c.partyCompany || '未知'}`,
      `金额：¥${(Number(p.amount) / 100).toLocaleString('zh-CN')}`,
      `付款截止：${new Date(p.dueDate).toLocaleDateString('zh-CN')}（明天）`,
      '请跟进付款执行。',
    ].join('\n');

    const result = await wecom.sendCardMessage(recipients, title, description, `/contracts/${c.id}`, '查看合同');

    try {
      const finance = resolveGroupWebhookCfg('FINANCE', c.companyId);
      const md = [
        `**付款提醒（明天到期）**`,
        `> 合同：${c.contractNo}`,
        `> 公司：${r.companyShortName || '未知'}`,
        `> 节点：第${p.sequence}期 ${p.nodeName}`,
        `> 金额：¥${(Number(p.amount) / 100).toLocaleString('zh-CN')}`,
        `> 付款截止：${new Date(p.dueDate).toLocaleDateString('zh-CN')}`,
      ].join('\n');
      if (finance.url) {
        await sendGroupMarkdown(finance.url, md, { mentionAll: true });
      }
    } catch {
      // ignore
    }

    if (result.errcode === 0) {
      await db
        .update(schema.paymentSchedules)
        .set({ remindedPayment: true })
        .where(eq(schema.paymentSchedules.id, p.id));
    }
  }
}

module.exports = {
  sendGeneralReminders,
  sendContractExpiringReminders,
  sendPaymentBudgetReminders,
  sendPaymentDueReminders,
  close() {
    sqlite.close();
  },
};

