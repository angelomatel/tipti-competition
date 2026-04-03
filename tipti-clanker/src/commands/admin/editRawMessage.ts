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
export class AdminEditRawMessageCommand {
  @Slash({
    name: 'edit-raw-message',
    description: 'Edit an existing message with a raw JSON payload (supports components v2)',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async editRawMessage(
    @SlashOption({
      name: 'message_id',
      description: 'The ID of the message to edit',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    messageId: string,
    @SlashOption({
      name: 'json',
      description: 'Raw JSON payload to replace the message content with',
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

      const message = await channel.messages.fetch(messageId);
      await message.edit(payload as any);
      await interaction.editReply({ content: 'Message edited.' });
      await sendAuditLog(interaction.client, {
        action: '/admin edit-raw-message',
        actorId: interaction.user.id,
        details: [`Message ID: ${messageId}`],
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed to edit message:\n\`\`\`${err.message ?? err}\`\`\`` });
    }
  }
}
