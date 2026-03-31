import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  PermissionFlagsBits,
  type TextChannel,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class RawMessage {
  @Slash({
    name: "raw-message",
    description: "Send a message from raw JSON (supports components v2)",
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  async rawMessage(
    @SlashOption({
      name: "json",
      description: "Raw JSON payload for the message (components, flags, etc.)",
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
      await interaction.editReply({
        content: "❌ Invalid JSON. Please provide a valid JSON string.",
      });
      return;
    }

    try {
      const channel = interaction.channel as TextChannel | null;
      if (!channel) {
        await interaction.editReply({ content: "❌ Could not resolve channel." });
        return;
      }
      await channel.send(payload as any);
      await interaction.editReply({ content: "✅ Message sent!" });
    } catch (err: any) {
      await interaction.editReply({
        content: `❌ Failed to send message:\n\`\`\`${err.message ?? err}\`\`\``,
      });
    }
  }

  @Slash({
    name: "edit-raw-message",
    description: "Edit an existing message with a raw JSON payload (supports components v2)",
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  async editRawMessage(
    @SlashOption({
      name: "message_id",
      description: "The ID of the message to edit",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    messageId: string,
    @SlashOption({
      name: "json",
      description: "Raw JSON payload to replace the message content with",
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
      await interaction.editReply({
        content: "❌ Invalid JSON. Please provide a valid JSON string.",
      });
      return;
    }

    try {
      const channel = interaction.channel as TextChannel | null;
      if (!channel) {
        await interaction.editReply({ content: "❌ Could not resolve channel." });
        return;
      }
      const message = await channel.messages.fetch(messageId);
      await message.edit(payload as any);
      await interaction.editReply({ content: "✅ Message edited!" });
    } catch (err: any) {
      await interaction.editReply({
        content: `❌ Failed to edit message:\n\`\`\`${err.message ?? err}\`\`\``,
      });
    }
  }
}
