import cron from 'node-cron';
import { AttachmentBuilder, EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import {
  getTournamentSettings,
  getNotificationFeed,
  ackNotificationFeed,
  getDailySummary,
  getDailyGraphData,
  updatePlayerProfile,
  getGodStandings,
} from '@/lib/backendClient';
import { renderLpGraph } from '@/lib/chartRenderer';
import { logger } from '@/lib/logger';
import { formatLpDelta, formatOrdinal } from '@/lib/format';
import { EMBED_COLORS, GOD_COLORS, SOURCE_LABELS, CRON_SCHEDULES } from '@/lib/constants';

async function getTextChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel as TextChannel;
  } catch {
    return null;
  }
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
    const now = new Date();
    if (now < new Date(settings.startDate) || now > new Date(settings.endDate) || !settings.feedChannelId) return;

    const channel = await getTextChannel(client, settings.feedChannelId);
    if (!channel) {
      logger.warn('[feed-job] feedChannelId is set but channel not found or not text-based');
      return;
    }

    const feedRes = await getNotificationFeed();
    const notifications: any[] = feedRes.notifications ?? [];
    if (notifications.length === 0) return;

    for (const notif of notifications) {
      // Refresh avatar URL when we have access to the guild
      if (channel.guild && notif.discordId) {
        try {
          const member = await channel.guild.members.fetch(notif.discordId);
          const currentAvatar = member.user.displayAvatarURL({ extension: 'png', size: 128 });
          updatePlayerProfile(notif.discordId, { discordAvatarUrl: currentAvatar }).catch(() => {});
        } catch { /* member not in guild */ }
      }

      const lpStr = formatLpDelta(notif.lpDelta);
      const lpPart = lpStr ? ` (${lpStr})` : '';

      // Build buff lines
      let buffLine = '';
      if (notif.godBuffs && notif.godBuffs.length > 0) {
        const buffStrings = notif.godBuffs.map((b: any) => {
          const name = SOURCE_LABELS[b.source] || b.source;
          return `🌟 **${name}**: ${b.value > 0 ? '+' : ''}${b.value} pts`;
        });
        buffLine = '\n> ' + buffStrings.join('\n> ');
      }

      // Build external match links (tactics.tools + metatft)
      const ttUrl = `https://tactics.tools/player/sg/${encodeURIComponent(notif.gameName)}/${encodeURIComponent(notif.tagLine)}/${notif.matchId}`;
      const metatftUrl = `https://www.metatft.com/player/SG2/${encodeURIComponent(notif.gameName)}-${encodeURIComponent(notif.tagLine)}?match=${notif.matchId}`;
      const linksLine = `\n-# [tactics.tools](${ttUrl}) | [metatft](${metatftUrl})`;

      // Pick embed color: god color if assigned, else placement-based fallback
      const godColor: number | undefined = notif.godSlug ? GOD_COLORS[notif.godSlug] : undefined;

      const username = notif.discordUsername || notif.gameName;
      const inGameName = `${notif.gameName}#${notif.tagLine}`;
      const footerOpts: { text: string; iconURL?: string } = { text: inGameName };
      if (notif.discordAvatarUrl) footerOpts.iconURL = notif.discordAvatarUrl;

      const embed = new EmbedBuilder()
        .setTimestamp(new Date(notif.playedAt))
        .setFooter(footerOpts);

      if (notif.placement === 1) {
        embed
          .setColor(godColor ?? EMBED_COLORS.GOLD)
          .setDescription(`👑 **${username}** just secured a **1st Place**${lpPart}!${buffLine}${linksLine}`);
      } else if (notif.placement === 8) {
        embed
          .setColor(godColor ?? EMBED_COLORS.DANGER)
          .setDescription(`🚨 **${username}** just went **8th**${lpPart}! The tilt is real!${buffLine}${linksLine}`);
      } else {
        // Placements 2–7
        const ordinal = formatOrdinal(notif.placement);
        const topHalf = notif.placement <= 4;
        const emoji = topHalf ? '🏅' : '📉';
        const fallbackColor = topHalf ? EMBED_COLORS.REGULAR_TOP : EMBED_COLORS.REGULAR_BOT;
        embed
          .setColor(godColor ?? fallbackColor)
          .setDescription(`${emoji} **${username}** placed **${ordinal}**${lpPart}${buffLine}${linksLine}`);
      }

      await channel.send({ embeds: [embed] });
      await ackNotificationFeed([notif.matchId]);
      logger.debug(
        { matchId: notif.matchId, placement: notif.placement, discordId: notif.discordId ?? null, riotId: notif.gameName && notif.tagLine ? `${notif.gameName}#${notif.tagLine}` : null, channelId: channel.id },
        `[feed-job] Posted notification for match ${notif.matchId}`,
      );
    }
  } catch (err) {
    logger.error({ err }, '[feed-job] Error in feed job');
  }
}

export async function runDailyJob(client: Client): Promise<void> {
  try {
    const settingsRes = await getTournamentSettings();
    const settings = settingsRes.settings;
    const now = new Date();
    if (now < new Date(settings.startDate) || now > new Date(settings.endDate) || !settings.dailyChannelId) return;

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
      .setColor(EMBED_COLORS.PRIMARY)
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
      if (channel.guild) {
        for (const p of players) {
          if (!p.discordAvatarUrl && p.discordId) {
            try {
              const member = await channel.guild.members.fetch(p.discordId);
              p.discordAvatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128 });
              updatePlayerProfile(p.discordId, { discordAvatarUrl: p.discordAvatarUrl }).catch(() => {});
            } catch { /* member not in guild */ }
          }
        }
      }

      const chartBuffer = await renderLpGraph(players, date);
      const attachment = new AttachmentBuilder(chartBuffer, { name: 'lp-graph.png' });
      embed.setImage('attachment://lp-graph.png');
      await channel.send({ embeds: [embed], files: [attachment] });
    } else {
      await channel.send({ embeds: [embed] });
    }

    logger.debug({ date, channelId: channel.id }, `[daily-job] Posted daily recap for ${date}`);
  } catch (err) {
    logger.error({ err }, '[daily-job] Error in daily job');
  }
}

export async function runGodStandingsJob(client: Client): Promise<void> {
  try {
    const settingsRes = await getTournamentSettings();
    const settings = settingsRes.settings;
    const now = new Date();
    if (now < new Date(settings.startDate) || now > new Date(settings.endDate) || !settings.godStandingsChannelId) return;

    const channel = await getTextChannel(client, settings.godStandingsChannelId);
    if (!channel) {
      logger.warn('[god-standings-job] godStandingsChannelId is set but channel not found');
      return;
    }

    const data = await getGodStandings();
    const standings: any[] = data.standings ?? [];
    if (standings.length === 0) return;

    const lines = standings.map((god: any, i: number) => {
      const status = god.isEliminated ? '~~' : '';
      const prefix = god.isEliminated ? '💀' : `#${i + 1}`;
      return `${prefix} ${status}**${god.name}** — ${god.title}${status}\n   Score: **${Math.round(god.score)}** | Players: ${god.playerCount}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('God Standings Update')
      .setDescription(lines.join('\n\n'))
      .setColor(EMBED_COLORS.GOD_STANDINGS)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    logger.debug({ channelId: channel.id, standingCount: standings.length }, `[god-standings-job] Posted god standings update with ${standings.length} entries`);
  } catch (err) {
    logger.error({ err }, '[god-standings-job] Error in god standings job');
  }
}

export function startNotificationJobs(client: Client): void {
  cron.schedule(CRON_SCHEDULES.FEED_JOB, () => {
    void runFeedJob(client);
  });

  cron.schedule(CRON_SCHEDULES.DAILY_JOB, () => {
    void runDailyJob(client);
  }, { timezone: 'UTC' });

  cron.schedule(CRON_SCHEDULES.GOD_STANDINGS_JOB, () => {
    void runGodStandingsJob(client);
  }, { timezone: 'UTC' });

  logger.debug('[notifications] Feed (*/5 min), daily (16:05 UTC), and god standings (16:10 UTC) jobs scheduled');
}
