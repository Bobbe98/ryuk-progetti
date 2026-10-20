import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { commands } from './registry.js';

if (!config.token || !config.clientId) {
  console.error('❌ Mancano DISCORD_TOKEN e/o CLIENT_ID nel file .env');
  process.exit(1);
}

const body = [...commands.values()].map((c) => c.data.toJSON());
const rest = new REST().setToken(config.token);
const route = config.guildId ? Routes.applicationGuildCommands(config.clientId, config.guildId) : Routes.applicationCommands(config.clientId);

const res = await rest.put(route, { body });
console.log(`✅ Registrati ${res.length} comandi ${config.guildId ? `sul server ${config.guildId} (subito disponibili)` : 'globalmente (possono servire fino a 1 ora)'}`);
