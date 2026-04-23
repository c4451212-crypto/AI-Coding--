import { eq, inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { reminderConfirmations, reminders, users } from '@/lib/db/schema';

function parseRecipients(raw: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const reminderId = parseInt(context.params.id, 10);
  if (Number.isNaN(reminderId)) return failure(1004, '参数错误', 400);

  const reminderRows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.id, reminderId))
    .limit(1);
  const reminder = reminderRows[0];
  if (!reminder) return failure(1003, '提醒不存在', 404);

  if (reminder.status !== '已发送') {
    return failure(1004, '仅已发送的提醒可确认', 400);
  }

  const recipients = parseRecipients(reminder.recipients);
  if (!recipients.includes(user.username)) {
    return failure(1002, '你不是该提醒的接收人', 403);
  }

  const now = new Date();

  db.transaction((tx) => {
    tx.insert(reminderConfirmations)
      .values({
        reminderId,
        userId: user.sub,
        confirmedAt: now,
      })
      .onConflictDoUpdate({
        target: [reminderConfirmations.reminderId, reminderConfirmations.userId],
        set: { confirmedAt: now },
      });

    const userRows = tx
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.username, recipients))
      .all();

    const idByUsername = new Map(userRows.map((r) => [r.username, r.id]));

    const expectedIds = recipients
      .map((u) => idByUsername.get(u))
      .filter((x): x is number => typeof x === 'number');

    const confirms = tx
      .select({ userId: reminderConfirmations.userId })
      .from(reminderConfirmations)
      .where(eq(reminderConfirmations.reminderId, reminderId))
      .all();

    const confirmed = new Set(confirms.map((c) => c.userId));
    const allDone =
      expectedIds.length === recipients.length &&
      expectedIds.length > 0 &&
      expectedIds.every((id) => confirmed.has(id));

    if (allDone) {
      tx.update(reminders).set({ status: '已确认' }).where(eq(reminders.id, reminderId));
    }
  });

  return success({ confirmed: true });
}
