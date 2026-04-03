import {
  ApplicationCommandOptionType,
  ChannelType,
  type CommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  type TextChannel,
} from 'discord.js';
import { Discord, Guild, Slash, SlashGroup, SlashOption } from 'discordx';
import { getTournamentSettings, updateTournamentSettings } from '@/lib/backendClient';
import { sendAuditLog } from '@/lib/auditLog';
import { EMBED_COLORS } from '@/lib/constants';
import { ADMIN_GUILDS } from './shared';

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminSettingsCommand {
  @Slash({
    name: 'settings',
    description: 'View or update tournament settings',
    defaultMemberPermissions: [
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageChannels,
    ],
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
      const settings = result.settings;

      const embed = new EmbedBuilder()
        .setTitle(`Tournament Settings: ${settings.name}`)
        .addFields(
          { name: 'Start', value: new Date(settings.startDate).toLocaleString(), inline: true },
          { name: 'End', value: new Date(settings.endDate).toLocaleString(), inline: true },
          {
            name: 'Active',
            value:
              new Date() >= new Date(settings.startDate) && new Date() <= new Date(settings.endDate)
                ? 'Yes'
                : 'No',
            inline: true,
          },
          { name: 'Feed Channel', value: settings.feedChannelId ? `<#${settings.feedChannelId}>` : 'Not set', inline: true },
          { name: 'Daily Channel', value: settings.dailyChannelId ? `<#${settings.dailyChannelId}>` : 'Not set', inline: true },
          { name: 'Audit Channel', value: settings.auditChannelId ? `<#${settings.auditChannelId}>` : 'Not set', inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      const msg = start || end || feedChannel || dailyChannel || auditChannel ? 'Tournament settings updated.' : undefined;
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
}
