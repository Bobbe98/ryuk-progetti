import { DICE_REGEX, rollAndBroadcast } from '../lib/dice';

// Renders free text with every dice formula (2d6+4, d20, ...) turned into a
// tappable chip that rolls it and shows the result in the global dice tray.
export default function DiceText({ text, className }) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  const re = new RegExp(DICE_REGEX.source, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const expr = m[0];
    parts.push(
      <button
        key={`${m.index}-${expr}`}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); rollAndBroadcast(expr); }}
        className="dice-chip"
        title={`Tira ${expr}`}
      >
        {expr}
      </button>,
    );
    last = m.index + expr.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}
