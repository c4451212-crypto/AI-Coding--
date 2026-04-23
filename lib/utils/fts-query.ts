/**
 * 将用户输入转为 FTS5 MATCH 安全表达式（避免注入与语法错误）。
 * 空格分词，每段用双引号包裹并加前缀匹配 *。
 */
export function buildFtsPrefixMatch(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return null;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  for (const t of tokens) {
    const safe = t.replaceAll('"', '').replaceAll('*', '').slice(0, 64);
    if (!safe) continue;
    parts.push(`"${safe}"*`);
  }
  if (parts.length === 0) return null;
  return parts.join(' AND ');
}
