'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
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

const ACTIONS = [
  'CREATE_CONTRACT',
  'UPDATE_CONTRACT',
  'DELETE_CONTRACT',
  'BORROW_PAPER',
  'RETURN_PAPER',
  'UPLOAD_SCAN',
  'VIEW_SCAN',
  'LOGIN',
  'WECOM_SEND',
  'UPDATE_USER',
  'UPDATE_COMPANY',
  'ARCHIVE_COMPANY',
  'TOGGLE_ENUM',
  'DELETE_ENUM',
] as const;

export default function LogsPage() {
  const [action, setAction] = useState<string>('');
  const [days, setDays] = useState<string>('7');

  const url = useMemo(() => {
    const qs = new URLSearchParams();
    if (action) qs.set('action', action);
    qs.set('days', days);
    return `/api/audit-logs?${qs.toString()}`;
  }, [action, days]);

  const { data, error, isLoading } = useSWR(url, fetcher<any[]>);
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">审计日志</h2>
        <p className="text-sm text-muted-foreground">仅管理员/档案管理员可查看</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-[220px] space-y-2">
          <div className="text-xs text-muted-foreground">操作类型</div>
          <Select value={action || '__all__'} onValueChange={(v) => setAction(v === '__all__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[180px] space-y-2">
          <div className="text-xs text-muted-foreground">时间范围</div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger>
              <SelectValue placeholder="最近7天" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">今天</SelectItem>
              <SelectItem value="7">最近7天</SelectItem>
              <SelectItem value="30">最近30天</SelectItem>
              <SelectItem value="90">最近90天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-destructive">加载失败：{(error as Error).message}</div>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">时间</TableHead>
              <TableHead className="w-[120px]">用户</TableHead>
              <TableHead className="w-[180px]">操作</TableHead>
              <TableHead className="w-[160px]">对象</TableHead>
              <TableHead>详情</TableHead>
              <TableHead className="w-[140px]">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground text-center">
                  加载中…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground text-center">
                  暂无日志
                </TableCell>
              </TableRow>
            ) : (
              rows.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(log.createdAt as any).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>{log.userName || log.userId || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.targetType || '-'} {log.targetId != null ? `#${log.targetId}` : ''}
                  </TableCell>
                  <TableCell className="max-w-[520px] truncate" title={log.details || ''}>
                    {log.details || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.ipAddress || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

