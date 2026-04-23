import { desc, like } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type * as schema from '@/lib/db/schema';
import { contracts } from '@/lib/db/schema';

/**
 * 生成合同编号：{年}-{公司简称}-{合同类型}-{序号}
 * 例：2026-母-租赁-001
 */
export async function generateContractNo(
  db: BetterSQLite3Database<typeof schema>,
  companyShortName: string,
  contractType: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-${companyShortName}-${contractType}-`;

  const rows = await db
    .select({ contractNo: contracts.contractNo })
    .from(contracts)
    .where(like(contracts.contractNo, `${prefix}%`))
    .orderBy(desc(contracts.contractNo))
    .limit(1);

  let seq = 1;
  const lastNo = rows[0]?.contractNo;
  if (lastNo) {
    const tail = lastNo.split('-').pop();
    const n = tail ? parseInt(tail, 10) : NaN;
    if (!Number.isNaN(n)) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}
