import { Discord, On, type ArgsOf, type Client } from "discordx";
import { logger } from "@/lib/logger";

@Discord()
export class Example {
  @On()
  messageDelete([message]: ArgsOf<"messageDelete">, client: Client): void {
    logger.debug({ username: client.user?.username, content: message.content }, "Message Deleted");
  }
}
