---
name: claude-mem
description: Memoria persistente tra le sessioni di Claude Code tramite il plugin claude-mem (osservazioni automatiche, riassunti di sessione, ricerca testuale FTS5, etichette <private>). Usa questa skill quando l'utente chiede di installare o configurare claude-mem, di cercare cosa è stato fatto nelle sessioni precedenti ("cosa abbiamo sistemato la settimana scorsa?"), di ridurre i token del contesto iniettato o di escludere dati sensibili dalla memoria.
version: 1.2.0
source: https://github.com/enuno/claude-command-and-control/blob/main/skills-templates/claude-mem/SKILL.md
upstream: https://github.com/thedotmack/claude-mem
tags: [claude-code, memoria, contesto, persistenza, mcp, plugin, sqlite]
---

# Claude-Mem — memoria persistente per Claude Code

Claude-Mem registra in automatico ciò che succede durante le sessioni (letture, scritture, comandi),
lo comprime in osservazioni con titolo, racconto e concetti, e lo reinserisce nelle sessioni successive.
Documentazione ufficiale (in inglese): https://docs.claude-mem.ai

> ⚠️ **Sessioni nel cloud (claude.ai/code)**: il contenitore è temporaneo e `~/.claude-mem/` viene
> cancellata a fine sessione. Claude-Mem va installato sul **PC locale**. Nel cloud, per una memoria
> che duri usa il file CLAUDE.md nel repository o il vault Obsidian (skill `mappa-obsidian` / `secondo-cervello`).

## Requisiti
- Node.js 18 o superiore, Claude Code con supporto ai plugin
- Bun (si installa da solo se manca) e SQLite 3 (già incluso)

## Installazione

**Rapida (consigliata)** — dentro Claude Code:
```
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```
Poi riavvia Claude Code.

**Dal codice sorgente**:
```bash
git clone https://github.com/thedotmack/claude-mem.git
cd claude-mem && npm install && npm run build
npm run worker:start && npm run worker:status   # avvia il servizio e ne controlla lo stato
```

**Controllo**:
```bash
cat plugin/hooks/hooks.json   # gli agganci sono installati?
npm run worker:logs           # registro del servizio
npm run test:context          # prova l'iniezione del contesto
```

## Come funziona

| Aggancio (hook) | Tempo massimo | Cosa fa |
|-----------------|---------------|---------|
| SessionStart (inizio sessione) | 120 s | Inserisce il contesto delle ultime sessioni |
| UserPromptSubmit (invio messaggio) | 60 s | Crea la sessione e salva il messaggio |
| PostToolUse (dopo ogni strumento) | 120 s | Registra un'osservazione per ogni strumento usato |
| Stop (fine risposta) | 60 s | Genera il riassunto della sessione |

Un servizio in sottofondo (porta `37777`, interfaccia web su http://localhost:37777) elabora le
osservazioni con il Claude Agent SDK e per ognuna produce: titolo, sottotitolo, racconto dettagliato,
cose imparate, etichette di concetto, tipo di lavoro e file coinvolti.

Tipi di lavoro (i valori da usare nei filtri restano in inglese):
`bugfix` = correzione errore · `feature` = nuova funzione · `decision` = decisione ·
`discovery` = scoperta · `refactor` = riorganizzazione codice · `change` = modifica.

Una sessione comprende più messaggi; `/clear` non la chiude (riparte col messaggio successivo).

## Ricerca nella memoria (strumenti MCP)

Procedura in 3 passi (circa 10 volte meno token) — **non saltare subito al passo 3**:

1. `search` — indice leggero (circa 50-100 token per risultato).
   Parametri: `query` (sintassi FTS5), `limit` (risultati per pagina, predefinito 20), `offset` (scostamento),
   `type` (tipo di lavoro), `project` (progetto), `dateStart` / `dateEnd` (intervallo di date), `orderBy` (ordinamento).
2. `timeline` — cosa è successo prima e dopo un'osservazione: `anchor` (ID di riferimento) oppure `query`,
   `depth_before` / `depth_after` (quante osservazioni prima/dopo, predefinito 3).
3. `get_observations` — dettagli completi, solo per gli `ids` che servono davvero.

Sintassi di ricerca FTS5 (gli operatori `AND`, `OR`, `NOT` e i nomi dei campi restano in inglese):
```
"autenticazione utente" AND (JWT OR sessione) NOT deprecato
title:pagamento       # cerca solo nel titolo
content:database      # cerca solo nel contenuto
concepts:trappola     # cerca tra le etichette di concetto
"connessione fallita" # frase esatta
```

Esempio — "Che errori abbiamo sistemato la settimana scorsa?":
`search(type:"bugfix", dateStart:<7 giorni fa>)` → `timeline(anchor:<id>)` se serve contesto →
`get_observations(ids:[...])` solo per i dettagli. Cita sempre le osservazioni con il loro ID.

## Configurazione

File `~/.claude-mem/settings.json` (oppure variabili d'ambiente con lo stesso nome, oppure lo
script interattivo `./claude-mem-settings.sh`):
```json
{
  "CLAUDE_MEM_MODEL": "sonnet",
  "CLAUDE_MEM_MODE": "code--it",
  "CLAUDE_MEM_CONTEXT_OBSERVATIONS": 50,
  "CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED": false
}
```

| Variabile | Valore predefinito | Note |
|-----------|--------------------|------|
| `CLAUDE_MEM_MODEL` | sonnet | modello che elabora: haiku / sonnet / opus |
| `CLAUDE_MEM_PROVIDER` | claude | fornitore: claude / gemini / openrouter (con `_GEMINI_API_KEY`, `_OPENROUTER_API_KEY` e i relativi `_MODEL`) |
| `CLAUDE_MEM_DATA_DIR` | ~/.claude-mem | cartella del database |
| `CLAUDE_MEM_WORKER_PORT` / `_HOST` | 37777 / 127.0.0.1 | porta e indirizzo del servizio |
| `CLAUDE_MEM_LOG_LEVEL` | INFO | dettaglio del registro: DEBUG, INFO, WARN, ERROR, SILENT |
| `CLAUDE_MEM_CONTEXT_SESSION_COUNT` | 10 | quante sessioni recenti leggere |
| `CLAUDE_MEM_CONTEXT_OBSERVATIONS` | 50 | quante osservazioni inserire nel contesto |
| `CLAUDE_MEM_CONTEXT_FULL_COUNT` / `_FULL_FIELD` | 5 / narrative | quante mostrare per intero; `narrative` (racconto) o `facts` (solo fatti) |
| `CLAUDE_MEM_CONTEXT_SHOW_*` | — | cosa mostrare: token letti, token di lavoro, risparmio, ultimo riassunto, ultimo messaggio |
| `CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED` | false | genera un CLAUDE.md per cartella con la cronologia |
| `CLAUDE_MEM_SKIP_TOOLS` | — | strumenti da ignorare, es. `ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion` |

Le chiavi API vanno solo in variabili d'ambiente locali, **mai** nel repository.

## Modalità

Una modalità stabilisce: il ruolo di chi osserva (es. "sviluppatore"), i tipi di osservazione,
le etichette di concetto e la lingua in cui vengono scritte le osservazioni.

| Modalità | Uso |
|----------|-----|
| `code` | predefinita, sviluppo software |
| `code--chill` | registra solo ciò che sarebbe faticoso riscoprire (meno token) |
| `email-investigation` | analisi di archivi email |
| **`code--it`** | **sviluppo, osservazioni e riassunti scritti in italiano (consigliata)** |
| `code--es`, `code--fr`, `code--de`, `code--ja`, `code--zh`… | osservazioni in altre lingue (oltre 28) |
| `law-study`, `meme-tokens` | modalità speciali incluse nel plugin |

### Osservazioni in italiano (`code--it`)

La modalità esiste nel plugin (`plugin/modes/code--it.json`): eredita tutto da `code` e chiede
all'agente di memoria di scrivere in italiano titoli, sottotitoli, fatti, racconti e riassunti
(richiesta, cosa è stato esaminato, cosa si è imparato, cosa è stato fatto, prossimi passi, note).

Per attivarla, in `~/.claude-mem/settings.json`:
```json
{ "CLAUDE_MEM_MODE": "code--it" }
```
oppure come variabile d'ambiente (es. in `~/.bashrc` o `~/.zshrc`):
```bash
export CLAUDE_MEM_MODE="code--it"
```
Poi `npm run worker:restart` (o riavvia Claude Code). Le osservazioni già salvate restano nella
lingua in cui erano state scritte; le nuove saranno in italiano.

Nota: `code--it` e `code--chill` non si combinano. Per contenere i token restando in italiano,
abbassa `CLAUDE_MEM_CONTEXT_OBSERVATIONS` (es. 25) invece di passare a `code--chill`.
Con le osservazioni in italiano, fai anche le ricerche FTS5 con parole italiane.

Ereditarietà con `--`: `code--es` carica prima `code` e poi sovrascrive solo ciò che cambia.

## Riservatezza: etichetta `<private>`

```
<private>
Host: db-interno.azienda.it  Utente: admin  Password: ...
</private>
```
Claude vede il contenuto nella sessione corrente, ma viene tolto prima del salvataggio nel database.
Funziona nei messaggi e nei risultati degli strumenti, anche su più righe e con più etichette nello
stesso messaggio. Usala per credenziali, dati dei clienti (es. preventivi) e log di errore molto lunghi.

Controllo che il filtro funzioni:
```bash
sqlite3 ~/.claude-mem/claude-mem.db "SELECT prompt_text FROM user_prompts LIMIT 5;"
sqlite3 ~/.claude-mem/claude-mem.db "SELECT narrative FROM observations LIMIT 5;"
```

## Dati e servizio

Contenuto di `~/.claude-mem/`:
- `claude-mem.db` — database SQLite
- `.worker.pid` — numero del processo del servizio
- `logs/worker-AAAA-MM-GG.log` — registri giornalieri
- `settings.json` — configurazione

```sql
-- Ultime sessioni
SELECT session_id, project, created_at, status FROM sdk_sessions ORDER BY created_at DESC LIMIT 10;
-- Osservazioni di un progetto
SELECT title, type, created_at FROM observations WHERE project = 'ryuk-progetti';
```

Gestione del servizio:
```bash
npm run worker:start     # avvia
npm run worker:stop      # ferma
npm run worker:restart   # riavvia
npm run worker:status    # stato
npm run worker:logs      # registro
```

## Risoluzione dei problemi

- **Il servizio non parte**: `lsof -i :37777` per vedere chi occupa la porta → cambiala con
  `CLAUDE_MEM_WORKER_PORT=38000` e poi `npm run worker:restart`.
- **Nessun contesto all'avvio**: controlla `plugin/hooks/hooks.json`, conta i dati con
  `sqlite3 ~/.claude-mem/claude-mem.db "SELECT COUNT(*) FROM observations;"` e leggi il registro.
- **Troppi token**: `CLAUDE_MEM_CONTEXT_OBSERVATIONS=25`; se non ti serve l'italiano, anche `CLAUDE_MEM_MODE=code--chill`.
- **Osservazioni ancora in inglese**: controlla che `CLAUDE_MEM_MODE` sia `code--it` e riavvia il servizio.
- **Database rovinato**: fai una copia (`cp ~/.claude-mem/claude-mem.db ~/.claude-mem/claude-mem.db.bak`),
  cancella il database e `npm run worker:restart`.

## Buone pratiche
1. Parti con le impostazioni predefinite, poi regola `CLAUDE_MEM_CONTEXT_OBSERVATIONS` in base a quanto è grande il progetto.
2. Prima di chiedere "come avevamo fatto X?", **cerca nella memoria** con la procedura in 3 passi.
3. Proteggi sempre i dati sensibili con `<private>`.
4. Usa `code--it` per avere la memoria in italiano; ricontrolla ogni tanto le osservazioni salvate.
5. Le decisioni importanti vanno anche in CLAUDE.md / Obsidian: claude-mem resta solo sul tuo PC.

## Novità per versione (del plugin)
- **v9.0.0** — CLAUDE.md per cartella, supporto ai git worktree, limiti configurabili
- **v7.1.0** — Bun al posto di PM2, bun:sqlite al posto di better-sqlite3
- **v7.0.0** — 11 impostazioni configurabili, doppia etichetta di riservatezza
- **v5.4.0** — ricerca tramite skill (circa 2.250 token risparmiati a sessione)
