import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { aiAvailable, chat, complete, resetChat } from '../ai.js';
import { searchAll, wikipedia } from '../search.js';
import { embed, errorEmbed, truncate, chunk, cooldown, COLORS } from '../util.js';
import { config } from '../config.js';

const noAI = 'L\'AI non è configurata. Aggiungi una chiave gratuita **GROQ_API_KEY** o **GEMINI_API_KEY** nel file `.env` (vedi README).';

async function sendLong(interaction, text) {
  const parts = chunk(text);
  await interaction.editReply(parts[0]);
  for (const p of parts.slice(1)) await interaction.followUp(p);
}

export const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('chiedi')
      .setDescription("Fai una domanda all'assistente AI (ricorda la conversazione nel canale)")
      .addStringOption((o) => o.setName('domanda').setDescription('Cosa vuoi sapere?').setRequired(true).setMaxLength(1500))
      .addBooleanOption((o) => o.setName('privato').setDescription('Risposta visibile solo a te')),
    async execute(i) {
      if (!aiAvailable()) return i.reply({ embeds: [errorEmbed(noAI)], flags: MessageFlags.Ephemeral });
      const wait = cooldown(`ai:${i.user.id}`, 3);
      if (wait) return i.reply({ content: `⏳ Aspetta ${wait}s`, flags: MessageFlags.Ephemeral });
      const priv = i.options.getBoolean('privato') ?? false;
      await i.deferReply(priv ? { flags: MessageFlags.Ephemeral } : {});
      const q = i.options.getString('domanda');
      const key = priv ? `dm:${i.user.id}` : `ch:${i.channelId}`;
      const answer = await chat(key, `${i.user.displayName} chiede: ${q}`);
      await sendLong(i, `> **${truncate(q, 200)}**\n\n${answer}`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('cerca')
      .setDescription('Cerca informazioni sul web (Wikipedia + DuckDuckGo), con riassunto AI')
      .addStringOption((o) => o.setName('cosa').setDescription('Cosa cercare').setRequired(true).setMaxLength(200))
      .addStringOption((o) =>
        o.setName('fonte').setDescription('Dove cercare').addChoices(
          { name: 'Tutte', value: 'tutte' },
          { name: 'Wikipedia italiana', value: 'it' },
          { name: 'Wikipedia inglese', value: 'en' },
        ),
      ),
    async execute(i) {
      await i.deferReply();
      const q = i.options.getString('cosa');
      const fonte = i.options.getString('fonte') ?? 'tutte';
      let results = fonte === 'tutte' ? await searchAll(q) : await wikipedia(q, 3, fonte).catch(() => []);
      if (!results.length && fonte === 'tutte') results = await wikipedia(q, 3, 'en').catch(() => []);
      if (!results.length) {
        if (!aiAvailable()) return i.editReply({ embeds: [errorEmbed(`Nessun risultato per **${q}**.`)] });
        const answer = await complete({ messages: [{ role: 'user', content: `Non ho trovato fonti web. Rispondi con ciò che sai (avvisando che non è verificato): ${q}` }] });
        return i.editReply({ embeds: [embed(`🔎 ${truncate(q, 200)}`, truncate(`⚠️ *Nessuna fonte trovata, risposta dalla conoscenza dell'AI:*\n\n${answer}`, 4000), COLORS.warn)] });
      }
      const e = embed(`🔎 ${truncate(q, 200)}`);
      if (aiAvailable()) {
        const ctx = results.slice(0, 5).map((r, n) => `[${n + 1}] ${r.title} (${r.source}): ${truncate(r.text, 900)}`).join('\n\n');
        const summary = await complete({
          messages: [{ role: 'user', content: `Domanda: "${q}"\n\nFonti:\n${ctx}\n\nScrivi un riassunto chiaro in italiano (max 900 caratteri) basato SOLO sulle fonti, citandole come [1], [2].` }],
        }).catch(() => null);
        if (summary) e.setDescription(truncate(summary, 4000));
      }
      if (!e.data.description) e.setDescription(truncate(results[0].text, 1500));
      e.addFields(results.slice(0, 5).map((r, n) => ({ name: truncate(`[${n + 1}] ${r.title}`, 256), value: truncate(`${truncate(r.text, 180)}\n🔗 ${r.url}`, 1024) })));
      const img = results.find((r) => r.image)?.image;
      if (img) e.setThumbnail(img);
      e.setFooter({ text: 'Fonti: ' + [...new Set(results.map((r) => r.source))].join(', ') });
      await i.editReply({ embeds: [e] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('traduci')
      .setDescription('Traduci un testo in un\'altra lingua')
      .addStringOption((o) => o.setName('testo').setDescription('Testo da tradurre').setRequired(true).setMaxLength(1800))
      .addStringOption((o) => o.setName('lingua').setDescription('Lingua di destinazione (es. inglese, giapponese)').setRequired(true)),
    async execute(i) {
      if (!aiAvailable()) return i.reply({ embeds: [errorEmbed(noAI)], flags: MessageFlags.Ephemeral });
      await i.deferReply();
      const lang = i.options.getString('lingua');
      const out = await complete({
        system: 'Sei un traduttore professionista. Restituisci solo la traduzione. Se la lingua usa un alfabeto non latino aggiungi sotto la pronuncia in caratteri latini.',
        messages: [{ role: 'user', content: `Traduci in ${lang}:\n${i.options.getString('testo')}` }],
      });
      await i.editReply({ embeds: [embed(`🌐 Traduzione → ${truncate(lang, 50)}`, truncate(out, 4000))] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('riassumi')
      .setDescription('Riassume gli ultimi messaggi del canale (utile se ti sei perso la discussione)')
      .addIntegerOption((o) => o.setName('messaggi').setDescription('Quanti messaggi (default 50)').setMinValue(5).setMaxValue(100)),
    async execute(i) {
      if (!aiAvailable()) return i.reply({ embeds: [errorEmbed(noAI)], flags: MessageFlags.Ephemeral });
      if (!config.messageContent) return i.reply({ embeds: [errorEmbed('Serve l\'intent **Message Content** (ENABLE_MESSAGE_CONTENT=true nel .env e nel portale sviluppatori).')], flags: MessageFlags.Ephemeral });
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const n = i.options.getInteger('messaggi') ?? 50;
      const msgs = await i.channel.messages.fetch({ limit: n });
      const log = [...msgs.values()].reverse().filter((m) => !m.author.bot && m.content).map((m) => `${m.member?.displayName ?? m.author.username}: ${truncate(m.content, 400)}`).join('\n');
      if (!log) return i.editReply('Non ci sono messaggi da riassumere.');
      const out = await complete({ messages: [{ role: 'user', content: `Riassumi questa conversazione Discord in punti chiave (chi ha detto cosa, decisioni, domande aperte):\n\n${truncate(log, 12000)}` }] });
      await i.editReply({ embeds: [embed(`📝 Riassunto degli ultimi ${n} messaggi`, truncate(out, 4000))] });
    },
  },
  {
    data: new SlashCommandBuilder().setName('ai-reset').setDescription("Fa dimenticare all'AI la conversazione di questo canale"),
    async execute(i) {
      resetChat(`ch:${i.channelId}`);
      resetChat(`dm:${i.user.id}`);
      await i.reply({ content: '🧹 Memoria della conversazione cancellata.', flags: MessageFlags.Ephemeral });
    },
  },
];
