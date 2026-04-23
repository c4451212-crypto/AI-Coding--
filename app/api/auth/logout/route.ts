import { NextResponse } from 'next/server';

import { success } from '@/lib/api-response';

export async function POST() {
  const res = success(null);
  res.cookies.set('token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
