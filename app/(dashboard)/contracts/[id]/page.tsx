'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetcher } from '@/lib/fetcher';

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, error, isLoading } = useSWR(id ? `/api/contracts/${id}` : null, id ? fetcher : null);

  const payload = data?.data as any;

  if (!id) return <div className="text-sm text-destructive">参数错误</div>;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">加载中…</div>;
  }
  if (error) {
    return <div className="text-sm text-destructive">加载失败：{(error as Error).message}</div>;
  }

  const c = payload?.contract;
  if (!c) return <div className="text-sm text-destructive">合同不存在</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">{c.title}</div>
          <div className="text-sm text-muted-foreground">{c.contractNo}</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/contracts">返回列表</Link>
          </Button>
          <Button asChild>
            <Link href={`/contracts/${id}/edit`}>编辑</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">状态</span>
              <Badge variant="secondary">{c.status}</Badge>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">所属公司</span>
              <span>{payload?.company?.shortName ?? '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">类型</span>
              <span>{c.contractType}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">金额</span>
              <span>
                {c.totalAmount != null ? `¥${(Number(c.totalAmount) / 100).toLocaleString('zh-CN')}` : '-'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">签订日</span>
              <span>{c.signDate ? new Date(c.signDate).toLocaleDateString('zh-CN') : '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">到期日</span>
              <span>{c.endDate ? new Date(c.endDate).toLocaleDateString('zh-CN') : '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">扫描件</span>
              <span>{c.scanFilePath ? '已上传' : '未上传'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>签订方</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">角色</span>
              <span>{c.partyRole || '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">企业</span>
              <span className="text-right">{c.partyCompany || '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">个人</span>
              <span>{c.partyPerson || '-'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">联系方式</span>
              <span className="text-right">{c.partyContact || '-'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>付款节点</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>比例</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>计划日</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payload?.paymentSchedules ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    暂无付款节点
                  </TableCell>
                </TableRow>
              ) : (
                payload.paymentSchedules.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.sequence}</TableCell>
                    <TableCell>{p.nodeName}</TableCell>
                    <TableCell>
                      {p.percentage == null ? '-' : `${(Number(p.percentage) / 100).toFixed(2)}%`}
                    </TableCell>
                    <TableCell>¥{(Number(p.amount) / 100).toLocaleString('zh-CN')}</TableCell>
                    <TableCell>{p.dueDate ? new Date(p.dueDate).toLocaleDateString('zh-CN') : '-'}</TableCell>
                    <TableCell>{p.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近操作日志</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(payload?.auditLogs ?? []).length === 0 ? (
            <div className="text-muted-foreground">暂无日志</div>
          ) : (
            payload.auditLogs.map((l: any) => (
              <div key={l.id} className="flex justify-between gap-3 border-b py-2 last:border-b-0">
                <div className="text-muted-foreground">{new Date(l.createdAt).toLocaleString('zh-CN')}</div>
                <div className="flex-1">
                  <div className="font-medium">{l.action}</div>
                  {l.details ? <div className="text-xs text-muted-foreground">{l.details}</div> : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
