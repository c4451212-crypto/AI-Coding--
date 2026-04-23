import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { wecomGroupWebhooks, type WecomGroupWebhookPurpose } from '@/lib/db/schema';

export async function getGroupWebhookConfig(
  purpose: WecomGroupWebhookPurpose,
  companyId?: number | null,
) {
  const cid = typeof companyId === 'number' && Number.isFinite(companyId) ? companyId : 0;

  const scoped = await db
    .select()
    .from(wecomGroupWebhooks)
    .where(
      and(
        eq(wecomGroupWebhooks.purposeKey, purpose),
        eq(wecomGroupWebhooks.companyId, cid),
        eq(wecomGroupWebhooks.isActive, true),
      ),
    )
    .limit(1)
    .get();

  const row =
    scoped ||
    (cid !== 0
      ? await db
          .select()
          .from(wecomGroupWebhooks)
          .where(
            and(
              eq(wecomGroupWebhooks.purposeKey, purpose),
              eq(wecomGroupWebhooks.companyId, 0),
              eq(wecomGroupWebhooks.isActive, true),
            ),
          )
          .limit(1)
          .get()
      : undefined);

  const url = row?.webhookUrl?.trim() || '';
  return {
    webhookUrl: url,
    mentionAllDefault: !!row?.mentionAllDefault,
    matchedCompanyId: row?.companyId ?? null,
  };
}

export function envWebhookFallback(name: WecomGroupWebhookPurpose) {
  const key = `WECOM_BOT_WEBHOOK_${name}` as const;
  return process.env[key]?.trim() || '';
}

export async function resolveGroupWebhookUrl(
  purpose: WecomGroupWebhookPurpose,
  companyId?: number | null,
) {
  const cfg = await getGroupWebhookConfig(purpose, companyId);
  if (cfg.webhookUrl) return cfg.webhookUrl;
  return envWebhookFallback(purpose);
}
