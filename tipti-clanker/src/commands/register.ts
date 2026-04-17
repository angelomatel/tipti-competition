import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { registerPlayer, listGods, lookupRiotAccount, getTournamentSettings, getPlayer } from '@/lib/backendClient';
import { parseRiotId } from '@/lib/riotId';
import { formatTierDisplay } from '@/lib/format';
import { EMBED_COLORS, GOD_CHOICES } from '@/lib/constants';
import { sendAuditLog } from '@/lib/auditLog';
import { logger } from '@/lib/logger';
import {
  getPublicErrorMessage,
  isAlreadyRegisteredError,
  isHttpStatus,
  PUBLIC_ERROR_MESSAGES,
  sendCommandErrorAuditLog,
} from '@/lib/publicCommandErrors';
import { sendRegistrationFailureNotice } from '@/lib/registrationFailureNotice';

const GOD_SELECTION_TIMEOUT_MS = 180_000;

function hasTournamentStarted(settingsResponse: any): boolean {
  const startDate = settingsResponse?.settings?.startDate ?? settingsResponse?.startDate;

  return !!startDate && new Date() >= new Date(startDate);
}

@Discord()
export class Register {
  @Slash({
    name: 'register',
    description: 'Register for the tournament with your Riot account (e.g. /register account:PlayerName#TAG)',
  })
  async register(
    @SlashOption({
      name: 'account',
      description: 'Your Riot ID with tag, e.g. PlayerName#1234',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    account: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const { gameName, tagLine, isValid } = parseRiotId(account);

    const handleFailure = async (
      userMessage: string,
      options: { error?: unknown; target?: string } = {},
    ): Promise<void> => {
      await interaction.editReply({
        content: userMessage,
        embeds: [],
        components: [],
      });

      await Promise.allSettled([
        sendCommandErrorAuditLog(interaction.client, {
          commandName: '/register',
          actorId: interaction.user.id,
          target: options.target ?? `${gameName}#${tagLine}`,
          userMessage,
          error: options.error,
        }),
        sendRegistrationFailureNotice(interaction.client, interaction.user.id, userMessage),
      ]);
    };

    if (!isValid) {
      const userMessage = '❌ Invalid format. Use `username#TAG` (the #TAG is required).';
      await handleFailure(userMessage, { target: account });
      return;
    }

    try {
      const existingPlayer = await getPlayer(interaction.user.id);
      if (existingPlayer?.player) {
        const userMessage = PUBLIC_ERROR_MESSAGES.alreadyRegistered;
        await handleFailure(userMessage);
        return;
      }
    } catch (err: any) {
      if (!isHttpStatus(err, 404)) {
        const userMessage = getPublicErrorMessage(err);
        await handleFailure(userMessage, { error: err });
        return;
      }
    }

    try {
      await lookupRiotAccount(gameName, tagLine);
      logger.info(
        {
          requesterId: interaction.user.id,
          discordId: interaction.user.id,
          riotId: `${gameName}#${tagLine}`,
        },
        '[register] Fetched Riot account before registration',
      );
    } catch (err) {
      const userMessage = getPublicErrorMessage(err, {
        notFoundMessage: PUBLIC_ERROR_MESSAGES.riotAccountNotFound,
        fallbackPrefix: '❌ Failed to verify Riot account',
      });
      await handleFailure(userMessage, { error: err });
      return;
    }

    let eventStarted = false;
    try {
      const settings = await getTournamentSettings();
      eventStarted = hasTournamentStarted(settings);
    } catch {
      eventStarted = false;
    }

    let gods: any[] = [];
    try {
      gods = await listGods();
    } catch {
      gods = GOD_CHOICES.map((g) => ({ ...g, isEliminated: false, playerCount: 0 }));
    }

    const options = GOD_CHOICES
      .filter((god) => {
        const godData = gods.find((g: any) => g.slug === god.slug);
        return !(godData?.isEliminated ?? false);
      })
      .map((god) => {
        const godData = gods.find((g: any) => g.slug === god.slug);
        const playerCount = godData?.playerCount ?? 0;
        const description = eventStarted ? `${playerCount} player${playerCount !== 1 ? 's' : ''}` : god.title;

        return new StringSelectMenuOptionBuilder()
          .setLabel(`${god.name} — ${god.title}`)
          .setDescription(description)
          .setValue(god.slug)
          .setDefault(false);
      });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('god_select')
      .setPlaceholder('Choose your God...')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('Choose Your God')
      .setDescription(
        `Account: **${gameName}#${tagLine}**\n\n` +
        '> God buffs activate **after Phase 1** (Day 6+). During Phase 1, all gods play without buffs.\n\n' +
        'You can view each god\'s lore and buffs in <#1487949751587573861> or at\n' +
        'https://tipti-bootcamp.vercel.app/leaderboard/gods\n\n' +
        '-# [See the points formula here](https://tipti-bootcamp.vercel.app/rules)',
      )
      .setColor(EMBED_COLORS.PRIMARY);

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    try {
      const selection = await reply.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: GOD_SELECTION_TIMEOUT_MS,
        filter: (i) => i.user.id === interaction.user.id,
      });

      await selection.deferUpdate();

      const godSlug = selection.values[0];
      const godInfo = GOD_CHOICES.find((g) => g.slug === godSlug);

      const result = await registerPlayer({
        discordId: interaction.user.id,
        gameName,
        tagLine,
        addedBy: interaction.user.id,
        discordAvatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
        discordUsername: interaction.user.username,
        godSlug,
      });

      const player = result.player;
      const tierDisplay = formatTierDisplay(player.currentTier, player.currentRank, player.currentLP);
      logger.info(
        {
          requesterId: interaction.user.id,
          discordId: interaction.user.id,
          riotId: player.riotId ?? `${gameName}#${tagLine}`,
          godSlug,
        },
        '[register] Registered player',
      );

      const confirmEmbed = new EmbedBuilder()
        .setTitle(`✅ Registered: ${player.gameName}#${player.tagLine}`)
        .addFields(
          { name: 'Rank', value: tierDisplay, inline: true },
          { name: 'W/L', value: `${player.currentWins}W / ${player.currentLosses}L`, inline: true },
          { name: 'God', value: `${godInfo?.name ?? godSlug} — ${godInfo?.title ?? ''}`, inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      await interaction.editReply({ embeds: [confirmEmbed], components: [] });

      await sendAuditLog(interaction.client, {
        action: '/register',
        actorId: interaction.user.id,
        details: [
          `Discord: ${interaction.user.username}`,
          `Riot: ${gameName}#${tagLine}`,
          `God: ${godInfo?.name ?? godSlug} (${godSlug})`,
        ],
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const isSelectionTimeout = msg.includes('time') || msg.includes('Collector');
      const alreadyRegistered = !isSelectionTimeout && isAlreadyRegisteredError(err);
      const userMessage = isSelectionTimeout
        ? `❌ God selection timed out after ${Math.floor(GOD_SELECTION_TIMEOUT_MS / 60_000)} minutes. Run \`/register\` again.`
        : alreadyRegistered
          ? PUBLIC_ERROR_MESSAGES.alreadyRegistered
          : getPublicErrorMessage(err, { fallbackPrefix: '❌ Failed to register' });

      await handleFailure(userMessage, { error: err });
    }
  }
}
