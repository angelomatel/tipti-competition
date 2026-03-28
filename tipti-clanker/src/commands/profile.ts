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
        await interaction.editReply({ content: '❌ Player not found. Use `/register` to join first.' });
        return;
      }

      const leaderboardEntry = (leaderboardData.entries ?? []).find(
        (e: any) => e.discordId === targetId
      );

      const tierDisplay = formatTierDisplay(player.currentTier, player.currentRank, player.currentLP);
      const lpGain = leaderboardEntry ? formatLpGain(leaderboardEntry.lpGain) : 'N/A';
      const rankPos = leaderboardEntry ? `#${leaderboardEntry.rank}` : 'N/A';
      const scorePoints = profileData.scorePoints ?? 0;
      const godName = profileData.godName ?? 'None';
      const godTitle = profileData.godTitle ?? '';

      const fields = [
        { name: 'Rank', value: tierDisplay, inline: true },
        { name: 'W/L', value: `${player.currentWins}W / ${player.currentLosses}L`, inline: true },
        { name: 'LP Gain (today)', value: lpGain, inline: true },
        { name: 'Leaderboard', value: rankPos, inline: true },
        { name: 'Score Points', value: `${scorePoints}`, inline: true },
        { name: 'God', value: godTitle ? `${godName} — ${godTitle}` : godName, inline: true },
      ];

      // Add point breakdown if available
      const breakdown = profileData.pointBreakdown;
      if (breakdown) {
        const parts: string[] = [];
        if (breakdown.match) parts.push(`Match: ${breakdown.match}`);
        if (breakdown.buff) parts.push(`Buff: +${breakdown.buff}`);
        if (breakdown.penalty) parts.push(`Penalty: ${breakdown.penalty}`);
        if (breakdown.godPlacementBonus) parts.push(`God Bonus: +${breakdown.godPlacementBonus}`);
        if (parts.length > 0) {
          fields.push({ name: 'Point Breakdown', value: parts.join(' | '), inline: false });
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`${player.gameName}#${player.tagLine}`)
        .addFields(fields)
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to fetch profile: ${err?.message ?? err}` });
    }
  }
}
