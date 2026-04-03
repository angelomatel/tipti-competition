import { type CommandInteraction, EmbedBuilder } from 'discord.js';
import { Discord, Slash } from 'discordx';
import { getGodStandings, getTournamentSettings } from '@/lib/backendClient';
import { EMBED_COLORS } from '@/lib/constants';

@Discord()
export class GodStandingsCommand {
  @Slash({
    name: 'god-standings',
    description: 'Show the current god standings',
  })
  async godStandings(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const { settings } = await getTournamentSettings();
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

      const lines = standings.map((god: any, index: number) => {
        const status = god.isEliminated ? '~~' : '';
        const prefix = god.isEliminated ? '💀' : `#${index + 1}`;
        return `${prefix} ${status}**${god.name}** - ${god.title}${status}\n   Score: **${Math.round(god.score)}** | Players: ${god.playerCount}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('God Standings')
        .setDescription(lines.join('\n\n'))
        .setColor(EMBED_COLORS.GOD_STANDINGS)
        .setFooter({ text: `Updated ${new Date(data.updatedAt).toLocaleString()}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to fetch standings: ${err?.message ?? err}` });
    }
  }
}
