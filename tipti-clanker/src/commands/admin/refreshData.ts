import { PermissionFlagsBits, type CommandInteraction } from 'discord.js';
import { Discord, Guild, Slash, SlashGroup } from 'discordx';
import { triggerCron } from '@/lib/backendClient';
import { sendAuditLog } from '@/lib/auditLog';
import { ADMIN_GUILDS } from './shared';

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminRefreshDataCommand {
  @Slash({
    name: 'refresh-data',
    description: 'Manually trigger a data refresh for all players',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async refreshData(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      await triggerCron();
      await interaction.editReply({
        content: 'Data refresh triggered. Snapshots and match records are being updated for all active players.',
      });
      await sendAuditLog(interaction.client, {
        action: '/admin refresh-data',
        actorId: interaction.user.id,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to trigger refresh: ${err?.message ?? err}` });
    }
  }
}
