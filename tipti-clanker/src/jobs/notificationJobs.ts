import cron from 'node-cron';
import { AttachmentBuilder, EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import {
  getTournamentSettings,
  getNotificationFeed,
  ackNotificationFeed,
  getDailySummary,
  getDailyGraphData,
} from '@/lib/backendClient';
import { renderLpGraph } from '@/lib/chartRenderer';
import { logger } from '@/lib/logger';

async function getTextChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel as TextChannel;
  } catch {
    return null;
  }
}

/** Formats LP delta as "+42 LP" or "-45 LP" */
function formatLpDelta(delta: number | null): string {
  if (delta === null) return '';
  return delta >= 0 ? `+${delta} LP` : `${delta} LP`;
}

/** Returns yesterday's date string in UTC+8 as YYYY-MM-DD */
function getYesterdayUTC8(): string {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  utc8.setUTCDate(utc8.getUTCDate() - 1);
  return utc8.toISOString().slice(0, 10);
}

async function runFeedJob(client: Client): Promise<void> {
  try {
    const settingsRes = await getTournamentSettings();
    const settings = settingsRes.settings;
    if (!settings.isActive || !settings.feedChannelId) return;

    const channel = await getTextChannel(client, settings.feedChannelId);
    if (!channel) {
      logger.warn('[feed-job] feedChannelId is set but channel not found or not text-based');
      return;
    }

    const feedRes = await getNotificationFeed();
    const notifications: any[] = feedRes.notifications ?? [];
    if (notifications.length === 0) return;

    for (const notif of notifications) {
      const lpStr = formatLpDelta(notif.lpDelta);
      const lpPart = lpStr ? ` (${lpStr})` : '';

      const embed = new EmbedBuilder().setTimestamp(new Date(notif.playedAt));

      if (notif.placement === 1) {
        embed
          .setColor(0xffd700)
          .setDescription(`👑 <@${notif.discordId}> just secured a **1st Place**${lpPart}!`);
      } else {
        embed
          .setColor(0xff4444)
          .setDescription(`🚨 <@${notif.discordId}> just went **8th**${lpPart}! The tilt is real!`);
      }

      await channel.send({ embeds: [embed] });
      await ackNotificationFeed([notif.matchId]);
      logger.debug({ matchId: notif.matchId, placement: notif.placement }, '[feed-job] Posted notification');
    }
  } catch (err) {
    logger.error({ err }, '[feed-job] Error in feed job');
  }
}

async function runDailyJob(client: Client): Promise<void> {
  try {
    const settingsRes = await getTournamentSettings();
    const settings = settingsRes.settings;
    if (!settings.isActive || !settings.dailyChannelId) return;

    const channel = await getTextChannel(client, settings.dailyChannelId);
    if (!channel) {
      logger.warn('[daily-job] dailyChannelId is set but channel not found or not text-based');
      return;
    }

    const date = getYesterdayUTC8();
    const [summary, graphData] = await Promise.all([
      getDailySummary(date),
      getDailyGraphData(date),
    ]);

    // Build recap embed
    const embed = new EmbedBuilder()
      .setTitle(`📅 Daily Recap — ${date}`)
      .setColor(0x7b2fff)
      .setTimestamp();

    if (summary.climber) {
      embed.addFields({
        name: '📈 Climber of the Day',
        value: `<@${summary.climber.discordId}> — **+${summary.climber.lpGain} LP**`,
      });
    } else {
      embed.addFields({ name: '📈 Climber of the Day', value: 'No data' });
    }

    if (summary.slider) {
      embed.addFields({
        name: '📉 Slider of the Day',
        value: `<@${summary.slider.discordId}> — **${summary.slider.lpGain} LP**`,
      });
    } else {
      embed.addFields({ name: '📉 Slider of the Day', value: 'No data' });
    }

    // Generate and attach LP graph if we have data
    const players: any[] = graphData.players ?? [];
    if (players.length > 0) {
      const chartBuffer = await renderLpGraph(players);
      const attachment = new AttachmentBuilder(chartBuffer, { name: 'lp-graph.png' });
      embed.setImage('attachment://lp-graph.png');
      await channel.send({ embeds: [embed], files: [attachment] });
    } else {
      await channel.send({ embeds: [embed] });
    }

    logger.info({ date }, '[daily-job] Posted daily recap');
  } catch (err) {
    logger.error({ err }, '[daily-job] Error in daily job');
  }
}

export function startNotificationJobs(client: Client): void {
  // Feed check every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    void runFeedJob(client);
  });

  // Daily recap at 16:00 UTC (midnight UTC+8)
  cron.schedule('0 16 * * *', () => {
    void runDailyJob(client);
  });

  logger.info('[notifications] Feed job (*/5 min) and daily job (16:00 UTC) scheduled');
}
