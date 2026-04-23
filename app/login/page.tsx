import { Suspense } from 'react';

import { LoginForm } from '@/app/login/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">加载中…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
