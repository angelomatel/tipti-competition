import { type CommandInteraction, EmbedBuilder } from 'discord.js';
import { Discord, Slash } from 'discordx';
import { getLeaderboard, getTournamentSettings, updatePlayerProfile } from '@/lib/backendClient';
import { formatTierName, formatLpGain } from '@/lib/format';
import { EMBED_COLORS, LEADERBOARD_TOP_N, RANK_EMOJIS } from '@/lib/constants';
import { Tier } from '@/types/Rank';

const MEDALS = ['🥇', '🥈', '🥉'];

@Discord()
export class Leaderboard {
  @Slash({
    name: 'leaderboard',
    description: 'Show the current Space Gods bootcamp leaderboard',
  })
  async leaderboard(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const data = await getLeaderboard();
      const entries: any[] = data.entries ?? [];

      if (entries.length === 0) {
        await interaction.editReply({ content: 'No players registered yet.' });
        return;
      }

      const top = entries.slice(0, LEADERBOARD_TOP_N);
      const nameByDiscordId = new Map<string, string>();

      if (interaction.guild) {
        await Promise.all(
          top
            .filter((e: any) => typeof e.discordId === 'string' && e.discordId.length > 0)
            .map(async (e: any) => {
              try {
                const member = await interaction.guild!.members.fetch(e.discordId);
                nameByDiscordId.set(e.discordId, member.user.username);

                // Refresh avatar URL if it has changed
                const currentAvatar = member.user.displayAvatarURL({ size: 128 });
                if (currentAvatar !== e.discordAvatarUrl) {
                  updatePlayerProfile(e.discordId, { discordAvatarUrl: currentAvatar }).catch(() => {});
                }
              } catch {
                // ignore lookup failures (not in guild, missing intents, etc.)
              }
            })
        );
      }

      const lines = top.map((e: any) => {
        const prefix = MEDALS[e.rank - 1] ?? `#${e.rank}`;
        const mention = e.discordId ? `<@${e.discordId}>` : e.gameName;
        const displayName = (e.discordId && nameByDiscordId.get(e.discordId)) || e.gameName;

        const riotId = `${e.gameName}#${e.tagLine}`;
        const tierName = formatTierName(e.currentTier === 'UNRANKED' ? '' : e.currentTier) || 'Unranked';
        const tierEmoji = RANK_EMOJIS[e.currentTier as Tier] ?? '';
        const gain = formatLpGain(e.lpGain);
        const godTag = e.godName ? ` [${e.godName}]` : '';

        const line1 = `${prefix} ${mention} (${displayName}) \`${riotId}\`${godTag}`;
        const line2 = `${tierEmoji} **${tierName}** ${e.currentLP} LP | **${e.scorePoints ?? 0}** pts (\`${gain} LP\` today)`;

        return `${line1}\n${line2}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('Space Gods — eulbeulb bootcamp leaderboard')
        .setDescription(lines.join('\n\n'))
        .setColor(EMBED_COLORS.PRIMARY)
        .setFooter({ text: `Updated ${new Date(data.updatedAt).toLocaleString()}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to fetch leaderboard: ${err?.message ?? err}` });
    }
  }
}
