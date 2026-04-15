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
import { logger } from "@/lib/logger";
import {
  getPublicErrorMessage,
  PUBLIC_ERROR_MESSAGES,
  sendCommandErrorAuditLog,
} from "@/lib/publicCommandErrors";

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
      const userMessage = '❌ Invalid account format. Use `username#tag` (the #tag is required).';
      await interaction.editReply({ content: userMessage });
      await sendCommandErrorAuditLog(interaction.client, {
        commandName: '/get-user-by-account',
        actorId: interaction.user.id,
        target: account,
        userMessage,
      });
      return;
    }

    try {
      const info = await lookupRiotAccount(gameName, tagLine);
      logger.info(
        {
          requesterId: interaction.user.id,
          riotId: `${info.gameName ?? gameName}#${info.tagLine ?? tagLine}`,
        },
        "[get-user-by-account] Fetched Riot account",
      );

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
      const userMessage = getPublicErrorMessage(err, {
        notFoundMessage: PUBLIC_ERROR_MESSAGES.riotAccountNotFound,
        fallbackPrefix: '❌ Failed to fetch account',
      });
      await interaction.editReply({ content: userMessage });
      await sendCommandErrorAuditLog(interaction.client, {
        commandName: '/get-user-by-account',
        actorId: interaction.user.id,
        target: `${gameName}#${tagLine}`,
        userMessage,
        error: err,
      });
    }
  }
}
