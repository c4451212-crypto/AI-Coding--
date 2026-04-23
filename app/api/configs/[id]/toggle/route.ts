import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, configEnums } from '@/lib/db/schema';

const bodySchema = z.object({ isActive: z.boolean() });

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
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const existing = await db.select().from(configEnums).where(eq(configEnums.id, id)).limit(1).get();
  if (!existing) return failure(1003, '枚举不存在', 404);

  db.transaction((tx) => {
    tx.update(configEnums)
      .set({ isActive: parsed.data.isActive })
      .where(eq(configEnums.id, id));
    tx.insert(auditLogs).values({
      userId: user.sub,
      action: 'TOGGLE_ENUM',
      targetType: 'config_enum',
      targetId: id,
      details: JSON.stringify({
        category: existing.category,
        code: existing.code,
        isActive: parsed.data.isActive,
      }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  });

  return success({ updated: true });
}

