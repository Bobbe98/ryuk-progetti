import { Client, GatewayIntentBits, Partials, Events, MessageFlags, ActivityType } from 'discord.js';
import { config } from './config.js';
import { commands, buttons } from './registry.js';
import { aiAvailable, aiProvider, chat } from './ai.js';
import { getGuild, listReminders, removeReminder } from './storage.js';
import { renderWelcome, DEFAULT_WELCOME } from './commands/community.js';
import { errorEmbed, chunk, cooldown } from './util.js';

if (!config.token) {
  console.error('❌ Manca DISCORD_TOKEN nel file .env (copia .env.example in .env e compilalo)');
  process.exit(1);
}

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (config.messageContent) intents.push(GatewayIntentBits.MessageContent);
if (config.members) intents.push(GatewayIntentBits.GuildMembers);

const client = new Client({ intents, partials: [Partials.Channel] });

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Online come ${c.user.tag} su ${c.guilds.cache.size} server · AI: ${aiProvider()}`);
  c.user.setActivity('/aiuto', { type: ActivityType.Listening });
  setInterval(checkReminders, 15_000);
});

async function checkReminders() {
  const now = Date.now();
  for (const r of listReminders().filter((r) => r.at <= now)) {
    removeReminder(r.id);
    const ch = await client.channels.fetch(r.channelId).catch(() => null);
    await ch?.send({ content: `⏰ <@${r.userId}> promemoria: **${r.text}**`, allowedMentions: { users: [r.userId] } }).catch(() => null);
  }
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      const cmd = commands.get(i.commandName);
      if (cmd) await cmd.execute(i);
    } else if (i.isButton()) {
      const [prefix, action, id] = i.customId.split(':');
      if (buttons[prefix]) await buttons[prefix](i, action, id);
    }
  } catch (err) {
    console.error(`[${i.commandName ?? i.customId}]`, err);
    const hint = err.code === 50013 ? 'Mi mancano i permessi per farlo. Controlla che il ruolo del bot abbia i permessi giusti e stia abbastanza in alto.' : err.message;
    const payload = { embeds: [errorEmbed(hint)], flags: MessageFlags.Ephemeral };
    if (i.deferred || i.replied) await i.followUp(payload).catch(() => null);
    else if (i.isRepliable()) await i.reply(payload).catch(() => null);
  }
});

// Chat libera: menziona il bot o rispondi a un suo messaggio.
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !config.messageContent || !msg.guild) return;
  const mentioned = msg.mentions.users.has(client.user.id);
  const replyToMe = msg.reference && msg.mentions.repliedUser?.id === client.user.id;
  if (!mentioned && !replyToMe) return;
  const text = msg.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  if (!text) return msg.reply('Ciao! Scrivimi una domanda, oppure usa `/aiuto` per vedere i comandi.');
  if (!aiAvailable()) return msg.reply('L\'AI non è configurata: chiedi all\'admin di aggiungere una chiave gratuita Groq o Gemini. Intanto prova `/cerca`.');
  if (cooldown(`ai:${msg.author.id}`, 3)) return;
  try {
    await msg.channel.sendTyping();
    const answer = await chat(`ch:${msg.channelId}`, `${msg.member?.displayName ?? msg.author.username}: ${text}`);
    const parts = chunk(answer);
    await msg.reply({ content: parts[0], allowedMentions: { repliedUser: false, parse: [] } });
    for (const p of parts.slice(1)) await msg.channel.send({ content: p, allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('[chat]', err.message);
    await msg.reply('😵 Ho avuto un problema con l\'AI, riprova tra poco.').catch(() => null);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  const cfg = getGuild(member.guild.id);
  if (cfg.autoRole) await member.roles.add(cfg.autoRole, 'Autoruolo').catch((e) => console.warn('[autoruolo]', e.message));
  if (cfg.welcomeChannel) {
    const ch = await member.guild.channels.fetch(cfg.welcomeChannel).catch(() => null);
    await ch?.send({ content: renderWelcome(cfg.welcomeMessage ?? DEFAULT_WELCOME, member), allowedMentions: { users: [member.id] } }).catch(() => null);
  }
});

process.on('unhandledRejection', (e) => console.error('[unhandled]', e));

client.login(config.token).catch((e) => {
  if (/disallowed intents/i.test(e.message)) {
    console.error('❌ Intent non abilitati. Vai su https://discord.com/developers/applications → Bot → Privileged Gateway Intents\n   e attiva MESSAGE CONTENT e SERVER MEMBERS, oppure mettili a false nel .env.');
  } else console.error('❌ Login fallito:', e.message);
  process.exit(1);
});
