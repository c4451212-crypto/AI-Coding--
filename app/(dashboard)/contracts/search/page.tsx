'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetcher } from '@/lib/fetcher';

type Hit = {
  id: number;
  contractNo: string;
  title: string;
  signDate: string | Date | null;
  endDate: string | Date | null;
  totalAmount: number | null;
  status: string;
  contractType: string;
  companyShortName: string | null;
  contractTypeName: string;
  holderName: string | null;
};

type SearchPayload = {
  results: Hit[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
};

export default function ContractSearchPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = (sp.get('q') || '').trim();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const url = useMemo(() => {
    if (q.length < 2) return null;
    const qs = new URLSearchParams();
    qs.set('q', q);
    qs.set('page', String(page));
    qs.set('pageSize', '30');
    return `/api/search?${qs.toString()}`;
  }, [q, page]);

  const { data, error, isLoading } = useSWR(url, fetcher<SearchPayload>);

  const payload = data?.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">全文搜索</h1>
          <p className="text-sm text-muted-foreground">
            关键词：<span className="font-medium text-foreground">{q || '（空）'}</span>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/contracts">返回合同列表</Link>
        </Button>
      </div>

      {q.length < 2 ? (
        <div className="text-sm text-muted-foreground">请至少输入 2 个字符后再搜索。</div>
      ) : null}

      {error ? (
        <div className="text-sm text-destructive">加载失败：{(error as Error).message}</div>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>公司</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>到期日</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : !payload || payload.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  无匹配结果
                </TableCell>
              </TableRow>
            ) : (
              payload.results.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/contracts/${row.id}`)}
                >
                  <TableCell className="font-mono text-xs">{row.contractNo}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.companyShortName || '-'}</TableCell>
                  <TableCell>{row.contractTypeName || row.contractType}</TableCell>
                  <TableCell>
                    {row.totalAmount != null
                      ? `¥${(Number(row.totalAmount) / 100).toLocaleString('zh-CN')}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {row.endDate ? new Date(row.endDate as any).toLocaleDateString('zh-CN') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {payload && payload.total > 0 ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            共 {payload.total} 条；第 {payload.page} / {Math.max(1, Math.ceil(payload.total / payload.pageSize))} 页
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </Button>
            <Button
              variant="outline"
              disabled={page >= Math.ceil(payload.total / payload.pageSize)}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
