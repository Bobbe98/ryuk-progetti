import { ChannelType, GuildVerificationLevel, GuildExplicitContentFilter, PermissionFlagsBits, PermissionsBitField } from 'discord.js';

// Permessi che @everyone non dovrebbe MAI avere.
export const DANGEROUS_EVERYONE = [
  'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'ManageWebhooks', 'BanMembers',
  'KickMembers', 'ModerateMembers', 'ManageMessages', 'MentionEveryone', 'ManageGuildExpressions', 'ManageEvents', 'ManageThreads', 'ViewAuditLog',
];

/**
 * Analizza il server e restituisce { score, issues: [{ level, text, fix? }], stats }.
 * level: 'alto' | 'medio' | 'basso'. `fix` indica che /analizza-server può correggerlo da solo.
 */
export async function auditGuild(guild) {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const issues = [];
  const everyone = guild.roles.everyone;

  const badPerms = DANGEROUS_EVERYONE.filter((p) => everyone.permissions.has(PermissionFlagsBits[p], false));
  if (badPerms.length) issues.push({ level: 'alto', text: `@everyone ha permessi pericolosi: **${badPerms.join(', ')}**`, fix: 'everyonePerms' });

  const admins = guild.roles.cache.filter((r) => !r.managed && r.id !== everyone.id && r.permissions.has(PermissionFlagsBits.Administrator));
  if (admins.size > 3) issues.push({ level: 'medio', text: `${admins.size} ruoli hanno **Amministratore** (${admins.map((r) => r.name).slice(0, 8).join(', ')}). Meglio dare solo i permessi necessari.` });

  if (guild.verificationLevel === GuildVerificationLevel.None) issues.push({ level: 'alto', text: 'Livello di verifica **Nessuno**: chiunque scrive subito, facile per lo spam.', fix: 'verification' });
  if (guild.explicitContentFilter === GuildExplicitContentFilter.Disabled) issues.push({ level: 'medio', text: 'Filtro contenuti espliciti **disattivato**.', fix: 'contentFilter' });
  if (guild.mfaLevel === 0) issues.push({ level: 'basso', text: "La 2FA per i moderatori non è obbligatoria (Impostazioni server → Sicurezza). Solo il proprietario può attivarla." });

  const channels = [...guild.channels.cache.values()];
  const orphans = channels.filter((c) => c.type !== ChannelType.GuildCategory && !c.parentId && !c.isThread());
  if (orphans.length > 3) issues.push({ level: 'basso', text: `${orphans.length} canali senza categoria: ${orphans.slice(0, 6).map((c) => `<#${c.id}>`).join(' ')}. Raggrupparli rende il server più ordinato.` });

  const cats = channels.filter((c) => c.type === ChannelType.GuildCategory);
  const empty = cats.filter((cat) => !channels.some((c) => c.parentId === cat.id));
  if (empty.length) issues.push({ level: 'basso', text: `Categorie vuote: ${empty.map((c) => `**${c.name}**`).join(', ')}`, fix: 'emptyCategories' });

  const names = new Map();
  for (const c of channels.filter((c) => c.type !== ChannelType.GuildCategory)) names.set(c.name, (names.get(c.name) ?? 0) + 1);
  const dupes = [...names].filter(([, n]) => n > 1).map(([n]) => n);
  if (dupes.length) issues.push({ level: 'basso', text: `Canali con nome duplicato: ${dupes.slice(0, 8).join(', ')}` });

  if (!guild.rulesChannelId && !channels.some((c) => /regol|rule/i.test(c.name))) issues.push({ level: 'medio', text: 'Nessun canale **regole**. Usa `/crea-canale` o `/setup` per aggiungerlo.' });
  if (!guild.systemChannelId) issues.push({ level: 'basso', text: 'Nessun canale di sistema (messaggi di benvenuto di Discord). Puoi usare `/benvenuto imposta`.' });

  // Canali dove @everyone può menzionare tutti o gestire messaggi tramite override.
  const riskyOverrides = channels.filter((c) => {
    const ow = c.permissionOverwrites?.cache.get(everyone.id);
    return ow && (ow.allow.has(PermissionFlagsBits.MentionEveryone) || ow.allow.has(PermissionFlagsBits.ManageMessages) || ow.allow.has(PermissionFlagsBits.ManageChannels));
  });
  if (riskyOverrides.length) issues.push({ level: 'alto', text: `Override pericolosi per @everyone in: ${riskyOverrides.slice(0, 6).map((c) => `<#${c.id}>`).join(' ')}`, fix: 'channelOverrides' });

  const me = guild.members.me;
  const higher = guild.roles.cache.filter((r) => r.position > me.roles.highest.position && !r.managed && r.id !== everyone.id);
  if (higher.size) issues.push({ level: 'basso', text: `Il ruolo del bot è sotto ${higher.size} ruoli: non potrà gestire/moderare chi li ha. Trascina il ruolo del bot più in alto se serve.` });

  const weight = { alto: 20, medio: 10, basso: 4 };
  const score = Math.max(0, 100 - issues.reduce((n, i) => n + weight[i.level], 0));
  const stats = {
    members: guild.memberCount,
    roles: guild.roles.cache.size - 1,
    text: channels.filter((c) => c.type === ChannelType.GuildText).length,
    voice: channels.filter((c) => c.type === ChannelType.GuildVoice).length,
    categories: cats.length,
  };
  return { score, issues, stats };
}

/** Applica le correzioni automatiche sicure. Ritorna l'elenco di cosa è stato fatto. */
export async function autoFix(guild, fixes) {
  const done = [];
  const reason = 'Correzione automatica da /analizza-server';
  const everyone = guild.roles.everyone;
  if (fixes.includes('everyonePerms')) {
    const bits = new PermissionsBitField(everyone.permissions).remove(DANGEROUS_EVERYONE.map((p) => PermissionFlagsBits[p]));
    await everyone.setPermissions(bits, reason);
    done.push('Rimossi i permessi pericolosi da @everyone');
  }
  if (fixes.includes('verification')) {
    await guild.setVerificationLevel(GuildVerificationLevel.Low, reason);
    done.push('Livello di verifica impostato a **Basso** (email verificata)');
  }
  if (fixes.includes('contentFilter')) {
    await guild.setExplicitContentFilter(GuildExplicitContentFilter.AllMembers, reason);
    done.push('Filtro contenuti espliciti attivo per tutti i membri');
  }
  if (fixes.includes('channelOverrides')) {
    let n = 0;
    for (const c of guild.channels.cache.values()) {
      const ow = c.permissionOverwrites?.cache.get(everyone.id);
      if (!ow) continue;
      const risky = [PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels].filter((p) => ow.allow.has(p));
      if (risky.length) {
        await c.permissionOverwrites.edit(everyone, Object.fromEntries(risky.map((p) => [new PermissionsBitField(p).toArray()[0], null])), { reason });
        n++;
      }
    }
    done.push(`Ripuliti gli override di @everyone in ${n} canali`);
  }
  if (fixes.includes('emptyCategories')) {
    const all = [...guild.channels.cache.values()];
    const empty = all.filter((cat) => cat.type === ChannelType.GuildCategory && !all.some((c) => c.parentId === cat.id));
    for (const c of empty) await c.delete(reason);
    done.push(`Eliminate ${empty.length} categorie vuote`);
  }
  return done;
}
