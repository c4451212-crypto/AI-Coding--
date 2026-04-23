import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { userPreferences } from '@/lib/db/schema';
import {
  ALLOWED_LIST_PAGE_SIZES,
  DEFAULT_CONTRACT_LIST_COLUMNS,
  VALID_CONTRACT_LIST_COLUMNS,
} from '@/lib/constants/contract-list-columns';

const patchSchema = z.object({
  listColumns: z.array(z.string()).optional(),
  listPageSize: z.number().int().optional(),
});

export async function GET(_request: NextRequest) {
  const user = await auth(_request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.sub))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return success({
      listColumns: JSON.stringify(DEFAULT_CONTRACT_LIST_COLUMNS),
      listPageSize: 30,
    });
  }

  return success({
    listColumns: row.listColumns,
    listPageSize: row.listPageSize,
    updatedAt: row.updatedAt,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const body = parsed.data;

  let nextColumns: string | undefined;
  if (body.listColumns !== undefined) {
    const invalid = body.listColumns.filter(
      (c) => !(VALID_CONTRACT_LIST_COLUMNS as readonly string[]).includes(c),
    );
    if (invalid.length > 0) {
      return failure(1004, `无效列: ${invalid.join(',')}`, 400);
    }
    if (body.listColumns.length === 0) {
      return failure(1004, '至少保留一列', 400);
    }
    nextColumns = JSON.stringify(body.listColumns);
  }

  let nextPageSize: number | undefined;
  if (body.listPageSize !== undefined) {
    if (!ALLOWED_LIST_PAGE_SIZES.includes(body.listPageSize as (typeof ALLOWED_LIST_PAGE_SIZES)[number])) {
      return failure(1004, '每页条数仅支持 10 / 30 / 50 / 100', 400);
    }
    nextPageSize = body.listPageSize;
  }

  const existingRows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, user.sub))
    .limit(1);
  const existing = existingRows[0];
  const now = new Date();

  if (existing) {
    db.update(userPreferences)
      .set({
        listColumns: nextColumns ?? existing.listColumns,
        listPageSize: nextPageSize ?? existing.listPageSize,
        updatedAt: now,
      })
      .where(eq(userPreferences.id, existing.id));
  } else {
    db.insert(userPreferences).values({
      userId: user.sub,
      listColumns: nextColumns ?? JSON.stringify(DEFAULT_CONTRACT_LIST_COLUMNS),
      listPageSize: nextPageSize ?? 30,
      updatedAt: now,
    });
  }

  return success({ updated: true });
}
