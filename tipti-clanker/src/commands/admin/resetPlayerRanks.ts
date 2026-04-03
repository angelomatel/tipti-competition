import { PermissionFlagsBits, type CommandInteraction } from 'discord.js';
import { Discord, Guild, Slash, SlashGroup } from 'discordx';
import { resetAllPlayerRanks } from '@/lib/backendClient';
import { sendAuditLog } from '@/lib/auditLog';
import { ADMIN_GUILDS } from './shared';

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminResetPlayerRanksCommand {
  @Slash({
    name: 'reset-player-ranks',
    description: 'Reset all players to Unranked 0 LP and clear points/history for a new set',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async resetPlayerRanks(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await resetAllPlayerRanks();
      const content = [
        `Reset ${result.reset}/${result.processed} players to Unranked 0 LP.`,
        `Cleared ${result.pointTransactionsCleared} point transactions, ${result.snapshotsCleared} LP snapshots, ${result.matchesCleared} match records, and ${result.dailyScoresCleared} daily score rows.`,
      ].join('\n');

      await interaction.editReply({ content });

      await sendAuditLog(interaction.client, {
        action: '/admin reset-player-ranks',
        actorId: interaction.user.id,
        details: [
          `Players processed: ${result.processed}`,
          `Players reset: ${result.reset}`,
          `Point transactions cleared: ${result.pointTransactionsCleared}`,
          `LP snapshots cleared: ${result.snapshotsCleared}`,
          `Match records cleared: ${result.matchesCleared}`,
          `Daily scores cleared: ${result.dailyScoresCleared}`,
        ],
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to reset player ranks: ${err?.message ?? err}` });

      await sendAuditLog(interaction.client, {
        action: '/admin reset-player-ranks (failed)',
        actorId: interaction.user.id,
        details: [`Reason: ${(err?.message ?? String(err)).slice(0, 250)}`],
      });
    }
  }
}
