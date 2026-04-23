import type { NextRequest } from 'next/server';

import { failure, success } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { sqlite } from '@/lib/db';
import { buildFtsPrefixMatch } from '@/lib/utils/fts-query';

type Row = Record<string, unknown>;

function mapRow(r: Row) {
  return {
    id: r.id,
    contractNo: r.contract_no,
    title: r.title,
    signDate: r.sign_date,
    endDate: r.end_date,
    totalAmount: r.total_amount,
    status: r.status,
    contractType: r.contract_type,
    companyShortName: r.company_short_name,
    companyId: r.company_id,
    contractTypeName: r.contract_type_name ?? '',
    holderName: r.holder_name ?? null,
  };
}

export async function GET(request: NextRequest) {
  const user = await auth(request);
  if (!user) return failure(1001, 'Unauthorized', 401);

  const { searchParams } = new URL(request.url);
  const qRaw = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '5', 10) || 5));
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '30', 10) || 30));

  if (qRaw.length < 2) {
    return success({
      suggestions: [],
      results: [],
      total: 0,
      page,
      pageSize,
      query: qRaw,
    });
  }

  const match = buildFtsPrefixMatch(qRaw);
  if (!match) {
    return success({
      suggestions: [],
      results: [],
      total: 0,
      page,
      pageSize,
      query: qRaw,
    });
  }

  const admin = user.role === 'admin';
  const companyIds = user.permissions?.viewCompanyIds ?? [];

  if (!admin && companyIds.length === 0) {
    return success({
      suggestions: [],
      results: [],
      total: 0,
      page,
      pageSize,
      query: qRaw,
    });
  }

  const companyClause =
    admin || companyIds.length === 0
      ? ''
      : ` AND c.company_id IN (${companyIds.map(() => '?').join(',')}) `;
  const companyParams = admin ? [] : companyIds;

  const suggestSql = `
    SELECT c.id, c.contract_no, c.title, comp.short_name AS company_short_name
    FROM contracts_fts
    JOIN contracts c ON contracts_fts.rowid = c.id
    JOIN companies comp ON c.company_id = comp.id
    WHERE contracts_fts MATCH ?
    ${companyClause}
    ORDER BY rank
    LIMIT ?
  `;

  const suggestStmt = sqlite.prepare(suggestSql);
  const suggestionRows = suggestStmt.all(match, ...companyParams, limit) as Row[];

  const suggestions = suggestionRows.map((s) => ({
    id: s.id,
    title: `${s.contract_no} - ${s.title}`,
    subtitle: String(s.company_short_name ?? ''),
  }));

  const offset = (page - 1) * pageSize;

  const resultsSql = `
    SELECT
      c.id,
      c.contract_no,
      c.title,
      c.sign_date,
      c.end_date,
      c.total_amount,
      c.status,
      c.contract_type,
      comp.short_name AS company_short_name,
      comp.id AS company_id,
      COALESCE(ct.name, '') AS contract_type_name,
      u.name AS holder_name
    FROM contracts_fts
    JOIN contracts c ON contracts_fts.rowid = c.id
    LEFT JOIN companies comp ON c.company_id = comp.id
    LEFT JOIN config_enums ct ON ct.category = 'contract_type'
      AND ct.code = c.contract_type AND ct.is_active = 1
    LEFT JOIN users u ON c.current_holder = u.username
    WHERE contracts_fts MATCH ?
    ${companyClause}
    ORDER BY rank
    LIMIT ? OFFSET ?
  `;

  const resultsStmt = sqlite.prepare(resultsSql);
  const resultRows = resultsStmt.all(match, ...companyParams, pageSize, offset) as Row[];

  const countSql = `
    SELECT COUNT(*) AS cnt
    FROM contracts_fts
    JOIN contracts c ON contracts_fts.rowid = c.id
    WHERE contracts_fts MATCH ?
    ${companyClause}
  `;
  const countStmt = sqlite.prepare(countSql);
  const countRow = countStmt.get(match, ...companyParams) as { cnt: number } | undefined;
  const total = Number(countRow?.cnt ?? 0);

  return success({
    suggestions,
    results: resultRows.map(mapRow),
    total,
    page,
    pageSize,
    query: qRaw,
  });
}
