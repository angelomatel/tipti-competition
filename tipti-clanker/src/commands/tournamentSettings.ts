import {
  ApplicationCommandOptionType,
  ChannelType,
  type CommandInteraction,
  type TextChannel,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getTournamentSettings, updateTournamentSettings } from '@/lib/backendClient';
import { EMBED_COLORS } from '@/lib/constants';

@Discord()
export class TournamentSettingsCommand {
  @Slash({
    name: 'tournament-settings',
    description: 'View or update tournament settings (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageChannels],
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
      // If any update params provided, update first
      if (start || end || feedChannel || dailyChannel || auditChannel) {
        const updates: Record<string, unknown> = {};
        if (start) updates.startDate = start;
        if (end) updates.endDate = end;
        if (feedChannel) updates.feedChannelId = feedChannel.id;
        if (dailyChannel) updates.dailyChannelId = dailyChannel.id;
        if (auditChannel) updates.auditChannelId = auditChannel.id;
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
          { name: 'Active', value: (new Date() >= new Date(s.startDate) && new Date() <= new Date(s.endDate)) ? 'Yes' : 'No', inline: true },
          { name: 'Feed Channel', value: s.feedChannelId ? `<#${s.feedChannelId}>` : 'Not set', inline: true },
          { name: 'Daily Channel', value: s.dailyChannelId ? `<#${s.dailyChannelId}>` : 'Not set', inline: true },
          { name: 'Audit Channel', value: s.auditChannelId ? `<#${s.auditChannelId}>` : 'Not set', inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      const msg = (start || end || feedChannel || dailyChannel || auditChannel) ? '✅ Tournament settings updated.' : '';
      await interaction.editReply({ content: msg || undefined, embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed: ${err?.message ?? err}` });
    }
  }
}
