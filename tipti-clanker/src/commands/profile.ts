import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  type GuildMember,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getPlayer, getLeaderboard } from '@/lib/backendClient';

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

      const tierDisplay = player.currentTier === 'UNRANKED'
        ? 'Unranked'
        : `${player.currentTier} ${player.currentRank} — ${player.currentLP} LP`;

      const lpGain = leaderboardEntry
        ? (leaderboardEntry.lpGain >= 0 ? `+${leaderboardEntry.lpGain}` : `${leaderboardEntry.lpGain}`)
        : 'N/A';

      const rankPos = leaderboardEntry ? `#${leaderboardEntry.rank}` : 'N/A';

      const embed = new EmbedBuilder()
        .setTitle(`${player.gameName}#${player.tagLine}`)
        .addFields(
          { name: 'Rank', value: tierDisplay, inline: true },
          { name: 'W/L', value: `${player.currentWins}W / ${player.currentLosses}L`, inline: true },
          { name: 'LP Gain (tournament)', value: lpGain, inline: true },
          { name: 'Leaderboard Position', value: rankPos, inline: true },
        )
        .setColor(0x7b2fff)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to fetch profile: ${err?.message ?? err}` });
    }
  }
}
