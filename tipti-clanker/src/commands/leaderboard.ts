import { type CommandInteraction, EmbedBuilder } from 'discord.js';
import { Discord, Slash } from 'discordx';
import { getLeaderboard } from '@/lib/backendClient';

const MEDALS = ['🥇', '🥈', '🥉'];

const RANK_EMOJIS: Record<string, string> = {
  IRON: '<:iron:1457026116001988763>',
  BRONZE: '<:bronze:1457026206674194556>',
  SILVER: '<:silver:1457026070854373619>',
  GOLD: '<:gold:1457026180694933650>',
  PLATINUM: '<:platinum:1461948180471218267>',
  EMERALD: '<:emerald:1457026255894478890>',
  DIAMOND: '<:diamond:1457026145739346012>',
  MASTER: '<:master:1457026279210483743>',
  GRANDMASTER: '<:grandmaster:1457026329148002395>',
  CHALLENGER: '<:challenger:1457026304279974063>',
};

function formatTierName(tier: string): string {
  if (!tier) return '';
  const lower = tier.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

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

      const top = entries.slice(0, 10);
      const nameByDiscordId = new Map<string, string>();

      if (interaction.guild) {
        await Promise.all(
          top
            .filter((e: any) => typeof e.discordId === 'string' && e.discordId.length > 0)
            .map(async (e: any) => {
              try {
                const member = await interaction.guild!.members.fetch(e.discordId);
                nameByDiscordId.set(e.discordId, member.user.username);
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
        const tierName = e.currentTier === 'UNRANKED' ? 'Unranked' : formatTierName(e.currentTier);
        const tierEmoji = RANK_EMOJIS[e.currentTier as string] ?? '';
        const gain = e.lpGain >= 0 ? `+${e.lpGain}` : `${e.lpGain}`;

        const line1 = `${prefix} ${mention} (${displayName}) \`${riotId}\``;
        const line2 = `${tierEmoji} **${tierName}** ${e.currentLP} LP (\`${gain} LP\` today)`;

        return `${line1}\n${line2}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('Space Gods — eulbeulb bootcamp leaderboard')
        .setDescription(lines.join('\n\n'))
        .setColor(0x7b2fff)
        .setFooter({ text: `Updated ${new Date(data.updatedAt).toLocaleString()}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to fetch leaderboard: ${err?.message ?? err}` });
    }
  }
}
