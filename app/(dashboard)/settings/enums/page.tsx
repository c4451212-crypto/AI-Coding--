'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetcher } from '@/lib/fetcher';

const CATEGORIES = [
  { key: 'contract_type', label: '合同类型' },
  { key: 'party_role', label: '签订方角色' },
  { key: 'currency', label: '币种' },
  { key: 'contract_status', label: '合同状态' },
  { key: 'return_status', label: '纸质件状态' },
] as const;

type Row = {
  id: number;
  category: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export default function SettingsEnumsPage() {
  const [category, setCategory] = useState<string>(CATEGORIES[0].key);
  const { data, mutate } = useSWR(
    `/api/configs?category=${category}&include_inactive=1`,
    fetcher<Row[]>,
  );
  const rows = data?.data ?? [];

  const [newItem, setNewItem] = useState({ code: '', name: '', sortOrder: 0 });

  const categoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.key === category)?.label || category,
    [category],
  );

  async function add() {
    const res = await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ category, ...newItem, sortOrder: Number(newItem.sortOrder) || 0 }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '添加失败');
    setNewItem({ code: '', name: '', sortOrder: 0 });
    await mutate();
  }

  async function toggle(id: number, nextActive: boolean) {
    const res = await fetch(`/api/configs/${id}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isActive: nextActive }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '更新失败');
    await mutate();
  }

  async function del(id: number, name: string) {
    const checkRes = await fetch(`/api/configs/${id}/usage`, { credentials: 'include' });
    const check = await checkRes.json();
    const count = Number(check?.data?.count ?? 0);
    if (count > 0) {
      if (!window.confirm(`【${name}】正被 ${count} 份合同使用，删除后这些合同将显示空白。确认删除？`)) {
        return;
      }
    } else {
      if (!window.confirm(`确认删除【${name}】？`)) return;
    }

    const res = await fetch(`/api/configs/${id}`, { method: 'DELETE', credentials: 'include' });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '删除失败');
    await mutate();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">枚举配置</h2>
        <p className="text-sm text-muted-foreground">当前分类：{categoryLabel}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-[220px] space-y-2">
          <div className="text-xs text-muted-foreground">分类</div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-wrap items-end gap-2">
          <div className="w-[160px] space-y-2">
            <div className="text-xs text-muted-foreground">编码</div>
            <Input value={newItem.code} onChange={(e) => setNewItem((p) => ({ ...p, code: e.target.value }))} />
          </div>
          <div className="w-[220px] space-y-2">
            <div className="text-xs text-muted-foreground">显示名称</div>
            <Input value={newItem.name} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="w-[120px] space-y-2">
            <div className="text-xs text-muted-foreground">排序</div>
            <Input
              type="number"
              value={String(newItem.sortOrder)}
              onChange={(e) => setNewItem((p) => ({ ...p, sortOrder: parseInt(e.target.value || '0', 10) }))}
            />
          </div>
          <Button type="button" onClick={() => add().catch((e) => window.alert((e as Error).message))}>
            添加
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">排序</TableHead>
              <TableHead className="w-[140px]">编码</TableHead>
              <TableHead>显示名称</TableHead>
              <TableHead className="w-[120px]">状态</TableHead>
              <TableHead className="w-[180px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">暂无数据</TableCell>
              </TableRow>
            ) : (
              rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.sortOrder}</TableCell>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? 'default' : 'secondary'}>
                      {item.isActive ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggle(item.id, !item.isActive).catch((e) => window.alert((e as Error).message))}
                      >
                        {item.isActive ? '禁用' : '启用'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => del(item.id, item.name).catch((e) => window.alert((e as Error).message))}
                      >
                        删除
                      </Button>
                    </div>
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
