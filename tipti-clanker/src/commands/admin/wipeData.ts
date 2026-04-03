import { PermissionFlagsBits, type CommandInteraction } from 'discord.js';
import { Discord, Guild, Slash, SlashGroup } from 'discordx';
import { seedGods, updateTournamentSettings, wipePlayerData } from '@/lib/backendClient';
import { sendAuditLog } from '@/lib/auditLog';
import { logger } from '@/lib/logger';
import { ADMIN_GUILDS } from './shared';

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminWipeDataCommand {
  @Slash({
    name: 'wipe-data',
    description: 'Wipe all player data, matches, snapshots, and points',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async wipeData(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await wipePlayerData();
      const seededGods = await seedGods();
      const seededGodCount = Array.isArray(seededGods) ? seededGods.length : 0;

      await updateTournamentSettings({
        startDate: '2026-04-15T00:00:00Z',
        endDate: '2026-04-28T23:59:59Z',
        feedChannelId: '1487935453234466998',
        dailyChannelId: '1487935514899124294',
        godStandingsChannelId: '1487935550387261581',
        auditChannelId: '1488146762828091502',
      });

      const lines = [
        `Players: ${result.players ?? 0}`,
        `Snapshots: ${result.snapshots ?? 0}`,
        `Matches: ${result.matches ?? 0}`,
        `Point Transactions: ${result.pointTransactions ?? 0}`,
        `Daily Scores: ${result.dailyPlayerScores ?? 0}`,
        `Gods Seeded: ${seededGodCount}`,
        'Audit Channel: <#1488146762828091502>',
      ];

      await interaction.editReply({
        content: `Data wiped and tournament settings reset:\n${lines.join('\n')}`,
      });

      logger.info(result, `Data wiped by ${interaction.user.id}`);
      await sendAuditLog(interaction.client, {
        action: '/admin wipe-data',
        actorId: interaction.user.id,
        details: lines,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to wipe data: ${err?.message ?? err}` });
    }
  }
}
