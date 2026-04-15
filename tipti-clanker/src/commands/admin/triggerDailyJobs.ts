import { PermissionFlagsBits, type CommandInteraction } from 'discord.js';
import { Discord, Guild, Slash, SlashGroup } from 'discordx';
import { sendAuditLog } from '@/lib/auditLog';
import { triggerDailyCron } from '@/lib/backendClient';
import { ADMIN_GUILDS } from './shared';

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminTriggerDailyJobsCommand {
  @Slash({
    name: 'trigger-daily-jobs',
    description: 'Manually trigger the daily recap and god standings notifications',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async triggerDailyJobs(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { runDailyJob, runGodStandingsJob } = await import('@/jobs/notificationJobs');

      await triggerDailyCron();
      await runDailyJob(interaction.client);
      await runGodStandingsJob(interaction.client);

      await interaction.editReply({ content: 'Daily jobs triggered successfully.' });

      await sendAuditLog(interaction.client, {
        action: '/admin trigger-daily-jobs',
        actorId: interaction.user.id,
        details: ['Manually triggered daily processing, recap, and god standings notifications.'],
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to trigger daily jobs: ${err?.message ?? err}` });
    }
  }
}
