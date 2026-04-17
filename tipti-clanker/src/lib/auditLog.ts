import { EmbedBuilder, type Client } from 'discord.js';
import { getTournamentSettings } from '@/lib/backendClient';
import { EMBED_COLORS } from '@/lib/constants';
import { logger } from '@/lib/logger';

type AuditLogPayload = {
  action: string;
  actorId: string;
  details?: string[];
};

async function resolveAuditChannelId(): Promise<string | null> {
  try {
    const result = await getTournamentSettings();
    const channelId = result?.settings?.auditChannelId;
    if (typeof channelId === 'string' && channelId.trim()) {
      return channelId;
    }

    logger.warn('[audit] auditChannelId is not set in tournament settings');
    return null;
  } catch (err) {
    logger.warn({ err }, '[audit] Failed to load tournament settings');
    return null;
  }
}

export async function sendAuditLog(client: Client, payload: AuditLogPayload): Promise<void> {
  try {
    const channelId = await resolveAuditChannelId();
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      logger.warn({ channelId }, '[audit] Audit channel not found or not text-based');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🧾 ${payload.action}`)
      .setColor(EMBED_COLORS.PRIMARY)
      .addFields({
        name: 'User',
        value: `<@${payload.actorId}> (\`${payload.actorId}\`)`,
      })
      .setTimestamp();

    if (payload.details?.length) {
      embed.addFields({
        name: 'Details',
        value: payload.details.map((line) => `• ${line}`).join('\n').slice(0, 1024),
      });
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err }, '[audit] Failed to send audit log');
  }
}

export async function sendSchedulerAuditWarning(
  client: Client,
  jobName: string,
  details: string[],
): Promise<void> {
  const actorId = client.user?.id;
  if (!actorId) {
    logger.warn({ jobName }, '[audit] Cannot send scheduler audit warning because bot user is unavailable');
    return;
  }

  await sendAuditLog(client, {
    action: `Scheduler Warning: ${jobName}`,
    actorId,
    details,
  });
}
