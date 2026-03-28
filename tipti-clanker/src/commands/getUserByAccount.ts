import {
  EmbedBuilder,
  ApplicationCommandOptionType,
  type CommandInteraction,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { lookupRiotAccount } from "@/lib/backendClient";

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

    const parsed = typeof account === "string" ? account.trim() : "";
    const parts = parsed.split("#");
    const username = parts[0];
    const tag = parts[1];

    if (!username || !tag) {
      await interaction.editReply({
        content:
          "Invalid account format. Use `username#tag` (the #tag is required).",
      });
      return;
    }

    try {
      const info = await lookupRiotAccount(username, tag);

      const usernameDisplay = `${info.gameName}#${info.tagLine}`;
      const tierDisplay = info.tier === 'UNRANKED'
        ? 'Unranked'
        : `${info.tier} ${info.rank}`;

      const embed = new EmbedBuilder()
        .setTitle(usernameDisplay)
        .addFields(
          { name: "Rank", value: tierDisplay, inline: true },
          { name: "LP", value: info.leaguePoints?.toString() ?? "0", inline: true },
        )
        .addFields(
          { name: "Wins", value: info.wins?.toString() ?? "0", inline: true },
          { name: "Losses", value: info.losses?.toString() ?? "0", inline: true },
        )
        .addFields(
          { name: "Fresh Blood", value: info.freshBlood ? "Yes" : "No", inline: true },
          { name: "Hot Streak", value: info.hotStreak ? "Yes" : "No", inline: true },
        )
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
