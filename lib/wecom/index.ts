import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

interface WeComConfig {
  corpId: string;
  agentId: number;
  secret: string;
}

export type WeComSendResult = {
  errcode: number;
  errmsg: string;
  msgid?: string;
};

function readConfig(): WeComConfig | null {
  const corpId = process.env.WECOM_CORP_ID?.trim();
  const secret = process.env.WECOM_SECRET?.trim();
  const agentRaw = process.env.WECOM_AGENT_ID?.trim();
  if (!corpId || !secret || !agentRaw) return null;
  const agentId = parseInt(agentRaw, 10);
  if (Number.isNaN(agentId)) return null;
  return { corpId, secret, agentId };
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
  );
}

/**
 * 企业微信 API（基础封装）。未配置环境变量时所有发送方法会优雅降级并写审计日志。
 */
export class WeComService {
  private accessToken: string | null = null;
  private tokenExpireTime = 0;

  isConfigured(): boolean {
    return readConfig() !== null;
  }

  async getAccessToken(): Promise<string> {
    const cfg = readConfig();
    if (!cfg) {
      throw new Error('企业微信未配置（缺少 WECOM_CORP_ID / WECOM_AGENT_ID / WECOM_SECRET）');
    }

    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(
      cfg.corpId,
    )}&corpsecret=${encodeURIComponent(cfg.secret)}`;
    const res = await fetch(url);
    const data = (await res.json()) as { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number };

    if (data.errcode !== 0 || !data.access_token) {
      throw new Error(`获取 Token 失败: ${data.errmsg ?? res.statusText}`);
    }

    this.accessToken = data.access_token;
    const ttl = (data.expires_in ?? 7200) - 300;
    this.tokenExpireTime = Date.now() + Math.max(60, ttl) * 1000;
    return this.accessToken;
  }

  /**
   * 仅用于健康检查：未配置返回 null；配置错误抛出。
   */
  async tryGetAccessToken(): Promise<{ token: string; expiresInSec: number } | null> {
    if (!this.isConfigured()) return null;
    const token = await this.getAccessToken();
    const expiresInSec = Math.max(0, Math.floor((this.tokenExpireTime - Date.now()) / 1000));
    return { token, expiresInSec };
  }

  async sendCardMessage(
    userIds: string[],
    title: string,
    description: string,
    url: string,
    btntxt: string = '查看详情',
  ): Promise<WeComSendResult> {
    const cfg = readConfig();
    if (!cfg || userIds.length === 0) {
      await this.logSend(userIds, title, { errcode: -1, errmsg: '未配置或无接收人' });
      return { errcode: -1, errmsg: cfg ? '无接收人' : '企业微信未配置' };
    }

    try {
      const token = await this.getAccessToken();
      const fullUrl = url.startsWith('http') ? url : `${appBaseUrl()}${url}`;

      const res = await fetch(
        `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            touser: userIds.join('|'),
            msgtype: 'textcard',
            agentid: cfg.agentId,
            textcard: {
              title,
              description: description.replace(/\n/g, '<br>'),
              url: fullUrl.includes('?') ? `${fullUrl}&wecom_auth=1` : `${fullUrl}?wecom_auth=1`,
              btntxt,
            },
            enable_id_trans: 0,
          }),
        },
      );

      const result = (await res.json()) as WeComSendResult;
      await this.logSend(userIds, title, result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const fallback: WeComSendResult = { errcode: -2, errmsg: msg };
      await this.logSend(userIds, title, fallback);
      return fallback;
    }
  }

  private async logSend(userIds: string[], title: string, result: WeComSendResult) {
    try {
      db.insert(auditLogs).values({
        userId: null,
        action: 'WECOM_SEND',
        targetType: 'message',
        targetId: null,
        details: JSON.stringify({
          userIds,
          title,
          msgId: result.msgid,
          errcode: result.errcode,
          errmsg: result.errmsg,
        }),
      });
    } catch {
      // 忽略审计失败
    }
  }

  async getUserInfoByCode(code: string): Promise<{ userid?: string; errcode: number; errmsg: string }> {
    const cfg = readConfig();
    if (!cfg) return { errcode: -1, errmsg: '企业微信未配置' };
    const token = await this.getAccessToken();
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${encodeURIComponent(
        token,
      )}&code=${encodeURIComponent(code)}`,
    );
    return (await res.json()) as { userid?: string; errcode: number; errmsg: string };
  }

  async getUserDetail(userId: string): Promise<unknown> {
    const cfg = readConfig();
    if (!cfg) return { errcode: -1, errmsg: '企业微信未配置' };
    const token = await this.getAccessToken();
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${encodeURIComponent(
        token,
      )}&userid=${encodeURIComponent(userId)}`,
    );
    return res.json();
  }
}

export const wecom = new WeComService();
