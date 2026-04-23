import { and, asc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { configEnums } from '@/lib/db/schema';

const createSchema = z.object({
  category: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const includeInactive =
    (searchParams.get('include_inactive') || '').toLowerCase() === '1';

  const rows = await db
    .select()
    .from(configEnums)
    .where(
      category
        ? includeInactive
          ? eq(configEnums.category, category)
          : and(eq(configEnums.category, category), eq(configEnums.isActive, true))
        : includeInactive
          ? undefined
          : eq(configEnums.isActive, true),
    )
    .orderBy(asc(configEnums.sortOrder), asc(configEnums.id));

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
      .insert(configEnums)
      .values({
        category: body.category,
        code: body.code,
        name: body.name,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      })
      .returning();

    return success(inserted[0], { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes('unique')) {
      return failure(1005, '枚举项已存在', 409);
    }
    return failure(5000, '服务器内部错误', 500);
  }
}
