import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType, ChannelType, EmbedBuilder } from 'discord.js';
import { getGuild, setGuild, addReminder } from '../storage.js';
import { embed, errorEmbed, parseDuration, COLORS } from '../util.js';
import { aiAvailable, aiProvider } from '../ai.js';
import { config } from '../config.js';

export const DEFAULT_WELCOME = 'Benvenuto/a {utente} in **{server}**! Sei il membro numero {membri} 🎉';

export function renderWelcome(tpl, member) {
  return tpl.replaceAll('{utente}', `${member}`).replaceAll('{nome}', member.displayName).replaceAll('{server}', member.guild.name).replaceAll('{membri}', `${member.guild.memberCount}`);
}

const HELP = [
  ['🤖 AI e ricerca', [
    '`/chiedi` — domanda all\'assistente (ricorda la chat del canale)',
    '`/cerca` — cerca sul web con riassunto e fonti',
    '`/traduci` — traduzioni in qualsiasi lingua',
    '`/riassumi` — riassunto degli ultimi messaggi',
    '`/ai-reset` — cancella la memoria della chat',
    'Oppure **menzionami** in un messaggio per parlare con me',
  ]],
  ['🏗️ Creare e sistemare il server', [
    '`/setup` — struttura completa da template (community, gaming, studio, progetti, D&D)',
    '`/progetta-server` — l\'AI progetta canali e ruoli su misura',
    '`/analizza-server` — controllo sicurezza/ordine con correzione automatica',
    '`/crea-canale` · `/crea-ruolo` · `/info-server`',
  ]],
  ['🛡️ Moderazione', ['`/pulisci` · `/timeout` · `/espelli` · `/banna` · `/blocca` · `/slowmode`']],
  ['🎉 Community', ['`/benvenuto` — messaggio ai nuovi membri', '`/autoruolo` — ruolo dato a chi entra', '`/sondaggio` · `/promemoria` · `/utente`']],
];

export const commands = [
  {
    data: new SlashCommandBuilder().setName('aiuto').setDescription('Mostra cosa so fare'),
    async execute(i) {
      const e = new EmbedBuilder().setTitle('👋 Ciao, sono il tuo Aiutante').setColor(COLORS.main)
        .setDescription(`AI: **${aiAvailable() ? aiProvider() : 'non configurata (ricerca e gestione server funzionano lo stesso)'}**`);
      for (const [name, lines] of HELP) e.addFields({ name, value: lines.join('\n') });
      await i.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('benvenuto')
      .setDescription('Configura il messaggio di benvenuto')
      .addSubcommand((s) =>
        s.setName('imposta').setDescription('Attiva il benvenuto in un canale')
          .addChannelOption((o) => o.setName('canale').setDescription('Dove scrivere').setRequired(true).addChannelTypes(ChannelType.GuildText))
          .addStringOption((o) => o.setName('messaggio').setDescription('Variabili: {utente} {nome} {server} {membri}').setMaxLength(1500)),
      )
      .addSubcommand((s) => s.setName('disattiva').setDescription('Disattiva il benvenuto'))
      .addSubcommand((s) => s.setName('prova').setDescription('Mostra un\'anteprima con te come nuovo membro'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      const sub = i.options.getSubcommand();
      if (sub === 'imposta') {
        const ch = i.options.getChannel('canale');
        setGuild(i.guildId, { welcomeChannel: ch.id, welcomeMessage: i.options.getString('messaggio') ?? DEFAULT_WELCOME });
        const warn = config.members ? '' : '\n⚠️ Attiva **ENABLE_MEMBERS** e l\'intent *Server Members* perché funzioni.';
        return i.reply({ embeds: [embed('👋 Benvenuto attivato', `I nuovi membri verranno salutati in ${ch}.${warn}`, COLORS.ok)], flags: MessageFlags.Ephemeral });
      }
      if (sub === 'disattiva') {
        setGuild(i.guildId, { welcomeChannel: null });
        return i.reply({ content: 'Benvenuto disattivato.', flags: MessageFlags.Ephemeral });
      }
      const cfg = getGuild(i.guildId);
      await i.reply({ content: renderWelcome(cfg.welcomeMessage ?? DEFAULT_WELCOME, i.member), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('autoruolo')
      .setDescription('Ruolo assegnato automaticamente a chi entra (vuoto = disattiva)')
      .addRoleOption((o) => o.setName('ruolo').setDescription('Ruolo da dare'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      const role = i.options.getRole('ruolo');
      if (role && (role.managed || role.position >= i.guild.members.me.roles.highest.position)) {
        return i.reply({ embeds: [errorEmbed(`Non posso assegnare ${role}: deve stare **sotto** il ruolo del bot e non essere gestito da un'integrazione.`)], flags: MessageFlags.Ephemeral });
      }
      setGuild(i.guildId, { autoRole: role?.id ?? null });
      await i.reply({ content: role ? `✅ Chi entra riceverà ${role}.` : 'Autoruolo disattivato.', flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('sondaggio')
      .setDescription('Crea un sondaggio nativo di Discord')
      .addStringOption((o) => o.setName('domanda').setDescription('La domanda').setRequired(true).setMaxLength(300))
      .addStringOption((o) => o.setName('opzioni').setDescription('Opzioni separate da | (es. Pizza | Sushi | Kebab)').setRequired(true))
      .addIntegerOption((o) => o.setName('ore').setDescription('Durata in ore (default 24)').setMinValue(1).setMaxValue(768))
      .addBooleanOption((o) => o.setName('multipla').setDescription('Permetti più risposte'))
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      const answers = i.options.getString('opzioni').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 10);
      if (answers.length < 2) return i.reply({ embeds: [errorEmbed('Servono almeno 2 opzioni separate da `|`.')], flags: MessageFlags.Ephemeral });
      await i.reply({
        poll: {
          question: { text: i.options.getString('domanda') },
          answers: answers.map((text) => ({ text: text.slice(0, 55) })),
          duration: i.options.getInteger('ore') ?? 24,
          allowMultiselect: i.options.getBoolean('multipla') ?? false,
        },
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('promemoria')
      .setDescription('Ti ricordo qualcosa più tardi in questo canale')
      .addStringOption((o) => o.setName('tra').setDescription('Es. 10m, 2h, 1d, 1h30m').setRequired(true))
      .addStringOption((o) => o.setName('cosa').setDescription('Cosa ricordarti').setRequired(true).setMaxLength(500)),
    async execute(i) {
      const ms = parseDuration(i.options.getString('tra'));
      if (!ms || ms < 1e4 || ms > 365 * 864e5) return i.reply({ embeds: [errorEmbed('Tempo non valido. Esempi: `10m`, `2h`, `3d` (max 1 anno).')], flags: MessageFlags.Ephemeral });
      const at = Date.now() + ms;
      addReminder({ id: `${i.id}`, userId: i.user.id, channelId: i.channelId, text: i.options.getString('cosa'), at });
      await i.reply({ content: `⏰ Ok! Te lo ricordo <t:${Math.floor(at / 1000)}:R>.`, flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('utente')
      .setDescription('Informazioni su un utente')
      .addUserOption((o) => o.setName('chi').setDescription('Utente (default: tu)'))
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      const user = i.options.getUser('chi') ?? i.user;
      const m = await i.guild.members.fetch(user.id).catch(() => null);
      const e = new EmbedBuilder().setTitle(m?.displayName ?? user.username).setColor(m?.displayColor || COLORS.main).setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields({ name: 'Account creato', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true });
      if (m) {
        e.addFields(
          { name: 'Entrato nel server', value: `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: 'Ruoli', value: m.roles.cache.filter((r) => r.id !== i.guildId).sort((a, b) => b.position - a.position).map((r) => `${r}`).slice(0, 20).join(' ') || '—' },
        );
      }
      await i.reply({ embeds: [e] });
    },
  },
];
