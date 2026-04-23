'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetcher } from '@/lib/fetcher';

type BackupConfig = {
  id: number;
  localEnabled: boolean;
  localPath: string | null;
  scheduleTime: string;
  keepCount: number;
  cosEnabled: boolean;
  cosSecretId: string | null;
  cosSecretKey: string | null;
  cosBucket: string | null;
  cosRegion: string | null;
};

export default function SettingsBackupPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/settings/backup', fetcher<BackupConfig | null>);
  const cfg = data?.data ?? null;

  const [form, setForm] = useState({
    localEnabled: false,
    localPath: '',
    scheduleTime: '03:00',
    keepCount: 7,
    cosEnabled: false,
    cosSecretId: '',
    cosSecretKey: '',
    cosBucket: '',
    cosRegion: '',
  });

  useEffect(() => {
    if (!cfg) return;
    setForm({
      localEnabled: !!cfg.localEnabled,
      localPath: cfg.localPath || '',
      scheduleTime: cfg.scheduleTime || '03:00',
      keepCount: cfg.keepCount || 7,
      cosEnabled: !!cfg.cosEnabled,
      cosSecretId: cfg.cosSecretId || '',
      cosSecretKey: cfg.cosSecretKey || '',
      cosBucket: cfg.cosBucket || '',
      cosRegion: cfg.cosRegion || '',
    });
  }, [cfg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    const res = await fetch('/api/settings/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        localEnabled: form.localEnabled,
        localPath: form.localPath || null,
        scheduleTime: form.scheduleTime,
        keepCount: Number(form.keepCount) || 7,
        cosEnabled: form.cosEnabled,
        cosSecretId: form.cosSecretId || null,
        cosSecretKey: form.cosSecretKey || null,
        cosBucket: form.cosBucket || null,
        cosRegion: form.cosRegion || null,
      }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '保存失败');
    await mutate();
    window.alert('已保存');
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">备份管理</h2>
        <p className="text-sm text-muted-foreground">当前仅配置；备份执行可在 cron 服务中扩展</p>
      </div>

      {error ? <div className="text-sm text-destructive">加载失败：{(error as Error).message}</div> : null}
      {isLoading ? <div className="text-sm text-muted-foreground">加载中…</div> : null}

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.localEnabled}
            onChange={(e) => setForm((p) => ({ ...p, localEnabled: e.target.checked }))}
          />
          <div className="text-sm font-medium">启用本地备份</div>
        </div>
        <div className="space-y-2">
          <div className="text-sm">本地路径</div>
          <Input value={form.localPath} onChange={(e) => setForm((p) => ({ ...p, localPath: e.target.value }))} placeholder="例如：/data/backups" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm">定时（HH:mm）</div>
            <Input value={form.scheduleTime} onChange={(e) => setForm((p) => ({ ...p, scheduleTime: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <div className="text-sm">保留份数</div>
            <Input type="number" value={String(form.keepCount)} onChange={(e) => setForm((p) => ({ ...p, keepCount: parseInt(e.target.value || '7', 10) }))} />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.cosEnabled}
            onChange={(e) => setForm((p) => ({ ...p, cosEnabled: e.target.checked }))}
          />
          <div className="text-sm font-medium">启用 COS（预留）</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm">COS SecretId</div>
            <Input value={form.cosSecretId} onChange={(e) => setForm((p) => ({ ...p, cosSecretId: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <div className="text-sm">COS SecretKey</div>
            <Input value={form.cosSecretKey} onChange={(e) => setForm((p) => ({ ...p, cosSecretKey: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <div className="text-sm">Bucket</div>
            <Input value={form.cosBucket} onChange={(e) => setForm((p) => ({ ...p, cosBucket: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <div className="text-sm">Region</div>
            <Input value={form.cosRegion} onChange={(e) => setForm((p) => ({ ...p, cosRegion: e.target.value }))} />
          </div>
        </div>
      </div>

      <Button type="button" onClick={() => save().catch((e) => window.alert((e as Error).message))}>
        保存配置
      </Button>
    </div>
  );
}
