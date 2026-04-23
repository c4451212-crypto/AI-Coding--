import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { wecom } from '@/lib/wecom';
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

/** 管理员校验企业微信 Token（用于环境配置验收） */
export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  try {
    const r = await wecom.tryGetAccessToken();
    if (!r) {
      return success({ configured: false, message: '未配置 WECOM_* 环境变量' });
    }
    try {
      await db.insert(auditLogs).values({
        userId: user.sub,
        action: 'WECOM_TOKEN_CHECK',
        targetType: 'wecom',
        targetId: null,
        details: JSON.stringify({ ok: true }),
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });
    } catch {
      // ignore
    }
    return success({
      configured: true,
      expiresInSec: r.expiresInSec,
      tokenPreview: `${r.token.slice(0, 10)}…`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await db.insert(auditLogs).values({
        userId: user.sub,
        action: 'WECOM_TOKEN_CHECK',
        targetType: 'wecom',
        targetId: null,
        details: JSON.stringify({ ok: false, error: msg }),
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });
    } catch {
      // ignore
    }
    return failure(5000, msg, 500);
  }
}
