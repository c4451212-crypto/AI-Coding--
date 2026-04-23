import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WelcomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">欢迎进入系统</h1>
        <p className="text-sm text-muted-foreground">
          左侧为双栏导航入口：管理员可见全部菜单，普通用户仅展示管理员在【用户管理】里授予的页面。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>文件管理</CardTitle>
            <CardDescription>合同与纸质档案流转</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/contracts">合同管理</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/archives">档案管理</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>信息管理</CardTitle>
            <CardDescription>到期/付款/自定义提醒</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/reminders">提醒管理</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统配置</CardTitle>
            <CardDescription>枚举、公司、备份、企业微信</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/settings/enums">枚举</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/companies">公司</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/backup">备份</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/wecom">企业微信</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
