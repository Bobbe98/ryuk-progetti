import { config } from './config.js';

export const SYSTEM_PROMPT = `Sei "Aiutante", un assistente dentro Discord. Rispondi in italiano (o nella lingua dell'utente),
in modo chiaro, pratico e conciso. Usa il markdown di Discord (grassetto, elenchi, blocchi di codice).
Sei esperto di gestione server Discord: ruoli, permessi, canali, moderazione, bot, community.
Non inventare fatti: se non sei sicuro, dillo. Le risposte devono stare sotto i 1800 caratteri quando possibile.`;

export const aiAvailable = () => Boolean(config.groqKey || config.geminiKey);
export const aiProvider = () => (config.groqKey ? `Groq (${config.groqModel})` : config.geminiKey ? `Gemini (${config.geminiModel})` : 'nessuno');

async function groq(system, messages, json) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: json ? 0.4 : 0.7,
      max_tokens: 2048,
      messages: [{ role: 'system', content: system }, ...messages],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Groq ${res.status}: ${data.error?.message ?? res.statusText}`);
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

async function gemini(system, messages, json) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: json ? 0.4 : 0.7, maxOutputTokens: 2048, ...(json ? { responseMimeType: 'application/json' } : {}) },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message ?? res.statusText}`);
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() ?? '';
}

/** Chiamata AI di basso livello. Se un provider fallisce prova l'altro (se configurato). */
export async function complete({ system = SYSTEM_PROMPT, messages, json = false }) {
  if (!aiAvailable()) throw new Error('AI non configurata: aggiungi GROQ_API_KEY o GEMINI_API_KEY nel file .env');
  const order = [config.groqKey && groq, config.geminiKey && gemini].filter(Boolean);
  let lastErr;
  for (const fn of order) {
    try {
      const out = await fn(system, messages, json);
      if (out) return out;
    } catch (e) {
      lastErr = e;
      console.warn('[AI]', e.message);
    }
  }
  throw lastErr ?? new Error('Risposta AI vuota');
}

/** Estrae un oggetto JSON anche se il modello lo circonda di testo o ```json. */
export async function completeJSON(opts) {
  const raw = await complete({ ...opts, json: true });
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("L'AI non ha restituito un JSON valido");
  return JSON.parse(match[0]);
}

// Memoria breve della conversazione per canale (ultimi 12 messaggi, scade dopo 30 minuti).
const memory = new Map();
const MAX_TURNS = 12;
const TTL = 30 * 60 * 1000;

export async function chat(key, userText, system = SYSTEM_PROMPT) {
  const now = Date.now();
  let mem = memory.get(key);
  if (!mem || now - mem.at > TTL) mem = { at: now, msgs: [] };
  mem.msgs.push({ role: 'user', content: userText });
  const answer = await complete({ system, messages: mem.msgs.slice(-MAX_TURNS) });
  mem.msgs.push({ role: 'assistant', content: answer });
  mem.msgs = mem.msgs.slice(-MAX_TURNS);
  mem.at = now;
  memory.set(key, mem);
  return answer;
}

export const resetChat = (key) => memory.delete(key);
