import type { NextRequest } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

/** 登录用户可选接收人列表（提醒等场景） */
export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const rows = db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.username));

  return success(rows);
}
