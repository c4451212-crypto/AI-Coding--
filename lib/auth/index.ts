import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

export type JwtPermissions = {
  viewCompanyIds: number[];
  allowedPages: string[];
  canEditContracts: boolean;
  canDeleteContracts: boolean;
  canManageUsers: boolean;
  canBorrowPaper: boolean;
};

export type JWTPayload = {
  sub: number;
  username: string;
  name: string;
  role: string;
  permissions: JwtPermissions;
};

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

export function signAccessToken(
  payload: JWTPayload,
  expiresIn: NonNullable<SignOptions['expiresIn']> = '8h',
) {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as unknown as JWTPayload;
}

export async function auth(request: NextRequest): Promise<JWTPayload | null> {
  const cookieToken = request.cookies.get('token')?.value;
  const header = request.headers.get('authorization');
  const bearer =
    header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const token = cookieToken ?? bearer;
  if (!token) return null;

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

export function checkPermission(
  user: JWTPayload,
  permission: keyof JwtPermissions,
): boolean {
  if (user.role === 'admin') return true;
  const value = user.permissions?.[permission];
  if (typeof value === 'boolean') return value;
  return false;
}
