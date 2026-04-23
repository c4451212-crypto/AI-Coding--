'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import { ColumnSettings } from '@/components/contracts/ColumnSettings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { parseListColumnsJson } from '@/lib/constants/contract-list-columns';
import { fetcher } from '@/lib/fetcher';

type CompanyRow = { id: number; shortName: string; name: string };
type EnumRow = { code: string; name: string };

type ContractListRow = {
  id: number;
  contractNo: string;
  title: string;
  companyId: number;
  companyShortName: string | null;
  contractType: string;
  contractTypeName: string | null;
  totalAmount: number | null;
  signDate: string | Date | null;
  endDate: string | Date | null;
  status: string;
  primaryHandler: string | null;
  primaryHandlerName: string | null;
  partyCompany: string | null;
  currentHolder: string | null;
  holderName: string | null;
  storageLocation: string | null;
  returnStatus: string | null;
  scanFilePath: string | null;
  createdAt: string | Date | null;
};

const ALL = '__all__';

const DEFAULT_COLUMNS = [
  'sign_date',
  'company_id',
  'contract_no',
  'title',
  'contract_type',
  'total_amount',
  'end_date',
  'status',
];

export default function ContractsPage() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [prefApplied, setPrefApplied] = useState(false);

  const { data: prefResp, error: prefError, mutate: mutatePref } = useSWR(
    '/api/users/me/preferences',
    fetcher<{ listColumns: string; listPageSize: number }>,
  );

  useEffect(() => {
    if (prefApplied) return;
    if (!prefResp && !prefError) return;
    if (prefResp?.data) {
      const d = prefResp.data;
      setColumns(parseListColumnsJson(d.listColumns));
      if (typeof d.listPageSize === 'number' && d.listPageSize > 0) {
        setPageSize(d.listPageSize);
      }
    }
    setPrefApplied(true);
  }, [prefResp, prefError, prefApplied]);

  const [companyId, setCompanyId] = useState<string>(ALL);
  const [contractType, setContractType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [keyword, setKeyword] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('pageSize', String(pageSize));
    if (companyId !== ALL) qs.set('company_id', companyId);
    if (contractType !== ALL) qs.set('contract_type', contractType);
    if (status !== ALL) qs.set('status', status);
    if (keyword.trim().length >= 2) qs.set('keyword', keyword.trim());
    return `/api/contracts?${qs.toString()}`;
  }, [page, pageSize, companyId, contractType, status, keyword]);

  const { data, error, isLoading } = useSWR(query, fetcher<ContractListRow[]>);
  const { data: companiesResp } = useSWR(`/api/companies`, fetcher<CompanyRow[]>);
  const { data: typesResp } = useSWR(`/api/configs?category=contract_type`, fetcher<EnumRow[]>);
  const { data: statusesResp } = useSWR(`/api/configs?category=contract_status`, fetcher<EnumRow[]>);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const companies = companiesResp?.data ?? [];
  const types = typesResp?.data ?? [];
  const statuses = statusesResp?.data ?? [];

  function applyKeyword() {
    setKeyword(keywordDraft);
    setPage(1);
  }

  function badgeVariantForStatus(s: string) {
    if (s === '已到期') return 'destructive' as const;
    if (s === '草稿' || s === '已终止' || s === '已完结') return 'secondary' as const;
    return 'default' as const;
  }

  function renderCell(row: ContractListRow, key: string) {
    switch (key) {
      case 'sign_date':
        return row.signDate ? new Date(row.signDate as any).toLocaleDateString('zh-CN') : '-';
      case 'company_id':
        return row.companyShortName || '-';
      case 'contract_no':
        return row.contractNo;
      case 'title':
        return row.title;
      case 'contract_type':
        return row.contractTypeName || row.contractType || '-';
      case 'total_amount':
        return row.totalAmount != null
          ? `¥${(Number(row.totalAmount) / 100).toLocaleString('zh-CN')}`
          : '-';
      case 'end_date':
        return row.endDate ? new Date(row.endDate as any).toLocaleDateString('zh-CN') : '-';
      case 'status':
        return <Badge variant={badgeVariantForStatus(row.status)}>{row.status}</Badge>;
      case 'primary_handler':
        return row.primaryHandlerName || row.primaryHandler || '-';
      case 'party_company':
        return row.partyCompany || '-';
      case 'created_at':
        return row.createdAt ? new Date(row.createdAt as any).toLocaleString('zh-CN') : '-';
      case 'current_holder':
        return row.holderName || row.currentHolder || '-';
      case 'storage_location':
        return row.storageLocation || '-';
      case 'return_status':
        return row.returnStatus || '-';
      case 'scan_file_path':
        return row.scanFilePath ? '有' : '-';
      default:
        return '-';
    }
  }

  function columnTitle(key: string) {
    const map: Record<string, string> = {
      sign_date: '签订日期',
      company_id: '公司',
      contract_no: '合同编号',
      title: '标题',
      contract_type: '类型',
      total_amount: '金额',
      end_date: '到期日',
      status: '状态',
      primary_handler: '第一接收人',
      party_company: '签订方',
      created_at: '创建时间',
      current_holder: '当前负责人',
      storage_location: '存放位置',
      return_status: '纸质件状态',
      scan_file_path: '扫描件',
    };
    return map[key] || key;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">合同管理</h1>
          <p className="text-sm text-muted-foreground">列表 / 筛选 / 分页（关键词至少 2 个字符）</p>
        </div>
        <Button onClick={() => router.push('/contracts/new')}>新建合同</Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="w-[200px] space-y-2">
            <div className="text-xs text-muted-foreground">公司</div>
            <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="公司" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部公司</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[200px] space-y-2">
            <div className="text-xs text-muted-foreground">类型</div>
            <Select value={contractType} onValueChange={(v) => { setContractType(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部类型</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[200px] space-y-2">
            <div className="text-xs text-muted-foreground">状态</div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部状态</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[320px] space-y-2">
            <div className="text-xs text-muted-foreground">关键词</div>
            <div className="flex gap-2">
              <Input
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                placeholder="编号/标题/合作方（≥2字符）"
              />
              <Button type="button" variant="secondary" onClick={applyKeyword}>
                应用
              </Button>
            </div>
          </div>
        </div>

        <ColumnSettings
          currentOrder={columns}
          currentPageSize={pageSize}
          onSave={async (next, ps) => {
            const res = await fetch('/api/users/me/preferences', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ listColumns: next, listPageSize: ps }),
            });
            const j = (await res.json()) as { code: number; message?: string };
            if (!res.ok || j.code !== 0) {
              throw new Error(j.message || '保存失败');
            }
            setColumns(next);
            setPageSize(ps);
            setPage(1);
            await mutatePref();
          }}
        />
      </div>

      {error ? (
        <div className="text-sm text-destructive">加载失败：{(error as Error).message}</div>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{columnTitle(c)}</TableHead>
              ))}
              <TableHead className="w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center text-sm text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/contracts/${row.id}`)}
                >
                  {columns.map((c) => (
                    <TableCell key={c}>{renderCell(row, c)}</TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/contracts/${row.id}/edit`);
                      }}
                    >
                      编辑
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            共 {pagination.total} 条；第 {pagination.page}/{Math.max(1, pagination.totalPages)} 页
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </Button>
            <Button
              variant="outline"
              disabled={pagination.totalPages === 0 ? true : page >= pagination.totalPages}
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
