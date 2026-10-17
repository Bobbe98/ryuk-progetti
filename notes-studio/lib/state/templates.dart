import '../models/block.dart';
import '../models/note_page.dart';

Block _t(String text, {int indent = 0}) => Block(text: text, indent: indent);
Block _h2(String text) => Block(type: BlockType.h2, text: text);
Block _h3(String text) => Block(type: BlockType.h3, text: text);
Block _b(String text, {int indent = 0}) =>
    Block(type: BlockType.bullet, text: text, indent: indent);
Block _n(String text, {int indent = 0}) =>
    Block(type: BlockType.numbered, text: text, indent: indent);
Block _todo(String text, {bool done = false, int indent = 0}) =>
    Block(type: BlockType.todo, text: text, checked: done, indent: indent);
Block _toggle(String text, {bool collapsed = true}) =>
    Block(type: BlockType.toggle, text: text, collapsed: collapsed);
Block _callout(
  String text,
  String emoji, [
  BlockColor color = BlockColor.gray,
]) => Block(type: BlockType.callout, text: text, emoji: emoji, color: color);
Block _quote(String text) => Block(type: BlockType.quote, text: text);
Block _div() => Block(type: BlockType.divider);

const _gettingStartedId = 'welcome-getting-started';

NotePage welcomePage() => NotePage(
  title: 'Benvenuto in Notes Studio',
  icon: '👋',
  cover: 0,
  blocks: [
    _callout(
      'Questa è la tua prima pagina. Tutto quello che vedi è modificabile: '
          'tocca un punto qualsiasi e inizia a scrivere.',
      '💡',
      BlockColor.blue,
    ),
    _h2('Le basi'),
    _todo('Tocca qui e scrivi qualcosa', done: true),
    _todo(
      'Scrivi "/" all\'inizio di una riga per vedere tutti i tipi di blocco',
    ),
    _todo('Tieni premuto ⋮⋮ a sinistra di un blocco per trascinarlo'),
    _todo(
      'Tocca ⋮⋮ per trasformare, duplicare, colorare o eliminare un blocco',
    ),
    _todo('Apri il menu ☰ per creare pagine, sottopagine e preferiti'),
    _h2('Scorciatoie Markdown'),
    _toggle('Tocca la freccia per aprirle'),
    _b('#  →  Titolo 1   (##  e  ###  per i titoli più piccoli)', indent: 1),
    _b('-  oppure  *  →  Elenco puntato', indent: 1),
    _b('1.  →  Elenco numerato', indent: 1),
    _b('[]  →  Casella da spuntare', indent: 1),
    _b('>  →  Elenco a scomparsa', indent: 1),
    _b('"  →  Citazione', indent: 1),
    _b('```  →  Blocco di codice', indent: 1),
    _b('---  →  Divisore', indent: 1),
    _b(
      '**grassetto**, *corsivo*, ~~barrato~~, `codice` dentro il testo',
      indent: 1,
    ),
    _h2('Sottopagine'),
    _t('Le pagine possono contenere altre pagine, all\'infinito:'),
    Block(type: BlockType.page, pageId: _gettingStartedId),
    _div(),
    _quote(
      'Le note sono salvate solo sul tuo dispositivo, '
      'in automatico, mentre scrivi.',
    ),
  ],
);

List<NotePage> welcomeChildren(String parentId) => [
  NotePage(
    id: _gettingStartedId,
    parentId: parentId,
    title: 'Lista della settimana',
    icon: '✅',
    blocks: [
      _t('Un esempio di lista di cose da fare con sotto-attività.'),
      _todo('Fare la spesa'),
      _todo('Latte', indent: 1),
      _todo('Pane', indent: 1, done: true),
      _todo('Chiamare il commercialista'),
      _todo('Preparare la presentazione'),
      _h3('Idee'),
      _b('Organizzare un weekend fuori'),
      _b('Iniziare un nuovo libro'),
    ],
  ),
];

class PageTemplate {
  const PageTemplate(this.name, this.icon, this.description, this.build);
  final String name;
  final String icon;
  final String description;
  final NotePage Function() build;
}

String _today() {
  final d = DateTime.now();
  const mesi = [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre',
  ];
  return '${d.day} ${mesi[d.month - 1]} ${d.year}';
}

final templates = <PageTemplate>[
  PageTemplate('Pagina vuota', '📄', 'Inizia da zero.', NotePage.new),
  PageTemplate(
    'Lista di cose da fare',
    '✅',
    'Attività da spuntare, divise per priorità.',
    () => NotePage(
      title: 'Cose da fare',
      icon: '✅',
      blocks: [
        _h2('Oggi'),
        _todo(''),
        _h2('Questa settimana'),
        _todo(''),
        _h2('Più avanti'),
        _todo(''),
      ],
    ),
  ),
  PageTemplate(
    'Note riunione',
    '🗓️',
    'Partecipanti, ordine del giorno e azioni.',
    () => NotePage(
      title: 'Riunione del ${_today()}',
      icon: '🗓️',
      cover: 3,
      blocks: [
        _callout('Data: ${_today()}', '📅'),
        _h2('Partecipanti'),
        _b(''),
        _h2('Ordine del giorno'),
        _n(''),
        _h2('Note'),
        _t(''),
        _h2('Azioni'),
        _todo(''),
      ],
    ),
  ),
  PageTemplate(
    'Diario',
    '📔',
    'Una pagina per la giornata di oggi.',
    () => NotePage(
      title: _today(),
      icon: '📔',
      cover: 5,
      blocks: [
        _h3('Come mi sento'),
        _t(''),
        _h3('Cosa è successo oggi'),
        _t(''),
        _h3('Tre cose per cui sono grato'),
        _n(''),
        _n(''),
        _n(''),
      ],
    ),
  ),
  PageTemplate(
    'Progetto',
    '🚀',
    'Obiettivi, fasi e risorse di un progetto.',
    () => NotePage(
      title: 'Nuovo progetto',
      icon: '🚀',
      cover: 1,
      blocks: [
        _callout(
          'Descrivi in una frase lo scopo del progetto.',
          '🎯',
          BlockColor.purple,
        ),
        _h2('Obiettivi'),
        _b(''),
        _h2('Fasi'),
        _toggle('Fase 1 — Analisi', collapsed: false),
        _todo('', indent: 1),
        _toggle('Fase 2 — Sviluppo', collapsed: false),
        _todo('', indent: 1),
        _toggle('Fase 3 — Rilascio', collapsed: false),
        _todo('', indent: 1),
        _h2('Risorse'),
        _b(''),
      ],
    ),
  ),
  PageTemplate(
    'Ricetta',
    '🍝',
    'Ingredienti e procedimento.',
    () => NotePage(
      title: 'Nuova ricetta',
      icon: '🍝',
      cover: 2,
      blocks: [
        _callout('Porzioni: 4 · Tempo: 30 min', '⏱️', BlockColor.orange),
        _h2('Ingredienti'),
        _todo(''),
        _h2('Procedimento'),
        _n(''),
        _h2('Note'),
        _t(''),
      ],
    ),
  ),
  PageTemplate(
    'Lettura',
    '📚',
    'Appunti e citazioni da un libro.',
    () => NotePage(
      title: 'Titolo del libro',
      icon: '📚',
      cover: 4,
      blocks: [
        _b('Autore: '),
        _b('Iniziato il: ${_today()}'),
        _h2('Riassunto'),
        _t(''),
        _h2('Citazioni preferite'),
        _quote(''),
        _h2('Cosa ho imparato'),
        _b(''),
      ],
    ),
  ),
];
