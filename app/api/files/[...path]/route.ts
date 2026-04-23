import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, contracts } from '@/lib/db/schema';
import { canViewCompany } from '@/lib/utils/contract-access';
import { assertSafeRelativeContractsPath, getUploadRootDir } from '@/lib/utils/upload-path';

function contentTypeForExt(ext: string) {
  switch (ext.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  const user = await auth(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const segments = context.params.path ?? [];
  const rel = segments.join('/').replaceAll('\\', '/');
  try {
    assertSafeRelativeContractsPath(rel);
  } catch {
    return new Response('Forbidden', { status: 403 });
  }

  const uploadRoot = path.resolve(getUploadRootDir());
  const filePath = path.resolve(uploadRoot, ...segments);
  if (!filePath.startsWith(uploadRoot + path.sep) && filePath !== uploadRoot) {
    return new Response('Forbidden', { status: 403 });
  }
  if (!existsSync(filePath)) {
    return new Response('Not Found', { status: 404 });
  }

  const rows = await db
    .select()
    .from(contracts)
    .where(eq(contracts.scanFilePath, rel))
    .limit(1);
  const contract = rows[0];
  if (!contract) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!canViewCompany(user, contract.companyId)) {
    return new Response('Forbidden', { status: 403 });
  }

  const buf = await readFile(filePath);
  const ext = path.extname(filePath).replace(/^\./, '');

  db.insert(auditLogs).values({
    userId: user.sub,
    action: 'VIEW_SCAN',
    targetType: 'contract',
    targetId: contract.id,
    details: JSON.stringify({ filePath: rel }),
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  return new Response(buf, {
    headers: {
      'Content-Type': contentTypeForExt(ext),
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
