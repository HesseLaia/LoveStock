import 'dotenv/config';
import { Bot } from 'grammy';

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  console.error('Missing required environment variable: BOT_TOKEN');
  process.exit(1);
}

const bot = new Bot(botToken);

bot.command('start', async (ctx) => {
  await ctx.reply(
    '💹 *Welcome to LoveStock Exchange*\n\nFind out your real market value in the dating economy.\n8 questions. Ruthlessly scientific. Slightly unhinged.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📊 Get My Valuation',
              web_app: { url: 'https://prismatic-puppy-8167f6.netlify.app' }
            }
          ]
        ]
      }
    }
  );
});

bot.catch((error) => {
  console.error('Bot error:', error);
});

bot.start();
console.log('LoveStock Bot is running...');

