import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function isPublicApiPath(pathname: string) {
  return (
    pathname === '/api/health' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/wecom/')
  );
}

function getToken(request: NextRequest) {
  const cookieToken = request.cookies.get('token')?.value;
  const header = request.headers.get('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  return cookieToken || bearer;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = getToken(request);

  if (pathname.startsWith('/api/')) {
    if (isPublicApiPath(pathname)) {
      return NextResponse.next();
    }
    if (!token) {
      return NextResponse.json(
        { code: 1001, message: 'Unauthorized', data: null },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  if (pathname === '/login') {
    return NextResponse.next();
  }

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
