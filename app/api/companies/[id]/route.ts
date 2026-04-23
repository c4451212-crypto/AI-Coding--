import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, companies } from '@/lib/db/schema';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  shortName: z.string().min(1).optional(),
  type: z.enum(['母公司', '子公司', '项目公司']).optional(),
  creditCode: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  const id = parseInt(context.params.id, 10);
  if (Number.isNaN(id)) return failure(1004, '参数错误', 400);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) return failure(1004, '无更新字段', 400);

  const existing = await db.select().from(companies).where(eq(companies.id, id)).limit(1).get();
  if (!existing) return failure(1003, '公司不存在', 404);

  try {
    db.transaction((tx) => {
      tx.update(companies).set(patch).where(eq(companies.id, id));
      tx.insert(auditLogs).values({
        userId: user.sub,
        action: 'UPDATE_COMPANY',
        targetType: 'company',
        targetId: id,
        details: JSON.stringify({ before: existing, patch }),
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });
    });
    const refreshed = await db.select().from(companies).where(eq(companies.id, id)).limit(1).get();
    return success(refreshed);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes('unique')) {
      return failure(1005, '公司简称已存在', 409);
    }
    return failure(5000, '服务器内部错误', 500);
  }
}

