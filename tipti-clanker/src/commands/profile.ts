import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  type GuildMember,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getPlayer, getLeaderboard } from '@/lib/backendClient';
import { formatTierDisplay, formatLpGain } from '@/lib/format';
import { EMBED_COLORS } from '@/lib/constants';

@Discord()
export class Profile {
  @Slash({
    name: 'profile',
    description: 'View a player\'s tournament profile',
  })
  async profile(
    @SlashOption({
      name: 'user',
      description: 'The Discord user to view (defaults to yourself)',
      required: false,
      type: ApplicationCommandOptionType.User,
    })
    member: GuildMember | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    const targetId = member?.id ?? interaction.user.id;

    try {
      const [profileData, leaderboardData] = await Promise.all([
        getPlayer(targetId),
        getLeaderboard(),
      ]);

      const player = profileData.player;
      if (!player) {
        await interaction.editReply({ content: '❌ Player not found. Use `/link` to register first.' });
        return;
      }

      const leaderboardEntry = (leaderboardData.entries ?? []).find(
        (e: any) => e.discordId === targetId
      );

      const tierDisplay = formatTierDisplay(player.currentTier, player.currentRank, player.currentLP);
      const lpGain = leaderboardEntry ? formatLpGain(leaderboardEntry.lpGain) : 'N/A';

      const rankPos = leaderboardEntry ? `#${leaderboardEntry.rank}` : 'N/A';

      const embed = new EmbedBuilder()
        .setTitle(`${player.gameName}#${player.tagLine}`)
        .addFields(
          { name: 'Rank', value: tierDisplay, inline: true },
          { name: 'W/L', value: `${player.currentWins}W / ${player.currentLosses}L`, inline: true },
          { name: 'LP Gain (today)', value: lpGain, inline: true },
          { name: 'Leaderboard Position', value: rankPos, inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to fetch profile: ${err?.message ?? err}` });
    }
  }
}
