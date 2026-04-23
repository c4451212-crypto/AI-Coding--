import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, backupConfig } from '@/lib/db/schema';

const saveSchema = z.object({
  localEnabled: z.boolean().optional(),
  localPath: z.string().optional().nullable(),
  scheduleTime: z.string().optional(),
  keepCount: z.number().int().optional(),
  cosEnabled: z.boolean().optional(),
  cosSecretId: z.string().optional().nullable(),
  cosSecretKey: z.string().optional().nullable(),
  cosBucket: z.string().optional().nullable(),
  cosRegion: z.string().optional().nullable(),
});

function testWritableDir(p: string) {
  const abs = path.resolve(p);
  if (!existsSync(abs)) {
    mkdirSync(abs, { recursive: true });
  }
  const testFile = path.join(abs, `.write_test_${Date.now()}`);
  writeFileSync(testFile, '');
  unlinkSync(testFile);
}

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  const row = await db.select().from(backupConfig).limit(1).get();
  return success(row ?? null);
}

export async function POST(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }
  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const body = parsed.data;

  if (body.localPath) {
    try {
      testWritableDir(body.localPath);
    } catch {
      return failure(1004, '路径不存在或无写入权限', 400);
    }
  }

  const existing = await db.select().from(backupConfig).limit(1).get();
  const now = new Date();

  if (existing) {
    await db
      .update(backupConfig)
      .set({
        localEnabled: body.localEnabled ?? existing.localEnabled,
        localPath: body.localPath ?? existing.localPath,
        scheduleTime: body.scheduleTime ?? existing.scheduleTime,
        keepCount: body.keepCount ?? existing.keepCount,
        cosEnabled: body.cosEnabled ?? existing.cosEnabled,
        cosSecretId: body.cosSecretId ?? existing.cosSecretId,
        cosSecretKey: body.cosSecretKey ?? existing.cosSecretKey,
        cosBucket: body.cosBucket ?? existing.cosBucket,
        cosRegion: body.cosRegion ?? existing.cosRegion,
        updatedAt: now,
        updatedBy: user.sub,
      })
      .where(eq(backupConfig.id, existing.id));
  } else {
    await db.insert(backupConfig).values({
      localEnabled: body.localEnabled ?? false,
      localPath: body.localPath ?? null,
      scheduleTime: body.scheduleTime ?? '03:00',
      keepCount: body.keepCount ?? 7,
      cosEnabled: body.cosEnabled ?? false,
      cosSecretId: body.cosSecretId ?? null,
      cosSecretKey: body.cosSecretKey ?? null,
      cosBucket: body.cosBucket ?? null,
      cosRegion: body.cosRegion ?? null,
      updatedAt: now,
      updatedBy: user.sub,
    });
  }

  try {
    await db.insert(auditLogs).values({
      userId: user.sub,
      action: 'UPDATE_BACKUP_CONFIG',
      targetType: 'backup_config',
      targetId: existing?.id ?? null,
      details: JSON.stringify({
        localEnabled: body.localEnabled,
        localPath: body.localPath ? '***' : null,
        scheduleTime: body.scheduleTime,
        keepCount: body.keepCount,
        cosEnabled: body.cosEnabled,
      }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  } catch {
    // ignore
  }

  return success({ saved: true });
}

