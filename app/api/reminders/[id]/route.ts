import { and, eq, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { alias } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { reminderConfirmations, reminders, users } from '@/lib/db/schema';

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  remindDate: z.string().min(1).optional(),
  remindTime: z.string().optional().nullable(),
  recipients: z.array(z.string().min(1)).min(1).optional(),
  relatedContractId: z.number().int().optional().nullable(),
  status: z.enum(['待发送', '已发送', '已确认', '已取消']).optional(),
});

function parseRecipients(raw: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const id = parseInt(context.params.id, 10);
  if (Number.isNaN(id)) return failure(1004, '参数错误', 400);

  const myConf = alias(reminderConfirmations, 'my_rem_conf');

  const rows = await db
    .select({
      id: reminders.id,
      title: reminders.title,
      description: reminders.description,
      remindDate: reminders.remindDate,
      remindTime: reminders.remindTime,
      recipients: reminders.recipients,
      status: reminders.status,
      creatorId: reminders.creatorId,
      creatorName: users.name,
      relatedContractId: reminders.relatedContractId,
      createdAt: reminders.createdAt,
      myConfirmedAt: myConf.confirmedAt,
    })
    .from(reminders)
    .leftJoin(users, eq(reminders.creatorId, users.id))
    .leftJoin(
      myConf,
      and(eq(myConf.reminderId, reminders.id), eq(myConf.userId, user.sub)),
    )
    .where(eq(reminders.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return failure(1003, '提醒不存在', 404);

  const rec = parseRecipients(row.recipients);
  const isRecipient = rec.includes(user.username);
  const canView = user.role === 'admin' || row.creatorId === user.sub || isRecipient;
  if (!canView) return failure(1002, 'Forbidden', 403);

  const confirms = await db
    .select({
      userId: reminderConfirmations.userId,
      confirmedAt: reminderConfirmations.confirmedAt,
      username: users.username,
      name: users.name,
    })
    .from(reminderConfirmations)
    .innerJoin(users, eq(reminderConfirmations.userId, users.id))
    .where(eq(reminderConfirmations.reminderId, id));

  return success({
    ...row,
    recipientsParsed: parseRecipients(row.recipients),
    confirmations: confirms,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const id = parseInt(context.params.id, 10);
  if (Number.isNaN(id)) return failure(1004, '参数错误', 400);

  const existingRows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return failure(1003, '提醒不存在', 404);

  if (existing.creatorId !== user.sub && user.role !== 'admin') {
    return failure(1002, 'Forbidden', 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const body = parsed.data;
  const set: {
    title?: string;
    description?: string | null;
    remindDate?: Date;
    remindTime?: string;
    recipients?: string;
    relatedContractId?: number | null;
    status?: string;
  } = {};

  if (body.title !== undefined) set.title = body.title;
  if (body.description !== undefined) set.description = body.description;
  if (body.remindTime !== undefined) set.remindTime = body.remindTime?.trim() || '09:00';
  if (body.status !== undefined) set.status = body.status;
  if (body.relatedContractId !== undefined) set.relatedContractId = body.relatedContractId;

  if (body.remindDate !== undefined) {
    const d = new Date(body.remindDate);
    if (Number.isNaN(d.getTime())) return failure(1004, '提醒日期无效', 400);
    set.remindDate = d;
  }

  if (body.recipients !== undefined) {
    const recipientUsernames = [...new Set(body.recipients)];
    const found = await db
      .select({ username: users.username })
      .from(users)
      .where(and(eq(users.isActive, true), inArray(users.username, recipientUsernames)));
    if (found.length !== recipientUsernames.length) {
      return failure(1004, '部分接收人不存在或未启用', 400);
    }
    set.recipients = JSON.stringify(recipientUsernames);
  }

  if (Object.keys(set).length === 0) {
    return failure(1004, '无更新字段', 400);
  }

  db.update(reminders).set(set).where(eq(reminders.id, id));

  const refreshedRows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1);
  const refreshed = refreshedRows[0] ?? null;
  return success(refreshed);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const id = parseInt(context.params.id, 10);
  if (Number.isNaN(id)) return failure(1004, '参数错误', 400);

  const existingRows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return failure(1003, '提醒不存在', 404);

  if (existing.creatorId !== user.sub && user.role !== 'admin') {
    return failure(1002, 'Forbidden', 403);
  }

  db.delete(reminders).where(eq(reminders.id, id));
  return success({ deleted: true });
}
