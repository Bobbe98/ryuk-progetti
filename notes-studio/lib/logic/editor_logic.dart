import '../models/block.dart';
import '../models/note_page.dart';

// ---------------------------------------------------------------------------
// Scorciatoie Markdown (come in Notion: "# " diventa Titolo 1, "- " elenco...)
// ---------------------------------------------------------------------------

class Shortcut {
  const Shortcut(this.type, this.rest, {this.checked = false});
  final BlockType type;
  final String rest;
  final bool checked;
}

const _prefixes = <String, BlockType>{
  '# ': BlockType.h1,
  '## ': BlockType.h2,
  '### ': BlockType.h3,
  '- ': BlockType.bullet,
  '* ': BlockType.bullet,
  '+ ': BlockType.bullet,
  '[] ': BlockType.todo,
  '[ ] ': BlockType.todo,
  '[x] ': BlockType.todo,
  '> ': BlockType.toggle,
  '" ': BlockType.quote,
  '| ': BlockType.quote,
  '! ': BlockType.callout,
};

final _numbered = RegExp(r'^\d+[.)] ');

/// Riconosce una scorciatoia digitata all'inizio di un blocco di testo.
Shortcut? detectShortcut(String text) {
  if (text == '---' || text == '***' || text == '___') {
    return const Shortcut(BlockType.divider, '');
  }
  if (text.startsWith('```')) {
    return Shortcut(BlockType.code, text.substring(3));
  }
  final m = _numbered.firstMatch(text);
  if (m != null) return Shortcut(BlockType.numbered, text.substring(m.end));
  // I prefissi più lunghi vanno controllati prima ("### " prima di "# ").
  final keys = _prefixes.keys.toList()..sort((a, b) => b.length - a.length);
  for (final p in keys) {
    if (text.startsWith(p)) {
      return Shortcut(
        _prefixes[p]!,
        text.substring(p.length),
        checked: p == '[x] ',
      );
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Comandi "/"
// ---------------------------------------------------------------------------

class SlashCommand {
  const SlashCommand(
    this.id,
    this.label,
    this.description,
    this.icon, {
    this.type,
    this.keywords = const [],
  });
  final String id;
  final String label;
  final String description;
  final String icon;

  /// Tipo di blocco in cui trasformare (null = azione speciale).
  final BlockType? type;
  final List<String> keywords;
}

const slashCommands = <SlashCommand>[
  SlashCommand(
    'text',
    'Testo',
    'Inizia a scrivere testo semplice.',
    'Aa',
    type: BlockType.text,
    keywords: ['text', 'paragrafo', 'plain'],
  ),
  SlashCommand(
    'page',
    'Pagina',
    'Incorpora una sottopagina.',
    '📄',
    type: BlockType.page,
    keywords: ['page', 'sottopagina', 'subpage'],
  ),
  SlashCommand(
    'todo',
    'Lista di cose da fare',
    'Tieni traccia delle attività.',
    '☑️',
    type: BlockType.todo,
    keywords: ['todo', 'checkbox', 'attività', 'task'],
  ),
  SlashCommand(
    'h1',
    'Titolo 1',
    'Intestazione di sezione grande.',
    'H1',
    type: BlockType.h1,
    keywords: ['heading', 'h1', 'intestazione'],
  ),
  SlashCommand(
    'h2',
    'Titolo 2',
    'Intestazione di sezione media.',
    'H2',
    type: BlockType.h2,
    keywords: ['heading', 'h2', 'intestazione'],
  ),
  SlashCommand(
    'h3',
    'Titolo 3',
    'Intestazione di sezione piccola.',
    'H3',
    type: BlockType.h3,
    keywords: ['heading', 'h3', 'intestazione'],
  ),
  SlashCommand(
    'bullet',
    'Elenco puntato',
    'Crea un semplice elenco puntato.',
    '•',
    type: BlockType.bullet,
    keywords: ['bullet', 'lista', 'list', 'ul'],
  ),
  SlashCommand(
    'numbered',
    'Elenco numerato',
    'Crea un elenco numerato.',
    '1.',
    type: BlockType.numbered,
    keywords: ['numbered', 'lista', 'ol'],
  ),
  SlashCommand(
    'toggle',
    'Elenco a scomparsa',
    'Nascondi e mostra il contenuto annidato.',
    '▸',
    type: BlockType.toggle,
    keywords: ['toggle', 'collapse', 'scomparsa'],
  ),
  SlashCommand(
    'quote',
    'Citazione',
    'Riporta una citazione.',
    '❝',
    type: BlockType.quote,
    keywords: ['quote', 'citazione'],
  ),
  SlashCommand(
    'callout',
    'Callout',
    'Fai risaltare il testo.',
    '💡',
    type: BlockType.callout,
    keywords: ['callout', 'nota', 'avviso'],
  ),
  SlashCommand(
    'code',
    'Codice',
    'Scrivi un frammento di codice.',
    '</>',
    type: BlockType.code,
    keywords: ['code', 'codice', 'snippet'],
  ),
  SlashCommand(
    'divider',
    'Divisore',
    'Separa visivamente i blocchi.',
    '—',
    type: BlockType.divider,
    keywords: ['divider', 'linea', 'hr'],
  ),
  SlashCommand(
    'date',
    'Data di oggi',
    'Inserisce la data odierna.',
    '📅',
    keywords: ['date', 'data', 'oggi', 'today'],
  ),
];

String _norm(String s) => s.toLowerCase().trim();

/// Filtra i comandi in base al testo scritto dopo "/".
List<SlashCommand> filterCommands(String query) {
  final q = _norm(query);
  if (q.isEmpty) return slashCommands;
  return slashCommands
      .where(
        (c) =>
            _norm(c.label).contains(q) ||
            c.id.startsWith(q) ||
            c.keywords.any((k) => k.startsWith(q)),
      )
      .toList();
}

// ---------------------------------------------------------------------------
// Struttura dei blocchi (rientri, elenchi a scomparsa, numerazione)
// ---------------------------------------------------------------------------

/// Indici dei blocchi visibili: i figli di un toggle chiuso sono nascosti.
List<int> visibleIndices(List<Block> blocks) {
  final out = <int>[];
  int? hideAbove; // rientro del toggle chiuso che sta nascondendo
  for (var i = 0; i < blocks.length; i++) {
    final b = blocks[i];
    if (hideAbove != null) {
      if (b.indent > hideAbove) continue;
      hideAbove = null;
    }
    out.add(i);
    if (b.type == BlockType.toggle && b.collapsed) hideAbove = b.indent;
  }
  return out;
}

/// Numero da mostrare per un blocco di elenco numerato.
int numberFor(List<Block> blocks, int index) {
  final indent = blocks[index].indent;
  var n = 1;
  for (var i = index - 1; i >= 0; i--) {
    final b = blocks[i];
    if (b.indent > indent) continue; // figli di una voce precedente
    if (b.indent < indent) break;
    if (b.type != BlockType.numbered) break;
    n++;
  }
  return n;
}

/// Ultimo indice (escluso) del gruppo formato dal blocco e dai suoi figli.
int groupEnd(List<Block> blocks, int index) {
  final indent = blocks[index].indent;
  var end = index + 1;
  while (end < blocks.length && blocks[end].indent > indent) {
    end++;
  }
  return end;
}

/// Sposta il blocco [from] (insieme ai figli) prima del blocco [before]
/// (o in fondo se [before] è null). Restituisce false se non si muove.
bool moveGroup(List<Block> blocks, int from, int? before) {
  final end = groupEnd(blocks, from);
  if (before != null && before >= from && before <= end) return false;
  final group = blocks.sublist(from, end);
  final target = before == null ? null : blocks[before];
  blocks.removeRange(from, end);
  final at = target == null ? blocks.length : blocks.indexOf(target);
  blocks.insertAll(at, group);
  return true;
}

/// Sposta il gruppo di un blocco su o giù di una posizione tra i fratelli.
bool moveUpDown(List<Block> blocks, int index, {required bool up}) {
  final indent = blocks[index].indent;
  if (up) {
    for (var i = index - 1; i >= 0; i--) {
      if (blocks[i].indent < indent) return false;
      if (blocks[i].indent == indent) return moveGroup(blocks, index, i);
    }
    return false;
  }
  final end = groupEnd(blocks, index);
  if (end >= blocks.length || blocks[end].indent < indent) return false;
  final afterNext = groupEnd(blocks, end);
  return moveGroup(
    blocks,
    index,
    afterNext >= blocks.length ? null : afterNext,
  );
}

/// Il rientro massimo consentito per il blocco [index] (uno più del precedente).
int maxIndentFor(List<Block> blocks, int index) {
  if (index == 0) return 0;
  final prev = blocks[index - 1].indent + 1;
  return prev > Block.maxIndent ? Block.maxIndent : prev;
}

// ---------------------------------------------------------------------------
// Formattazione in linea (**grassetto**, *corsivo*, ~~barrato~~, `codice`)
// ---------------------------------------------------------------------------

class InlineSegment {
  const InlineSegment(
    this.text, {
    this.bold = false,
    this.italic = false,
    this.strike = false,
    this.code = false,
    this.marker = false,
  });
  final String text;
  final bool bold;
  final bool italic;
  final bool strike;
  final bool code;

  /// Caratteri di marcatura (**, ~~, `), mostrati attenuati.
  final bool marker;
}

final _inline = RegExp(
  r'(\*\*([^*\n]+)\*\*)|(~~([^~\n]+)~~)|(`([^`\n]+)`)|(\*([^*\n]+)\*)|(_([^_\n]+)_)',
);

/// Divide il testo in segmenti formattati mantenendo intatta la lunghezza.
List<InlineSegment> parseInline(String text) {
  final out = <InlineSegment>[];
  var pos = 0;
  for (final m in _inline.allMatches(text)) {
    if (m.start > pos) out.add(InlineSegment(text.substring(pos, m.start)));
    late String mark;
    late String inner;
    var bold = false, italic = false, strike = false, code = false;
    if (m.group(1) != null) {
      mark = '**';
      inner = m.group(2)!;
      bold = true;
    } else if (m.group(3) != null) {
      mark = '~~';
      inner = m.group(4)!;
      strike = true;
    } else if (m.group(5) != null) {
      mark = '`';
      inner = m.group(6)!;
      code = true;
    } else if (m.group(7) != null) {
      mark = '*';
      inner = m.group(8)!;
      italic = true;
    } else {
      mark = '_';
      inner = m.group(10)!;
      italic = true;
    }
    out
      ..add(InlineSegment(mark, marker: true))
      ..add(
        InlineSegment(
          inner,
          bold: bold,
          italic: italic,
          strike: strike,
          code: code,
        ),
      )
      ..add(InlineSegment(mark, marker: true));
    pos = m.end;
  }
  if (pos < text.length) out.add(InlineSegment(text.substring(pos)));
  return out;
}

/// Racchiude la selezione [start, end) tra i marcatori [mark] (o li toglie
/// se già presenti). Restituisce il nuovo testo e la nuova selezione.
({String text, int start, int end}) toggleWrap(
  String text,
  int start,
  int end,
  String mark,
) {
  if (start > end) {
    final t = start;
    start = end;
    end = t;
  }
  final l = mark.length;
  final wrapped =
      start >= l &&
      end + l <= text.length &&
      text.substring(start - l, start) == mark &&
      text.substring(end, end + l) == mark;
  if (wrapped) {
    final t = text
        .replaceRange(end, end + l, '')
        .replaceRange(start - l, start, '');
    return (text: t, start: start - l, end: end - l);
  }
  final t = text.replaceRange(end, end, mark).replaceRange(start, start, mark);
  return (text: t, start: start + l, end: end + l);
}

// ---------------------------------------------------------------------------
// Markdown: esportazione e importazione
// ---------------------------------------------------------------------------

/// Esporta una pagina in Markdown. [titleOf] risolve il titolo delle
/// sottopagine collegate.
String pageToMarkdown(NotePage page, {String Function(String id)? titleOf}) {
  final sb = StringBuffer();
  final head = [if (page.icon.isNotEmpty) page.icon, page.displayTitle];
  sb.writeln('# ${head.join(' ')}');
  sb.writeln();
  final blocks = page.blocks;
  for (var i = 0; i < blocks.length; i++) {
    final b = blocks[i];
    final pad = '  ' * b.indent;
    switch (b.type) {
      case BlockType.text:
        sb.writeln(b.text.isEmpty ? '' : '$pad${b.text}');
      case BlockType.h1:
        sb.writeln('## ${b.text}');
      case BlockType.h2:
        sb.writeln('### ${b.text}');
      case BlockType.h3:
        sb.writeln('#### ${b.text}');
      case BlockType.bullet:
        sb.writeln('$pad- ${b.text}');
      case BlockType.numbered:
        sb.writeln('$pad${numberFor(blocks, i)}. ${b.text}');
      case BlockType.todo:
        sb.writeln('$pad- [${b.checked ? 'x' : ' '}] ${b.text}');
      case BlockType.toggle:
        sb.writeln('$pad- ▸ ${b.text}');
      case BlockType.quote:
        sb.writeln('$pad> ${b.text}');
      case BlockType.callout:
        sb.writeln('$pad> ${b.emoji ?? '💡'} ${b.text}');
      case BlockType.code:
        sb
          ..writeln('```')
          ..writeln(b.text)
          ..writeln('```');
      case BlockType.divider:
        sb.writeln('---');
      case BlockType.page:
        final t = b.pageId == null
            ? 'Pagina'
            : (titleOf?.call(b.pageId!) ?? 'Pagina');
        sb.writeln('$pad📄 $t');
    }
  }
  return sb.toString();
}

/// Converte del testo Markdown (es. incollato) in blocchi.
List<Block> markdownToBlocks(String md) {
  final out = <Block>[];
  final lines = md.replaceAll('\r\n', '\n').split('\n');
  StringBuffer? code;
  for (final raw in lines) {
    if (code != null) {
      if (raw.trimLeft().startsWith('```')) {
        out.add(Block(type: BlockType.code, text: code.toString().trimRight()));
        code = null;
      } else {
        code.writeln(raw);
      }
      continue;
    }
    if (raw.trimLeft().startsWith('```')) {
      code = StringBuffer();
      continue;
    }
    final stripped = raw.trimLeft();
    final indent = ((raw.length - stripped.length) ~/ 2).clamp(
      0,
      Block.maxIndent,
    );
    var line = stripped;
    // "- [ ] " nello stile GitHub
    final gh = RegExp(r'^[-*+] \[( |x|X)\] ').firstMatch(line);
    if (gh != null) {
      out.add(
        Block(
          type: BlockType.todo,
          text: line.substring(gh.end),
          checked: gh.group(1)!.toLowerCase() == 'x',
          indent: indent,
        ),
      );
      continue;
    }
    if (line.startsWith('#### ')) line = '### ${line.substring(5)}';
    if (line.startsWith('> ')) line = '" ${line.substring(2)}';
    final s = detectShortcut(line);
    if (s == null) {
      out.add(Block(text: line, indent: line.isEmpty ? 0 : indent));
    } else {
      out.add(
        Block(
          type: s.type,
          text: s.rest,
          checked: s.checked,
          indent: s.type.isHeading ? 0 : indent,
        ),
      );
    }
  }
  if (code != null) {
    out.add(Block(type: BlockType.code, text: code.toString().trimRight()));
  }
  return out;
}

/// Conta le parole di una pagina.
int wordCount(NotePage page) {
  final words = RegExp(r'\S+');
  var n = words.allMatches(page.title).length;
  for (final b in page.blocks) {
    n += words.allMatches(b.text).length;
  }
  return n;
}

/// Corregge i rientri dopo uno spostamento: il primo blocco sta a 0 e ogni
/// blocco può rientrare al massimo di uno rispetto al precedente.
void normalizeIndents(List<Block> blocks) {
  for (var i = 0; i < blocks.length; i++) {
    final max = maxIndentFor(blocks, i);
    if (blocks[i].indent > max) blocks[i].indent = max;
    if (blocks[i].indent < 0) blocks[i].indent = 0;
  }
}
