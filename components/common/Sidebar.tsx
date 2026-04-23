/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { fetcher } from '@/lib/fetcher';

type MeResp = {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions?: {
    allowedPages?: string[];
    canManageUsers?: boolean;
  };
};

type NavItem = { href: string; label: string };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: '文件管理',
    items: [
      { href: '/contracts', label: '合同管理' },
      { href: '/archives', label: '档案管理' },
    ],
  },
  {
    title: '信息管理',
    items: [{ href: '/reminders', label: '提醒管理' }],
  },
  {
    title: '页面管理',
    items: [
      { href: '/settings/enums', label: '枚举配置' },
      { href: '/settings/companies', label: '公司配置' },
      { href: '/settings/backup', label: '备份配置' },
      { href: '/settings/wecom', label: '企业微信' },
      { href: '/settings/logs', label: '审计日志' },
    ],
  },
  {
    title: '用户管理',
    items: [{ href: '/settings/users', label: '用户权限' }],
  },
];

function normalizeAllowedPages(list: string[] | undefined) {
  const raw = Array.isArray(list) ? list : [];
  const cleaned = raw
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .map((s) => (s.startsWith('/') ? s : `/${s}`));
  return cleaned.length ? cleaned : ['/'];
}

function canSeePath(pathname: string, allowed: string[]) {
  if (allowed.includes('/')) return true;
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p));
}

function linkClass(active: boolean) {
  return [
    'block rounded-md px-2 py-2 text-sm transition-colors',
    active ? 'bg-accent font-medium' : 'hover:bg-accent',
  ].join(' ');
}

function greetingByLocalTime(d: Date) {
  const h = d.getHours();
  if (h < 11) return '早~';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: meResp } = useSWR('/api/users/me', fetcher<MeResp>);
  const me = meResp?.data;

  const [welcomeLabel, setWelcomeLabel] = useState('欢迎页');

  useEffect(() => {
    const tick = () => setWelcomeLabel(greetingByLocalTime(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const allowedPages =
    me?.role === 'admin'
      ? ['/']
      : normalizeAllowedPages(me?.permissions?.allowedPages);

  const groups = NAV_GROUPS.map((g) => {
    if (g.title === '用户管理') {
      const canManage = me?.role === 'admin' || !!me?.permissions?.canManageUsers;
      if (!canManage) return null;
    }
    const visibleItems = g.items.filter((it) => canSeePath(it.href, allowedPages));
    if (visibleItems.length === 0) return null;
    return { ...g, items: visibleItems };
  }).filter(Boolean) as { title: string; items: NavItem[] }[];

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex flex-col leading-tight">
          <div className="text-sm font-semibold">wjglxt</div>
          <div className="text-xs text-muted-foreground">文件管理系统</div>
        </div>
        <Badge className="ml-auto" variant="secondary">
          dev
        </Badge>
      </div>

      <nav className="space-y-4 p-3">
        <div className="space-y-1">
          <Link href="/" className={linkClass(pathname === '/')}>
            {welcomeLabel}
          </Link>
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-1 py-2 text-xs font-semibold text-muted-foreground">
              {g.title}
            </div>
            <div className="space-y-1">
              {g.items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                return (
                  <Link key={it.href} href={it.href} className={linkClass(active)}>
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
