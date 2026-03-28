import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { registerPlayer } from '@/lib/backendClient';

@Discord()
export class Link {
  @Slash({
    name: 'link',
    description: 'Link your Riot account to this tournament (e.g. /link account:PlayerName#TAG)',
  })
  async link(
    @SlashOption({
      name: 'account',
      description: 'Your Riot ID with tag, e.g. PlayerName#1234',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    account: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const parts = account.trim().split('#');
    const gameName = parts[0];
    const tagLine = parts[1];

    if (!gameName || !tagLine) {
      await interaction.editReply({ content: '❌ Invalid format. Use `username#TAG` (the #TAG is required).' });
      return;
    }

    try {
      const result = await registerPlayer({
        discordId: interaction.user.id,
        gameName,
        tagLine,
        addedBy: interaction.user.id,
        discordAvatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
        discordUsername: interaction.user.username,
      });

      const player = result.player;
      const tierDisplay = player.currentTier === 'UNRANKED'
        ? 'Unranked'
        : `${player.currentTier} ${player.currentRank} — ${player.currentLP} LP`;

      const embed = new EmbedBuilder()
        .setTitle(`✅ Linked: ${player.gameName}#${player.tagLine}`)
        .addFields(
          { name: 'Rank', value: tierDisplay, inline: true },
          { name: 'W/L', value: `${player.currentWins}W / ${player.currentLosses}L`, inline: true },
        )
        .setColor(0x7b2fff)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const already = msg.includes('already registered') || msg.includes('409');
      await interaction.editReply({
        content: already
          ? '❌ Your account is already linked. Contact an admin if you need to change it.'
          : `❌ Failed to link account: ${msg}`,
      });
    }
  }
}
