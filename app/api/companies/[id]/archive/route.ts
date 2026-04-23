import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, companies } from '@/lib/db/schema';

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  const id = parseInt(context.params.id, 10);
  if (Number.isNaN(id)) return failure(1004, '参数错误', 400);

  const existing = await db.select().from(companies).where(eq(companies.id, id)).limit(1).get();
  if (!existing) return failure(1003, '公司不存在', 404);

  db.transaction((tx) => {
    tx.update(companies)
      .set({ isActive: false })
      .where(and(eq(companies.id, id), eq(companies.isActive, true)));

    tx.insert(auditLogs).values({
      userId: user.sub,
      action: 'ARCHIVE_COMPANY',
      targetType: 'company',
      targetId: id,
      details: JSON.stringify({ name: existing.name, shortName: existing.shortName }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  });

  return success({ archived: true });
}

