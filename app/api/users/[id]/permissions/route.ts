import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { permissions } from '@/lib/db/schema';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const operator = await auth(request);
  if (!operator) return failure(1001, 'Unauthorized', 401);
  if (operator.role !== 'admin') return failure(1002, 'Forbidden', 403);

  const id = parseInt(context.params.id, 10);
  if (Number.isNaN(id)) return failure(1004, '参数错误', 400);

  const row = await db
    .select()
    .from(permissions)
    .where(eq(permissions.userId, id))
    .limit(1)
    .get();

  if (!row) return failure(1003, '权限不存在', 404);

  return success({
    viewCompanyIds: row.viewCompanyIds ? (JSON.parse(row.viewCompanyIds) as number[]) : [],
    allowedPages: row.allowedPages ? (JSON.parse(row.allowedPages) as string[]) : [],
    canEditContracts: !!row.canEditContracts,
    canDeleteContracts: !!row.canDeleteContracts,
    canManageUsers: !!row.canManageUsers,
    canBorrowPaper: !!row.canBorrowPaper,
  });
}

