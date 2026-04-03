import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getGod, getTournamentSettings } from '@/lib/backendClient';
import { EMBED_COLORS, GOD_CHOICES } from '@/lib/constants';

@Discord()
export class GodLeaderboardCommand {
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
      const { settings } = await getTournamentSettings();
      const now = new Date();
      const startDate = new Date(settings.startDate);

      if (now < startDate) {
        const embed = new EmbedBuilder()
          .setTitle('Event Not Started')
          .setDescription('The tournament has not started yet.')
          .setColor(EMBED_COLORS.DANGER);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const slug = godName.toLowerCase().replace(/\s+/g, '_');
      const godChoice = GOD_CHOICES.find((god) => god.slug === slug || god.name.toLowerCase() === godName.toLowerCase());
      const targetSlug = godChoice?.slug ?? slug;

      const data = await getGod(targetSlug);
      const god = data.god;
      const players: any[] = data.players ?? [];

      if (!god) {
        await interaction.editReply({ content: `God "${godName}" not found.` });
        return;
      }

      const lines = players.slice(0, 10).map((player: any, index: number) => {
        const eliminated = player.isEliminatedFromGod ? ' *(eliminated)*' : '';
        return `**#${index + 1}** ${player.gameName}#${player.tagLine} - **${player.scorePoints}** pts${eliminated}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`${god.name} - ${god.title}`)
        .setDescription(lines.length > 0 ? lines.join('\n') : 'No players in this god.')
        .setColor(god.isEliminated ? EMBED_COLORS.DANGER : EMBED_COLORS.PRIMARY)
        .setTimestamp();

      if (god.isEliminated) {
        embed.setFooter({ text: `Eliminated in Phase ${god.eliminatedInPhase}` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to fetch god: ${err?.message ?? err}` });
    }
  }
}
