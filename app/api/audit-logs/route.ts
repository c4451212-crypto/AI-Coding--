import { and, desc, eq, gte } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin' && user.role !== 'archivist') {
    return failure(1002, 'Forbidden', 403);
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action')?.trim() || '';
  const targetType = searchParams.get('targetType')?.trim() || '';
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '7', 10) || 7));

  const start = new Date();
  start.setDate(start.getDate() - days);

  const cond = [gte(auditLogs.createdAt, start)];
  if (action) cond.push(eq(auditLogs.action, action));
  if (targetType) cond.push(eq(auditLogs.targetType, targetType));

  const rows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      userName: users.name,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(...cond))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1000);

  return success(rows);
}

