import { NextResponse } from 'next/server';

export function success<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ code: 0, message: 'OK', data }, init);
}

export function successWithPagination<T>(
  data: T,
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  },
  init?: ResponseInit,
) {
  return NextResponse.json({ code: 0, message: 'OK', data, pagination }, init);
}

export function failure(
  code: number,
  message: string,
  status: number = 400,
  data?: unknown,
) {
  return NextResponse.json({ code, message, data: data ?? null }, { status });
}
