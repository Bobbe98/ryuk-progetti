// Structured translator for the highly templated "Weapon Attack" opening
// clause that dominates SRD monster actions ("Melee Weapon Attack: +4 to
// hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage."). Rather
// than blind regex substitution, this parses the clause's numeric/semantic
// fields and regenerates correct Italian using the same phrasing official
// Italian 5e books use, converting feet to meters. Any text that comes
// after the matched clause (a "rider" - grapple/poison/save effects etc.)
// is left untouched and reported separately, to be filled in by the
// natural-language translation pass.
import { DAMAGE_TYPE_IT } from './translate.js';

const FT_TO_M = 0.3048;

function ftToM(ft) {
  const m = Number(ft) * FT_TO_M;
  // 5 ft steps map to clean meter values per official conversion table.
  const table = { 5: 1.5, 10: 3, 15: 4.5, 20: 6, 25: 7.5, 30: 9, 40: 12, 50: 15, 60: 18, 80: 24, 90: 27, 100: 30, 120: 36, 150: 45 };
  if (table[ft]) return table[ft];
  return Math.round(m * 2) / 2;
}

function fmtM(n) {
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

function translateDamageClause(clause) {
  // "5 (1d6 + 2) slashing damage" | "5 (1d6+2) slashing damage" | "5 slashing damage"
  const m = clause.match(/^(\d+) (?:\((\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\) )?(\w+) damage(?: in melee or (\d+) \((\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\) (\w+) damage at range)?$/);
  if (!m) return null;
  const [, total, nd, nf, sign, mod, type, total2, nd2, nf2, sign2, mod2, type2] = m;
  const typeIt = (t) => DAMAGE_TYPE_IT[t.toLowerCase()] || t.toLowerCase();
  const dice = (n, f, s, mo) => `${n}d${f}${s ? ` ${s} ${mo}` : ''}`;
  let out = nd ? `${total} (${dice(nd, nf, sign, mod)}) danni ${typeIt(type)}` : `${total} danni ${typeIt(type)}`;
  if (total2) {
    out += ` in mischia, oppure ${total2} (${dice(nd2, nf2, sign2, mod2)}) danni ${typeIt(type2)} a distanza`;
  }
  return out;
}

const PREFIX_RE = /^(Melee|Ranged|Melee or Ranged) Weapon Attack: ([+-]\d+) to hit, (?:reach (\d+) ft\.|range (\d+)\/(\d+) ft\.|reach (\d+) ft\. or range (\d+)\/(\d+) ft\.), (one target|one creature|one Large or smaller creature|one Medium or smaller creature|one prone creature)\. Hit: /;

const DAMAGE_CLAUSE_HEAD_RE = /^(\d+) (?:\((\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\) )?(\w+) damage(?: in melee or (\d+) \((\d+)d(\d+)(?:\s*([+-])\s*(\d+))?\) (\w+) damage at range)?/;

const TARGET_IT = {
  'one target': 'un obiettivo',
  'one creature': 'una creatura',
  'one Large or smaller creature': 'una creatura di taglia Grande o inferiore',
  'one Medium or smaller creature': 'una creatura di taglia Media o inferiore',
  'one prone creature': 'una creatura prona',
};

function cleanRider(rider) {
  let r = rider.trim();
  r = r.replace(/^[.,]\s*/, '');
  r = r.replace(/^and\s+/i, '');
  if (!r) return '';
  return r[0].toUpperCase() + r.slice(1);
}

export function translateAttackAction(desc) {
  const pm = desc.match(PREFIX_RE);
  if (!pm) return null;
  const [, kind, bonus, reach, rMin, rMax, reach2, rMin2, rMax2, target] = pm;
  let rest = desc.slice(pm[0].length);
  const translatedParts = [];
  for (;;) {
    const dm = rest.match(DAMAGE_CLAUSE_HEAD_RE);
    if (!dm) break;
    const t = translateDamageClause(dm[0]);
    if (t === null) break;
    translatedParts.push(t);
    rest = rest.slice(dm[0].length);
    if (rest.startsWith(' plus ')) { rest = rest.slice(6); continue; }
    break;
  }
  if (translatedParts.length === 0) return null;
  const riderEn = cleanRider(rest);

  let rangeIt;
  let kindIt;
  if (kind === 'Melee') {
    kindIt = 'Attacco con Arma da Mischia';
    rangeIt = `raggio ${fmtM(ftToM(reach))} m`;
  } else if (kind === 'Ranged') {
    kindIt = 'Attacco con Arma a Distanza';
    rangeIt = `gittata ${fmtM(ftToM(rMin))}/${fmtM(ftToM(rMax))} m`;
  } else {
    kindIt = 'Attacco con Arma da Mischia o a Distanza';
    rangeIt = `raggio ${fmtM(ftToM(reach2))} m o gittata ${fmtM(ftToM(rMin2))}/${fmtM(ftToM(rMax2))} m`;
  }
  const targetIt = TARGET_IT[target] || 'un obiettivo';
  const opening = `${kindIt}: ${bonus} per colpire, ${rangeIt}, ${targetIt}. Colpito: ${translatedParts.join(', più ')}.`;
  return { opening, riderEn };
}
