import { and, eq, inArray, lte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  companies,
  contracts,
  paymentSchedules,
  reminderConfirmations,
  reminders,
  users,
} from '@/lib/db/schema';
import { wecom } from '@/lib/wecom';
import { sendGroupMarkdown } from '@/lib/wecom/bot';
import { envWebhookFallback, getGroupWebhookConfig, resolveGroupWebhookUrl } from '@/lib/wecom/group-webhooks';

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDueAt(remindDate: Date, remindTime: string | null) {
  const d = new Date(remindDate);
  const t = (remindTime || '00:00').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return d;
  const hh = Math.max(0, Math.min(23, parseInt(m[1]!, 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2]!, 10)));
  d.setHours(hh, mm, 0, 0);
  return d;
}

async function usernamesToWecomUserIds(usernames: string[]) {
  const list = uniq(usernames).filter(Boolean);
  if (list.length === 0) return [];

  const rows = await db
    .select({
      username: users.username,
      wecomUserid: users.wecomUserid,
    })
    .from(users)
    .where(and(eq(users.isActive, true), inArray(users.username, list)));

  return rows.map((r) => r.wecomUserid).filter((x): x is string => !!x);
}

async function usernamesToUserIds(usernames: string[]) {
  const list = uniq(usernames).filter(Boolean);
  if (list.length === 0) return [];

  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(eq(users.isActive, true), inArray(users.username, list)));

  return rows.map((r) => r.id);
}

function safeParseRecipients(raw: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function sendGeneralReminders() {
  const now = new Date();
  const upper = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const pending = await db
    .select({
      reminder: reminders,
      creatorName: users.name,
    })
    .from(reminders)
    .leftJoin(users, eq(reminders.creatorId, users.id))
    .where(
      and(
        eq(reminders.status, '待发送'),
        lte(reminders.remindDate, upper),
      ),
    );

  for (const row of pending) {
    const reminder = row.reminder;
    const dueAt = buildDueAt(reminder.remindDate as unknown as Date, reminder.remindTime);
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

    const url = reminder.relatedContractId
      ? `/contracts/${reminder.relatedContractId}`
      : '/reminders';

    const result = await wecom.sendCardMessage(
      wecomUserIds,
      title,
      description,
      url,
      '查看详情',
    );

    if (result.errcode === 0) {
      const recipientUserIds = await usernamesToUserIds(usernames);

      db.transaction((tx) => {
        tx.update(reminders)
          .set({ status: '已发送', wecomMsgId: result.msgid ?? null })
          .where(eq(reminders.id, reminder.id));

        if (recipientUserIds.length > 0) {
          tx.insert(reminderConfirmations)
            .values(
              recipientUserIds.map((uid) => ({
                reminderId: reminder.id,
                userId: uid,
                confirmedAt: null,
              })),
            )
            .onConflictDoNothing({
              target: [
                reminderConfirmations.reminderId,
                reminderConfirmations.userId,
              ],
            });
        }
      });
    }
  }
}

export async function sendContractExpiringReminders() {
  const now = new Date();
  const today0 = startOfToday();
  const in30 = new Date(today0.getTime() + 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      contract: contracts,
      companyShortName: companies.shortName,
      holderWecomId: users.wecomUserid,
      holderName: users.name,
    })
    .from(contracts)
    .leftJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(users, eq(contracts.currentHolder, users.username))
    .where(
      and(
        inArray(contracts.status, ['履行中', '生效'] as const),
        lte(contracts.endDate, in30),
        sql`(${contracts.lastReminderSent} IS NULL OR ${contracts.lastReminderSent} < ${today0})`,
      ),
    );

  if (rows.length === 0) return;

  for (const r of rows) {
    const c = r.contract;
    const end = c.endDate as unknown as Date;
    const daysLeft = Math.ceil(
      (new Date(end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    const urgency =
      daysLeft < 0
        ? '【已逾期】'
        : daysLeft <= 7
          ? '【7天内到期】'
          : '【30天内到期】';

    const recipients = uniq([r.holderWecomId].filter((x): x is string => !!x));
    if (recipients.length === 0) continue;

    const title = `${urgency} ${c.contractNo}`;
    const amountText =
      c.totalAmount != null
        ? `¥${(Number(c.totalAmount) / 100).toLocaleString('zh-CN')}`
        : '¥0';
    const description = [
      `公司：${r.companyShortName || '未知'}`,
      `负责人：${r.holderName || c.currentHolder || '未知'}`,
      `合作方：${c.partyCompany || c.partyPerson || '未知'}`,
      `金额：${amountText}`,
      `到期日：${new Date(end).toLocaleDateString('zh-CN')}（剩余 ${daysLeft} 天）`,
      `纸质件位置：${c.storageLocation || '未登记'}`,
    ].join('\n');

    const result = await wecom.sendCardMessage(
      recipients,
      title,
      description,
      `/contracts/${c.id}`,
      '立即处理',
    );

    // 群通知：合同到期 → 财务群（支持 @all）
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

      const financeCfg = await getGroupWebhookConfig('FINANCE', c.companyId);
      let financeWebhook = financeCfg.webhookUrl;
      if (!financeWebhook) financeWebhook = await resolveGroupWebhookUrl('FINANCE', c.companyId);
      if (!financeWebhook) financeWebhook = envWebhookFallback('FINANCE');

      const hrCfg = await getGroupWebhookConfig('HR', c.companyId);
      let hrWebhook = hrCfg.webhookUrl;
      if (!hrWebhook) hrWebhook = await resolveGroupWebhookUrl('HR', c.companyId);
      if (!hrWebhook) hrWebhook = envWebhookFallback('HR');

      const md = [
        `${urgency} **合同到期提醒**`,
        `> 合同：${c.contractNo}`,
        `> 公司：${r.companyShortName || '未知'}`,
        `> 到期日：${new Date(end).toLocaleDateString('zh-CN')}（剩余 ${daysLeft} 天）`,
        `> 负责人：${r.holderName || c.currentHolder || '未知'}`,
        '',
        `打开系统：${baseUrl}/contracts/${c.id}`,
      ].join('\n');
      if (financeWebhook) {
        await sendGroupMarkdown(financeWebhook, md, {
          mentionAll:
            financeCfg.mentionAllDefault || daysLeft <= 7 || daysLeft < 0,
        });
      }

      // 临近到期/逾期：同步到人力资源群（用于续签/用工等协同）
      if (hrWebhook && (daysLeft <= 7 || daysLeft < 0)) {
        await sendGroupMarkdown(hrWebhook, md, {
          mentionAll: hrCfg.mentionAllDefault || daysLeft <= 7 || daysLeft < 0,
        });
      }
    } catch {
      // ignore group failures
    }

    if (result.errcode === 0) {
      const newStatus = daysLeft < 0 ? '已到期' : daysLeft <= 7 ? '即将到期' : c.status;
      await db
        .update(contracts)
        .set({ status: newStatus, lastReminderSent: new Date() })
        .where(eq(contracts.id, c.id));
    }
  }
}

export async function sendPaymentBudgetReminders() {
  const today0 = startOfToday();
  const day30 = new Date(today0.getTime() + 30 * 24 * 60 * 60 * 1000);
  const day30End = new Date(day30.getTime() + 24 * 60 * 60 * 1000 - 1);

  const financeUsers = await db
    .select({ wecomUserid: users.wecomUserid })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.role, 'finance')));
  const financeWecom = financeUsers
    .map((u) => u.wecomUserid)
    .filter((x): x is string => !!x);

  const rows = await db
    .select({
      payment: paymentSchedules,
      contract: contracts,
      companyShortName: companies.shortName,
      holderWecomId: users.wecomUserid,
    })
    .from(paymentSchedules)
    .leftJoin(contracts, eq(paymentSchedules.contractId, contracts.id))
    .leftJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(users, eq(contracts.currentHolder, users.username))
    .where(
      and(
        eq(paymentSchedules.status, '待预算'),
        eq(paymentSchedules.remindedBudget, false),
        sql`${paymentSchedules.dueDate} >= ${day30} AND ${paymentSchedules.dueDate} <= ${day30End}`,
      ),
    );

  for (const r of rows) {
    const p = r.payment;
    const c = r.contract;
    if (!c) continue;

    const recipients = uniq(
      [...financeWecom, r.holderWecomId].filter((x): x is string => !!x),
    );
    if (recipients.length === 0) continue;

    const title = `【预算提醒】第${p.sequence}期 ${p.nodeName}`;
    const description = [
      `合同：${c.contractNo}`,
      `公司：${r.companyShortName || '未知'} → ${c.partyCompany || '未知'}`,
      `金额：¥${(Number(p.amount) / 100).toLocaleString('zh-CN')}`,
      `付款截止：${new Date(p.dueDate as unknown as Date).toLocaleDateString('zh-CN')}（30天后）`,
      '请提前安排资金预算。',
    ].join('\n');

    const result = await wecom.sendCardMessage(
      recipients,
      title,
      description,
      `/contracts/${c.id}`,
      '查看合同',
    );

    // 群通知：预算提醒 → 财务群
    try {
      const financeCfg = await getGroupWebhookConfig('FINANCE', c.companyId);
      let financeWebhook = financeCfg.webhookUrl;
      if (!financeWebhook) financeWebhook = await resolveGroupWebhookUrl('FINANCE', c.companyId);
      if (!financeWebhook) financeWebhook = envWebhookFallback('FINANCE');

      const md = [
        `**预算提醒**（30天后付款）`,
        `> 合同：${c.contractNo}`,
        `> 公司：${r.companyShortName || '未知'}`,
        `> 节点：第${p.sequence}期 ${p.nodeName}`,
        `> 金额：¥${(Number(p.amount) / 100).toLocaleString('zh-CN')}`,
        `> 付款截止：${new Date(p.dueDate as unknown as Date).toLocaleDateString('zh-CN')}`,
      ].join('\n');
      if (financeWebhook) {
        await sendGroupMarkdown(financeWebhook, md, { mentionAll: financeCfg.mentionAllDefault });
      }
    } catch {
      // ignore
    }

    if (result.errcode === 0) {
      await db
        .update(paymentSchedules)
        .set({ remindedBudget: true })
        .where(eq(paymentSchedules.id, p.id));
    }
  }
}

export async function sendPaymentDueReminders() {
  const today0 = startOfToday();
  const day1 = new Date(today0.getTime() + 1 * 24 * 60 * 60 * 1000);
  const day1End = new Date(day1.getTime() + 24 * 60 * 60 * 1000 - 1);

  const financeUsers = await db
    .select({ wecomUserid: users.wecomUserid })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.role, 'finance')));
  const financeWecom = financeUsers
    .map((u) => u.wecomUserid)
    .filter((x): x is string => !!x);

  const rows = await db
    .select({
      payment: paymentSchedules,
      contract: contracts,
      companyShortName: companies.shortName,
      holderWecomId: users.wecomUserid,
    })
    .from(paymentSchedules)
    .leftJoin(contracts, eq(paymentSchedules.contractId, contracts.id))
    .leftJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(users, eq(contracts.currentHolder, users.username))
    .where(
      and(
        eq(paymentSchedules.status, '待支付'),
        eq(paymentSchedules.remindedPayment, false),
        sql`${paymentSchedules.dueDate} >= ${day1} AND ${paymentSchedules.dueDate} <= ${day1End}`,
      ),
    );

  for (const r of rows) {
    const p = r.payment;
    const c = r.contract;
    if (!c) continue;

    const recipients = uniq(
      [...financeWecom, r.holderWecomId].filter((x): x is string => !!x),
    );
    if (recipients.length === 0) continue;

    const title = `【付款提醒】第${p.sequence}期 ${p.nodeName}`;
    const description = [
      `合同：${c.contractNo}`,
      `公司：${r.companyShortName || '未知'} → ${c.partyCompany || '未知'}`,
      `金额：¥${(Number(p.amount) / 100).toLocaleString('zh-CN')}`,
      `付款截止：${new Date(p.dueDate as unknown as Date).toLocaleDateString('zh-CN')}（明天）`,
      '请跟进付款执行。',
    ].join('\n');

    const result = await wecom.sendCardMessage(
      recipients,
      title,
      description,
      `/contracts/${c.id}`,
      '查看合同',
    );

    // 群通知：付款提醒（提前一天）→ 财务群（@all）
    try {
      const financeCfg = await getGroupWebhookConfig('FINANCE', c.companyId);
      let financeWebhook = financeCfg.webhookUrl;
      if (!financeWebhook) financeWebhook = await resolveGroupWebhookUrl('FINANCE', c.companyId);
      if (!financeWebhook) financeWebhook = envWebhookFallback('FINANCE');

      const md = [
        `**付款提醒（明天到期）**`,
        `> 合同：${c.contractNo}`,
        `> 公司：${r.companyShortName || '未知'}`,
        `> 节点：第${p.sequence}期 ${p.nodeName}`,
        `> 金额：¥${(Number(p.amount) / 100).toLocaleString('zh-CN')}`,
        `> 付款截止：${new Date(p.dueDate as unknown as Date).toLocaleDateString('zh-CN')}`,
      ].join('\n');
      if (financeWebhook) {
        await sendGroupMarkdown(financeWebhook, md, { mentionAll: true });
      }
    } catch {
      // ignore
    }

    if (result.errcode === 0) {
      await db
        .update(paymentSchedules)
        .set({ remindedPayment: true })
        .where(eq(paymentSchedules.id, p.id));
    }
  }
}

