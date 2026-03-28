import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildMember,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { registerPlayer, removePlayer, triggerCron } from '@/lib/backendClient';
import { parseRiotId } from '@/lib/riotId';
import { formatTierDisplay } from '@/lib/format';
import { EMBED_COLORS } from '@/lib/constants';

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

    try {
      const result = await registerPlayer({
        discordId: member.id,
        gameName,
        tagLine,
        addedBy: interaction.user.id,
        discordAvatarUrl: member.displayAvatarURL({ extension: 'png', size: 128 }),
        discordUsername: member.user.username,
      });

      const player = result.player;
      const tierDisplay = formatTierDisplay(player.currentTier, player.currentRank, player.currentLP);

      const embed = new EmbedBuilder()
        .setTitle(`✅ Registered: ${player.gameName}#${player.tagLine}`)
        .addFields(
          { name: 'Discord', value: `<@${member.id}>`, inline: true },
          { name: 'Rank', value: tierDisplay, inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to register player: ${err?.message ?? err}` });
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
