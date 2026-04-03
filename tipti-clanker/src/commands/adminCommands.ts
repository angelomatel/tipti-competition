import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ChannelType,
  type CommandInteraction,
  ComponentType,
  EmbedBuilder,
  type GuildMember,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type TextChannel,
} from 'discord.js';
import { Discord, Guild, Slash, SlashGroup, SlashOption } from 'discordx';
import {
  assignPlayerToGod,
  getTournamentSettings,
  listGods,
  lookupRiotAccount,
  registerPlayer,
  removePlayer,
  resetAllPlayerRanks,
  seedGods,
  triggerCron,
  updateTournamentSettings,
  wipePlayerData,
} from '@/lib/backendClient';
import { sendAuditLog } from '@/lib/auditLog';
import { EMBED_COLORS, GOD_BUFF_SUMMARIES, GOD_CHOICES } from '@/lib/constants';
import { formatTierDisplay } from '@/lib/format';
import { logger } from '@/lib/logger';
import { parseRiotId } from '@/lib/riotId';

const ADMIN_GUILDS = ['262398311007387653', '1456994464982630443'] as const;

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminCommands {
  @Slash({
    name: 'add-player',
    description: 'Register a player in the tournament',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async addPlayer(
    @SlashOption({
      name: 'user',
      description: 'The Discord user to register',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    member: GuildMember,
    @SlashOption({
      name: 'account',
      description: 'Riot ID with tag, e.g. PlayerName#1234',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    account: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const { gameName, tagLine, isValid } = parseRiotId(account);

    if (!isValid) {
      await interaction.editReply({ content: 'Invalid format. Use `username#TAG`.' });
      return;
    }

    try {
      await lookupRiotAccount(gameName, tagLine);
    } catch {
      await interaction.editReply({ content: 'Could not find that Riot account.' });
      return;
    }

    let gods: any[] = [];
    try {
      gods = await listGods();
    } catch {
      gods = GOD_CHOICES.map((g) => ({ ...g, isEliminated: false, playerCount: 0 }));
    }

    const options = GOD_CHOICES.map((god) => {
      const godData = gods.find((g: any) => g.slug === god.slug);
      const eliminated = godData?.isEliminated ?? false;
      const playerCount = godData?.playerCount ?? 0;

      return new StringSelectMenuOptionBuilder()
        .setLabel(`${god.name} — ${god.title}`)
        .setDescription(`${playerCount} player${playerCount !== 1 ? 's' : ''}${eliminated ? ' (ELIMINATED)' : ''}`)
        .setValue(god.slug);
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('god_select_admin')
      .setPlaceholder('Choose a God for this player...')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('Choose God for Player')
      .setDescription(
        `Registering <@${member.id}> as **${gameName}#${tagLine}**\n\n` +
        '> God buffs activate **after Phase 1** (Day 6+). During Phase 1, all gods play without buffs.\n\n' +
        GOD_BUFF_SUMMARIES.join('\n'),
      )
      .setColor(EMBED_COLORS.PRIMARY);

    const reply = await interaction.editReply({ embeds: [embed], components: [row] });

    try {
      const selection = await reply.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 60_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      await selection.deferUpdate();

      const godSlug = selection.values[0];
      const godInfo = GOD_CHOICES.find((g) => g.slug === godSlug);

      const result = await registerPlayer({
        discordId: member.id,
        gameName,
        tagLine,
        addedBy: interaction.user.id,
        discordAvatarUrl: member.displayAvatarURL({ extension: 'png', size: 128 }),
        discordUsername: member.user.username,
        godSlug,
      });

      const player = result.player;
      const tierDisplay = formatTierDisplay(player.currentTier, player.currentRank, player.currentLP);

      const confirmEmbed = new EmbedBuilder()
        .setTitle(`Registered: ${player.gameName}#${player.tagLine}`)
        .addFields(
          { name: 'Discord', value: `<@${member.id}>`, inline: true },
          { name: 'Rank', value: tierDisplay, inline: true },
          { name: 'God', value: `${godInfo?.name ?? godSlug} — ${godInfo?.title ?? ''}`, inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      await interaction.editReply({ embeds: [confirmEmbed], components: [] });

      await sendAuditLog(interaction.client, {
        action: '/admin add-player',
        actorId: interaction.user.id,
        details: [
          `Target Discord: <@${member.id}> (${member.user.username})`,
          `Riot: ${gameName}#${tagLine}`,
          `God: ${godInfo?.name ?? godSlug} (${godSlug})`,
        ],
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes('time') || msg.includes('Collector')) {
        await interaction.editReply({ content: '❌ Selection timed out.', embeds: [], components: [] });
      } else {
        await interaction.editReply({ content: `❌ Failed to register player: ${msg}`, embeds: [], components: [] });
      }

      await sendAuditLog(interaction.client, {
        action: '/admin add-player (failed)',
        actorId: interaction.user.id,
        details: [
          `Target Discord: <@${member.id}>`,
          `Riot: ${gameName}#${tagLine}`,
          `Reason: ${msg.slice(0, 250)}`,
        ],
      });
    }
  }

  @Slash({
    name: 'remove-player',
    description: 'Remove a player from the tournament',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async removePlayer(
    @SlashOption({
      name: 'user',
      description: 'The Discord user to remove',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    member: GuildMember,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      await removePlayer(member.id);
      await interaction.editReply({ content: `✅ <@${member.id}> has been removed from the tournament.` });

      await sendAuditLog(interaction.client, {
        action: '/admin remove-player',
        actorId: interaction.user.id,
        details: [`Target Discord: <@${member.id}> (${member.user.username})`],
      });
    } catch (err: any) {
      const notFound = err?.message?.includes('not found') || err?.message?.includes('404');
      await interaction.editReply({
        content: notFound
          ? `❌ <@${member.id}> is not registered in the tournament.`
          : `⚠️ Failed to remove player: ${err?.message ?? err}`,
      });

      await sendAuditLog(interaction.client, {
        action: '/admin remove-player (failed)',
        actorId: interaction.user.id,
        details: [
          `Target Discord: <@${member.id}>`,
          `Reason: ${(err?.message ?? String(err)).slice(0, 250)}`,
        ],
      });
    }
  }

  @Slash({
    name: 'assign-god',
    description: 'Assign or reassign a player to a god',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async assignGod(
    @SlashOption({
      name: 'user',
      description: 'The Discord user to assign',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    member: GuildMember,
    @SlashOption({
      name: 'god',
      description: 'The god to assign them to',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    godName: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const slug = godName.toLowerCase().replace(/\s+/g, '_');
    const godChoice = GOD_CHOICES.find((g) => g.slug === slug || g.name.toLowerCase() === godName.toLowerCase());
    const targetSlug = godChoice?.slug ?? slug;

    try {
      await assignPlayerToGod(targetSlug, member.id);
      await interaction.editReply({
        content: `✅ <@${member.id}> has been assigned to **${godChoice?.name ?? godName}**.`,
      });

      await sendAuditLog(interaction.client, {
        action: '/admin assign-god',
        actorId: interaction.user.id,
        details: [
          `Target Discord: <@${member.id}> (${member.user.username})`,
          `God: ${godChoice?.name ?? godName} (${targetSlug})`,
        ],
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed: ${err?.message ?? err}` });

      await sendAuditLog(interaction.client, {
        action: '/admin assign-god (failed)',
        actorId: interaction.user.id,
        details: [
          `Target Discord: <@${member.id}>`,
          `God: ${godChoice?.name ?? godName} (${targetSlug})`,
          `Reason: ${(err?.message ?? String(err)).slice(0, 250)}`,
        ],
      });
    }
  }

  @Slash({
    name: 'refresh-data',
    description: 'Manually trigger a data refresh for all players',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async refreshData(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      await triggerCron();
      await interaction.editReply({ content: 'Data refresh triggered. Snapshots and match records are being updated for all active players.' });
      await sendAuditLog(interaction.client, {
        action: '/admin refresh-data',
        actorId: interaction.user.id,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to trigger refresh: ${err?.message ?? err}` });
    }
  }

  @Slash({
    name: 'reset-player-ranks',
    description: 'Reset all players to Unranked 0 LP and clear points/history for a new set',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async resetPlayerRanks(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await resetAllPlayerRanks();
      const content = [
        `Reset ${result.reset}/${result.processed} players to Unranked 0 LP.`,
        `Cleared ${result.pointTransactionsCleared} point transactions, ${result.snapshotsCleared} LP snapshots, ${result.matchesCleared} match records, and ${result.dailyScoresCleared} daily score rows.`,
      ].join('\n');

      await interaction.editReply({ content });

      await sendAuditLog(interaction.client, {
        action: '/admin reset-player-ranks',
        actorId: interaction.user.id,
        details: [
          `Players processed: ${result.processed}`,
          `Players reset: ${result.reset}`,
          `Point transactions cleared: ${result.pointTransactionsCleared}`,
          `LP snapshots cleared: ${result.snapshotsCleared}`,
          `Match records cleared: ${result.matchesCleared}`,
          `Daily scores cleared: ${result.dailyScoresCleared}`,
        ],
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to reset player ranks: ${err?.message ?? err}` });

      await sendAuditLog(interaction.client, {
        action: '/admin reset-player-ranks (failed)',
        actorId: interaction.user.id,
        details: [`Reason: ${(err?.message ?? String(err)).slice(0, 250)}`],
      });
    }
  }

  @Slash({
    name: 'trigger-daily-jobs',
    description: 'Manually trigger the daily recap and god standings notifications',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async triggerDailyJobs(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { runDailyJob, runGodStandingsJob } = await import('@/jobs/notificationJobs');

      await runDailyJob(interaction.client);
      await runGodStandingsJob(interaction.client);

      await interaction.editReply({ content: 'Daily jobs triggered successfully.' });

      await sendAuditLog(interaction.client, {
        action: '/admin trigger-daily-jobs',
        actorId: interaction.user.id,
        details: ['Manually triggered daily recap and god standings notifications.'],
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to trigger daily jobs: ${err?.message ?? err}` });
    }
  }

  @Slash({
    name: 'settings',
    description: 'View or update tournament settings',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageChannels],
  })
  @SlashGroup('admin')
  async tournamentSettings(
    @SlashOption({
      name: 'start',
      description: 'Tournament start date (ISO 8601, e.g. 2026-04-15T00:00:00Z)',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    start: string | undefined,
    @SlashOption({
      name: 'end',
      description: 'Tournament end date (ISO 8601, e.g. 2026-04-28T23:59:59Z)',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    end: string | undefined,
    @SlashOption({
      name: 'feed_channel',
      description: 'Channel to post 1st/8th place notifications',
      required: false,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
    })
    feedChannel: TextChannel | undefined,
    @SlashOption({
      name: 'daily_channel',
      description: 'Channel to post daily recap and LP graph',
      required: false,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
    })
    dailyChannel: TextChannel | undefined,
    @SlashOption({
      name: 'audit_channel',
      description: 'Channel to post command audit logs',
      required: false,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
    })
    auditChannel: TextChannel | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      if (start || end || feedChannel || dailyChannel || auditChannel) {
        const updates: Record<string, unknown> = {};
        if (start) updates.startDate = start;
        if (end) updates.endDate = end;
        if (feedChannel) updates.feedChannelId = feedChannel.id;
        if (dailyChannel) updates.dailyChannelId = dailyChannel.id;
        if (auditChannel) updates.auditChannelId = auditChannel.id;
        await updateTournamentSettings(updates);
      }

      const result = await getTournamentSettings();
      const s = result.settings;

      const embed = new EmbedBuilder()
        .setTitle(`Tournament Settings: ${s.name}`)
        .addFields(
          { name: 'Start', value: new Date(s.startDate).toLocaleString(), inline: true },
          { name: 'End', value: new Date(s.endDate).toLocaleString(), inline: true },
          { name: 'Active', value: (new Date() >= new Date(s.startDate) && new Date() <= new Date(s.endDate)) ? 'Yes' : 'No', inline: true },
          { name: 'Feed Channel', value: s.feedChannelId ? `<#${s.feedChannelId}>` : 'Not set', inline: true },
          { name: 'Daily Channel', value: s.dailyChannelId ? `<#${s.dailyChannelId}>` : 'Not set', inline: true },
          { name: 'Audit Channel', value: s.auditChannelId ? `<#${s.auditChannelId}>` : 'Not set', inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      const msg = (start || end || feedChannel || dailyChannel || auditChannel) ? 'Tournament settings updated.' : undefined;
      await interaction.editReply({ content: msg, embeds: [embed] });

      if (msg) {
        await sendAuditLog(interaction.client, {
          action: '/admin settings',
          actorId: interaction.user.id,
          details: [
            ...(start ? [`Start: ${start}`] : []),
            ...(end ? [`End: ${end}`] : []),
            ...(feedChannel ? [`Feed Channel: <#${feedChannel.id}>`] : []),
            ...(dailyChannel ? [`Daily Channel: <#${dailyChannel.id}>`] : []),
            ...(auditChannel ? [`Audit Channel: <#${auditChannel.id}>`] : []),
          ],
        });
      }
    } catch (err: any) {
      await interaction.editReply({ content: `Failed: ${err?.message ?? err}` });
    }
  }

  @Slash({
    name: 'wipe-data',
    description: 'Wipe all player data, matches, snapshots, and points',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async wipeData(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await wipePlayerData();
      const seededGods = await seedGods();
      const seededGodCount = Array.isArray(seededGods) ? seededGods.length : 0;

      await updateTournamentSettings({
        startDate: '2026-04-15T00:00:00Z',
        endDate: '2026-04-28T23:59:59Z',
        feedChannelId: '1487935453234466998',
        dailyChannelId: '1487935514899124294',
        godStandingsChannelId: '1487935550387261581',
        auditChannelId: '1488146762828091502',
      });

      const lines = [
        `Players: ${result.players ?? 0}`,
        `Snapshots: ${result.snapshots ?? 0}`,
        `Matches: ${result.matches ?? 0}`,
        `Point Transactions: ${result.pointTransactions ?? 0}`,
        `Daily Scores: ${result.dailyPlayerScores ?? 0}`,
        `Gods Seeded: ${seededGodCount}`,
        'Audit Channel: <#1488146762828091502>',
      ];

      await interaction.editReply({
        content: `Data wiped and tournament settings reset:\n${lines.join('\n')}`,
      });

      logger.info(result, `Data wiped by ${interaction.user.id}`);
      await sendAuditLog(interaction.client, {
        action: '/admin wipe-data',
        actorId: interaction.user.id,
        details: lines,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to wipe data: ${err?.message ?? err}` });
    }
  }

  @Slash({
    name: 'raw-message',
    description: 'Send a message from raw JSON (supports components v2)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async rawMessage(
    @SlashOption({
      name: 'json',
      description: 'Raw JSON payload for the message (components, flags, etc.)',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    json: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(json);
    } catch {
      await interaction.editReply({ content: 'Invalid JSON. Please provide a valid JSON string.' });
      return;
    }

    try {
      const channel = interaction.channel as TextChannel | null;
      if (!channel) {
        await interaction.editReply({ content: 'Could not resolve channel.' });
        return;
      }

      await channel.send(payload as any);
      await interaction.editReply({ content: 'Message sent.' });
      await sendAuditLog(interaction.client, {
        action: '/admin raw-message',
        actorId: interaction.user.id,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to send message:\n\`\`\`${err.message ?? err}\`\`\`` });
    }
  }

  @Slash({
    name: 'edit-raw-message',
    description: 'Edit an existing message with a raw JSON payload (supports components v2)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async editRawMessage(
    @SlashOption({
      name: 'message_id',
      description: 'The ID of the message to edit',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    messageId: string,
    @SlashOption({
      name: 'json',
      description: 'Raw JSON payload to replace the message content with',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    json: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(json);
    } catch {
      await interaction.editReply({ content: 'Invalid JSON. Please provide a valid JSON string.' });
      return;
    }

    try {
      const channel = interaction.channel as TextChannel | null;
      if (!channel) {
        await interaction.editReply({ content: 'Could not resolve channel.' });
        return;
      }

      const message = await channel.messages.fetch(messageId);
      await message.edit(payload as any);
      await interaction.editReply({ content: 'Message edited.' });
      await sendAuditLog(interaction.client, {
        action: '/admin edit-raw-message',
        actorId: interaction.user.id,
        details: [`Message ID: ${messageId}`],
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to edit message:\n\`\`\`${err.message ?? err}\`\`\`` });
    }
  }
}
