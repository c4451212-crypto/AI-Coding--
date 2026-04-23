import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { alias } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { reminderConfirmations, reminders, users } from '@/lib/db/schema';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  remindDate: z.string().min(1),
  remindTime: z.string().optional().nullable(),
  recipients: z.array(z.string().min(1)).min(1),
  relatedContractId: z.number().int().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';

  const myConf = alias(reminderConfirmations, 'my_rem_conf');

  const isRecipient = sql`EXISTS (
    SELECT 1 FROM json_each(${reminders.recipients}) j
    WHERE j.type = 'text' AND j.value = ${user.username}
  )`;

  let whereSql;
  if (type === 'created') {
    whereSql = eq(reminders.creatorId, user.sub);
  } else if (type === 'received') {
    whereSql = isRecipient;
  } else {
    whereSql = or(eq(reminders.creatorId, user.sub), isRecipient)!;
  }

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
    .where(whereSql)
    .orderBy(desc(reminders.remindDate))
    .limit(100);

  return success(rows);
}

export async function POST(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return failure(1004, '缺少必填字段或格式错误', 400);

  const body = parsed.data;
  const recipientUsernames = [...new Set(body.recipients)];

  const found = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(
      and(eq(users.isActive, true), inArray(users.username, recipientUsernames)),
    );

  if (found.length !== recipientUsernames.length) {
    return failure(1004, '部分接收人不存在或未启用', 400);
  }

  const remindDate = new Date(body.remindDate);
  if (Number.isNaN(remindDate.getTime())) {
    return failure(1004, '提醒日期无效', 400);
  }

  const row = db.transaction((tx) => {
    const inserted = tx
      .insert(reminders)
      .values({
        title: body.title,
        description: body.description ?? null,
        creatorId: user.sub,
        remindDate,
        remindTime: body.remindTime?.trim() || '09:00',
        recipients: JSON.stringify(recipientUsernames),
        relatedContractId: body.relatedContractId ?? null,
        status: '待发送',
      })
      .returning()
      .get();

    if (!inserted) throw new Error('创建失败');

    // 创建“预定通知”的库记录：为每个接收人生成一条 reminder_confirmations（confirmedAt=null）
    // 发送成功后会写 wecomMsgId；用户点击“确认收到”会把 confirmedAt 写入。
    tx.insert(reminderConfirmations)
      .values(
        found.map((u) => ({
          reminderId: inserted.id,
          userId: u.id,
          confirmedAt: null,
        })),
      )
      .onConflictDoNothing({
        target: [reminderConfirmations.reminderId, reminderConfirmations.userId],
      });

    return inserted;
  });

  return success(row, { status: 201 });
}
