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
import { registerPlayer, listGods, lookupRiotAccount } from '@/lib/backendClient';
import { parseRiotId } from '@/lib/riotId';
import { formatTierDisplay } from '@/lib/format';
import { EMBED_COLORS, GOD_BUFF_SUMMARIES, GOD_CHOICES } from '@/lib/constants';
import { sendAuditLog } from '@/lib/auditLog';

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

    // Validate the Riot account exists
    try {
      await lookupRiotAccount(gameName, tagLine);
    } catch {
      await interaction.editReply({ content: '❌ Could not find that Riot account. Double-check the username and tag.' });
      return;
    }

    // Fetch current gods to show availability
    let gods: any[] = [];
    try {
      gods = await listGods();
    } catch {
      gods = GOD_CHOICES.map((g) => ({ ...g, isEliminated: false, playerCount: 0 }));
    }

    // Build god selection dropdown
    const options = GOD_CHOICES.map((god) => {
      const godData = gods.find((g: any) => g.slug === god.slug);
      const eliminated = godData?.isEliminated ?? false;
      const playerCount = godData?.playerCount ?? 0;

      return new StringSelectMenuOptionBuilder()
        .setLabel(`${god.name} — ${god.title}`)
        .setDescription(`${playerCount} player${playerCount !== 1 ? 's' : ''}${eliminated ? ' (ELIMINATED)' : ''}`)
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
        GOD_BUFF_SUMMARIES.join('\n'),
      )
      .setColor(EMBED_COLORS.PRIMARY);

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Wait for selection (60 second timeout)
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
          content: '❌ God selection timed out. Run `/register` again.',
          embeds: [],
          components: [],
        });
      } else {
        const already = msg.includes('already registered') || msg.includes('409');
        await interaction.editReply({
          content: already
            ? '❌ Your account is already linked. Contact an admin if you need to change it.'
            : `❌ Failed to register: ${msg}`,
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
