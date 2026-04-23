import { desc } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, permissions, users } from '@/lib/db/schema';

const createSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z
    .enum(['admin', 'archivist', 'manager', 'finance', 'hr', 'viewer'])
    .optional(),
  wecomUserid: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') {
    return failure(1002, 'Forbidden', 403);
  }

  const rows = await db
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
    .orderBy(desc(users.createdAt));

  return success(rows);
}

export async function POST(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') {
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
  const passwordHash = bcrypt.hashSync(body.password, 10);

  try {
    const inserted = await db
      .insert(users)
      .values({
        username: body.username,
        passwordHash,
        name: body.name,
        role: body.role ?? 'viewer',
        wecomUserid: body.wecomUserid ?? null,
      })
      .returning({
        id: users.id,
        username: users.username,
        name: users.name,
        wecomUserid: users.wecomUserid,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    const created = inserted[0];
    if (!created) {
      return failure(1005, '创建用户失败', 409);
    }

    await db.insert(permissions).values({
      userId: created.id,
      viewCompanyIds: JSON.stringify([]),
      allowedPages: JSON.stringify(['/']),
      canEditContracts: false,
      canDeleteContracts: false,
      canManageUsers: false,
      canBorrowPaper: false,
    });

    try {
      await db.insert(auditLogs).values({
        userId: user.sub,
        action: 'CREATE_USER',
        targetType: 'user',
        targetId: created.id,
        details: JSON.stringify({ username: created.username, role: created.role }),
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      });
    } catch {
      // ignore
    }

    return success(created, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes('unique')) {
      return failure(1005, '用户名已存在', 409);
    }
    return failure(5000, '服务器内部错误', 500);
  }
}
