import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  return success({
    id: user.sub,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
  });
}
