import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import {
  getGodStandings,
  getGod,
  getTournamentSettings,
  assignPlayerToGod,
  eliminateGod,
} from '@/lib/backendClient';
import { EMBED_COLORS, GOD_CHOICES } from '@/lib/constants';

@Discord()
export class GodCommands {
  @Slash({
    name: 'god-standings',
    description: 'Show the current god standings',
  })
  async godStandings(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const settings = await getTournamentSettings();
      if (new Date() < new Date(settings.startDate)) {
        const embed = new EmbedBuilder()
          .setTitle('Event Not Started')
          .setDescription('The tournament has not started yet.')
          .setColor(EMBED_COLORS.DANGER);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const data = await getGodStandings();
      const standings: any[] = data.standings ?? [];

      if (standings.length === 0) {
        await interaction.editReply({ content: 'No gods have been seeded yet.' });
        return;
      }

      const lines = standings.map((god: any, i: number) => {
        const status = god.isEliminated ? '~~' : '';
        const prefix = god.isEliminated ? '💀' : `#${i + 1}`;
        return `${prefix} ${status}**${god.name}** — ${god.title}${status}\n   Score: **${Math.round(god.score)}** | Players: ${god.playerCount}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('God Standings')
        .setDescription(lines.join('\n\n'))
        .setColor(EMBED_COLORS.GOD_STANDINGS)
        .setFooter({ text: `Updated ${new Date(data.updatedAt).toLocaleString()}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to fetch standings: ${err?.message ?? err}` });
    }
  }

  @Slash({
    name: 'god-leaderboard',
    description: 'Show the leaderboard for a specific god',
  })
  async godLeaderboard(
    @SlashOption({
      name: 'god',
      description: 'The god to view',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    godName: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    try {
      const settings = await getTournamentSettings();
      if (new Date() < new Date(settings.startDate)) {
        const embed = new EmbedBuilder()
          .setTitle('Event Not Started')
          .setDescription('The tournament has not started yet.')
          .setColor(EMBED_COLORS.DANGER);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const slug = godName.toLowerCase().replace(/\s+/g, '_');
      const godChoice = GOD_CHOICES.find((g) => g.slug === slug || g.name.toLowerCase() === godName.toLowerCase());
      const targetSlug = godChoice?.slug ?? slug;

      const data = await getGod(targetSlug);
      const god = data.god;
      const players: any[] = data.players ?? [];

      if (!god) {
        await interaction.editReply({ content: `❌ God "${godName}" not found.` });
        return;
      }

      const lines = players.slice(0, 10).map((p: any, i: number) => {
        const eliminated = p.isEliminatedFromGod ? ' *(eliminated)*' : '';
        return `**#${i + 1}** ${p.gameName}#${p.tagLine} — **${p.scorePoints}** pts${eliminated}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`${god.name} — ${god.title}`)
        .setDescription(lines.length > 0 ? lines.join('\n') : 'No players in this god.')
        .setColor(god.isEliminated ? EMBED_COLORS.DANGER : EMBED_COLORS.PRIMARY)
        .setTimestamp();

      if (god.isEliminated) {
        embed.setFooter({ text: `Eliminated in Phase ${god.eliminatedInPhase}` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to fetch god: ${err?.message ?? err}` });
    }
  }

  @Slash({
    name: 'assign-god',
    description: 'Assign or reassign a player to a god (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
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
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed: ${err?.message ?? err}` });
    }
  }

  @Slash({
    name: 'eliminate-god',
    description: 'Eliminate a god from the tournament (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  async eliminateGodCmd(
    @SlashOption({
      name: 'god',
      description: 'The god to eliminate',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    godName: string,
    @SlashOption({
      name: 'phase',
      description: 'The phase number (1 or 2)',
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    phase: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const slug = godName.toLowerCase().replace(/\s+/g, '_');
    const godChoice = GOD_CHOICES.find((g) => g.slug === slug || g.name.toLowerCase() === godName.toLowerCase());
    const targetSlug = godChoice?.slug ?? slug;

    try {
      await eliminateGod(targetSlug, phase);
      await interaction.editReply({
        content: `💀 **${godChoice?.name ?? godName}** has been eliminated in Phase ${phase}.`,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed: ${err?.message ?? err}` });
    }
  }
}
