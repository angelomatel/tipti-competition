import {
  type CommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Discord, Guild, Slash } from 'discordx';
import { seedGods, wipePlayerData } from '@/lib/backendClient';
import { logger } from '@/lib/logger';

const ADMIN_GUILD = '262398311007387653';

@Discord()
@Guild(ADMIN_GUILD)
export class SetupCommands {
  @Slash({
    name: 'seed-gods',
    description: 'Seed all 9 gods into the database (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  async seedGods(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await seedGods();
      const count = Array.isArray(result) ? result.length : 0;
      await interaction.editReply({ content: `✅ Seeded ${count} gods successfully.` });
      logger.info(`Gods seeded by ${interaction.user.id}`);
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to seed gods: ${err?.message ?? err}` });
    }
  }

  @Slash({
    name: 'wipe-data',
    description: 'Wipe all player data, matches, snapshots, and points (admin only)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  async wipeData(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await wipePlayerData();
      const lines = [
        `Players: ${result.players ?? 0}`,
        `Snapshots: ${result.snapshots ?? 0}`,
        `Matches: ${result.matches ?? 0}`,
        `Point Transactions: ${result.pointTransactions ?? 0}`,
        `Daily Scores: ${result.dailyPlayerScores ?? 0}`,
      ];
      await interaction.editReply({
        content: `✅ Data wiped:\n${lines.join('\n')}`,
      });
      logger.info(result, `Data wiped by ${interaction.user.id}`);
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to wipe data: ${err?.message ?? err}` });
    }
  }
}
