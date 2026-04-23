import type { ReactNode } from 'react';
import Link from 'next/link';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const settingsNav = [
  { href: '/settings/companies', label: '公司管理' },
  { href: '/settings/enums', label: '枚举配置' },
  { href: '/settings/users', label: '用户权限' },
  { href: '/settings/backup', label: '备份管理' },
  { href: '/settings/wecom', label: '企业微信' },
  { href: '/settings/logs', label: '审计日志' },
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">系统设置</h1>

      <Tabs value="__nav__" className="w-full">
        <TabsList className="h-auto flex-wrap justify-start">
          {settingsNav.map((item) => (
            <TabsTrigger key={item.href} value={item.href} asChild>
              <Link href={item.href} className="cursor-pointer">
                {item.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div>{children}</div>
    </div>
  );
}

