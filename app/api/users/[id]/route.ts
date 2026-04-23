import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, permissions, users } from '@/lib/db/schema';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'archivist', 'manager', 'finance', 'hr', 'viewer']).optional(),
  wecomUserid: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
  viewCompanyIds: z.array(z.number().int()).optional(),
  allowedPages: z.array(z.string()).optional(),
  canEditContracts: z.boolean().optional(),
  canDeleteContracts: z.boolean().optional(),
  canManageUsers: z.boolean().optional(),
  canBorrowPaper: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const operator = await auth(request);
  if (!operator) return failure(1001, 'Unauthorized', 401);
  if (operator.role !== 'admin') return failure(1002, 'Forbidden', 403);

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

  const body = parsed.data;

  const existingUser = await db.select().from(users).where(eq(users.id, id)).limit(1).get();
  if (!existingUser) return failure(1003, '用户不存在', 404);

  const existingPerm = await db
    .select()
    .from(permissions)
    .where(eq(permissions.userId, id))
    .limit(1)
    .get();
  if (!existingPerm) return failure(1003, '权限不存在', 404);

  const userPatch: Partial<typeof users.$inferInsert> = {};
  if (body.name !== undefined) userPatch.name = body.name;
  if (body.role !== undefined) userPatch.role = body.role;
  if (body.wecomUserid !== undefined) userPatch.wecomUserid = body.wecomUserid ?? null;
  if (body.isActive !== undefined) userPatch.isActive = body.isActive;
  if (body.password) {
    userPatch.passwordHash = bcrypt.hashSync(body.password, 10);
  }

  const permPatch: Partial<typeof permissions.$inferInsert> = {};
  if (body.viewCompanyIds !== undefined) permPatch.viewCompanyIds = JSON.stringify(body.viewCompanyIds);
  if (body.allowedPages !== undefined) permPatch.allowedPages = JSON.stringify(body.allowedPages);
  if (body.canEditContracts !== undefined) permPatch.canEditContracts = body.canEditContracts;
  if (body.canDeleteContracts !== undefined) permPatch.canDeleteContracts = body.canDeleteContracts;
  if (body.canManageUsers !== undefined) permPatch.canManageUsers = body.canManageUsers;
  if (body.canBorrowPaper !== undefined) permPatch.canBorrowPaper = body.canBorrowPaper;

  if (Object.keys(userPatch).length === 0 && Object.keys(permPatch).length === 0) {
    return failure(1004, '无更新字段', 400);
  }

  db.transaction((tx) => {
    if (Object.keys(userPatch).length) {
      tx.update(users).set(userPatch).where(eq(users.id, id));
    }
    if (Object.keys(permPatch).length) {
      tx.update(permissions).set(permPatch).where(eq(permissions.userId, id));
    }
    tx.insert(auditLogs).values({
      userId: operator.sub,
      action: 'UPDATE_USER',
      targetType: 'user',
      targetId: id,
      details: JSON.stringify({
        userPatch,
        permPatch,
      }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  });

  const refreshed = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      wecomUserid: users.wecomUserid,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .get();

  return success(refreshed);
}

