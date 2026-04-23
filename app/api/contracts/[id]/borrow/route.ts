import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, contracts } from '@/lib/db/schema';
import { canViewCompany } from '@/lib/utils/contract-access';

const schema = z.object({
  borrower: z.string().min(1),
  expectedReturnDate: z.string().min(1),
});

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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return failure(1004, '缺少必填字段', 400);

  const body = parsed.data;
  const expected = new Date(body.expectedReturnDate);
  if (Number.isNaN(expected.getTime())) {
    return failure(1004, '预计归还日期无效', 400);
  }

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

  if (contract.returnStatus !== '在库') {
    return failure(1005, `当前状态：${contract.returnStatus}，无法借出`, 409);
  }

  db.transaction((tx) => {
    tx.update(contracts)
      .set({
        borrower: body.borrower,
        borrowDate: new Date(),
        expectedReturnDate: expected,
        returnStatus: '已借出',
        updatedAt: new Date(),
      })
      .where(and(eq(contracts.id, contractId), eq(contracts.returnStatus, '在库')));

    tx.insert(auditLogs).values({
      userId: user.sub,
      action: 'BORROW_PAPER',
      targetType: 'contract',
      targetId: contractId,
      details: JSON.stringify({
        borrower: body.borrower,
        expectedReturn: body.expectedReturnDate,
      }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  });

  return success({ status: '已借出' });
}

