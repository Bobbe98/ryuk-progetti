import { EmbedBuilder } from 'discord.js';

export const COLORS = { main: 0x5865f2, ok: 0x57f287, warn: 0xfee75c, err: 0xed4245 };

export const embed = (title, description = null, color = COLORS.main) =>
  new EmbedBuilder().setTitle(title).setDescription(description).setColor(color);

export const errorEmbed = (msg) => embed('❌ Errore', msg, COLORS.err);

/** Taglia un testo a `max` caratteri senza spezzare a metà le parole quando possibile. */
export function truncate(text, max) {
  if (!text || text.length <= max) return text ?? '';
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.8 ? cut.slice(0, sp) : cut) + '…';
}

/** Divide un testo lungo in blocchi da massimo `size` caratteri (limite messaggi Discord: 2000). */
export function chunk(text, size = 1900) {
  const parts = [];
  let rest = text;
  while (rest.length > size) {
    let at = rest.lastIndexOf('\n', size);
    if (at < size * 0.5) at = rest.lastIndexOf(' ', size);
    if (at < size * 0.5) at = size;
    parts.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** "10m", "2h", "1d", "1h30m" -> millisecondi (null se non valido). */
export function parseDuration(str) {
  const re = /(\d+)\s*(s|m|h|d|g)/gi;
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, g: 864e5 };
  let ms = 0;
  let found = false;
  for (const [, n, u] of str.matchAll(re)) {
    ms += Number(n) * unit[u.toLowerCase()];
    found = true;
  }
  if (!found && /^\d+$/.test(str.trim())) return Number(str) * 6e4; // numero secco = minuti
  return found ? ms : null;
}

export const cooldowns = new Map();
/** Ritorna i secondi mancanti se l'utente è in cooldown, altrimenti 0 e registra l'uso. */
export function cooldown(key, seconds) {
  const now = Date.now();
  const until = cooldowns.get(key) ?? 0;
  if (until > now) return Math.ceil((until - now) / 1000);
  cooldowns.set(key, now + seconds * 1000);
  return 0;
}
