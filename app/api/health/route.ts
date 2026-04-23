import { NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';
import { wecom } from '@/lib/wecom';

export async function GET() {
  const checks: Record<string, any> = {
    database: { status: 'unknown', latencyMs: null as number | null, error: null as string | null },
    wecom: { status: 'unknown', configured: wecom.isConfigured(), error: null as string | null },
  };

  try {
    const start = Date.now();
    sqlite.prepare('select 1 as ok').get();
    checks.database.status = 'ok';
    checks.database.latencyMs = Date.now() - start;
  } catch (e) {
    checks.database.status = 'error';
    checks.database.error = e instanceof Error ? e.message : String(e);
  }

  try {
    if (!wecom.isConfigured()) {
      checks.wecom.status = 'not_configured';
    } else {
      await wecom.getAccessToken();
      checks.wecom.status = 'ok';
    }
  } catch (e) {
    checks.wecom.status = 'error';
    checks.wecom.error = e instanceof Error ? e.message : String(e);
  }

  const degraded = Object.values(checks).some(
    (c: any) => c.status === 'error',
  );

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'healthy',
      service: 'wjglxt',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: degraded ? 503 : 200 },
  );
}
