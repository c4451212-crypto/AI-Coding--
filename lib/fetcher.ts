export type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export async function fetcher<T = unknown>(url: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const json = (await res.json()) as ApiEnvelope<T> & { code?: number; message?: string };

  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `请求失败（HTTP ${res.status}）`);
  }

  return json as ApiEnvelope<T>;
}
