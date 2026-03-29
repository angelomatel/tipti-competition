import {
  EmbedBuilder,
  ApplicationCommandOptionType,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { lookupRiotAccount } from "@/lib/backendClient";
import { parseRiotId } from "@/lib/riotId";
import { formatTierDisplay } from "@/lib/format";
import { EMBED_COLORS, RANK_EMOJIS } from "@/lib/constants";
import { Tier } from "@/types/Rank";

@Discord()
export class GetUserByAccount {
  @Slash({
    name: "get-user-by-account",
    description:
      "Fetch a Riot summoner by inputting username#tag",
  })
  async getUser(
    @SlashOption({
      name: "account",
      description: "Username with discriminator, e.g. SummonerName#1234",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    account: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    const { gameName, tagLine, isValid } = parseRiotId(typeof account === "string" ? account : "");

    if (!isValid) {
      await interaction.editReply({
        content: "Invalid account format. Use `username#tag` (the #tag is required).",
      });
      return;
    }

    try {
      const info = await lookupRiotAccount(gameName, tagLine);

      const usernameDisplay = `${info.gameName}#${info.tagLine}`;
      const tierDisplay = formatTierDisplay(info.tier, info.rank);
      const tierEmoji = RANK_EMOJIS[info.tier as Tier] ?? '';

      const embed = new EmbedBuilder()
        .setTitle(usernameDisplay)
        .addFields(
          { name: "Rank", value: `${tierEmoji} ${tierDisplay}`, inline: true },
          { name: "LP", value: info.leaguePoints?.toString() ?? "0", inline: true },
        )
        .addFields(
          { name: "Wins", value: info.wins?.toString() ?? "0", inline: true },
          { name: "Losses", value: info.losses?.toString() ?? "0", inline: true },
        )
        .setColor(EMBED_COLORS.PRIMARY)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      const message = err?.message ?? String(err ?? "Unknown error");
      await interaction.editReply({
        content: `Failed to fetch account: ${message}`,
      });
    }
  }
}
