import { desc } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';

const createSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  type: z.enum(['母公司', '子公司', '项目公司']),
  creditCode: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const rows = await db
    .select()
    .from(companies)
    .orderBy(desc(companies.createdAt));

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
  try {
    const inserted = await db
      .insert(companies)
      .values({
        name: body.name,
        shortName: body.shortName,
        type: body.type,
        creditCode: body.creditCode ?? null,
        isActive: body.isActive ?? true,
      })
      .returning();

    return success(inserted[0], { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes('unique')) {
      return failure(1005, '公司简称已存在', 409);
    }
    return failure(5000, '服务器内部错误', 500);
  }
}
