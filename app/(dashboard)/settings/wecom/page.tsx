'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetcher } from '@/lib/fetcher';

type WecomConfig = {
  configured: boolean;
  corpId: string;
  agentId: string;
  secret: string;
  appUrl: string;
};

type CompanyRow = { id: number; name: string; shortName: string; isActive: boolean };

type WebhookRow = {
  id: number;
  companyId: number;
  companyShortName: string;
  purposeKey: 'FINANCE' | 'HR' | 'OPS' | 'BOARD';
  displayName: string;
  isActive: boolean;
  mentionAllDefault: boolean;
  hasWebhook: boolean;
  webhookPreview: string;
};

export default function SettingsWecomPage() {
  const { data: cfgResp, error: cfgErr } = useSWR('/api/wecom/config', fetcher<WecomConfig>);
  const { data: tokenResp, error: tokenErr, mutate } = useSWR('/api/wecom/token', fetcher<any>);
  const { data: companiesResp } = useSWR('/api/companies', fetcher<CompanyRow[]>);
  const {
    data: hooksResp,
    error: hooksErr,
    mutate: mutateHooks,
  } = useSWR('/api/settings/wecom/bot-webhooks', fetcher<WebhookRow[]>);

  const cfg = cfgResp?.data;
  const hookRows = hooksResp?.data ?? [];
  const companies = (companiesResp?.data ?? []).filter((c) => c.isActive);

  const [drafts, setDrafts] = useState<Record<number, { webhookUrl: string }>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [addCompanyId, setAddCompanyId] = useState<string>('');
  const [addPurpose, setAddPurpose] = useState<'FINANCE' | 'HR' | 'OPS' | 'BOARD'>('FINANCE');
  const [addWebhook, setAddWebhook] = useState('');

  useEffect(() => {
    const next: Record<number, { webhookUrl: string }> = {};
    for (const r of hookRows) next[r.id] = { webhookUrl: '' };
    setDrafts(next);
  }, [hookRows]);

  const purposeLabel = useMemo(
    () =>
      ({
        FINANCE: '财务用途（预算/付款/到期群通知）',
        HR: '人力用途（到期临近/逾期协同）',
        OPS: '经营用途（预留）',
        BOARD: '董事用途（预留）',
      }) as const,
    [],
  );

  const grouped = useMemo(() => {
    const map = new Map<number, WebhookRow[]>();
    for (const r of hookRows) {
      const list = map.get(r.companyId) ?? [];
      list.push(r);
      map.set(r.companyId, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [hookRows]);

  async function patchItems(items: unknown[]) {
    const res = await fetch('/api/settings/wecom/bot-webhooks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '保存失败');
    await mutateHooks();
  }

  async function saveRow(row: WebhookRow) {
    const d = drafts[row.id]?.webhookUrl ?? '';
    await patchItems([
      {
        id: row.id,
        ...(d.trim() ? { webhookUrl: d.trim() } : {}),
      },
    ]);
    setDrafts((p) => ({ ...p, [row.id]: { webhookUrl: '' } }));
  }

  async function clearRow(row: WebhookRow) {
    if (!window.confirm(`确认清空【${row.companyShortName} / ${row.displayName}】的 Webhook？`)) return;
    await patchItems([{ id: row.id, webhookUrl: null }]);
  }

  async function testRow(row: WebhookRow, mentionAll: boolean) {
    const res = await fetch('/api/settings/wecom/bot-webhooks/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ companyId: row.companyId, purposeKey: row.purposeKey, mentionAll }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '测试失败');
  }

  async function createMapping() {
    const cid = parseInt(addCompanyId, 10);
    if (!Number.isFinite(cid) || cid <= 0) {
      window.alert('请选择子公司/主体（不能用全局默认行来新增）');
      return;
    }
    const company = companies.find((c) => c.id === cid);
    if (!company) {
      window.alert('公司不存在或已停用');
      return;
    }
    if (!addWebhook.trim()) {
      window.alert('请粘贴 Webhook');
      return;
    }

    const displayName = `${company.shortName}-${addPurpose === 'FINANCE' ? '财务群' : addPurpose === 'HR' ? '人力群' : addPurpose === 'OPS' ? '经营群' : '董事群'}`;

    const res = await fetch('/api/settings/wecom/bot-webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        companyId: cid,
        purposeKey: addPurpose,
        displayName,
        webhookUrl: addWebhook.trim(),
        isActive: true,
        mentionAllDefault: false,
      }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '创建失败');

    setAddOpen(false);
    setAddCompanyId('');
    setAddPurpose('FINANCE');
    setAddWebhook('');
    await mutateHooks();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">企业微信</h2>
        <p className="text-sm text-muted-foreground">
          群机器人 Webhook 可在本页按<strong>公司主体</strong>绑定：系统发送群消息时会用合同的 `company_id` 选择对应 Webhook；找不到则回退到
          <span className="font-mono"> company_id=0 </span>
          的全局默认，避免误发到子公司群。
        </p>
        <p className="text-sm text-muted-foreground">
          保密性提示：群消息默认不包含合作方等敏感字段；更详细信息仍通过<strong>个人应用消息</strong>发给有权限的人（依赖用户绑定企业微信 userid）。
        </p>
      </div>

      {cfgErr ? <div className="text-sm text-destructive">加载失败：{(cfgErr as Error).message}</div> : null}
      {tokenErr ? <div className="text-sm text-destructive">Token 检查失败：{(tokenErr as Error).message}</div> : null}
      {hooksErr ? <div className="text-sm text-destructive">群 Webhook 加载失败：{(hooksErr as Error).message}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>配置状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>是否已配置：{cfg?.configured ? '是' : '否'}</div>
            <div>WECOM_CORP_ID：{cfg?.corpId ? '已设置' : '未设置'}</div>
            <div>WECOM_AGENT_ID：{cfg?.agentId ? '已设置' : '未设置'}</div>
            <div>WECOM_SECRET：{cfg?.secret ? '已设置' : '未设置'}</div>
            <div>NEXT_PUBLIC_APP_URL：{cfg?.appUrl || '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token 校验</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>configured：{String(tokenResp?.data?.configured ?? false)}</div>
            <div>expiresInSec：{tokenResp?.data?.expiresInSec ?? '-'}</div>
            <div>tokenPreview：{tokenResp?.data?.tokenPreview ?? '-'}</div>
            <Button type="button" variant="outline" onClick={() => mutate()}>
              重新检查
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>群机器人 Webhook 映射（按公司）</CardTitle>
            <Button type="button" onClick={() => setAddOpen(true)}>
              新增子公司映射
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {addOpen ? (
            <div className="rounded-md border p-3 space-y-3">
              <div className="font-medium">新增映射</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">公司主体</div>
                  <Select value={addCompanyId} onValueChange={setAddCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择公司" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.shortName}（{c.name}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">用途</div>
                  <Select value={addPurpose} onValueChange={(v) => setAddPurpose(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FINANCE">FINANCE（财务）</SelectItem>
                      <SelectItem value="HR">HR（人力）</SelectItem>
                      <SelectItem value="OPS">OPS（经营）</SelectItem>
                      <SelectItem value="BOARD">BOARD（董事）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <div className="text-xs text-muted-foreground">Webhook</div>
                  <Input value={addWebhook} onChange={(e) => setAddWebhook(e.target.value)} placeholder="粘贴完整 Webhook URL，或只粘贴 key" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  取消
                </Button>
                <Button type="button" onClick={() => createMapping().catch((e) => window.alert((e as Error).message))}>
                  创建
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            {grouped.map(([companyId, rows]) => (
              <div key={companyId} className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                  {companyId === 0 ? '全局默认（回退）' : rows[0]?.companyShortName || `公司#${companyId}`}
                </div>
                <div className="divide-y">
                  {rows.map((r) => (
                    <div key={r.id} className="grid grid-cols-12 gap-2 px-3 py-3">
                      <div className="col-span-4 space-y-1">
                        <div className="font-medium">
                          {r.displayName}{' '}
                          <span className="font-mono text-xs text-muted-foreground">({r.purposeKey})</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{purposeLabel[r.purposeKey]}</div>
                        <div className="text-xs text-muted-foreground">
                          当前：{r.hasWebhook ? `已配置（${r.webhookPreview}）` : '未配置'}
                        </div>
                      </div>

                      <div className="col-span-4 space-y-2">
                        <Input
                          value={drafts[r.id]?.webhookUrl ?? ''}
                          onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { webhookUrl: e.target.value } }))}
                          placeholder="留空表示不改；保存后写入"
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={r.mentionAllDefault}
                            onChange={(e) =>
                              patchItems([{ id: r.id, mentionAllDefault: e.target.checked }]).catch((err) =>
                                window.alert((err as Error).message),
                              )
                            }
                          />
                          默认 @all（紧急场景仍会强制 @all）
                        </label>
                      </div>

                      <div className="col-span-2 flex items-center">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={r.isActive}
                            onChange={(e) =>
                              patchItems([{ id: r.id, isActive: e.target.checked }]).catch((err) =>
                                window.alert((err as Error).message),
                              )
                            }
                          />
                          启用
                        </label>
                      </div>

                      <div className="col-span-2 flex flex-col items-end justify-between gap-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => testRow(r, false).catch((e) => window.alert((e as Error).message))}>
                            测试
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => testRow(r, true).catch((e) => window.alert((e as Error).message))}>
                            测试@all
                          </Button>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" size="sm" onClick={() => saveRow(r).catch((e) => window.alert((e as Error).message))}>
                            保存
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => clearRow(r).catch((e) => window.alert((e as Error).message))}>
                            清空
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
