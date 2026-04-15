import type { Client } from 'discord.js';
import { sendAuditLog } from '@/lib/auditLog';

const UNKNOWN_ERROR_MESSAGE = 'Something went wrong.';
const MAX_AUDIT_DETAIL_LENGTH = 300;

export const PUBLIC_ERROR_MESSAGES = {
  playerNotFound: '❌ Player not found. Use `/register` to join first.',
  riotAccountNotFound: '❌ Could not find that Riot account. Double-check the username and tag.',
  alreadyRegistered: '❌ You are already registered for the tournament. Contact an admin if you need your registration updated.',
  timeout: '❌ The request timed out. Please try again in a moment.',
  serviceUnavailable: '❌ The tournament service is temporarily unavailable. Please try again later.',
} as const;

type PublicErrorOptions = {
  notFoundMessage?: string;
  fallbackPrefix?: string;
};

type CommandErrorAuditPayload = {
  commandName: string;
  actorId: string;
  target?: string;
  userMessage: string;
  error?: unknown;
};

export function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error ?? UNKNOWN_ERROR_MESSAGE);
}

export function extractBackendErrorMessage(error: unknown): string {
  const rawMessage = getRawErrorMessage(error);
  const jsonStart = rawMessage.indexOf('{');

  if (jsonStart === -1) {
    return rawMessage;
  }

  try {
    const parsed = JSON.parse(rawMessage.slice(jsonStart)) as { error?: unknown; message?: unknown };
    const backendMessage = parsed.error ?? parsed.message;
    return typeof backendMessage === 'string' && backendMessage.trim() ? backendMessage : rawMessage;
  } catch {
    return rawMessage;
  }
}

export function getHttpStatus(error: unknown): number | null {
  const match = getRawErrorMessage(error).match(/\bHTTP\s+(\d{3})\b/i);
  return match ? Number(match[1]) : null;
}

export function isHttpStatus(error: unknown, status: number): boolean {
  return getHttpStatus(error) === status;
}

export function isAlreadyRegisteredError(error: unknown): boolean {
  const normalizedMessage = extractBackendErrorMessage(error).toLowerCase();
  return isHttpStatus(error, 409) && normalizedMessage.includes('already registered');
}

export function isTimeoutError(error: unknown): boolean {
  const normalizedMessage = getRawErrorMessage(error).toLowerCase();
  return normalizedMessage.includes('timed out') || normalizedMessage.includes('timeout');
}

export function isServiceUnavailableError(error: unknown): boolean {
  const normalizedMessage = getRawErrorMessage(error).toLowerCase();
  const status = getHttpStatus(error);

  return (
    (status !== null && status >= 500) ||
    normalizedMessage.includes('econnrefused') ||
    normalizedMessage.includes('econnreset') ||
    normalizedMessage.includes('enotfound') ||
    normalizedMessage.includes('socket hang up') ||
    normalizedMessage.includes('network')
  );
}

export function sanitizeErrorMessage(error: unknown): string {
  const backendMessage = extractBackendErrorMessage(error);
  const sanitized = backendMessage
    .replace(/\bHTTP\s+\d{3}\s*:\s*/gi, '')
    .replace(/(?:GET|POST|PUT|PATCH|DELETE)\s+\/api\/[^\s)]+/gi, '')
    .replace(/\/api\/[^\s)]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized || UNKNOWN_ERROR_MESSAGE;
}

export function getPublicErrorMessage(error: unknown, options: PublicErrorOptions = {}): string {
  if (isAlreadyRegisteredError(error)) {
    return PUBLIC_ERROR_MESSAGES.alreadyRegistered;
  }

  if (isHttpStatus(error, 404) && options.notFoundMessage) {
    return options.notFoundMessage;
  }

  if (isTimeoutError(error)) {
    return PUBLIC_ERROR_MESSAGES.timeout;
  }

  if (isServiceUnavailableError(error)) {
    return PUBLIC_ERROR_MESSAGES.serviceUnavailable;
  }

  const prefix = options.fallbackPrefix ?? '❌ Something went wrong';
  return `${prefix}: ${sanitizeErrorMessage(error)}`;
}

export async function sendCommandErrorAuditLog(client: Client, payload: CommandErrorAuditPayload): Promise<void> {
  const details = [
    `Command: ${payload.commandName}`,
    ...(payload.target ? [`Target: ${payload.target}`] : []),
    `Shown: ${payload.userMessage}`,
  ];

  if (payload.error !== undefined) {
    details.push(`Raw: ${getRawErrorMessage(payload.error).slice(0, MAX_AUDIT_DETAIL_LENGTH)}`);
  }

  await sendAuditLog(client, {
    action: `${payload.commandName} (error)`,
    actorId: payload.actorId,
    details,
  });
}
