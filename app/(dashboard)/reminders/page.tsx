'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetcher } from '@/lib/fetcher';

type ReminderRow = {
  id: number;
  title: string;
  description: string | null;
  remindDate: string | Date;
  remindTime: string;
  recipients: string;
  status: string;
  creatorId: number;
  creatorName: string | null;
  relatedContractId: number | null;
  createdAt: string | Date;
  myConfirmedAt: string | Date | null;
};

type UserPick = { id: number; username: string; name: string };

function statusVariant(s: string) {
  if (s === '待发送') return 'secondary' as const;
  if (s === '已取消') return 'destructive' as const;
  if (s === '已确认') return 'outline' as const;
  return 'default' as const;
}

export default function RemindersPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'created' | 'received'>('all');
  const { data, error, isLoading, mutate } = useSWR(
    `/api/reminders?type=${activeTab}`,
    fetcher<ReminderRow[]>,
  );

  const { data: meResp } = useSWR('/api/users/me', fetcher<{ id: number; username: string; name: string; role: string }>);
  const me = meResp?.data;

  const { data: usersResp } = useSWR('/api/users/active', fetcher<UserPick[]>);
  const pickUsers = usersResp?.data ?? [];

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [remindDate, setRemindDate] = useState('');
  const [remindTime, setRemindTime] = useState('09:00');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const rows = data?.data ?? [];

  function toggleRecipient(username: string) {
    setSelected((prev) => ({ ...prev, [username]: !prev[username] }));
  }

  async function handleCreate() {
    const recipients = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!title.trim() || !remindDate || recipients.length === 0) {
      window.alert('请填写标题、提醒日期并至少选择一名接收人');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          remindDate,
          remindTime,
          recipients,
        }),
      });
      const j = await res.json();
      if (!res.ok || j.code !== 0) throw new Error(j.message || '创建失败');
      setOpen(false);
      setTitle('');
      setDescription('');
      setRemindDate('');
      setRemindTime('09:00');
      setSelected({});
      await mutate();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function markSent(id: number) {
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: '已发送' }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) {
      window.alert(j.message || '更新失败');
      return;
    }
    await mutate();
  }

  async function handleConfirm(id: number) {
    const res = await fetch(`/api/reminders/${id}/confirm`, {
      method: 'POST',
      credentials: 'include',
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) {
      window.alert(j.message || '确认失败');
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">提醒管理</h1>
          <p className="text-sm text-muted-foreground">创建、发送（模拟）、接收人确认</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>新建提醒</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>新建提醒</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="rt">标题</Label>
                <Input id="rt" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rd">说明</Label>
                <textarea
                  id="rd"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rdate">提醒日期</Label>
                  <Input id="rdate" type="date" value={remindDate} onChange={(e) => setRemindDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rtime">时间</Label>
                  <Input id="rtime" type="time" value={remindTime} onChange={(e) => setRemindTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>接收人</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2 text-sm">
                  {pickUsers.length === 0 ? (
                    <div className="text-muted-foreground">暂无可选用户</div>
                  ) : (
                    pickUsers.map((u) => (
                      <label key={u.id} className="flex cursor-pointer items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={!!selected[u.username]}
                          onChange={() => toggleRecipient(u.username)}
                        />
                        <span>
                          {u.name}（{u.username}）
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="button" disabled={saving} onClick={handleCreate}>
                {saving ? '保存中…' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: '全部' },
            { id: 'created', label: '我创建的' },
            { id: 'received', label: '发给我的' },
          ] as const
        ).map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={activeTab === t.id ? 'default' : 'outline'}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {error ? (
        <div className="text-sm text-destructive">加载失败：{(error as Error).message}</div>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">暂无提醒</div>
      ) : (
        <div className="space-y-3">
          {rows.map((reminder) => {
            let recipients: string[] = [];
            try {
              recipients = JSON.parse(reminder.recipients) as string[];
            } catch {
              recipients = [];
            }
            const iAmRecipient = me ? recipients.includes(me.username) : false;
            const showConfirm =
              reminder.status === '已发送' && !reminder.myConfirmedAt && iAmRecipient;
            const canMarkSent =
              reminder.status === '待发送' && me && reminder.creatorId === me.id;

            return (
              <Card key={reminder.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <CardTitle className="text-lg">{reminder.title}</CardTitle>
                    <Badge variant={statusVariant(reminder.status)}>{reminder.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {reminder.description ? (
                    <p className="text-muted-foreground">{reminder.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                    <div>
                      提醒时间：
                      {new Date(reminder.remindDate as any).toLocaleDateString('zh-CN')} {reminder.remindTime}
                    </div>
                    <div>创建人：{reminder.creatorName || '-'}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    接收人：{recipients.join('、') || '-'}
                    {reminder.myConfirmedAt ? (
                      <span className="ml-2 text-foreground">（你已确认）</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canMarkSent ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => markSent(reminder.id)}>
                        标记为已发送（模拟）
                      </Button>
                    ) : null}
                    {showConfirm ? (
                      <Button type="button" size="sm" onClick={() => handleConfirm(reminder.id)}>
                        确认收到
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
