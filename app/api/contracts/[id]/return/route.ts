import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, contracts } from '@/lib/db/schema';
import { canViewCompany } from '@/lib/utils/contract-access';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (!checkPermission(user, 'canBorrowPaper') && user.role !== 'admin') {
    return failure(1002, 'Forbidden', 403);
  }

  const contractId = parseInt(context.params.id, 10);
  if (Number.isNaN(contractId)) return failure(1004, '参数错误', 400);

  const contract = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1)
    .get();
  if (!contract) return failure(1003, '合同不存在', 404);

  if (!canViewCompany(user, contract.companyId)) {
    return failure(1002, 'Forbidden', 403);
  }

  if (contract.returnStatus !== '已借出') {
    return failure(1005, `当前状态：${contract.returnStatus}`, 409);
  }

  const now = new Date();
  const expected = contract.expectedReturnDate
    ? (contract.expectedReturnDate as unknown as Date)
    : null;
  const isOverdue = expected ? now.getTime() > new Date(expected).getTime() : false;
  const nextStatus = isOverdue ? '逾期' : '在库';

  db.transaction((tx) => {
    tx.update(contracts)
      .set({
        returnStatus: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    tx.insert(auditLogs).values({
      userId: user.sub,
      action: 'RETURN_PAPER',
      targetType: 'contract',
      targetId: contractId,
      details: JSON.stringify({
        previousBorrower: contract.borrower,
        isOverdue,
        expectedReturn: contract.expectedReturnDate ?? null,
      }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  });

  return success({ status: nextStatus, isOverdue });
}

