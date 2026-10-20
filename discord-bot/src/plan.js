import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { COLORS, truncate } from './util.js';

/*
 * Un "piano" descrive cosa creare in un server. È lo stesso formato sia per i template
 * sia per i piani generati dall'AI:
 * {
 *   roles: [{ name, color: "#hex", hoist: bool, permissions: ["ManageMessages", ...] }],
 *   categories: [{ name, private: bool, allowRoles: ["Staff"], channels: [{ name, type, topic }] }]
 * }
 * type: text | voice | announcement | forum | stage
 */

const TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  stage: ChannelType.GuildStageVoice,
};
const ICON = { text: '💬', voice: '🔊', announcement: '📢', forum: '🗂️', stage: '🎤' };

// Permessi che è sensato assegnare a un ruolo creato automaticamente. Administrator escluso di proposito.
const ALLOWED_PERMS = [
  'ManageMessages', 'ManageThreads', 'ManageNicknames', 'ModerateMembers', 'KickMembers', 'BanMembers',
  'ManageChannels', 'ManageRoles', 'ManageEvents', 'MuteMembers', 'DeafenMembers', 'MoveMembers',
  'MentionEveryone', 'ViewAuditLog', 'PrioritySpeaker', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis',
];

const LIMITS = { roles: 15, categories: 12, channelsPerCategory: 12, channels: 60 };

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Valida e ripulisce un piano (soprattutto quelli scritti dall'AI). */
export function normalizePlan(raw) {
  const plan = { roles: [], categories: [] };
  let total = 0;
  for (const r of (Array.isArray(raw?.roles) ? raw.roles : []).slice(0, LIMITS.roles)) {
    const name = str(r?.name, 100);
    if (!name || name === '@everyone') continue;
    const color = /^#?[0-9a-f]{6}$/i.test(r?.color ?? '') ? parseInt(r.color.replace('#', ''), 16) : 0;
    const permissions = (Array.isArray(r?.permissions) ? r.permissions : []).filter((p) => ALLOWED_PERMS.includes(p));
    plan.roles.push({ name, color, hoist: Boolean(r?.hoist), permissions });
  }
  for (const c of (Array.isArray(raw?.categories) ? raw.categories : []).slice(0, LIMITS.categories)) {
    const name = str(c?.name, 100);
    if (!name) continue;
    const channels = [];
    for (const ch of (Array.isArray(c?.channels) ? c.channels : []).slice(0, LIMITS.channelsPerCategory)) {
      const chName = str(ch?.name, 100);
      if (!chName || total >= LIMITS.channels) continue;
      const type = TYPES[ch?.type] !== undefined ? ch.type : 'text';
      channels.push({ name: chName, type, topic: str(ch?.topic, 1024) });
      total++;
    }
    const allowRoles = (Array.isArray(c?.allowRoles) ? c.allowRoles : []).map((x) => str(x, 100)).filter(Boolean);
    plan.categories.push({ name, private: Boolean(c?.private), allowRoles, channels });
  }
  return plan;
}

export function planStats(plan) {
  return {
    roles: plan.roles.length,
    categories: plan.categories.length,
    channels: plan.categories.reduce((n, c) => n + c.channels.length, 0),
  };
}

export function planEmbed(plan, title, description) {
  const s = planStats(plan);
  const e = new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.main)
    .setDescription(truncate(`${description ? description + '\n\n' : ''}**${s.roles}** ruoli · **${s.categories}** categorie · **${s.channels}** canali\nI canali/ruoli che esistono già con lo stesso nome vengono saltati.`, 4000));
  if (plan.roles.length) {
    e.addFields({ name: '🎭 Ruoli', value: truncate(plan.roles.map((r) => `• ${r.name}${r.permissions.length ? ` *(${r.permissions.join(', ')})*` : ''}`).join('\n'), 1024) });
  }
  for (const c of plan.categories.slice(0, 20)) {
    const head = c.private ? `🔒 ${c.name}${c.allowRoles.length ? ` → ${c.allowRoles.join(', ')}` : ''}` : `📁 ${c.name}`;
    e.addFields({ name: truncate(head, 256), value: truncate(c.channels.map((ch) => `${ICON[ch.type]} ${ch.name}`).join('\n') || '*(vuota)*', 1024), inline: true });
  }
  return e;
}

const norm = (s) => s.toLowerCase().replace(/\s+/g, '-');

/** Applica il piano al server. Ritorna un resoconto. Idempotente: non duplica ciò che esiste già. */
export async function applyPlan(guild, plan, reason = 'Setup automatico') {
  const report = { created: [], skipped: [], errors: [] };
  const roleByName = new Map(guild.roles.cache.map((r) => [r.name.toLowerCase(), r]));

  for (const r of plan.roles) {
    if (roleByName.has(r.name.toLowerCase())) {
      report.skipped.push(`ruolo ${r.name}`);
      continue;
    }
    try {
      const role = await guild.roles.create({
        name: r.name,
        colors: { primaryColor: r.color },
        hoist: r.hoist,
        permissions: r.permissions.map((p) => PermissionFlagsBits[p]),
        reason,
      });
      roleByName.set(r.name.toLowerCase(), role);
      report.created.push(`🎭 ${r.name}`);
    } catch (e) {
      report.errors.push(`ruolo ${r.name}: ${e.message}`);
    }
  }

  await guild.channels.fetch();
  for (const c of plan.categories) {
    let category = guild.channels.cache.find((ch) => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === c.name.toLowerCase());
    if (!category) {
      const overwrites = [];
      if (c.private) {
        overwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
        overwrites.push({ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] });
        for (const name of c.allowRoles) {
          const role = roleByName.get(name.toLowerCase());
          if (role) overwrites.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel] });
        }
      }
      try {
        category = await guild.channels.create({ name: c.name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason });
        report.created.push(`📁 ${c.name}`);
      } catch (e) {
        report.errors.push(`categoria ${c.name}: ${e.message}`);
        continue;
      }
    } else {
      report.skipped.push(`categoria ${c.name}`);
    }

    for (const ch of c.channels) {
      const exists = guild.channels.cache.find((x) => x.parentId === category.id && norm(x.name) === norm(ch.name));
      if (exists) {
        report.skipped.push(`canale ${ch.name}`);
        continue;
      }
      const base = { name: ch.name, parent: category.id, reason };
      const withTopic = ['text', 'announcement', 'forum'].includes(ch.type) && ch.topic ? { topic: ch.topic } : {};
      try {
        await guild.channels.create({ ...base, ...withTopic, type: TYPES[ch.type] });
        report.created.push(`${ICON[ch.type]} ${ch.name}`);
      } catch (e) {
        // Annunci/forum/stage richiedono a volte la "Community" attiva: ripiego su testo/vocale.
        const fallback = ch.type === 'stage' ? ChannelType.GuildVoice : ChannelType.GuildText;
        try {
          await guild.channels.create({ ...base, ...(fallback === ChannelType.GuildText ? withTopic : {}), type: fallback });
          report.created.push(`${fallback === ChannelType.GuildText ? '💬' : '🔊'} ${ch.name} *(come ${fallback === ChannelType.GuildText ? 'testo' : 'vocale'})*`);
        } catch (e2) {
          report.errors.push(`canale ${ch.name}: ${e2.message}`);
        }
      }
    }
  }
  return report;
}

export function reportEmbed(report) {
  const color = report.errors.length ? COLORS.warn : COLORS.ok;
  const e = new EmbedBuilder().setTitle('✅ Setup completato').setColor(color);
  e.setDescription(truncate(`**Creati (${report.created.length}):**\n${report.created.join('\n') || '—'}`, 4000));
  if (report.skipped.length) e.addFields({ name: `⏭️ Già presenti (${report.skipped.length})`, value: truncate(report.skipped.join(', '), 1024) });
  if (report.errors.length) e.addFields({ name: `⚠️ Errori (${report.errors.length})`, value: truncate(report.errors.join('\n'), 1024) });
  return e;
}

// Piani in attesa di conferma (bottone "Crea"), scadono dopo 15 minuti.
const pending = new Map();
export function storePending(data) {
  const id = Math.random().toString(36).slice(2, 10);
  pending.set(id, { ...data, expires: Date.now() + 15 * 60 * 1000 });
  for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
  return id;
}
export function takePending(id) {
  const p = pending.get(id);
  pending.delete(id);
  return p && p.expires > Date.now() ? p : null;
}
export const peekPending = (id) => pending.get(id);
