import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getTournamentSettings, updateTournamentSettings } from '@/lib/backendClient';

@Discord()
export class TournamentSettingsCommand {
  @Slash({
    name: 'tournament-settings',
    description: 'View or update tournament settings (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  async tournamentSettings(
    @SlashOption({
      name: 'start',
      description: 'Tournament start date (ISO 8601, e.g. 2025-04-01T00:00:00Z)',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    start: string | undefined,
    @SlashOption({
      name: 'end',
      description: 'Tournament end date (ISO 8601, e.g. 2025-04-14T23:59:59Z)',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    end: string | undefined,
    @SlashOption({
      name: 'name',
      description: 'Tournament name',
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    name: string | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      // If any update params provided, update first
      if (start || end || name) {
        const updates: Record<string, unknown> = {};
        if (start) updates.startDate = start;
        if (end) updates.endDate = end;
        if (name) updates.name = name;
        await updateTournamentSettings(updates);
      }

      // Fetch current settings
      const result = await getTournamentSettings();
      const s = result.settings;

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${s.name}`)
        .addFields(
          { name: 'Start', value: new Date(s.startDate).toLocaleString(), inline: true },
          { name: 'End', value: new Date(s.endDate).toLocaleString(), inline: true },
          { name: 'Active', value: s.isActive ? 'Yes' : 'No', inline: true },
        )
        .setColor(0x7b2fff)
        .setTimestamp();

      const msg = start || end || name ? '✅ Tournament settings updated.' : '';
      await interaction.editReply({ content: msg || undefined, embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed: ${err?.message ?? err}` });
    }
  }
}
