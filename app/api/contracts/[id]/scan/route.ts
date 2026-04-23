import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { failure, success } from '@/lib/api-response';
import { auth, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { auditLogs, companies, contracts } from '@/lib/db/schema';
import { canEditContractForCompany, canViewCompany } from '@/lib/utils/contract-access';
import { getUploadRootDir } from '@/lib/utils/upload-path';

const allowedMime = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxSize = 50 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);
  if (!checkPermission(user, 'canEditContracts') && user.role !== 'admin') {
    return failure(1002, 'Forbidden', 403);
  }

  const contractId = parseInt(context.params.id, 10);
  if (Number.isNaN(contractId)) return failure(1004, '参数错误', 400);

  const rows = await db
    .select({
      contract: contracts,
      company: companies,
    })
    .from(contracts)
    .leftJoin(companies, eq(contracts.companyId, companies.id))
    .where(eq(contracts.id, contractId))
    .limit(1);

  const row = rows[0];
  if (!row?.contract) return failure(1003, '合同不存在', 404);

  if (!canViewCompany(user, row.contract.companyId)) {
    return failure(1002, 'Forbidden', 403);
  }
  if (!canEditContractForCompany(user, row.contract.companyId)) {
    return failure(1002, 'Forbidden', 403);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return failure(1004, '未上传文件', 400);
  }

  if (!allowedMime.has(file.type)) {
    return failure(1004, '仅支持PDF/JPG/PNG', 400);
  }
  if (file.size > maxSize) {
    return failure(1004, '文件超过50MB', 400);
  }

  const year = new Date().getFullYear();
  const companyShort = row.company?.shortName ?? 'unknown';
  const type = row.contract.contractType;

  const uploadRoot = getUploadRootDir();
  const uploadDir = path.join(uploadRoot, 'contracts', String(year), companyShort, type);
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  const timestamp = Date.now();
  const ext =
    file.type === 'application/pdf'
      ? 'pdf'
      : file.type === 'image/jpeg'
        ? 'jpg'
        : 'png';
  const filename = `${row.contract.contractNo}_${timestamp}.${ext}`;
  const absolutePath = path.join(uploadDir, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(absolutePath, Buffer.from(bytes));

  const relativePath = path.posix.join(
    'contracts',
    String(year),
    companyShort,
    type,
    filename,
  );

  db.transaction((tx) => {
    tx.update(contracts)
      .set({
        scanFilePath: relativePath,
        scanFileSize: file.size,
        scanUploadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    tx.insert(auditLogs).values({
      userId: user.sub,
      action: 'UPLOAD_SCAN',
      targetType: 'contract',
      targetId: contractId,
      details: JSON.stringify({ fileName: filename, size: file.size }),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  });

  return success({ filePath: relativePath, fileSize: file.size });
}
