'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const ROLES = [
  { key: 'admin', label: '系统管理员' },
  { key: 'archivist', label: '档案管理员' },
  { key: 'manager', label: '业务负责人' },
  { key: 'finance', label: '财务专员' },
  { key: 'hr', label: '人事专员' },
  { key: 'viewer', label: '普通查看者' },
] as const;

type UserRow = {
  id: number;
  username: string;
  name: string;
  wecomUserid: string | null;
  role: string;
  isActive: boolean;
  createdAt: string | Date;
};

type CompanyRow = { id: number; name: string; shortName: string; isActive: boolean };

type PermRow = {
  viewCompanyIds: number[];
  allowedPages: string[];
  canEditContracts: boolean;
  canDeleteContracts: boolean;
  canManageUsers: boolean;
  canBorrowPaper: boolean;
};

const PAGE_OPTIONS = [
  { key: '/', label: '欢迎页（/）' },
  { key: '/contracts', label: '合同管理（/contracts）' },
  { key: '/archives', label: '档案管理（/archives）' },
  { key: '/reminders', label: '提醒管理（/reminders）' },
  { key: '/settings/enums', label: '枚举配置（/settings/enums）' },
  { key: '/settings/companies', label: '公司配置（/settings/companies）' },
  { key: '/settings/backup', label: '备份配置（/settings/backup）' },
  { key: '/settings/wecom', label: '企业微信（/settings/wecom）' },
  { key: '/settings/logs', label: '审计日志（/settings/logs）' },
  { key: '/settings/users', label: '用户管理（/settings/users）' },
];

export default function SettingsUsersPage() {
  const { data: usersResp, error: usersError, mutate: mutateUsers } = useSWR('/api/users', fetcher<UserRow[]>);
  const { data: companiesResp } = useSWR('/api/companies', fetcher<CompanyRow[]>);

  const rows = usersResp?.data ?? [];
  const companies = (companiesResp?.data ?? []).filter((c) => c.isActive);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const [form, setForm] = useState({
    username: '',
    name: '',
    wecomUserid: '',
    role: 'viewer',
    password: '',
    isActive: true,
    viewCompanyIds: [] as number[],
    allowedPages: ['/'] as string[],
    canEditContracts: false,
    canDeleteContracts: false,
    canManageUsers: false,
    canBorrowPaper: false,
  });

  const mode = editing?.id ? 'edit' : 'create';

  useEffect(() => {
    if (!open) return;
    if (!editing) {
      setForm({
        username: '',
        name: '',
        wecomUserid: '',
        role: 'viewer',
        password: '',
        isActive: true,
        viewCompanyIds: [],
        allowedPages: ['/'],
        canEditContracts: false,
        canDeleteContracts: false,
        canManageUsers: false,
        canBorrowPaper: false,
      });
      return;
    }
    setForm((p) => ({
      ...p,
      username: editing.username,
      name: editing.name,
      wecomUserid: editing.wecomUserid || '',
      role: editing.role,
      password: '',
      isActive: editing.isActive,
    }));
  }, [open, editing]);

  async function openEdit(u: UserRow) {
    setEditing(u);
    setOpen(true);
    try {
      const res = await fetch(`/api/users/${u.id}/permissions`, { credentials: 'include' });
      const j = await res.json();
      if (!res.ok || j.code !== 0) throw new Error(j.message || '加载权限失败');
      const p = j.data as PermRow;
      setForm((prev) => ({
        ...prev,
        viewCompanyIds: p.viewCompanyIds ?? [],
        allowedPages: Array.isArray(p.allowedPages) && p.allowedPages.length ? p.allowedPages : ['/'],
        canEditContracts: !!p.canEditContracts,
        canDeleteContracts: !!p.canDeleteContracts,
        canManageUsers: !!p.canManageUsers,
        canBorrowPaper: !!p.canBorrowPaper,
      }));
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  async function verifyWecomUserid() {
    const userid = form.wecomUserid.trim();
    if (!userid) {
      window.alert('请先填写企业微信 userid');
      return;
    }
    const res = await fetch('/api/wecom/verify-userid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userid }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '校验失败');
    const d = j.data as { name?: string; userid?: string; position?: string; mobile?: string };
    window.alert(
      `校验成功：\nuserid：${d.userid || userid}\n姓名：${d.name || '-'}\n岗位：${d.position || '-'}\n手机：${d.mobile || '-'}`,
    );
  }

  async function submit() {
    if (mode === 'create') {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: form.username,
          name: form.name,
          wecomUserid: form.wecomUserid || null,
          role: form.role,
          password: form.password,
        }),
      });
      const j = await res.json();
      if (!res.ok || j.code !== 0) throw new Error(j.message || '创建失败');
      await mutateUsers();
      setOpen(false);
      setEditing(null);
      return;
    }

    const res = await fetch(`/api/users/${editing!.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: form.name,
        wecomUserid: form.wecomUserid || null,
        role: form.role,
        isActive: form.isActive,
        password: form.password || undefined,
        viewCompanyIds: form.viewCompanyIds,
        allowedPages: form.allowedPages,
        canEditContracts: form.canEditContracts,
        canDeleteContracts: form.canDeleteContracts,
        canManageUsers: form.canManageUsers,
        canBorrowPaper: form.canBorrowPaper,
      }),
    });
    const j = await res.json();
    if (!res.ok || j.code !== 0) throw new Error(j.message || '保存失败');
    await mutateUsers();
    setOpen(false);
    setEditing(null);
  }

  function roleLabel(role: string) {
    return ROLES.find((r) => r.key === role)?.label || role;
  }

  const dialogTitle = useMemo(() => (mode === 'create' ? '新增用户' : `编辑用户：${editing?.username}`), [mode, editing]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">用户权限管理</h2>
        <Button type="button" onClick={() => { setEditing(null); setOpen(true); }}>
          新增用户
        </Button>
      </div>

      {usersError ? <div className="text-sm text-destructive">加载失败：{(usersError as Error).message}</div> : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>企业微信</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-[140px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  暂无用户
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.username}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.wecomUserid || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'default' : 'secondary'}>{u.isActive ? '启用' : '禁用'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(u)}>
                      编辑
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {mode === 'create' ? (
              <div className="space-y-2">
                <div className="text-sm">用户名</div>
                <Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm">姓名</div>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <div className="text-sm">企业微信 userid</div>
              <div className="flex gap-2">
                <Input
                  value={form.wecomUserid}
                  onChange={(e) => setForm((p) => ({ ...p, wecomUserid: e.target.value }))}
                  placeholder="与通讯录员工 userid 一致（用于个人消息推送）"
                />
                {mode === 'edit' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => verifyWecomUserid().catch((e) => window.alert((e as Error).message))}
                  >
                    校验
                  </Button>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                绑定关系：系统用户（账号/角色） → 企业微信 userid。个人类通知会按该 userid 发送；群通知走【企业微信】页的群机器人映射。
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm">{mode === 'create' ? '初始密码' : '重置密码（可选）'}</div>
              <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <div className="text-sm">角色</div>
              <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === 'edit' ? (
              <>
                <div className="rounded-md border p-3 space-y-2">
                  <div className="font-medium text-sm">可见公司</div>
                  <div className="space-y-1 text-sm">
                    {companies.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={form.viewCompanyIds.includes(c.id)}
                          onChange={(e) => {
                            setForm((p) => ({
                              ...p,
                              viewCompanyIds: e.target.checked
                                ? [...p.viewCompanyIds, c.id]
                                : p.viewCompanyIds.filter((x) => x !== c.id),
                            }));
                          }}
                        />
                        <span>{c.shortName}（{c.name}）</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <div className="font-medium text-sm">页面可见权限（导航显示）</div>
                  <div className="space-y-1 text-sm">
                    {PAGE_OPTIONS.map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={form.allowedPages.includes(opt.key)}
                          onChange={(e) => {
                            setForm((p) => {
                              const next = e.target.checked
                                ? Array.from(new Set([...p.allowedPages, opt.key]))
                                : p.allowedPages.filter((x) => x !== opt.key);
                              return { ...p, allowedPages: next.length ? next : ['/'] };
                            });
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    提示：管理员角色默认展示全部菜单；普通用户仅展示这里勾选的页面入口。
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <div className="font-medium text-sm">功能权限</div>
                  {([
                    ['canEditContracts', '编辑合同'],
                    ['canDeleteContracts', '删除合同'],
                    ['canManageUsers', '管理用户'],
                    ['canBorrowPaper', '纸质件借还'],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={(form as any)[k] as boolean}
                        onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.checked } as any))}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <div className="font-medium text-sm">账号状态</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                    <span>启用</span>
                  </label>
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button type="button" onClick={() => submit().then(() => undefined).catch((e) => window.alert((e as Error).message))}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
