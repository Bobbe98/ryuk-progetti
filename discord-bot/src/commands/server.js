import {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType, InteractionContextType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} from 'discord.js';
import { TEMPLATES } from '../templates.js';
import { normalizePlan, planEmbed, applyPlan, reportEmbed, storePending, takePending, peekPending, planStats } from '../plan.js';
import { auditGuild, autoFix } from '../audit.js';
import { aiAvailable, completeJSON, complete } from '../ai.js';
import { embed, errorEmbed, truncate, COLORS } from '../util.js';

const confirmRow = (prefix, id, label = 'Crea tutto') =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}:ok:${id}`).setLabel(label).setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`${prefix}:no:${id}`).setLabel('Annulla').setStyle(ButtonStyle.Secondary),
  );

/** Descrizione compatta della struttura attuale, da dare all'AI come contesto. */
function describeGuild(guild) {
  const cats = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
  const lines = cats.map((cat) => `${cat.name}: ${guild.channels.cache.filter((c) => c.parentId === cat.id).map((c) => c.name).join(', ')}`);
  const orphans = guild.channels.cache.filter((c) => !c.parentId && c.type !== ChannelType.GuildCategory && !c.isThread());
  if (orphans.size) lines.push(`(senza categoria): ${orphans.map((c) => c.name).join(', ')}`);
  const roles = guild.roles.cache.filter((r) => r.id !== guild.id && !r.managed).map((r) => r.name);
  return `Server "${guild.name}", ${guild.memberCount} membri.\nRuoli: ${roles.join(', ') || 'nessuno'}\nCanali:\n${lines.join('\n') || 'nessuno'}`;
}

const PLAN_PROMPT = `Sei un esperto di progettazione di server Discord. Restituisci SOLO un oggetto JSON con questo schema:
{"summary": "breve spiegazione in italiano delle scelte",
 "roles": [{"name": "string", "color": "#rrggbb", "hoist": true|false, "permissions": ["ManageMessages", ...]}],
 "categories": [{"name": "string con emoji", "private": true|false, "allowRoles": ["nomi ruoli che vedono la categoria privata"],
   "channels": [{"name": "nome-canale", "type": "text|voice|announcement|forum|stage", "topic": "descrizione breve"}]}]}
Permessi ammessi: ManageMessages, ManageThreads, ManageNicknames, ModerateMembers, KickMembers, BanMembers, ManageChannels,
ManageRoles, ManageEvents, MuteMembers, DeafenMembers, MoveMembers, MentionEveryone, ViewAuditLog, PrioritySpeaker.
Mai Administrator. Massimo 12 ruoli, 10 categorie, 50 canali in totale. Nomi canali testuali in minuscolo con trattini.
Non ripetere canali o ruoli che il server ha già, a meno che l'utente chieda di rifare tutto.`;

export const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Crea una struttura completa (ruoli + categorie + canali) da un template')
      .addStringOption((o) =>
        o.setName('template').setDescription('Tipo di server').setRequired(true)
          .addChoices(...Object.entries(TEMPLATES).map(([value, t]) => ({ name: t.label, value }))),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      const t = TEMPLATES[i.options.getString('template')];
      const plan = normalizePlan(t.plan);
      const id = storePending({ plan, userId: i.user.id, guildId: i.guildId, label: t.label });
      await i.reply({ embeds: [planEmbed(plan, `Anteprima: ${t.label}`, 'Controlla e premi **Crea tutto** per applicare.')], components: [confirmRow('plan', id)], flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('progetta-server')
      .setDescription("L'AI progetta ruoli e canali su misura: descrivi cosa ti serve")
      .addStringOption((o) => o.setName('richiesta').setDescription('Es. "server per un clan di Minecraft con zona eventi e staff"').setRequired(true).setMaxLength(1000))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      if (!aiAvailable()) return i.reply({ embeds: [errorEmbed('Serve una chiave AI gratuita (GROQ_API_KEY o GEMINI_API_KEY). Intanto puoi usare `/setup` con i template.')], flags: MessageFlags.Ephemeral });
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      await i.guild.channels.fetch();
      const raw = await completeJSON({
        system: PLAN_PROMPT,
        messages: [{ role: 'user', content: `Struttura attuale:\n${describeGuild(i.guild)}\n\nRichiesta: ${i.options.getString('richiesta')}` }],
      });
      const plan = normalizePlan(raw);
      const s = planStats(plan);
      if (!s.roles && !s.channels) return i.editReply({ embeds: [errorEmbed("L'AI non ha proposto nulla da creare. Prova a descrivere meglio la richiesta.")] });
      const id = storePending({ plan, userId: i.user.id, guildId: i.guildId });
      await i.editReply({ embeds: [planEmbed(plan, '🤖 Progetto AI', truncate(raw.summary ?? '', 1500))], components: [confirmRow('plan', id)] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('analizza-server')
      .setDescription('Controlla sicurezza e organizzazione del server e propone correzioni')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const { score, issues, stats } = await auditGuild(i.guild);
      const icon = { alto: '🔴', medio: '🟠', basso: '🟡' };
      const color = score >= 80 ? COLORS.ok : score >= 50 ? COLORS.warn : COLORS.err;
      const e = new EmbedBuilder()
        .setTitle(`🩺 Salute del server: ${score}/100`)
        .setColor(color)
        .setDescription(truncate(issues.length ? issues.map((x) => `${icon[x.level]} ${x.text}${x.fix ? ' *(correggibile)*' : ''}`).join('\n\n') : '✨ Nessun problema trovato, ottimo lavoro!', 4000))
        .addFields({ name: '📊 Numeri', value: `👥 ${stats.members} membri · 🎭 ${stats.roles} ruoli · 📁 ${stats.categories} categorie · 💬 ${stats.text} testo · 🔊 ${stats.voice} vocali` });
      if (aiAvailable() && issues.length) {
        const tips = await complete({
          messages: [{ role: 'user', content: `${describeGuild(i.guild)}\n\nProblemi rilevati:\n${issues.map((x) => '- ' + x.text).join('\n')}\n\nDai 3-5 consigli concreti e brevi (max 700 caratteri) per migliorare questo server.` }],
        }).catch(() => null);
        if (tips) e.addFields({ name: '🤖 Consigli AI', value: truncate(tips, 1024) });
      }
      const fixes = [...new Set(issues.filter((x) => x.fix).map((x) => x.fix))];
      const components = [];
      if (fixes.length) {
        const id = storePending({ fixes, userId: i.user.id, guildId: i.guildId });
        components.push(confirmRow('audit', id, `Correggi ${fixes.length} problemi`));
      }
      await i.editReply({ embeds: [e], components });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('crea-canale')
      .setDescription('Crea un canale (anche privato) in una categoria')
      .addStringOption((o) => o.setName('nome').setDescription('Nome del canale').setRequired(true).setMaxLength(100))
      .addStringOption((o) =>
        o.setName('tipo').setDescription('Tipo di canale').addChoices(
          { name: '💬 Testo', value: 'text' }, { name: '🔊 Vocale', value: 'voice' }, { name: '🗂️ Forum', value: 'forum' },
          { name: '📢 Annunci', value: 'announcement' }, { name: '📁 Categoria', value: 'category' },
        ),
      )
      .addChannelOption((o) => o.setName('categoria').setDescription('Dentro quale categoria').addChannelTypes(ChannelType.GuildCategory))
      .addStringOption((o) => o.setName('argomento').setDescription('Descrizione del canale').setMaxLength(1024))
      .addRoleOption((o) => o.setName('privato-per').setDescription('Rendi il canale visibile SOLO a questo ruolo'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      const types = { text: ChannelType.GuildText, voice: ChannelType.GuildVoice, forum: ChannelType.GuildForum, announcement: ChannelType.GuildAnnouncement, category: ChannelType.GuildCategory };
      const tipo = i.options.getString('tipo') ?? 'text';
      const role = i.options.getRole('privato-per');
      const topic = i.options.getString('argomento');
      const ch = await i.guild.channels.create({
        name: i.options.getString('nome'),
        type: types[tipo],
        parent: tipo === 'category' ? null : i.options.getChannel('categoria')?.id,
        ...(topic && ['text', 'forum', 'announcement'].includes(tipo) ? { topic } : {}),
        permissionOverwrites: role
          ? [
              { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: role.id, allow: [PermissionFlagsBits.ViewChannel] },
              { id: i.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
            ]
          : undefined,
        reason: `Creato da ${i.user.tag}`,
      });
      await i.reply({ embeds: [embed('✅ Creato', `${ch}${role ? ` (privato per ${role})` : ''}`, COLORS.ok)], flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('crea-ruolo')
      .setDescription('Crea un ruolo con colore e permessi base')
      .addStringOption((o) => o.setName('nome').setDescription('Nome del ruolo').setRequired(true).setMaxLength(100))
      .addStringOption((o) => o.setName('colore').setDescription('Colore esadecimale, es. #ff8800'))
      .addStringOption((o) =>
        o.setName('livello').setDescription('Permessi da assegnare').addChoices(
          { name: 'Membro (nessun permesso extra)', value: 'membro' },
          { name: 'Helper (gestisce thread e soprannomi)', value: 'helper' },
          { name: 'Moderatore', value: 'mod' },
        ),
      )
      .addBooleanOption((o) => o.setName('separato').setDescription('Mostra i membri separatamente nella lista'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .setContexts(InteractionContextType.Guild),
    async execute(i) {
      const presets = {
        membro: [],
        helper: [PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ManageNicknames],
        mod: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers],
      };
      const hex = i.options.getString('colore');
      if (hex && !/^#?[0-9a-f]{6}$/i.test(hex)) return i.reply({ embeds: [errorEmbed('Colore non valido: usa il formato `#ff8800`.')], flags: MessageFlags.Ephemeral });
      const role = await i.guild.roles.create({
        name: i.options.getString('nome'),
        colors: { primaryColor: hex ? parseInt(hex.replace('#', ''), 16) : 0 },
        hoist: i.options.getBoolean('separato') ?? false,
        permissions: presets[i.options.getString('livello') ?? 'membro'],
        reason: `Creato da ${i.user.tag}`,
      });
      await i.reply({ embeds: [embed('✅ Ruolo creato', `${role}`, COLORS.ok)], flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: new SlashCommandBuilder().setName('info-server').setDescription('Informazioni sul server').setContexts(InteractionContextType.Guild),
    async execute(i) {
      const g = i.guild;
      await g.channels.fetch();
      const owner = await g.fetchOwner().catch(() => null);
      const e = new EmbedBuilder()
        .setTitle(g.name)
        .setColor(COLORS.main)
        .setThumbnail(g.iconURL({ size: 256 }))
        .addFields(
          { name: '👑 Proprietario', value: owner ? `${owner}` : '—', inline: true },
          { name: '👥 Membri', value: `${g.memberCount}`, inline: true },
          { name: '📅 Creato', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '💬 Canali', value: `${g.channels.cache.filter((c) => !c.isThread()).size}`, inline: true },
          { name: '🎭 Ruoli', value: `${g.roles.cache.size - 1}`, inline: true },
          { name: '🚀 Boost', value: `Livello ${g.premiumTier} (${g.premiumSubscriptionCount ?? 0})`, inline: true },
        );
      await i.reply({ embeds: [e] });
    },
  },
];

export const buttons = {
  async plan(i, action, id) {
    const p = peekPending(id);
    if (!p) return i.update({ content: '⌛ Anteprima scaduta, rilancia il comando.', embeds: [], components: [] });
    if (p.userId !== i.user.id) return i.reply({ content: 'Solo chi ha lanciato il comando può confermare.', flags: MessageFlags.Ephemeral });
    takePending(id);
    if (action === 'no') return i.update({ content: 'Annullato.', embeds: [], components: [] });
    await i.update({ content: '⚙️ Sto creando tutto, un attimo…', components: [] });
    const report = await applyPlan(i.guild, p.plan, `Setup richiesto da ${i.user.tag}`);
    await i.editReply({ content: '', embeds: [reportEmbed(report)] });
  },
  async audit(i, action, id) {
    const p = peekPending(id);
    if (!p) return i.update({ content: '⌛ Analisi scaduta, rilancia /analizza-server.', components: [] });
    if (p.userId !== i.user.id) return i.reply({ content: 'Solo chi ha lanciato il comando può confermare.', flags: MessageFlags.Ephemeral });
    takePending(id);
    if (action === 'no') return i.update({ components: [] });
    if (!i.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return i.reply({ content: 'Ti serve il permesso Gestisci server.', flags: MessageFlags.Ephemeral });
    await i.update({ components: [] });
    const done = await autoFix(i.guild, p.fixes).catch((e) => [`⚠️ Interrotto: ${e.message} (il ruolo del bot ha i permessi necessari?)`]);
    await i.followUp({ embeds: [embed('🔧 Correzioni applicate', done.map((d) => `• ${d}`).join('\n'), COLORS.ok)], flags: MessageFlags.Ephemeral });
  },
};
