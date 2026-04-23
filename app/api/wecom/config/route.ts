import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { wecom } from '@/lib/wecom';

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  return success({
    configured: wecom.isConfigured(),
    corpId: process.env.WECOM_CORP_ID ? '***' : '',
    agentId: process.env.WECOM_AGENT_ID ? '***' : '',
    secret: process.env.WECOM_SECRET ? '***' : '',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
  });
}

