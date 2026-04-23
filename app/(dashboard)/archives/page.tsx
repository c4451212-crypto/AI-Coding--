'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { fetcher } from '@/lib/fetcher';

type Cabinet = 'A' | 'B' | 'C';

type Slot = {
  location: string;
  status: 'empty' | 'occupied' | 'borrowed';
  contract: null | {
    id: number;
    contractNo: string;
    title: string;
    borrower: string | null;
    expectedReturn: string | Date | null;
    returnStatus: string;
  };
};

function statusStyle(status: Slot['status']) {
  if (status === 'occupied') return 'bg-emerald-50 border-emerald-200 hover:border-emerald-400';
  if (status === 'borrowed') return 'bg-rose-50 border-rose-200 hover:border-rose-400';
  return 'bg-muted/40 border-border hover:border-primary';
}

export default function ArchivesPage() {
  const [cabinet, setCabinet] = useState<Cabinet>('A');
  const url = useMemo(() => `/api/archives?cabinet=${cabinet}`, [cabinet]);
  const { data, error, isLoading } = useSWR(url, fetcher<Slot[]>);

  const slots = data?.data ?? [];
  const stats = useMemo(() => {
    let empty = 0;
    let occupied = 0;
    let borrowed = 0;
    for (const s of slots) {
      if (s.status === 'empty') empty++;
      else if (s.status === 'occupied') occupied++;
      else borrowed++;
    }
    return { empty, occupied, borrowed };
  }, [slots]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">档案管理</h1>
          <p className="text-sm text-muted-foreground">
            基于合同 `storageLocation`（如 A-1-1）动态生成柜格
          </p>
        </div>
        <div className="flex gap-2">
          {(['A', 'B', 'C'] as const).map((c) => (
            <Button
              key={c}
              type="button"
              variant={cabinet === c ? 'default' : 'outline'}
              onClick={() => setCabinet(c)}
            >
              {c} 柜
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="text-sm text-destructive">加载失败：{(error as Error).message}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">在库</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-700">{stats.occupied}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">借出/逾期</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-rose-700">{stats.borrowed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">空位</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.empty}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {isLoading ? (
          <div className="col-span-5 text-sm text-muted-foreground">加载中…</div>
        ) : (
          slots.map((slot) => (
            <Dialog key={slot.location}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className={`rounded-lg border-2 p-3 text-left transition-shadow hover:shadow-sm ${statusStyle(slot.status)}`}
                >
                  <div className="text-sm font-medium">{slot.location}</div>
                  {slot.contract ? (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {slot.contract.contractNo}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">空</div>
                  )}
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>位置：{slot.location}</DialogTitle>
                </DialogHeader>
                {slot.contract ? (
                  <div className="space-y-3 text-sm">
                    <div className="space-y-1">
                      <div className="font-medium">{slot.contract.title}</div>
                      <div className="text-muted-foreground">{slot.contract.contractNo}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-muted-foreground">状态</div>
                      <Badge variant={slot.status === 'borrowed' ? 'destructive' : 'secondary'}>
                        {slot.contract.returnStatus}
                      </Badge>
                    </div>
                    {slot.contract.borrower ? (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm">
                        <div>借用人：{slot.contract.borrower}</div>
                        <div className="text-muted-foreground">
                          预计归还：
                          {slot.contract.expectedReturn
                            ? new Date(slot.contract.expectedReturn as any).toLocaleDateString('zh-CN')
                            : '-'}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Button asChild>
                        <Link href={`/contracts/${slot.contract.id}`}>查看合同</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">此位置暂无档案</div>
                )}
              </DialogContent>
            </Dialog>
          ))
        )}
      </div>
    </div>
  );
}
