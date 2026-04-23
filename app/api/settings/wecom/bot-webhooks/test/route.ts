import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { sendGroupMarkdown } from '@/lib/wecom/bot';
import { resolveGroupWebhookUrl } from '@/lib/wecom/group-webhooks';
import { wecomGroupWebhookPurposeEnum } from '@/lib/db/schema';

const bodySchema = z.object({
  companyId: z.number().int().min(0).optional(),
  purposeKey: z.enum(wecomGroupWebhookPurposeEnum),
  mentionAll: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const companyId = parsed.data.companyId ?? 0;
  const webhook = await resolveGroupWebhookUrl(parsed.data.purposeKey, companyId);
  if (!webhook) return failure(1004, '未配置 Webhook（后台保存或环境变量回退）', 400);

  const md = [
    `**Webhook 测试**（company=${companyId} / ${parsed.data.purposeKey}）`,
    `> 操作人：${user.name}（${user.username}）`,
    `> 时间：${new Date().toLocaleString('zh-CN')}`,
  ].join('\n');

  const r = await sendGroupMarkdown(webhook, md, { mentionAll: !!parsed.data.mentionAll });
  if (!r.ok) return failure(5000, r.message || '发送失败', 502);
  return success({ ok: true });
}
