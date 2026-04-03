import 'dotenv/config';

import { dirname, importx } from '@discordx/importer';
import { IntentsBitField, type Interaction, type Message } from 'discord.js';
import { Client } from 'discordx';
import { startNotificationJobs } from '@/jobs/notificationJobs';
import { logger } from '@/lib/logger';

export const bot = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.MessageContent,
  ],
  silent: false,
  simpleCommand: {
    prefix: '!',
  },
});

bot.once('ready', async () => {
  await bot.initApplicationCommands();
  startNotificationJobs(bot);
  logger.info('Bot started');
});

bot.on('interactionCreate', (interaction: Interaction) => {
  bot.executeInteraction(interaction);
});

bot.on('messageCreate', (message: Message) => {
  void bot.executeCommand(message);
});

async function run() {
  await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`);

  if (!process.env.BOT_TOKEN) {
    throw Error('Could not find BOT_TOKEN in your environment');
  }

  await bot.login(process.env.BOT_TOKEN);
}

void run();
