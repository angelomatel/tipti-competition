import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  PermissionFlagsBits,
  type TextChannel,
} from 'discord.js';
import { Discord, Guild, Slash, SlashGroup, SlashOption } from 'discordx';
import { sendAuditLog } from '@/lib/auditLog';
import { ADMIN_GUILDS } from './shared';

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminRawMessageCommand {
  @Slash({
    name: 'raw-message',
    description: 'Send a message from raw JSON (supports components v2)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async rawMessage(
    @SlashOption({
      name: 'json',
      description: 'Raw JSON payload for the message (components, flags, etc.)',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    json: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(json);
    } catch {
      await interaction.editReply({ content: 'Invalid JSON. Please provide a valid JSON string.' });
      return;
    }

    try {
      const channel = interaction.channel as TextChannel | null;
      if (!channel) {
        await interaction.editReply({ content: 'Could not resolve channel.' });
        return;
      }

      await channel.send(payload as any);
      await interaction.editReply({ content: 'Message sent.' });
      await sendAuditLog(interaction.client, {
        action: '/admin raw-message',
        actorId: interaction.user.id,
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to send message:\n\`\`\`${err.message ?? err}\`\`\`` });
    }
  }
}
