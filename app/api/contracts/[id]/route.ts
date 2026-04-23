import { and, asc, desc, eq } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  auditLogs,
  companies,
  contracts,
  paymentSchedules,
} from '@/lib/db/schema';
import {
  canDeleteContracts,
  canEditContractForCompany,
  canViewCompany,
} from '@/lib/utils/contract-access';

const paymentScheduleSchema = z.object({
  nodeName: z.string().min(1),
  percentage: z.union([z.number(), z.string()]).optional().nullable(),
  amount: z.union([z.number(), z.string()]),
  dueDate: z.string().min(1),
});

const updateSchema = z.object({
  title: z.string().optional(),
  companyId: z.number().int().optional(),
  contractType: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  subject: z.string().optional().nullable(),
  partyRole: z.string().optional().nullable(),
  partyCompany: z.string().optional().nullable(),
  partyPerson: z.string().optional().nullable(),
  partyContact: z.string().optional().nullable(),
  signDate: z.string().optional().nullable(),
  totalAmount: z.union([z.number(), z.string()]).optional().nullable(),
  currency: z.string().optional().nullable(),
  primaryHandler: z.string().optional().nullable(),
  currentHolder: z.string().optional().nullable(),
  storageLocation: z.string().optional().nullable(),
  status: z.string().optional(),
  returnStatus: z.string().optional(),
  paymentSchedules: z.array(paymentScheduleSchema).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const contractId = parseInt(context.params.id, 10);
  if (Number.isNaN(contractId)) return failure(1004, '参数错误', 400);

  const rows = await db
    .select({
      contract: contracts,
      company: companies,
    })
    .from(contracts)
    .leftJoin(companies, eq(contracts.companyId, companies.id))
    .where(eq(contracts.id, contractId))
    .limit(1);

  const row = rows[0];
  if (!row) return failure(1003, '合同不存在', 404);

  if (!canViewCompany(user, row.contract.companyId)) {
    return failure(1002, 'Forbidden', 403);
  }

  const payments = await db
    .select()
    .from(paymentSchedules)
    .where(eq(paymentSchedules.contractId, contractId))
    .orderBy(asc(paymentSchedules.sequence));

  const logs = await db
    .select()
    .from(auditLogs)
    .where(
      and(eq(auditLogs.targetType, 'contract'), eq(auditLogs.targetId, contractId)),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  return success({
    contract: row.contract,
    company: row.company,
    paymentSchedules: payments,
    auditLogs: logs,
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (!checkPermission(user, 'canEditContracts') && user.role !== 'admin') {
    return failure(1002, 'Forbidden', 403);
  }

  const contractId = parseInt(context.params.id, 10);
  if (Number.isNaN(contractId)) return failure(1004, '参数错误', 400);

  const existingRows = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return failure(1003, '合同不存在', 404);

  if (!canViewCompany(user, existing.companyId)) {
    return failure(1002, 'Forbidden', 403);
  }
  if (!canEditContractForCompany(user, existing.companyId)) {
    return failure(1002, 'Forbidden', 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const body = parsed.data;
  const nextCompanyId = body.companyId ?? existing.companyId;
  if (!canViewCompany(user, nextCompanyId)) {
    return failure(1002, 'Forbidden', 403);
  }
  if (!canEditContractForCompany(user, nextCompanyId)) {
    return failure(1002, 'Forbidden', 403);
  }

  const patch: Partial<InferInsertModel<typeof contracts>> = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) patch.title = body.title;
  if (body.companyId !== undefined) patch.companyId = body.companyId;
  if (body.contractType !== undefined) patch.contractType = body.contractType;
  if (body.subject !== undefined) patch.subject = body.subject;
  if (body.partyRole !== undefined) patch.partyRole = body.partyRole;
  if (body.partyCompany !== undefined) patch.partyCompany = body.partyCompany;
  if (body.partyPerson !== undefined) patch.partyPerson = body.partyPerson;
  if (body.partyContact !== undefined) patch.partyContact = body.partyContact;
  if (body.currency !== undefined) patch.currency = body.currency ?? 'CNY';
  if (body.primaryHandler !== undefined) patch.primaryHandler = body.primaryHandler;
  if (body.currentHolder !== undefined) patch.currentHolder = body.currentHolder;
  if (body.storageLocation !== undefined) patch.storageLocation = body.storageLocation;
  if (body.status !== undefined) patch.status = body.status;
  if (body.returnStatus !== undefined) patch.returnStatus = body.returnStatus;

  if (body.endDate !== undefined) {
    const d = new Date(body.endDate);
    if (Number.isNaN(d.getTime())) return failure(1004, '到期日无效', 400);
    patch.endDate = d;
  }

  if (body.signDate !== undefined) {
    if (body.signDate === null || body.signDate === '') {
      patch.signDate = null;
    } else {
      const d = new Date(body.signDate);
      if (Number.isNaN(d.getTime())) return failure(1004, '签订日期无效', 400);
      patch.signDate = d;
    }
  }

  if (body.totalAmount !== undefined) {
    if (body.totalAmount === null || body.totalAmount === '') {
      patch.totalAmount = 0;
    } else {
      patch.totalAmount = Math.round(Number(body.totalAmount) * 100);
    }
  }

  try {
    const updatedRow = db.transaction((tx) => {
      tx.update(contracts).set(patch).where(eq(contracts.id, contractId));

      if (body.paymentSchedules) {
        tx.delete(paymentSchedules).where(eq(paymentSchedules.contractId, contractId));
        if (body.paymentSchedules.length > 0) {
          const schedules = body.paymentSchedules.map((s, index) => {
            const pct =
              s.percentage === null ||
              s.percentage === undefined ||
              s.percentage === ''
                ? null
                : Math.round(Number(s.percentage) * 100);
            const amt = Math.round(Number(s.amount) * 100);
            const due = new Date(s.dueDate);
            if (Number.isNaN(due.getTime())) {
              throw new Error(`付款节点 ${index + 1} 的到期日无效`);
            }
            return {
              contractId,
              sequence: index + 1,
              nodeName: s.nodeName,
              percentage: pct,
              amount: amt,
              dueDate: due,
              status: '待预算' as const,
            };
          });
          tx.insert(paymentSchedules).values(schedules);
        }
      }

      tx.insert(auditLogs).values({
        userId: user.sub,
        action: 'UPDATE_CONTRACT',
        targetType: 'contract',
        targetId: contractId,
        details: JSON.stringify({ fields: Object.keys(body) }),
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });

      const refreshed = tx
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .limit(1)
        .get();
      return refreshed;
    });

    return success(updatedRow);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('付款节点')) return failure(1004, msg, 400);
    return failure(5000, '服务器内部错误', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (!canDeleteContracts(user)) return failure(1002, 'Forbidden', 403);

  const contractId = parseInt(context.params.id, 10);
  if (Number.isNaN(contractId)) return failure(1004, '参数错误', 400);

  const existingRows = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return failure(1003, '合同不存在', 404);

  if (!canViewCompany(user, existing.companyId)) {
    return failure(1002, 'Forbidden', 403);
  }

  db.transaction((tx) => {
    tx.insert(auditLogs).values({
      userId: user.sub,
      action: 'DELETE_CONTRACT',
      targetType: 'contract',
      targetId: contractId,
      details: JSON.stringify({ contractNo: existing.contractNo }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
    tx.delete(contracts).where(eq(contracts.id, contractId));
  });

  return success({ deleted: true });
}
