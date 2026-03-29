import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { registerPlayer, removePlayer, triggerCron, listGods, lookupRiotAccount } from '@/lib/backendClient';
import { parseRiotId } from '@/lib/riotId';
import { formatTierDisplay } from '@/lib/format';
import { EMBED_COLORS, GOD_CHOICES } from '@/lib/constants';

@Discord()
export class AdminCommands {
  @Slash({
    name: 'add-player',
    description: 'Register a player in the tournament (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
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
      await interaction.editReply({ content: '❌ Invalid format. Use `username#TAG`.' });
      return;
    }

    // Validate the Riot account exists
    try {
      await lookupRiotAccount(gameName, tagLine);
    } catch {
      await interaction.editReply({ content: '❌ Could not find that Riot account.' });
      return;
    }

    // Fetch gods for selection
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

    const buffSummaries = [
      '**Varus** — *Love*: Top 1 gets +6, all players get +2',
      '**Ekko** — *Time*: Flat +50 bonus at the end of each phase',
      '**Evelynn** — *Temptation*: Top player gets +5, or +9 if daily gain is 300+. All others get +2',
      '**Thresh** — *Pacts*: Top 2 get +5 each, all players get +2',
      '**Yasuo** — *Abyss*: 150+ LP gain gives +10, but 100 or less gives -8',
      '**Soraka** — *Stars*: +1/-1 per latest win/loss streak (cap ±4)',
      '**Kayle** — *Order*: Daily +2 for 5+ matches. End-of-tournament: Top 1-2 → +20, Top 3 → +30, Top 4-5 → +40',
      '**Ahri** — *Opulence*: +3 per 1st place finish (daily cap 21, overall cap 80)',
      '**Aurelion Sol** — *Wonders*: Top 1 gets +5-8, all players get +1-3 (random)',
    ];

    const embed = new EmbedBuilder()
      .setTitle('Choose God for Player')
      .setDescription(
        `Registering <@${member.id}> as **${gameName}#${tagLine}**\n\n` +
        '> God buffs activate **after Phase 1** (Day 6+). During Phase 1, all gods play without buffs.\n\n' +
        buffSummaries.join('\n'),
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
        .setTitle(`✅ Registered: ${player.gameName}#${player.tagLine}`)
        .addFields(
          { name: 'Discord', value: `<@${member.id}>`, inline: true },
          { name: 'Rank', value: tierDisplay, inline: true },
          { name: 'God', value: `${godInfo?.name ?? godSlug} — ${godInfo?.title ?? ''}`, inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      await interaction.editReply({ embeds: [confirmEmbed], components: [] });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes('time') || msg.includes('Collector')) {
        await interaction.editReply({ content: '❌ Selection timed out.', embeds: [], components: [] });
      } else {
        await interaction.editReply({ content: `❌ Failed to register player: ${msg}`, embeds: [], components: [] });
      }
    }
  }

  @Slash({
    name: 'remove-player',
    description: 'Remove a player from the tournament (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
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
    } catch (err: any) {
      const notFound = err?.message?.includes('not found') || err?.message?.includes('404');
      await interaction.editReply({
        content: notFound
          ? `❌ <@${member.id}> is not registered in the tournament.`
          : `❌ Failed to remove player: ${err?.message ?? err}`,
      });
    }
  }

  @Slash({
    name: 'refresh-data',
    description: 'Manually trigger a data refresh for all players (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  async refreshData(
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      await triggerCron();
      await interaction.editReply({ content: '✅ Data refresh triggered. Snapshots and match records are being updated for all active players.' });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to trigger refresh: ${err?.message ?? err}` });
    }
  }
}
