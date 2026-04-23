'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const from = useMemo(() => {
    const raw = searchParams.get('from') || '/';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
    return raw;
  }, [searchParams]);

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const json = (await res.json()) as {
        code: number;
        message?: string;
        data?: unknown;
      };

      if (!res.ok || json.code !== 0) {
        toast({
          title: '登录失败',
          description: json.message || `HTTP ${res.status}`,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: '登录成功' });
      router.push(from);
      router.refresh();
    } catch (err) {
      toast({
        title: '登录失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>登录</CardTitle>
        <CardDescription>默认账号：admin / admin123（种子脚本写入）</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button asChild type="button" variant="outline" disabled={loading}>
            <Link href="/">返回看板</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
