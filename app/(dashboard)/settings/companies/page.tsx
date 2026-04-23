'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetcher } from '@/lib/fetcher';

type Company = {
  id: number;
  name: string;
  shortName: string;
  type: '母公司' | '子公司' | '项目公司';
  creditCode: string | null;
  isActive: boolean;
};

export default function SettingsCompaniesPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/companies', fetcher<Company[]>);
  const rows = data?.data ?? [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({
    name: '',
    shortName: '',
    type: '母公司' as Company['type'],
    creditCode: '',
  });

  const title = useMemo(() => (editing ? '编辑公司' : '新增公司'), [editing]);

  function reset() {
    setEditing(null);
    setForm({ name: '', shortName: '', type: '母公司', creditCode: '' });
  }

  async function submit() {
    const url = editing ? `/api/companies/${editing.id}` : '/api/companies';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: form.name,
        shortName: form.shortName,
        type: form.type,
        creditCode: form.creditCode || null,
      }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '保存失败');
    await mutate();
    setOpen(false);
    reset();
  }

  async function archive(id: number) {
    if (!window.confirm('注销后该公司将不再出现在下拉选项中，历史合同仍保留。确认？')) return;
    const res = await fetch(`/api/companies/${id}/archive`, { method: 'PUT', credentials: 'include' });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '操作失败');
    await mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">公司管理</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button type="button" onClick={() => setOpen(true)}>新增公司</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm">公司全称</div>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <div className="text-sm">简称（编码）</div>
                <Input
                  value={form.shortName}
                  onChange={(e) => setForm((p) => ({ ...p, shortName: e.target.value }))}
                  placeholder="如：母、子A"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm">类型</div>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))}
                >
                  <option value="母公司">母公司</option>
                  <option value="子公司">子公司</option>
                  <option value="项目公司">项目公司</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-sm">统一社会信用代码</div>
                <Input
                  value={form.creditCode}
                  onChange={(e) => setForm((p) => ({ ...p, creditCode: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                onClick={() => submit().catch((e) => window.alert((e as Error).message))}
              >
                {editing ? '保存修改' : '创建'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <div className="text-sm text-destructive">加载失败：{(error as Error).message}</div> : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>全称</TableHead>
              <TableHead>简称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-[180px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">加载中…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">暂无数据</TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.shortName}</TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? 'default' : 'secondary'}>
                      {c.isActive ? '正常' : '已注销'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.isActive ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(c);
                            setForm({
                              name: c.name,
                              shortName: c.shortName,
                              type: c.type,
                              creditCode: c.creditCode || '',
                            });
                            setOpen(true);
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => archive(c.id).catch((e) => window.alert((e as Error).message))}
                        >
                          注销
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
