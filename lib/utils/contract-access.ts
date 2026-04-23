import type { JWTPayload } from '@/lib/auth';

export function canViewCompany(user: JWTPayload, companyId: number) {
  if (user.role === 'admin') return true;
  return user.permissions.viewCompanyIds.includes(companyId);
}

export function canEditContracts(user: JWTPayload) {
  return user.role === 'admin' || user.permissions.canEditContracts;
}

export function canDeleteContracts(user: JWTPayload) {
  return user.role === 'admin' || user.permissions.canDeleteContracts;
}

export function canEditContractForCompany(user: JWTPayload, companyId: number) {
  if (!canEditContracts(user)) return false;
  return canViewCompany(user, companyId);
}
