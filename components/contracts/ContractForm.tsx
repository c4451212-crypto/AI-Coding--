'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetcher } from '@/lib/fetcher';
import { useToast } from '@/hooks/use-toast';

type CompanyRow = {
  id: number;
  shortName: string;
  name: string;
};

type EnumRow = { code: string; name: string };

type PaymentDraft = {
  nodeName: string;
  percentage: string;
  amount: string;
  dueDate: string;
};

export function ContractForm({
  mode,
  contractId,
}: {
  mode: 'create' | 'edit';
  contractId?: number;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const { data: companiesResp } = useSWR(`/api/companies`, fetcher<CompanyRow[]>);
  const { data: typesResp } = useSWR(`/api/configs?category=contract_type`, fetcher<EnumRow[]>);
  const { data: currenciesResp } = useSWR(`/api/configs?category=currency`, fetcher<EnumRow[]>);

  const companies = companiesResp?.data ?? [];
  const types = typesResp?.data ?? [];
  const currencies = currenciesResp?.data ?? [];

  const [step, setStep] = useState(0);

  const [title, setTitle] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [contractType, setContractType] = useState<string>('');
  const [subject, setSubject] = useState('');

  const [partyRole, setPartyRole] = useState('');
  const [partyCompany, setPartyCompany] = useState('');
  const [partyPerson, setPartyPerson] = useState('');
  const [partyContact, setPartyContact] = useState('');

  const [signDate, setSignDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('CNY');

  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const detailKey = mode === 'edit' && contractId ? `/api/contracts/${contractId}` : null;
  const { data: detailResp, isLoading: detailLoading } = useSWR(
    detailKey,
    detailKey ? fetcher : null,
  );

  useEffect(() => {
    if (mode !== 'edit') return;
    const payload = detailResp?.data as
      | {
          contract: any;
          company: any;
          paymentSchedules: any[];
        }
      | undefined;
    if (!payload?.contract) return;

    const c = payload.contract;
    setTitle(c.title ?? '');
    setCompanyId(String(c.companyId ?? ''));
    setContractType(String(c.contractType ?? ''));
    setSubject(c.subject ?? '');
    setPartyRole(c.partyRole ?? '');
    setPartyCompany(c.partyCompany ?? '');
    setPartyPerson(c.partyPerson ?? '');
    setPartyContact(c.partyContact ?? '');
    setSignDate(c.signDate ? new Date(c.signDate).toISOString().slice(0, 10) : '');
    setEndDate(c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : '');
    setTotalAmount(c.totalAmount != null ? String(Number(c.totalAmount) / 100) : '');
    setCurrency(c.currency ?? 'CNY');

    setPayments(
      (payload.paymentSchedules ?? []).map((p) => ({
        nodeName: String(p.nodeName ?? ''),
        percentage:
          p.percentage == null || p.percentage === ''
            ? ''
            : String(Number(p.percentage) / 100),
        amount: String(Number(p.amount) / 100),
        dueDate: p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : '',
      })),
    );
  }, [mode, contractId, detailResp]);

  function addPayment() {
    setPayments((p) => [...p, { nodeName: '', percentage: '', amount: '', dueDate: '' }]);
  }

  function updatePayment(index: number, patch: Partial<PaymentDraft>) {
    setPayments((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!title.trim()) return toast({ title: '请填写标题', variant: 'destructive' });
    if (!companyId) return toast({ title: '请选择公司', variant: 'destructive' });
    if (!contractType) return toast({ title: '请选择合同类型', variant: 'destructive' });
    if (!endDate) return toast({ title: '请填写到期日', variant: 'destructive' });

    const payload: any = {
      title: title.trim(),
      companyId: parseInt(companyId, 10),
      contractType,
      endDate,
      subject: subject.trim() || null,
      partyRole: partyRole.trim() || null,
      partyCompany: partyCompany.trim() || null,
      partyPerson: partyPerson.trim() || null,
      partyContact: partyContact.trim() || null,
      signDate: signDate ? `${signDate}T00:00:00.000Z` : null,
      totalAmount: totalAmount.trim() === '' ? 0 : Number(totalAmount),
      currency,
      paymentSchedules: payments
        .filter((p) => p.nodeName.trim() && p.amount.trim() && p.dueDate.trim())
        .map((p) => ({
          nodeName: p.nodeName.trim(),
          percentage: p.percentage.trim() === '' ? null : Number(p.percentage),
          amount: Number(p.amount),
          dueDate: `${p.dueDate}T00:00:00.000Z`,
        })),
    };

    try {
      const url = mode === 'create' ? '/api/contracts' : `/api/contracts/${contractId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }

      const id = mode === 'create' ? json.data?.id : contractId;
      if (file && id) {
        const fd = new FormData();
        fd.set('file', file);
        const up = await fetch(`/api/contracts/${id}/scan`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        const upJson = await up.json();
        if (!up.ok || upJson.code !== 0) {
          throw new Error(upJson.message || `上传失败（HTTP ${up.status}）`);
        }
      }

      toast({ title: mode === 'create' ? '创建成功' : '保存成功' });
      router.push(`/contracts/${id}`);
      router.refresh();
    } catch (e) {
      toast({
        title: '提交失败',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  }

  if (mode === 'edit' && (!contractId || detailLoading)) {
    return <div className="text-sm text-muted-foreground">加载合同数据…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{mode === 'create' ? '新建合同' : '编辑合同'}</div>
          <div className="text-sm text-muted-foreground">
            分步填写：{step + 1}/5（最后一步可上传扫描件）
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => router.push('/contracts')}>
          返回列表
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {['基本信息', '签订方', '时间金额', '付款节点', '扫描件'].map((label, idx) => (
          <button
            key={label}
            type="button"
            className={`rounded-full border px-3 py-1 ${idx === step ? 'bg-accent' : ''}`}
            onClick={() => setStep(idx)}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>公司</Label>
                <Select value={companyId || undefined} onValueChange={setCompanyId}>
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
                <Label>合同类型</Label>
                <Select value={contractType || undefined} onValueChange={setContractType}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>标的（可选）</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>签订方信息</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>我方角色（可选）</Label>
              <Input value={partyRole} onChange={(e) => setPartyRole(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>对方企业（可选）</Label>
              <Input value={partyCompany} onChange={(e) => setPartyCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>对方个人（可选）</Label>
              <Input value={partyPerson} onChange={(e) => setPartyPerson(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>对方联系方式（可选）</Label>
              <Input value={partyContact} onChange={(e) => setPartyContact(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>时间金额</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>签订日期（可选）</Label>
              <Input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>到期日</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>金额（元）</Label>
              <Input inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>币种</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(currencies.length ? currencies : [{ code: 'CNY', name: '人民币' }]).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>付款节点</CardTitle>
            <Button type="button" variant="secondary" onClick={addPayment}>
              添加节点
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 ? (
              <div className="text-sm text-muted-foreground">可选：不添加付款节点也可提交。</div>
            ) : null}
            {payments.map((p, idx) => (
              <div key={idx} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">节点 {idx + 1}</div>
                  <Button type="button" variant="outline" size="sm" onClick={() => removePayment(idx)}>
                    删除
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>节点名称</Label>
                  <Input value={p.nodeName} onChange={(e) => updatePayment(idx, { nodeName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>百分比（如 30 表示 30%）</Label>
                  <Input value={p.percentage} onChange={(e) => updatePayment(idx, { percentage: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>金额（元）</Label>
                  <Input value={p.amount} onChange={(e) => updatePayment(idx, { amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>计划付款日</Label>
                  <Input type="date" value={p.dueDate} onChange={(e) => updatePayment(idx, { dueDate: e.target.value })} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>扫描件（可选）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="text-xs text-muted-foreground">PDF/JPG/PNG，最大 50MB。提交后自动上传。</div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          上一步
        </Button>
        {step < 4 ? (
          <Button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))}>
            下一步
          </Button>
        ) : (
          <Button type="button" onClick={submit}>
            提交
          </Button>
        )}
      </div>
    </div>
  );
}
