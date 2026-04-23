import crypto from 'crypto';
import type { NextRequest } from 'next/server';

import { failure } from '@/lib/api-response';
import { db } from '@/lib/db';
import { reminders, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function sha1(input: string) {
  return crypto.createHash('sha1').update(input).digest('hex');
}

function verifySignature(token: string, timestamp: string, nonce: string, signature: string) {
  const arr = [token, timestamp, nonce].sort();
  return sha1(arr.join('')) === signature;
}

function xmlGet(xml: string, tag: string) {
  const m = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>|<${tag}>(.*?)<\\/${tag}>`).exec(xml);
  return (m?.[1] ?? m?.[2] ?? '').trim();
}

function parseTime(raw: string): string | null {
  const t = raw
    .replace(/点/g, ':')
    .replace(/：/g, ':')
    .replace(/\s+/g, '')
    .trim();
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(t);
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, parseInt(m[1]!, 10)));
  const mm = m[2] ? Math.max(0, Math.min(59, parseInt(m[2]!, 10))) : 0;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function parseDate(raw: string) {
  const now = new Date();
  const today0 = new Date(now);
  today0.setHours(0, 0, 0, 0);

  const s = raw.trim();
  if (s.includes('明天')) return new Date(today0.getTime() + 1 * 24 * 60 * 60 * 1000);
  if (s.includes('后天')) return new Date(today0.getTime() + 2 * 24 * 60 * 60 * 1000);
  if (s.includes('今天')) return today0;

  const m1 = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m1) {
    const y = parseInt(m1[1]!, 10);
    const mo = parseInt(m1[2]!, 10) - 1;
    const d = parseInt(m1[3]!, 10);
    const dt = new Date(y, mo, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  const m2 = /(\d{1,2})-(\d{1,2})/.exec(s);
  if (m2) {
    const y = now.getFullYear();
    const mo = parseInt(m2[1]!, 10) - 1;
    const d = parseInt(m2[2]!, 10);
    const dt = new Date(y, mo, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  return null;
}

function parseReminderFromText(text: string): { remindDate: Date; remindTime: string; content: string } | null {
  const t = text.trim();
  if (!t) return null;

  // patterns (rough):
  // "明天提醒我xxx"
  // "明天 10:00 提醒我 xxx"
  // "2026-04-23 10:00 提醒我 xxx"
  // "2026-04-23 提醒我 xxx"
  const cleaned = t.replace(/，/g, ' ').replace(/\s+/g, ' ').trim();

  const datePart =
    /(今天|明天|后天|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\d{1,2})/.exec(cleaned)?.[1] ?? '';
  const remindDate = datePart ? parseDate(datePart) : null;
  if (!remindDate) return null;

  const timePart = /(\d{1,2}[:：]\d{2}|\d{1,2}点(\d{2})?)/.exec(cleaned)?.[1] ?? '';
  const remindTime = parseTime(timePart) ?? '00:00';

  let content = cleaned;
  content = content.replace(datePart, '').trim();
  if (timePart) content = content.replace(timePart, '').trim();
  content = content.replace(/^提醒我/,'').replace(/^提醒/,'').trim();
  if (!content) content = '未命名提醒';

  return { remindDate, remindTime, content };
}

function replyText(toUser: string, fromApp: string, text: string) {
  const now = Math.floor(Date.now() / 1000);
  return `<?xml version="1.0" encoding="UTF-8"?>
<xml>
  <ToUserName><![CDATA[${toUser}]]></ToUserName>
  <FromUserName><![CDATA[${fromApp}]]></FromUserName>
  <CreateTime>${now}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${text}]]></Content>
</xml>`;
}

export async function GET(request: NextRequest) {
  const token = process.env.WECOM_CALLBACK_TOKEN?.trim();
  if (!token) return failure(5000, '缺少 WECOM_CALLBACK_TOKEN', 500);

  const { searchParams } = new URL(request.url);
  const msgSignature = searchParams.get('msg_signature') || searchParams.get('signature') || '';
  const timestamp = searchParams.get('timestamp') || '';
  const nonce = searchParams.get('nonce') || '';
  const echostr = searchParams.get('echostr') || '';

  if (!msgSignature || !timestamp || !nonce || !echostr) {
    return failure(1004, '参数错误', 400);
  }
  if (!verifySignature(token, timestamp, nonce, msgSignature)) {
    return failure(1002, 'Forbidden', 403);
  }
  return new Response(echostr, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(request: NextRequest) {
  const token = process.env.WECOM_CALLBACK_TOKEN?.trim();
  if (!token) return failure(5000, '缺少 WECOM_CALLBACK_TOKEN', 500);

  const { searchParams } = new URL(request.url);
  const msgSignature = searchParams.get('msg_signature') || searchParams.get('signature') || '';
  const timestamp = searchParams.get('timestamp') || '';
  const nonce = searchParams.get('nonce') || '';
  if (!msgSignature || !timestamp || !nonce) {
    return failure(1004, '参数错误', 400);
  }
  if (!verifySignature(token, timestamp, nonce, msgSignature)) {
    return failure(1002, 'Forbidden', 403);
  }

  const xml = await request.text();
  const msgType = xmlGet(xml, 'MsgType');
  const fromUser = xmlGet(xml, 'FromUserName'); // 企业微信 userid
  const toUser = xmlGet(xml, 'ToUserName'); // 应用 id
  const content = xmlGet(xml, 'Content');

  // 只处理文本消息
  if (msgType !== 'text' || !fromUser) {
    return new Response('success', { status: 200 });
  }

  const parsed = parseReminderFromText(content);
  if (!parsed) {
    const out = replyText(fromUser, toUser, '格式示例：\n- 明天提醒我续签合同\n- 2026-04-23 10:00 提醒我提交预算\n未写时间默认 00:00 发送');
    return new Response(out, { status: 200, headers: { 'Content-Type': 'application/xml' } });
  }

  const u = await db
    .select({ id: users.id, username: users.username, name: users.name })
    .from(users)
    .where(eq(users.wecomUserid, fromUser))
    .limit(1)
    .get();

  if (!u) {
    const out = replyText(fromUser, toUser, '未找到对应系统用户。请管理员在【用户管理】里为该账号填写企业微信 userid。');
    return new Response(out, { status: 200, headers: { 'Content-Type': 'application/xml' } });
  }

  const title = parsed.content.length > 40 ? `${parsed.content.slice(0, 40)}…` : parsed.content;
  const remindDate = parsed.remindDate;
  const remindTime = parsed.remindTime; // default 00:00

  await db.insert(reminders).values({
    title,
    description: parsed.content,
    creatorId: u.id,
    remindDate,
    remindTime,
    recipients: JSON.stringify([u.username]),
    relatedContractId: null,
    status: '待发送',
  });

  const out = replyText(
    fromUser,
    toUser,
    `已创建提醒：${parsed.content}\n时间：${remindDate.toLocaleDateString('zh-CN')} ${remindTime}\n将按时推送给你本人。`,
  );
  return new Response(out, { status: 200, headers: { 'Content-Type': 'application/xml' } });
}

