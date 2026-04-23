import { eq, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { configEnums, contracts } from '@/lib/db/schema';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  const id = parseInt(context.params.id, 10);
  if (Number.isNaN(id)) return failure(1004, '参数错误', 400);

  const item = await db.select().from(configEnums).where(eq(configEnums.id, id)).limit(1).get();
  if (!item) return failure(1003, '枚举不存在', 404);

  // 目前仅对 contracts.contractType 做引用计数（后续可扩展）
  let count = 0;
  if (item.category === 'contract_type') {
    const rows = await db
      .select({ total: sql<number>`count(*)` })
      .from(contracts)
      .where(eq(contracts.contractType, item.code));
    count = Number(rows[0]?.total ?? 0);
  }

  return success({ count });
}

