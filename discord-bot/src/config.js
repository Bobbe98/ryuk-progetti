import 'dotenv/config';

const flag = (v, def = true) => (v === undefined || v === '' ? def : v.toLowerCase() === 'true');

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  groqKey: process.env.GROQ_API_KEY || null,
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  geminiKey: process.env.GEMINI_API_KEY || null,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  messageContent: flag(process.env.ENABLE_MESSAGE_CONTENT),
  members: flag(process.env.ENABLE_MEMBERS),
  wikiLang: process.env.WIKI_LANG || 'it',
};
