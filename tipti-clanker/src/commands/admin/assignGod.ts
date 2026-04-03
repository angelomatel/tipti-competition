import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  type GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import { Discord, Guild, Slash, SlashGroup, SlashOption } from 'discordx';
import { assignPlayerToGod } from '@/lib/backendClient';
import { sendAuditLog } from '@/lib/auditLog';
import { GOD_CHOICES } from '@/lib/constants';
import { ADMIN_GUILDS } from './shared';

@Discord()
@Guild(...ADMIN_GUILDS)
@SlashGroup({ name: 'admin', description: 'Tournament admin commands' })
export class AdminAssignGodCommand {
  @Slash({
    name: 'assign-god',
    description: 'Assign or reassign a player to a god',
    defaultMemberPermissions: [PermissionFlagsBits.Administrator],
  })
  @SlashGroup('admin')
  async assignGod(
    @SlashOption({
      name: 'user',
      description: 'The Discord user to assign',
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    member: GuildMember,
    @SlashOption({
      name: 'god',
      description: 'The god to assign them to',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    godName: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const slug = godName.toLowerCase().replace(/\s+/g, '_');
    const godChoice = GOD_CHOICES.find((god) => god.slug === slug || god.name.toLowerCase() === godName.toLowerCase());
    const targetSlug = godChoice?.slug ?? slug;

    try {
      await assignPlayerToGod(targetSlug, member.id);
      await interaction.editReply({
        content: `<@${member.id}> has been assigned to **${godChoice?.name ?? godName}**.`,
      });

      await sendAuditLog(interaction.client, {
        action: '/admin assign-god',
        actorId: interaction.user.id,
        details: [
          `Target Discord: <@${member.id}> (${member.user.username})`,
          `God: ${godChoice?.name ?? godName} (${targetSlug})`,
        ],
      });
    } catch (err: any) {
      await interaction.editReply({ content: `Failed: ${err?.message ?? err}` });

      await sendAuditLog(interaction.client, {
        action: '/admin assign-god (failed)',
        actorId: interaction.user.id,
        details: [
          `Target Discord: <@${member.id}>`,
          `God: ${godChoice?.name ?? godName} (${targetSlug})`,
          `Reason: ${(err?.message ?? String(err)).slice(0, 250)}`,
        ],
      });
    }
  }
}
