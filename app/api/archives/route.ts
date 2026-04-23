import { and, eq, like } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { contracts } from '@/lib/db/schema';
import { canViewCompany } from '@/lib/utils/contract-access';

type Cabinet = 'A' | 'B' | 'C';

function asCabinet(v: string | null): Cabinet {
  if (v === 'B' || v === 'C') return v;
  return 'A';
}

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const cabinet = asCabinet(searchParams.get('cabinet'));

  const rows = await db
    .select({
      id: contracts.id,
      contractNo: contracts.contractNo,
      title: contracts.title,
      companyId: contracts.companyId,
      storageLocation: contracts.storageLocation,
      returnStatus: contracts.returnStatus,
      borrower: contracts.borrower,
      expectedReturnDate: contracts.expectedReturnDate,
    })
    .from(contracts)
    .where(
      and(
        like(contracts.storageLocation, `${cabinet}-%`),
        eq(contracts.returnStatus, contracts.returnStatus),
      ),
    );

  const visible = rows.filter((c) => canViewCompany(user, c.companyId));

  const byLocation = new Map(
    visible
      .filter((c) => typeof c.storageLocation === 'string' && c.storageLocation)
      .map((c) => [c.storageLocation!, c]),
  );

  const slots = [];
  for (let layer = 1; layer <= 5; layer++) {
    for (let num = 1; num <= 10; num++) {
      const location = `${cabinet}-${layer}-${num}`;
      const contract = byLocation.get(location);
      const status = contract
        ? contract.returnStatus === '已借出' || contract.returnStatus === '逾期'
          ? 'borrowed'
          : 'occupied'
        : 'empty';

      slots.push({
        location,
        status,
        contract: contract
          ? {
              id: contract.id,
              contractNo: contract.contractNo,
              title: contract.title,
              borrower: contract.borrower,
              expectedReturn: contract.expectedReturnDate,
              returnStatus: contract.returnStatus,
            }
          : null,
      });
    }
  }

  return success(slots);
}

