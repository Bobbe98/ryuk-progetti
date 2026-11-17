---
name: claude-mem
description: Memoria persistente tra sessioni di Claude Code tramite il plugin claude-mem (osservazioni automatiche, riassunti di sessione, ricerca FTS5, tag <private>). Usa questa skill quando l'utente chiede di installare/configurare claude-mem, di cercare cosa è stato fatto in sessioni precedenti ("cosa abbiamo sistemato la settimana scorsa?"), di ridurre i token del contesto iniettato o di escludere dati sensibili dalla memoria.
version: 1.0.0
source: https://github.com/enuno/claude-command-and-control/blob/main/skills-templates/claude-mem/SKILL.md
upstream: https://github.com/thedotmack/claude-mem
tags: [claude-code, memoria, contesto, persistenza, mcp, plugin, sqlite]
---

# Claude-Mem — memoria persistente per Claude Code

Claude-Mem registra in automatico cosa succede durante le sessioni (letture, scritture, comandi),
lo comprime in osservazioni con titolo/narrazione/concetti e lo reinietta nelle sessioni successive.
Docs: https://docs.claude-mem.ai

> ⚠️ **Sessioni cloud (claude.ai/code)**: il container è effimero, `~/.claude-mem/` sparisce a fine
> sessione. Claude-Mem va installato sul **PC locale**. In cloud, per la memoria duratura usa
> CLAUDE.md nel repo o il vault Obsidian (skill `mappa-obsidian` / `secondo-cervello`).

## Requisiti
- Node.js ≥ 18, Claude Code con supporto plugin
- Bun (installato in automatico se manca), SQLite 3 (incluso)

## Installazione

**Rapida (consigliata)** — nel terminale di Claude Code:
```
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```
Poi riavvia Claude Code.

**Da sorgente**:
```bash
git clone https://github.com/thedotmack/claude-mem.git
cd claude-mem && npm install && npm run build
npm run worker:start && npm run worker:status
```

**Verifica**: `cat plugin/hooks/hooks.json`, `npm run worker:logs`, `npm run test:context`.

## Come funziona

| Hook | Timeout | Cosa fa |
|------|---------|---------|
| SessionStart | 120s | Inietta il contesto delle ultime sessioni |
| UserPromptSubmit | 60s | Crea la sessione, salva il prompt |
| PostToolUse | 120s | Cattura un'osservazione per ogni tool usato |
| Stop | 60s | Genera il riassunto di sessione |

Un worker in background (porta `37777`, UI web su http://localhost:37777) elabora le osservazioni
con il Claude Agent SDK e produce: titolo, sottotitolo, narrazione, learning, tag di concetto,
tipo (bugfix, feature, decision, discovery, refactor, change) e file coinvolti.
Le sessioni attraversano più prompt; `/clear` non chiude la sessione.

## Ricerca nella memoria (tool MCP)

Flusso a 3 livelli (~10x di risparmio token) — **non saltare direttamente al livello 3**:

1. `search` — indice leggero (~50-100 token/risultato).
   Parametri: `query` (sintassi FTS5), `limit` (20), `offset`, `type`, `project`, `dateStart`, `dateEnd`, `orderBy`.
2. `timeline` — contesto attorno a un'osservazione (`anchor` o `query`, `depth_before`/`depth_after`, default 3).
3. `get_observations` — dettagli completi solo per gli `ids` che servono davvero.

Sintassi FTS5:
```
"user auth" AND (JWT OR session) NOT deprecated
title:authentication   content:database   concepts:gotcha
"connection failed"
```

Esempio — "Che bug abbiamo sistemato la settimana scorsa?":
`search(type:"bugfix", dateStart:<7 giorni fa>)` → `timeline(anchor:<id>)` se serve contesto →
`get_observations(ids:[...])` solo per i dettagli. Cita le osservazioni per ID.

## Configurazione

File `~/.claude-mem/settings.json` (o variabili d'ambiente omonime, o `./claude-mem-settings.sh`):
```json
{
  "CLAUDE_MEM_MODEL": "sonnet",
  "CLAUDE_MEM_MODE": "code",
  "CLAUDE_MEM_CONTEXT_OBSERVATIONS": 50,
  "CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED": false
}
```

| Variabile | Default | Note |
|-----------|---------|------|
| `CLAUDE_MEM_MODEL` | sonnet | haiku / sonnet / opus |
| `CLAUDE_MEM_PROVIDER` | claude | claude / gemini / openrouter (+ `_GEMINI_API_KEY`, `_OPENROUTER_API_KEY`, `_..._MODEL`) |
| `CLAUDE_MEM_DATA_DIR` | ~/.claude-mem | posizione DB |
| `CLAUDE_MEM_WORKER_PORT` / `_HOST` | 37777 / 127.0.0.1 | |
| `CLAUDE_MEM_LOG_LEVEL` | INFO | DEBUG, INFO, WARN, ERROR, SILENT |
| `CLAUDE_MEM_CONTEXT_SESSION_COUNT` | 10 | sessioni recenti lette |
| `CLAUDE_MEM_CONTEXT_OBSERVATIONS` | 50 | osservazioni iniettate |
| `CLAUDE_MEM_CONTEXT_FULL_COUNT` / `_FULL_FIELD` | 5 / narrative | espanse; narrative o facts |
| `CLAUDE_MEM_CONTEXT_SHOW_*` | — | READ_TOKENS, WORK_TOKENS, SAVINGS_AMOUNT, LAST_SUMMARY, LAST_MESSAGE |
| `CLAUDE_MEM_SKIP_TOOLS` | — | es. `ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion` |

Le API key vanno in variabili d'ambiente locali, **mai** committate.

## Modalità

Una modalità definisce ruolo dell'osservatore, tipi di osservazione, concetti e lingua.

| Modalità | Uso |
|----------|-----|
| `code` | default sviluppo |
| `code--chill` | registra solo ciò che è doloroso da riscoprire (meno token) |
| `email-investigation` | analisi archivi email |
| `code--es/fr/de/ja/zh/...` | output in altre lingue (28+ supportate; verifica che `code--it` esista nella tua versione) |

Ereditarietà con `--`: `code--es` carica `code` e poi applica gli override.

## Privacy: tag `<private>`

```
<private>
Host: db-interno.azienda.it  User: admin
</private>
```
Claude lo vede nella sessione corrente, ma viene rimosso prima del salvataggio. Funziona in prompt e
output dei tool, multiriga, più tag per messaggio. Usalo per credenziali, dati clienti (es. preventivi),
stack trace verbosi.

Verifica:
```bash
sqlite3 ~/.claude-mem/claude-mem.db "SELECT prompt_text FROM user_prompts LIMIT 5;"
sqlite3 ~/.claude-mem/claude-mem.db "SELECT narrative FROM observations LIMIT 5;"
```

## Dati e worker

`~/.claude-mem/`: `claude-mem.db`, `.worker.pid`, `logs/worker-YYYY-MM-DD.log`, `settings.json`.

```sql
SELECT session_id, project, created_at, status FROM sdk_sessions ORDER BY created_at DESC LIMIT 10;
SELECT title, type, created_at FROM observations WHERE project = 'ryuk-progetti';
```

`npm run worker:start | stop | restart | status | logs`

## Troubleshooting

- **Worker non parte**: `lsof -i :37777` → cambia porta con `CLAUDE_MEM_WORKER_PORT=38000` e `worker:restart`.
- **Nessun contesto**: controlla `plugin/hooks/hooks.json`, `SELECT COUNT(*) FROM observations;`, i log.
- **Troppi token**: `CLAUDE_MEM_CONTEXT_OBSERVATIONS=25` e/o `CLAUDE_MEM_MODE=code--chill`.
- **DB corrotto**: backup `cp claude-mem.db claude-mem.db.bak`, elimina il DB, `worker:restart`.

## Buone pratiche
1. Parti con i default, poi regola `CONTEXT_OBSERVATIONS` sulla dimensione del progetto.
2. Prima di chiedere "come avevamo fatto X?", **cerca in memoria** con il flusso a 3 livelli.
3. Proteggi sempre i dati sensibili con `<private>`.
4. Rivedi periodicamente le osservazioni salvate; usa `code--chill` su progetti molto attivi.
5. Le decisioni durevoli vanno anche in CLAUDE.md / Obsidian: claude-mem è locale al PC.
