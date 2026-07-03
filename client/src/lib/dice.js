// Dice expression parsing and rolling, shared by the floating tray and the
// clickable formula chips inside stat blocks and descriptions.

// Matches "2d6", "d20", "1d8 + 3", "4d6-1" (Italian texts use both "2d6+3"
// and spaced "2d6 + 3"). Group 1: count, 2: faces, 3: signed modifier.
export const DICE_REGEX = /(\d{0,3})d(\d{1,4})(\s*[+-]\s*\d{1,4})?/gi;

export function parseDice(expr) {
  const m = /^(\d{0,3})d(\d{1,4})(?:\s*([+-])\s*(\d{1,4}))?$/i.exec(expr.trim());
  if (!m) return null;
  const count = Math.max(1, Number(m[1] || 1));
  const faces = Number(m[2]);
  const modifier = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  if (faces < 2 || count > 100) return null;
  return { count, faces, modifier };
}

export function rollDice(expr) {
  const parsed = typeof expr === 'string' ? parseDice(expr) : expr;
  if (!parsed) return null;
  const rolls = Array.from({ length: parsed.count }, () => 1 + Math.floor(Math.random() * parsed.faces));
  const total = rolls.reduce((a, b) => a + b, 0) + parsed.modifier;
  const formula = `${parsed.count}d${parsed.faces}${parsed.modifier ? (parsed.modifier > 0 ? `+${parsed.modifier}` : parsed.modifier) : ''}`;
  return { formula, rolls, modifier: parsed.modifier, total };
}

// Tiny event bus so any component (chips in stat blocks) can push a roll
// into the global dice tray without prop drilling.
const listeners = new Set();

export function onRoll(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitRoll(result) {
  for (const fn of listeners) fn(result);
}

export function rollAndBroadcast(expr) {
  const result = rollDice(expr);
  if (result) emitRoll(result);
  return result;
}
