import http from 'http';
import https from 'https';
import { URL } from 'url';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:5000';

function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND_URL);
    const data = body ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(text)); } catch { resolve(text as unknown as T); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${text}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

export interface RegisterPlayerRequest {
  discordId: string;
  gameName: string;
  tagLine: string;
  addedBy: string;
  discordAvatarUrl?: string;
  discordUsername?: string;
}

export function registerPlayer(data: RegisterPlayerRequest): Promise<any> {
  return request('POST', '/api/players', data);
}

export function removePlayer(discordId: string): Promise<any> {
  return request('DELETE', `/api/players/${encodeURIComponent(discordId)}`);
}

export function getLeaderboard(): Promise<any> {
  return request('GET', '/api/leaderboard');
}

export function getPlayer(discordId: string): Promise<any> {
  return request('GET', `/api/players/${encodeURIComponent(discordId)}`);
}

export function getTournamentSettings(): Promise<any> {
  return request('GET', '/api/tournament/settings');
}

export function updateTournamentSettings(updates: Record<string, unknown>): Promise<any> {
  return request('PUT', '/api/tournament/settings', updates);
}

export function triggerCron(): Promise<any> {
  return request('POST', '/api/cron/run');
}

export function lookupRiotAccount(gameName: string, tagLine: string): Promise<any> {
  return request('GET', `/api/riot/account/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
}
