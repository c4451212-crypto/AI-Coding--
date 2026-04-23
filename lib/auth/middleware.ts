import type { NextRequest } from 'next/server';

/**
 * API 路由权限中间件（骨架）
 *
 * 后续建议：
 * - 从 `Authorization: Bearer` 或 cookie 读取 JWT
 * - 将 `userId`/`role` 注入 request headers（或统一 auth helper）
 */
export function extractBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}
