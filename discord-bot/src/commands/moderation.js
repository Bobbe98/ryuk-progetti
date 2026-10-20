import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType, ChannelType } from 'discord.js';
import { embed, errorEmbed, parseDuration, COLORS } from '../util.js';

const guildOnly = (b, perm) => b.setDefaultMemberPermissions(perm).setContexts(InteractionContextType.Guild);
const reasonOpt = (o) => o.setName('motivo').setDescription('Motivo (finisce nel registro di controllo)').setMaxLength(400);
const fail = (i, msg) => i.reply({ embeds: [errorEmbed(msg)], flags: MessageFlags.Ephemeral });

async function target(i) {
  const user = i.options.getUser('utente');
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  return { user, member };
}

/** Impedisce di moderare chi ha un ruolo pari o superiore a quello di chi usa il comando. */
function outranks(i, member) {
  if (!member) return true;
  if (member.id === i.guild.ownerId) return false;
  return i.user.id === i.guild.ownerId || i.member.roles.highest.comparePositionTo(member.roles.highest) > 0;
}

export const commands = [
  {
    data: guildOnly(
      new SlashCommandBuilder()
        .setName('pulisci')
        .setDescription('Elimina gli ultimi messaggi del canale (max 100, più recenti di 14 giorni)')
        .addIntegerOption((o) => o.setName('quanti').setDescription('Numero di messaggi').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption((o) => o.setName('utente').setDescription('Solo i messaggi di questo utente')),
      PermissionFlagsBits.ManageMessages,
    ),
    async execute(i) {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const n = i.options.getInteger('quanti');
      const user = i.options.getUser('utente');
      let msgs = await i.channel.messages.fetch({ limit: 100 });
      if (user) msgs = msgs.filter((m) => m.author.id === user.id);
      const deleted = await i.channel.bulkDelete([...msgs.values()].slice(0, n), true);
      await i.editReply(`🧹 Eliminati **${deleted.size}** messaggi.${deleted.size < n ? ' (quelli più vecchi di 14 giorni Discord non li fa eliminare in blocco)' : ''}`);
    },
  },
  {
    data: guildOnly(
      new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Silenzia temporaneamente un utente')
        .addUserOption((o) => o.setName('utente').setDescription('Chi').setRequired(true))
        .addStringOption((o) => o.setName('durata').setDescription('Es. 10m, 2h, 1d (max 28 giorni). 0 = rimuovi').setRequired(true))
        .addStringOption(reasonOpt),
      PermissionFlagsBits.ModerateMembers,
    ),
    async execute(i) {
      const { user, member } = await target(i);
      if (!member) return fail(i, 'Utente non presente nel server.');
      if (!outranks(i, member) || !member.moderatable) return fail(i, 'Non posso silenziare questo utente (ruolo uguale o superiore al tuo o al mio).');
      const raw = i.options.getString('durata');
      const ms = raw.trim() === '0' ? 0 : parseDuration(raw);
      if (ms === null || ms > 28 * 864e5) return fail(i, 'Durata non valida. Esempi: `10m`, `1h30m`, `2d` (max 28 giorni).');
      const reason = i.options.getString('motivo') ?? undefined;
      await member.timeout(ms || null, reason);
      await i.reply({ embeds: [embed(ms ? '🔇 Timeout' : '🔊 Timeout rimosso', `${user}${ms ? ` fino a <t:${Math.floor((Date.now() + ms) / 1000)}:f>` : ''}${reason ? `\n**Motivo:** ${reason}` : ''}`, COLORS.warn)] });
    },
  },
  {
    data: guildOnly(
      new SlashCommandBuilder().setName('espelli').setDescription('Espelle (kick) un utente dal server')
        .addUserOption((o) => o.setName('utente').setDescription('Chi').setRequired(true)).addStringOption(reasonOpt),
      PermissionFlagsBits.KickMembers,
    ),
    async execute(i) {
      const { user, member } = await target(i);
      if (!member) return fail(i, 'Utente non presente nel server.');
      if (!outranks(i, member) || !member.kickable) return fail(i, 'Non posso espellere questo utente (ruolo troppo alto).');
      const reason = i.options.getString('motivo') ?? undefined;
      await member.kick(reason);
      await i.reply({ embeds: [embed('👢 Espulso', `${user.tag}${reason ? `\n**Motivo:** ${reason}` : ''}`, COLORS.warn)] });
    },
  },
  {
    data: guildOnly(
      new SlashCommandBuilder().setName('banna').setDescription('Banna un utente')
        .addUserOption((o) => o.setName('utente').setDescription('Chi').setRequired(true))
        .addIntegerOption((o) => o.setName('cancella-giorni').setDescription('Cancella i suoi messaggi degli ultimi N giorni (0-7)').setMinValue(0).setMaxValue(7))
        .addStringOption(reasonOpt),
      PermissionFlagsBits.BanMembers,
    ),
    async execute(i) {
      const { user, member } = await target(i);
      if (member && (!outranks(i, member) || !member.bannable)) return fail(i, 'Non posso bannare questo utente (ruolo troppo alto).');
      const reason = i.options.getString('motivo') ?? undefined;
      await i.guild.members.ban(user, { reason, deleteMessageSeconds: (i.options.getInteger('cancella-giorni') ?? 0) * 86400 });
      await i.reply({ embeds: [embed('🔨 Bannato', `${user.tag}${reason ? `\n**Motivo:** ${reason}` : ''}`, COLORS.err)] });
    },
  },
  {
    data: guildOnly(
      new SlashCommandBuilder().setName('blocca').setDescription('Blocca/sblocca la scrittura in questo canale per @everyone')
        .addBooleanOption((o) => o.setName('sblocca').setDescription('True per riaprire il canale')),
      PermissionFlagsBits.ManageChannels,
    ),
    async execute(i) {
      const unlock = i.options.getBoolean('sblocca') ?? false;
      if (i.channel.type !== ChannelType.GuildText) return fail(i, 'Funziona solo nei canali di testo.');
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: unlock ? null : false, SendMessagesInThreads: unlock ? null : false }, { reason: `Da ${i.user.tag}` });
      await i.reply({ embeds: [embed(unlock ? '🔓 Canale riaperto' : '🔒 Canale bloccato', unlock ? 'Tutti possono scrivere di nuovo.' : 'Solo lo staff può scrivere finché non viene riaperto.', unlock ? COLORS.ok : COLORS.warn)] });
    },
  },
  {
    data: guildOnly(
      new SlashCommandBuilder().setName('slowmode').setDescription('Imposta la modalità lenta del canale')
        .addIntegerOption((o) => o.setName('secondi').setDescription('0 per disattivare (max 21600)').setRequired(true).setMinValue(0).setMaxValue(21600)),
      PermissionFlagsBits.ManageChannels,
    ),
    async execute(i) {
      const s = i.options.getInteger('secondi');
      await i.channel.setRateLimitPerUser(s, `Da ${i.user.tag}`);
      await i.reply({ content: s ? `🐢 Modalità lenta: un messaggio ogni **${s}s**.` : '⚡ Modalità lenta disattivata.' });
    },
  },
];
