import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { registerPlayer } from '@/lib/backendClient';
import { parseRiotId } from '@/lib/riotId';
import { formatTierDisplay } from '@/lib/format';
import { EMBED_COLORS } from '@/lib/constants';

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

    const { gameName, tagLine, isValid } = parseRiotId(account);

    if (!isValid) {
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
      const tierDisplay = formatTierDisplay(player.currentTier, player.currentRank, player.currentLP);

      const embed = new EmbedBuilder()
        .setTitle(`✅ Linked: ${player.gameName}#${player.tagLine}`)
        .addFields(
          { name: 'Rank', value: tierDisplay, inline: true },
          { name: 'W/L', value: `${player.currentWins}W / ${player.currentLosses}L`, inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
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
