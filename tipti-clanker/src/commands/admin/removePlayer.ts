import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import { Discord, Guild, Slash, SlashGroup, SlashOption } from 'discordx';
import { removePlayer } from '@/lib/backendClient';
import { sendAuditLog } from '@/lib/auditLog';
import { ADMIN_GUILDS } from './shared';

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminRemovePlayerCommand {
  @Slash({
    name: 'remove-player',
    description: 'Remove a player from the tournament',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
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
      await interaction.editReply({ content: `<@${member.id}> has been removed from the tournament.` });

      const username = member instanceof GuildMember ? member.user.username : (member as any).username ?? 'unknown';
      await sendAuditLog(interaction.client, {
        action: '/admin remove-player',
        actorId: interaction.user.id,
        details: [`Target Discord: <@${member.id}> (${username})`],
      });
    } catch (err: any) {
      const notFound = err?.message?.includes('not found') || err?.message?.includes('404');
      await interaction.editReply({
        content: notFound
          ? `<@${member.id}> is not registered in the tournament.`
          : `Failed to remove player: ${err?.message ?? err}`,
      });

      await sendAuditLog(interaction.client, {
        action: '/admin remove-player (failed)',
        actorId: interaction.user.id,
        details: [
          `Target Discord: <@${member.id}>`,
          `Reason: ${(err?.message ?? String(err)).slice(0, 250)}`,
        ],
      });
    }
  }
}
