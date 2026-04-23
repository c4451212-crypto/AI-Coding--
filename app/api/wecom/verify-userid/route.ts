import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { WeComService } from '@/lib/wecom';

const bodySchema = z.object({
  userid: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (user.role !== 'admin') return failure(1002, 'Forbidden', 403);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return failure(1004, '参数错误', 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return failure(1004, '参数错误', 400);

  const svc = new WeComService();
  if (!svc.isConfigured()) {
    return failure(1004, '企业微信应用未配置（WECOM_CORP_ID / WECOM_AGENT_ID / WECOM_SECRET）', 400);
  }

  const detail = (await svc.getUserDetail(parsed.data.userid)) as any;
  if (!detail || typeof detail.errcode !== 'number' || detail.errcode !== 0) {
    return failure(
      1004,
      `userid 校验失败：${detail?.errmsg || 'unknown'}（errcode=${detail?.errcode ?? '-'})`,
      400,
    );
  }

  return success({
    userid: detail.userid,
    name: detail.name,
    mobile: detail.mobile,
    department: detail.department,
    position: detail.position,
  });
}
