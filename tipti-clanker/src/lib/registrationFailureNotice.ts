import type { Client, TextChannel } from 'discord.js';
import { getTournamentSettings } from '@/lib/backendClient';
import { DEFAULT_BOOTCAMP_CHAT_CHANNEL_ID } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { PUBLIC_ERROR_MESSAGES } from '@/lib/publicCommandErrors';

const DEFAULT_FAILURE_REASON = 'Something went wrong.';
const RETRY_INSTRUCTION = 'Please run `/register` again.';

export function shouldSendRegistrationFailureNotice(userMessage: string): boolean {
  return userMessage.trim() !== PUBLIC_ERROR_MESSAGES.alreadyRegistered;
}

function normalizeRegistrationFailureReason(userMessage: string): string {
  const trimmed = userMessage.trim();

  if (!trimmed) {
    return DEFAULT_FAILURE_REASON;
  }

  return trimmed
    .replace(/\s+Run `\/register` again\.?$/i, '')
    .replace(/\s+Please run `\/register` again\.?$/i, '')
    .trim();
}

export function buildRegistrationFailureNoticeContent(userId: string, userMessage: string): string {
  const reason = normalizeRegistrationFailureReason(userMessage);
  return `<@${userId}> your registration failed. ${reason} ${RETRY_INSTRUCTION}`;
}

async function getTextChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel as TextChannel;
  } catch {
    return null;
  }
}

async function resolveBootcampChatChannelId(): Promise<string> {
  try {
    const result = await getTournamentSettings();
    const channelId = result?.settings?.bootcampChatChannelId;

    if (typeof channelId === 'string' && channelId.trim()) {
      return channelId;
    }

    logger.warn('[register] bootcampChatChannelId is not set in tournament settings, using fallback');
  } catch (err) {
    logger.warn({ err }, '[register] Failed to load tournament settings for bootcamp chat channel, using fallback');
  }

  return DEFAULT_BOOTCAMP_CHAT_CHANNEL_ID;
}

export async function sendRegistrationFailureNotice(
  client: Client,
  userId: string,
  userMessage: string,
): Promise<void> {
  if (!shouldSendRegistrationFailureNotice(userMessage)) {
    return;
  }

  try {
    const channelId = await resolveBootcampChatChannelId();
    const channel = await getTextChannel(client, channelId);
    if (!channel) {
      logger.warn(
        { channelId },
        '[register] Registration failure channel not found or not text-based',
      );
      return;
    }

    await channel.send({ content: buildRegistrationFailureNoticeContent(userId, userMessage) });
  } catch (err) {
    logger.warn(
      { err, userId },
      '[register] Failed to send registration failure notice',
    );
  }
}
