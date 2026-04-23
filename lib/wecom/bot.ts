export type WeComBotSendResult = { ok: boolean; status: number; message?: string };

function normalizeWebhook(webhook: string) {
  const s = webhook.trim();
  if (!s) return '';
  if (s.startsWith('http')) return s;
  // allow passing only "key=xxx" or raw key
  const key = s.includes('key=') ? s.split('key=').pop() : s;
  return `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(
    key || '',
  )}`;
}

export async function sendGroupMarkdown(
  webhook: string | undefined,
  markdown: string,
  opts?: { mentionAll?: boolean },
): Promise<WeComBotSendResult> {
  const url = normalizeWebhook(webhook || '');
  if (!url) return { ok: false, status: 0, message: '企业微信群机器人未配置' };

  const payload: any = {
    msgtype: 'markdown',
    markdown: { content: markdown },
  };
  if (opts?.mentionAll) {
    payload.markdown.mentioned_list = ['@all'];
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = (await res.json().catch(() => null)) as
      | { errcode?: number; errmsg?: string }
      | null;

    if (!res.ok) {
      return { ok: false, status: res.status, message: j?.errmsg || res.statusText };
    }
    if (j?.errcode !== 0) {
      return { ok: false, status: res.status, message: j?.errmsg || '发送失败' };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

