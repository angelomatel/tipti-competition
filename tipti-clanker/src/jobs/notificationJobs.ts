import cron from 'node-cron';
import { AttachmentBuilder, EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import {
  getTournamentSettings,
  getNotificationFeed,
  ackNotificationFeed,
  getDailySummaryForScheduledRecap,
  getDailyGraphDataForScheduledRecap,
  updatePlayerProfile,
  getGodStandings,
} from '@/lib/backendClient';
import { renderLpGraph } from '@/lib/chartRenderer';
import { logger } from '@/lib/logger';
import { formatLpDelta, formatOrdinal } from '@/lib/format';
import { sendSchedulerAuditWarning } from '@/lib/auditLog';
import { getYesterdayPhtDay } from '@/lib/dateUtils';
import {
  EMBED_COLORS,
  GOD_COLORS,
  SOURCE_LABELS,
  CRON_SCHEDULES,
  PHT_TIMEZONE,
  DAILY_RECAP_MAX_ATTEMPTS,
  DAILY_RECAP_RETRY_DELAY_MS,
} from '@/lib/constants';

async function getTextChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel as TextChannel;
  } catch {
    return null;
  }
}

async function warnScheduledJob(client: Client, jobName: string, details: string[], extra?: Record<string, unknown>): Promise<void> {
  logger.warn({ jobName, ...extra }, `[${jobName}] ${details.join(' | ')}`);
  await sendSchedulerAuditWarning(client, jobName, details);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function postDailyRecapOnce(client: Client, date: string): Promise<void> {
  const settingsRes = await getTournamentSettings();
  const settings = settingsRes.settings;
  const now = new Date();
  if (now < new Date(settings.startDate) || now > new Date(settings.endDate) || !settings.dailyChannelId) return;

  const channel = await getTextChannel(client, settings.dailyChannelId);
  if (!channel) {
    await warnScheduledJob(client, 'daily-job', [
      `Daily recap for ${date} could not be posted because the configured channel was not found or is not text-based.`,
    ], { date, channelId: settings.dailyChannelId, stage: 'resolve-channel' });
    return;
  }

  const [summary, graphData] = await Promise.all([
    getDailySummaryForScheduledRecap(date),
    getDailyGraphDataForScheduledRecap(date),
  ]);

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

  const players: any[] = graphData.players ?? [];
  if (players.length > 0) {
    if (channel.guild) {
      for (const p of players) {
        if (!p.discordAvatarUrl && p.discordId) {
          try {
            const member = await channel.guild.members.fetch(p.discordId);
            p.discordAvatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128 });
            updatePlayerProfile(p.discordId, { discordAvatarUrl: p.discordAvatarUrl }).catch(() => {});
          } catch {
            // member not in guild
          }
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
}

async function runFeedJob(client: Client): Promise<void> {
  try {
    const settingsRes = await getTournamentSettings();
    const settings = settingsRes.settings;
    const now = new Date();
    if (now < new Date(settings.startDate) || now > new Date(settings.endDate) || !settings.feedChannelId) return;

    const channel = await getTextChannel(client, settings.feedChannelId);
    if (!channel) {
      await warnScheduledJob(client, 'feed-job', [
        'feedChannelId is set but channel was not found or is not text-based.',
      ], { channelId: settings.feedChannelId });
      return;
    }

    const feedRes = await getNotificationFeed();
    const notifications: any[] = feedRes.notifications ?? [];
    if (notifications.length === 0) return;

    logger.debug(
      { notificationCount: notifications.length, channelId: channel.id },
      '[feed-job] Received notifications from backend',
    );

    for (const notif of notifications) {
      if (channel.guild && notif.discordId) {
        try {
          const member = await channel.guild.members.fetch(notif.discordId);
          const currentAvatar = member.user.displayAvatarURL({ extension: 'png', size: 128 });
          updatePlayerProfile(notif.discordId, { discordAvatarUrl: currentAvatar }).catch(() => {});
        } catch {
          // member not in guild
        }
      }

      const lpStr = notif.lpStatus === 'unknown' ? 'LP unknown' : formatLpDelta(notif.lpDelta);
      const lpPart = lpStr ? ` (${lpStr})` : '';

      let buffLine = '';
      if (notif.godBuffs && notif.godBuffs.length > 0) {
        const buffStrings = notif.godBuffs.map((b: any) => {
          const name = SOURCE_LABELS[b.source] || b.source;
          return `🌟 **${name}**: ${b.value > 0 ? '+' : ''}${b.value} pts`;
        });
        buffLine = '\n> ' + buffStrings.join('\n> ');
      }

      const ttUrl = `https://tactics.tools/player/sg/${encodeURIComponent(notif.gameName)}/${encodeURIComponent(notif.tagLine)}/${notif.matchId}`;
      const metatftUrl = `https://www.metatft.com/player/SG2/${encodeURIComponent(notif.gameName)}-${encodeURIComponent(notif.tagLine)}?match=${notif.matchId}`;
      const linksLine = `\n-# [tactics.tools](${ttUrl}) | [metatft](${metatftUrl})`;

      const godColor: number | undefined = notif.godSlug ? GOD_COLORS[notif.godSlug] : undefined;

      const username = notif.discordUsername || notif.gameName;
      const inGameName = `${notif.gameName}#${notif.tagLine}`;
      const footerOpts: { text: string; iconURL?: string } = { text: inGameName };
      if (notif.discordAvatarUrl) footerOpts.iconURL = notif.discordAvatarUrl;

      logger.debug(
        {
          matchId: notif.matchId,
          discordId: notif.discordId ?? null,
          riotId: inGameName,
          placement: notif.placement,
          lpDelta: notif.lpDelta,
          lpStatus: notif.lpStatus,
          godBuffCount: notif.godBuffs?.length ?? 0,
          channelId: channel.id,
        },
        '[feed-job] Rendering notification',
      );

      if (notif.lpStatus !== 'known') {
        logger.warn(
          {
            matchId: notif.matchId,
            discordId: notif.discordId ?? null,
            riotId: inGameName,
            placement: notif.placement,
            lpDelta: notif.lpDelta,
            lpStatus: notif.lpStatus,
            channelId: channel.id,
          },
          '[feed-job] Posting notification without definitive LP attribution',
        );
      }

      const embed = new EmbedBuilder()
        .setTimestamp(new Date(notif.playedAt))
        .setFooter(footerOpts);

      if (notif.placement === 1) {
        embed
          .setColor(godColor ?? EMBED_COLORS.GOLD)
          .setDescription(`🫅 **${username}** just secured a **1st Place**${lpPart}!${buffLine}${linksLine}`);
      } else if (notif.placement === 8) {
        embed
          .setColor(godColor ?? EMBED_COLORS.DANGER)
          .setDescription(`🚨 **${username}** just went **8th**${lpPart}! The tilt is real!${buffLine}${linksLine}`);
      } else {
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
  } catch (err: any) {
    await warnScheduledJob(client, 'feed-job', [
      'Scheduled feed job failed.',
      err?.message ?? String(err),
    ], { err });
  }
}

export async function runDailyJob(client: Client): Promise<void> {
  const date = getYesterdayPhtDay();

  for (let attempt = 1; attempt <= DAILY_RECAP_MAX_ATTEMPTS; attempt += 1) {
    try {
      await postDailyRecapOnce(client, date);
      return;
    } catch (err: any) {
      const finalAttempt = attempt === DAILY_RECAP_MAX_ATTEMPTS;
      const details = finalAttempt
        ? [
            `Daily recap for ${date} failed after ${attempt} attempts.`,
            'Stage: fetch-render-post',
            err?.message ?? String(err),
          ]
        : [
            `Daily recap for ${date} attempt ${attempt} failed.`,
            `Retrying in ${Math.round(DAILY_RECAP_RETRY_DELAY_MS / 1000)}s.`,
            err?.message ?? String(err),
          ];

      await warnScheduledJob(client, 'daily-job', details, {
        date,
        stage: 'fetch-render-post',
        attempt,
        maxAttempts: DAILY_RECAP_MAX_ATTEMPTS,
        err,
      });

      if (finalAttempt) {
        return;
      }

      await sleep(DAILY_RECAP_RETRY_DELAY_MS);
    }
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
      await warnScheduledJob(client, 'god-standings-job', [
        'godStandingsChannelId is set but channel was not found or is not text-based.',
      ], { channelId: settings.godStandingsChannelId });
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
  } catch (err: any) {
    await warnScheduledJob(client, 'god-standings-job', [
      'Scheduled god standings job failed.',
      err?.message ?? String(err),
    ], { err });
  }
}

export function startNotificationJobs(client: Client): void {
  cron.schedule(CRON_SCHEDULES.FEED_JOB, () => {
    void runFeedJob(client);
  });

  cron.schedule(CRON_SCHEDULES.DAILY_JOB, () => {
    void runDailyJob(client);
  }, { timezone: PHT_TIMEZONE });

  cron.schedule(CRON_SCHEDULES.GOD_STANDINGS_JOB, () => {
    void runGodStandingsJob(client);
  }, { timezone: PHT_TIMEZONE });

  logger.debug(`[notifications] Feed (*/5 min), daily (${CRON_SCHEDULES.DAILY_JOB}), and god standings (${CRON_SCHEDULES.GOD_STANDINGS_JOB}) jobs scheduled in timezone=${PHT_TIMEZONE}`);
}
