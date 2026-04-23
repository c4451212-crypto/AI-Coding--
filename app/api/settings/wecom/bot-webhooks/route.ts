import { and, asc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  auditLogs,
  companies,
  wecomGroupWebhookPurposeEnum,
  wecomGroupWebhooks,
} from '@/lib/db/schema';

function normalizeWebhookInput(raw: string) {
  const s = raw.trim();
  if (!s) return '';
  if (s.startsWith('http')) return s;
  const key = s.includes('key=') ? s.split('key=').pop() : s;
  return `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(key || '')}`;
}

function maskWebhook(url: string) {
  const s = url.trim();
  if (!s) return { has: false, preview: '' as string };
  if (s.length <= 16) return { has: true, preview: `${s.slice(0, 6)}…${s.slice(-4)}` };
  return { has: true, preview: `${s.slice(0, 10)}…${s.slice(-6)}` };
}

const postSchema = z.object({
  companyId: z.number().int().min(0),
  purposeKey: z.enum(wecomGroupWebhookPurposeEnum),
  displayName: z.string().min(1),
  webhookUrl: z.string().min(1),
  isActive: z.boolean().optional(),
  mentionAllDefault: z.boolean().optional(),
});

const patchSchema = z.object({
  items: z
    .array(
      z
        .object({
          id: z.number().int().positive().optional(),
          companyId: z.number().int().min(0).optional(),
          purposeKey: z.enum(wecomGroupWebhookPurposeEnum).optional(),
          displayName: z.string().min(1).optional(),
          webhookUrl: z.string().optional().nullable(),
          isActive: z.boolean().optional(),
          mentionAllDefault: z.boolean().optional(),
        })
        .refine((v) => !!v.id || (v.companyId !== undefined && !!v.purposeKey), {
          message: '必须提供 id，或同时提供 companyId + purposeKey',
        }),
    )
    .min(1),
});

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  const rows = await db
    .select({
      id: wecomGroupWebhooks.id,
      companyId: wecomGroupWebhooks.companyId,
      companyShortName: companies.shortName,
      purposeKey: wecomGroupWebhooks.purposeKey,
      displayName: wecomGroupWebhooks.displayName,
      isActive: wecomGroupWebhooks.isActive,
      mentionAllDefault: wecomGroupWebhooks.mentionAllDefault,
      webhookUrl: wecomGroupWebhooks.webhookUrl,
    })
    .from(wecomGroupWebhooks)
    .leftJoin(companies, eq(wecomGroupWebhooks.companyId, companies.id))
    .orderBy(asc(wecomGroupWebhooks.companyId), asc(wecomGroupWebhooks.purposeKey));

  return success(
    rows.map((r) => {
      const m = maskWebhook(r.webhookUrl || '');
      return {
        id: r.id,
        companyId: r.companyId,
        companyShortName: r.companyId === 0 ? '全局默认' : r.companyShortName || `公司#${r.companyId}`,
        purposeKey: r.purposeKey,
        displayName: r.displayName,
        isActive: !!r.isActive,
        mentionAllDefault: !!r.mentionAllDefault,
        hasWebhook: m.has,
        webhookPreview: m.preview,
      };
    }),
  );
}

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
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  if (parsed.data.companyId !== 0) {
    const c = await db.select().from(companies).where(eq(companies.id, parsed.data.companyId)).limit(1).get();
    if (!c) return failure(1003, '公司不存在', 404);
  }

  const normalized = normalizeWebhookInput(parsed.data.webhookUrl);
  if (!normalized.startsWith('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
    return failure(1004, 'Webhook 格式不正确：应为群机器人完整 URL 或 key', 400);
  }

  const dup = await db
    .select({ id: wecomGroupWebhooks.id })
    .from(wecomGroupWebhooks)
    .where(
      and(
        eq(wecomGroupWebhooks.companyId, parsed.data.companyId),
        eq(wecomGroupWebhooks.purposeKey, parsed.data.purposeKey),
      ),
    )
    .limit(1)
    .get();
  if (dup) return failure(1005, '该用途在该公司的映射已存在', 409);

  const now = new Date();
  const inserted = await db
    .insert(wecomGroupWebhooks)
    .values({
      companyId: parsed.data.companyId,
      purposeKey: parsed.data.purposeKey,
      displayName: parsed.data.displayName,
      webhookUrl: normalized,
      isActive: parsed.data.isActive ?? true,
      mentionAllDefault: parsed.data.mentionAllDefault ?? false,
      updatedAt: now,
      updatedBy: user.sub,
    })
    .returning();

  try {
    await db.insert(auditLogs).values({
      userId: user.sub,
      action: 'CREATE_WECOM_GROUP_WEBHOOK',
      targetType: 'wecom',
      targetId: inserted[0]?.id ?? null,
      details: JSON.stringify({
        companyId: parsed.data.companyId,
        purposeKey: parsed.data.purposeKey,
      }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  } catch {
    // ignore
  }

  return success({ id: inserted[0]?.id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const now = new Date();

  for (const it of parsed.data.items) {
    const patch: Partial<typeof wecomGroupWebhooks.$inferInsert> = {
      updatedAt: now,
      updatedBy: user.sub,
    };

    if (it.displayName !== undefined) patch.displayName = it.displayName;
    if (it.isActive !== undefined) patch.isActive = it.isActive;
    if (it.mentionAllDefault !== undefined) patch.mentionAllDefault = it.mentionAllDefault;

    if (it.webhookUrl !== undefined) {
      if (it.webhookUrl === null || it.webhookUrl.trim() === '') {
        patch.webhookUrl = null;
      } else {
        const normalized = normalizeWebhookInput(it.webhookUrl);
        if (!normalized.startsWith('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=')) {
          return failure(1004, 'Webhook 格式不正确：应为群机器人完整 URL 或 key', 400);
        }
        patch.webhookUrl = normalized;
      }
    }

    if (it.id) {
      await db.update(wecomGroupWebhooks).set(patch).where(eq(wecomGroupWebhooks.id, it.id));
      continue;
    }

    if (it.companyId === undefined || !it.purposeKey) {
      return failure(1004, '参数错误', 400);
    }

    if (it.companyId !== 0) {
      const c = await db.select().from(companies).where(eq(companies.id, it.companyId)).limit(1).get();
      if (!c) return failure(1003, '公司不存在', 404);
    }

    await db
      .update(wecomGroupWebhooks)
      .set(patch)
      .where(
        and(eq(wecomGroupWebhooks.companyId, it.companyId), eq(wecomGroupWebhooks.purposeKey, it.purposeKey)),
      );
  }

  try {
    await db.insert(auditLogs).values({
      userId: user.sub,
      action: 'UPDATE_WECOM_GROUP_WEBHOOKS',
      targetType: 'wecom',
      targetId: null,
      details: JSON.stringify({ count: parsed.data.items.length }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  } catch {
    // ignore
  }

  const rows = await db
    .select({
      id: wecomGroupWebhooks.id,
      companyId: wecomGroupWebhooks.companyId,
      companyShortName: companies.shortName,
      purposeKey: wecomGroupWebhooks.purposeKey,
      displayName: wecomGroupWebhooks.displayName,
      isActive: wecomGroupWebhooks.isActive,
      mentionAllDefault: wecomGroupWebhooks.mentionAllDefault,
      webhookUrl: wecomGroupWebhooks.webhookUrl,
    })
    .from(wecomGroupWebhooks)
    .leftJoin(companies, eq(wecomGroupWebhooks.companyId, companies.id))
    .orderBy(asc(wecomGroupWebhooks.companyId), asc(wecomGroupWebhooks.purposeKey));

  return success(
    rows.map((r) => {
      const m = maskWebhook(r.webhookUrl || '');
      return {
        id: r.id,
        companyId: r.companyId,
        companyShortName: r.companyId === 0 ? '全局默认' : r.companyShortName || `公司#${r.companyId}`,
        purposeKey: r.purposeKey,
        displayName: r.displayName,
        isActive: !!r.isActive,
        mentionAllDefault: !!r.mentionAllDefault,
        hasWebhook: m.has,
        webhookPreview: m.preview,
      };
    }),
  );
}
