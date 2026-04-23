import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { getJwtSecret, signAccessToken, type JwtPermissions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureDbReady } from '@/lib/db';
import { auditLogs, permissions, users } from '@/lib/db/schema';

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    ensureDbReady();

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return failure(1004, '参数错误', 400);
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return failure(1004, '参数错误', 400);
    }

    const { username, password } = parsed.data;

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    const user = rows[0];

    if (!user || !user.isActive) {
      return failure(1001, '用户不存在或已禁用（如首次启动请先执行 npm run seed）', 401);
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      return failure(1001, '密码错误', 401);
    }

    const permRows = await db
      .select()
      .from(permissions)
      .where(eq(permissions.userId, user.id))
      .limit(1);
    const perm = permRows[0];

    // 确保 JWT 配置存在（尽早失败）
    getJwtSecret();

    const jwtPermissions: JwtPermissions = {
      viewCompanyIds: perm?.viewCompanyIds
        ? (JSON.parse(perm.viewCompanyIds) as number[])
        : [],
      allowedPages: perm?.allowedPages
        ? (JSON.parse(perm.allowedPages) as string[])
        : [],
      canEditContracts: !!perm?.canEditContracts,
      canDeleteContracts: !!perm?.canDeleteContracts,
      canManageUsers: !!perm?.canManageUsers,
      canBorrowPaper: !!perm?.canBorrowPaper,
    };

    const token = signAccessToken({
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions: jwtPermissions,
    });

    const res = success({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    // 记录登录日志（不影响登录结果）
    try {
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0]?.trim() : null;
      await db.insert(auditLogs).values({
        userId: user.id,
        action: 'LOGIN',
        targetType: 'user',
        targetId: user.id,
        details: JSON.stringify({ username: user.username }),
        ipAddress: ip ?? null,
      });
    } catch {
      // ignore
    }

    res.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failure(
      5000,
      `登录接口异常：${msg}（请确认已执行 npm run seed 初始化数据库）`,
      500,
    );
  }
}
