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

const GOD_SELECTION_TIMEOUT_MS = 180_000;

function extractBackendErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const jsonStart = rawMessage.indexOf('{');

  if (jsonStart === -1) {
    return rawMessage;
  }

  try {
    const parsed = JSON.parse(rawMessage.slice(jsonStart)) as { error?: string };
    return parsed.error ?? rawMessage;
  } catch {
    return rawMessage;
  }
}

function isAlreadyRegisteredError(error: unknown): boolean {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const normalizedMessage = extractBackendErrorMessage(error).toLowerCase();

  return rawMessage.includes('HTTP 409') && normalizedMessage.includes('already registered');
}

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

    if (!isValid) {
      await interaction.editReply({ content: '❌ Invalid format. Use `username#TAG` (the #TAG is required).' });
      return;
    }

    try {
      const existingPlayer = await getPlayer(interaction.user.id);
      if (existingPlayer?.player) {
        await interaction.editReply({
          content: '❌ You are already registered for the tournament. Contact an admin if you need your registration updated.',
        });
        return;
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (!msg.includes('HTTP 404')) {
        throw err;
      }
    }

    try {
      await lookupRiotAccount(gameName, tagLine);
    } catch {
      await interaction.editReply({ content: '❌ Could not find that Riot account. Double-check the username and tag.' });
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

      if (msg.includes('time') || msg.includes('Collector')) {
        await interaction.editReply({
          content: `❌ God selection timed out after ${Math.floor(GOD_SELECTION_TIMEOUT_MS / 60_000)} minutes. Run \`/register\` again.`,
          embeds: [],
          components: [],
        });
      } else {
        const alreadyRegistered = isAlreadyRegisteredError(err);
        const backendMessage = extractBackendErrorMessage(err);

        await interaction.editReply({
          content: alreadyRegistered
            ? '❌ You are already registered for the tournament. Contact an admin if you need your registration updated.'
            : `❌ Failed to register: ${backendMessage}`,
          embeds: [],
          components: [],
        });
      }

      await sendAuditLog(interaction.client, {
        action: '/register (failed)',
        actorId: interaction.user.id,
        details: [
          `Riot: ${gameName}#${tagLine}`,
          `Reason: ${msg.slice(0, 250)}`,
        ],
      });
    }
  }
}
