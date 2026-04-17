import http from 'http';
import https from 'https';
import { URL } from 'url';
import {
  BACKEND_ADMIN_PASSWORD_HEADER,
  BACKEND_REQUEST_TIMEOUT_MS,
  DAILY_RECAP_REQUEST_TIMEOUT_MS,
} from '@/lib/constants';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:5000';
const BACKEND_ADMIN_PASSWORD = process.env.BACKEND_ADMIN_PASSWORD ?? '';
const DAILY_CRON_REQUEST_TIMEOUT_MS = 60_000;

function getAuthHeaders(method: string): Record<string, string> {
  if (method === 'GET' || !BACKEND_ADMIN_PASSWORD) {
    return {};
  }

  return {
    [BACKEND_ADMIN_PASSWORD_HEADER]: BACKEND_ADMIN_PASSWORD,
  };
}

function request<T>(method: string, path: string, body?: unknown, timeoutMs = BACKEND_REQUEST_TIMEOUT_MS): Promise<T> {
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
        ...getAuthHeaders(method),
      },
      timeout: timeoutMs,
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
    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${method} ${path}`));
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
  godSlug: string;
}

export function registerPlayer(data: RegisterPlayerRequest): Promise<any> {
  return request('POST', '/api/players', data);
}

export function removePlayer(discordId: string): Promise<any> {
  return request('DELETE', `/api/players/${encodeURIComponent(discordId)}`);
}

export function updatePlayerProfile(discordId: string, updates: { discordAvatarUrl?: string; discordUsername?: string }): Promise<any> {
  return request('PATCH', `/api/players/${encodeURIComponent(discordId)}`, updates);
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

export function getNotificationFeed(): Promise<any> {
  return request('GET', '/api/notifications/feed');
}

export function ackNotificationFeed(matchIds: string[]): Promise<any> {
  return request('POST', '/api/notifications/feed/ack', { matchIds });
}

export function getDailySummary(date: string, timeoutMs = BACKEND_REQUEST_TIMEOUT_MS): Promise<any> {
  return request('GET', `/api/notifications/daily-summary?date=${encodeURIComponent(date)}`, undefined, timeoutMs);
}

export function getDailyGraphData(date: string, timeoutMs = BACKEND_REQUEST_TIMEOUT_MS): Promise<any> {
  return request('GET', `/api/notifications/daily-graph?date=${encodeURIComponent(date)}`, undefined, timeoutMs);
}

export function getDailySummaryForScheduledRecap(date: string): Promise<any> {
  return getDailySummary(date, DAILY_RECAP_REQUEST_TIMEOUT_MS);
}

export function getDailyGraphDataForScheduledRecap(date: string): Promise<any> {
  return getDailyGraphData(date, DAILY_RECAP_REQUEST_TIMEOUT_MS);
}

// God system endpoints
export function listGods(): Promise<any> {
  return request('GET', '/api/gods');
}

export function getGodStandings(): Promise<any> {
  return request('GET', '/api/gods/standings');
}

export function getGod(slug: string): Promise<any> {
  return request('GET', `/api/gods/${encodeURIComponent(slug)}`);
}

export function assignPlayerToGod(slug: string, discordId: string): Promise<any> {
  return request('POST', `/api/gods/${encodeURIComponent(slug)}/assign`, { discordId });
}

export function getPlayerPoints(discordId: string): Promise<any> {
  return request('GET', `/api/points/${encodeURIComponent(discordId)}`);
}

export function triggerDailyCron(day?: string): Promise<any> {
  return request('POST', '/api/cron/run-daily', day ? { day } : {}, DAILY_CRON_REQUEST_TIMEOUT_MS);
}

export function seedGods(): Promise<any> {
  return request('POST', '/api/gods/seed');
}

export function wipePlayerData(): Promise<any> {
  return request('POST', '/api/admin/wipe-data');
}

export function resetAllPlayerRanks(): Promise<any> {
  return request('POST', '/api/admin/reset-player-ranks');
}
