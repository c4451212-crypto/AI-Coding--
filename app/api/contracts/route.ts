import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
} from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { alias } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { failure, success, successWithPagination } from '@/lib/api-response';
import { auth, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  auditLogs,
  companies,
  configEnums,
  contracts,
  paymentSchedules,
  users,
} from '@/lib/db/schema';
import {
  canEditContractForCompany,
  canViewCompany,
} from '@/lib/utils/contract-access';
import { generateContractNo } from '@/lib/utils/contract-no';

const sortable = {
  sign_date: contracts.signDate,
  end_date: contracts.endDate,
  created_at: contracts.createdAt,
  contract_no: contracts.contractNo,
  title: contracts.title,
  total_amount: contracts.totalAmount,
  status: contracts.status,
} as const;

const paymentScheduleSchema = z.object({
  nodeName: z.string().min(1),
  percentage: z.union([z.number(), z.string()]).optional().nullable(),
  amount: z.union([z.number(), z.string()]),
  dueDate: z.string().min(1),
});

const createSchema = z.object({
  title: z.string().min(1),
  companyId: z.number().int(),
  contractType: z.string().min(1),
  endDate: z.string().min(1),
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
  paymentSchedules: z.array(paymentScheduleSchema).optional(),
});

function escapeLike(value: string) {
  return value.replaceAll('%', '\\%').replaceAll('_', '\\_');
}

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') || '30', 10) || 30),
  );
  const companyId = searchParams.get('company_id');
  const contractType = searchParams.get('contract_type');
  const status = searchParams.get('status');
  const sortField = searchParams.get('sort') || 'sign_date';
  const sortOrder = (searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const keyword = searchParams.get('keyword')?.trim();
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const conditions = [];

  if (user.role !== 'admin') {
    const ids = user.permissions.viewCompanyIds ?? [];
    if (ids.length === 0) {
      return successWithPagination([], {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
      });
    }
    conditions.push(inArray(contracts.companyId, ids));
  }

  if (companyId) {
    const id = parseInt(companyId, 10);
    if (!Number.isNaN(id)) conditions.push(eq(contracts.companyId, id));
  }
  if (contractType) conditions.push(eq(contracts.contractType, contractType));
  if (status) conditions.push(eq(contracts.status, status));

  if (dateFrom) {
    const t = new Date(`${dateFrom}T00:00:00.000`).getTime();
    if (!Number.isNaN(t)) {
      conditions.push(sql`(${contracts.signDate} IS NOT NULL AND ${contracts.signDate} >= ${t})`);
    }
  }
  if (dateTo) {
    const t = new Date(`${dateTo}T23:59:59.999`).getTime();
    if (!Number.isNaN(t)) {
      conditions.push(sql`(${contracts.signDate} IS NOT NULL AND ${contracts.signDate} <= ${t})`);
    }
  }

  if (keyword && keyword.length >= 2) {
    const kw = `%${escapeLike(keyword)}%`;
    conditions.push(
      or(
        like(contracts.contractNo, kw),
        like(contracts.title, kw),
        like(contracts.partyCompany, kw),
        like(contracts.partyPerson, kw),
        like(contracts.partyContact, kw),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderCol =
    sortable[sortField as keyof typeof sortable] ?? contracts.signDate;
  const orderBy = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);

  const offset = (page - 1) * pageSize;

  const holder = alias(users, 'contract_holder');
  const primary = alias(users, 'contract_primary');

  const rows = await db
    .select({
      id: contracts.id,
      contractNo: contracts.contractNo,
      title: contracts.title,
      companyId: contracts.companyId,
      companyShortName: companies.shortName,
      contractType: contracts.contractType,
      contractTypeName: configEnums.name,
      totalAmount: contracts.totalAmount,
      signDate: contracts.signDate,
      endDate: contracts.endDate,
      status: contracts.status,
      primaryHandler: contracts.primaryHandler,
      primaryHandlerName: primary.name,
      partyCompany: contracts.partyCompany,
      currentHolder: contracts.currentHolder,
      holderName: holder.name,
      storageLocation: contracts.storageLocation,
      returnStatus: contracts.returnStatus,
      scanFilePath: contracts.scanFilePath,
      createdAt: contracts.createdAt,
    })
    .from(contracts)
    .leftJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(
      configEnums,
      and(
        eq(configEnums.category, 'contract_type'),
        eq(configEnums.code, contracts.contractType),
        eq(configEnums.isActive, true),
      ),
    )
    .leftJoin(holder, eq(contracts.currentHolder, holder.username))
    .leftJoin(primary, eq(contracts.primaryHandler, primary.username))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  const countRows = await db
    .select({ total: count() })
    .from(contracts)
    .where(whereClause);
  const total = countRows[0]?.total ?? 0;

  const totalNum = Number(total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalNum / pageSize));

  return successWithPagination(rows, {
    page,
    pageSize,
    total: totalNum,
    totalPages: totalNum === 0 ? 0 : totalPages,
  });
}

export async function POST(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (!checkPermission(user, 'canEditContracts') && user.role !== 'admin') {
    return failure(1002, 'Forbidden', 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return failure(1004, '参数错误', 400);
  }

  const body = parsed.data;

  if (!canEditContractForCompany(user, body.companyId)) {
    return failure(1002, 'Forbidden', 403);
  }

  const companyRows = await db
    .select()
    .from(companies)
    .where(eq(companies.id, body.companyId))
    .limit(1);
  const company = companyRows[0];
  if (!company) return failure(1004, '公司不存在', 400);

  const contractNo = await generateContractNo(db, company.shortName, body.contractType);

  const totalAmountYuan = body.totalAmount;
  const totalAmountCents =
    totalAmountYuan === null || totalAmountYuan === undefined || totalAmountYuan === ''
      ? 0
      : Math.round(Number(totalAmountYuan) * 100);

  const endDate = new Date(body.endDate);
  if (Number.isNaN(endDate.getTime())) {
    return failure(1004, '到期日无效', 400);
  }

  const signDate = body.signDate ? new Date(body.signDate) : null;
  if (body.signDate && signDate && Number.isNaN(signDate.getTime())) {
    return failure(1004, '签订日期无效', 400);
  }

  const primaryHandler = body.primaryHandler ?? user.username;
  const currentHolder = body.currentHolder ?? user.username;

  try {
    const created = db.transaction((tx) => {
      const row = tx
        .insert(contracts)
        .values({
          contractNo,
          companyId: body.companyId,
          title: body.title,
          contractType: body.contractType,
          subject: body.subject ?? null,
          partyRole: body.partyRole ?? null,
          partyCompany: body.partyCompany ?? null,
          partyPerson: body.partyPerson ?? null,
          partyContact: body.partyContact ?? null,
          signDate: signDate && !Number.isNaN(signDate.getTime()) ? signDate : null,
          endDate,
          totalAmount: totalAmountCents,
          currency: body.currency ?? 'CNY',
          primaryHandler,
          currentHolder,
          status: '草稿',
          storageLocation: body.storageLocation ?? null,
        })
        .returning()
        .get();
      if (!row) throw new Error('create failed');

      if (body.paymentSchedules?.length) {
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
            contractId: row.id,
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

      tx.insert(auditLogs).values({
        userId: user.sub,
        action: 'CREATE_CONTRACT',
        targetType: 'contract',
        targetId: row.id,
        details: JSON.stringify({ contractNo: row.contractNo, title: body.title }),
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });

      return row;
    });

    return success(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('付款节点')) return failure(1004, msg, 400);
    if (msg.toLowerCase().includes('unique')) {
      return failure(1005, '合同编号冲突，请重试', 409);
    }
    return failure(5000, '服务器内部错误', 500);
  }
}
