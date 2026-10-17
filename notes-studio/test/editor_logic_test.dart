import 'package:flutter_test/flutter_test.dart';
import 'package:notes_studio/logic/editor_logic.dart';
import 'package:notes_studio/models/block.dart';
import 'package:notes_studio/models/note_page.dart';

Block b(BlockType t, [int indent = 0, String text = '']) =>
    Block(type: t, indent: indent, text: text);

void main() {
  group('scorciatoie Markdown', () {
    test('riconosce i prefissi', () {
      expect(detectShortcut('# ')!.type, BlockType.h1);
      expect(detectShortcut('## ciao')!.type, BlockType.h2);
      expect(detectShortcut('## ciao')!.rest, 'ciao');
      expect(detectShortcut('### ')!.type, BlockType.h3);
      expect(detectShortcut('- ')!.type, BlockType.bullet);
      expect(detectShortcut('* ')!.type, BlockType.bullet);
      expect(detectShortcut('1. ')!.type, BlockType.numbered);
      expect(detectShortcut('12) x')!.rest, 'x');
      expect(detectShortcut('[] ')!.type, BlockType.todo);
      expect(detectShortcut('[x] fatto')!.checked, isTrue);
      expect(detectShortcut('> ')!.type, BlockType.toggle);
      expect(detectShortcut('" ')!.type, BlockType.quote);
      expect(detectShortcut('---')!.type, BlockType.divider);
      expect(detectShortcut('```')!.type, BlockType.code);
    });

    test('ignora il testo normale', () {
      expect(detectShortcut('ciao'), isNull);
      expect(detectShortcut('#hashtag'), isNull);
      expect(detectShortcut('-trattino'), isNull);
      expect(detectShortcut('--'), isNull);
    });
  });

  test('filtro comandi "/"', () {
    expect(filterCommands('').length, slashCommands.length);
    expect(filterCommands('tit').map((c) => c.id), ['h1', 'h2', 'h3']);
    expect(filterCommands('todo').first.id, 'todo');
    expect(filterCommands('h2').single.id, 'h2');
    expect(filterCommands('zzzz'), isEmpty);
  });

  test('i toggle chiusi nascondono i figli', () {
    final blocks = [
      b(BlockType.toggle)..collapsed = true,
      b(BlockType.text, 1),
      b(BlockType.text, 2),
      b(BlockType.text, 0),
      b(BlockType.toggle),
      b(BlockType.text, 1),
    ];
    expect(visibleIndices(blocks), [0, 3, 4, 5]);
  });

  test('numerazione degli elenchi', () {
    final blocks = [
      b(BlockType.numbered),
      b(BlockType.numbered),
      b(BlockType.numbered, 1),
      b(BlockType.numbered, 1),
      b(BlockType.numbered),
      b(BlockType.text),
      b(BlockType.numbered),
    ];
    expect(
      [
        for (var i = 0; i < blocks.length; i++)
          if (blocks[i].type == BlockType.numbered) numberFor(blocks, i),
      ],
      [1, 2, 1, 2, 3, 1],
    );
  });

  group('spostamento dei blocchi', () {
    test('sposta il gruppo con i figli', () {
      final a = b(BlockType.text, 0, 'a'),
          a1 = b(BlockType.text, 1, 'a1'),
          c = b(BlockType.text, 0, 'c');
      final blocks = [a, a1, c];
      expect(moveGroup(blocks, 0, null), isTrue);
      expect(blocks.map((x) => x.text), ['c', 'a', 'a1']);
    });

    test('non sposta dentro sé stesso', () {
      final blocks = [b(BlockType.text, 0), b(BlockType.text, 1)];
      expect(moveGroup(blocks, 0, 1), isFalse);
    });

    test('su e giù tra fratelli', () {
      final x = b(BlockType.text, 0, 'x'),
          x1 = b(BlockType.text, 1, 'x1'),
          y = b(BlockType.text, 0, 'y');
      final blocks = [x, x1, y];
      expect(moveUpDown(blocks, 2, up: true), isTrue);
      expect(blocks.map((e) => e.text), ['y', 'x', 'x1']);
      expect(moveUpDown(blocks, 1, up: false), isFalse);
      expect(moveUpDown(blocks, 0, up: false), isTrue);
      expect(blocks.map((e) => e.text), ['x', 'x1', 'y']);
    });

    test('normalizza i rientri', () {
      final blocks = [b(BlockType.text, 2), b(BlockType.text, 3)];
      normalizeIndents(blocks);
      expect(blocks.map((e) => e.indent), [0, 1]);
    });
  });

  group('formattazione in linea', () {
    test('analizza grassetto, corsivo, barrato e codice', () {
      final segs = parseInline('a **b** *c* ~~d~~ `e`');
      expect(segs.map((s) => s.text).join(), 'a **b** *c* ~~d~~ `e`');
      expect(segs.firstWhere((s) => s.text == 'b').bold, isTrue);
      expect(segs.firstWhere((s) => s.text == 'c').italic, isTrue);
      expect(segs.firstWhere((s) => s.text == 'd').strike, isTrue);
      expect(segs.firstWhere((s) => s.text == 'e').code, isTrue);
    });

    test('aggiunge e toglie i marcatori', () {
      final on = toggleWrap('ciao mondo', 5, 10, '**');
      expect(on.text, 'ciao **mondo**');
      expect((on.start, on.end), (7, 12));
      final off = toggleWrap(on.text, on.start, on.end, '**');
      expect(off.text, 'ciao mondo');
    });
  });

  test('esporta e importa Markdown', () {
    final page = NotePage(
      title: 'Prova',
      icon: '🚀',
      blocks: [
        b(BlockType.h1, 0, 'Sezione'),
        b(BlockType.bullet, 0, 'uno'),
        b(BlockType.bullet, 1, 'due'),
        b(BlockType.numbered, 0, 'a'),
        b(BlockType.numbered, 0, 'b'),
        Block(type: BlockType.todo, text: 'fatto', checked: true),
        b(BlockType.divider),
        b(BlockType.code, 0, 'print(1)'),
      ],
    );
    final md = pageToMarkdown(page);
    expect(md, contains('# 🚀 Prova'));
    expect(md, contains('## Sezione'));
    expect(md, contains('  - due'));
    expect(md, contains('2. b'));
    expect(md, contains('- [x] fatto'));
    expect(md, contains('```\nprint(1)\n```'));

    final blocks = markdownToBlocks(
      '# T\n- a\n  - b\n- [ ] c\n> q\n```\nx\ny\n```',
    );
    expect(blocks.map((x) => x.type), [
      BlockType.h1,
      BlockType.bullet,
      BlockType.bullet,
      BlockType.todo,
      BlockType.quote,
      BlockType.code,
    ]);
    expect(blocks[2].indent, 1);
    expect(blocks.last.text, 'x\ny');
  });

  test('il JSON di una pagina fa andata e ritorno', () {
    final p = NotePage(
      title: 'X',
      icon: '📄',
      cover: 2,
      favorite: true,
      blocks: [
        Block(
          type: BlockType.callout,
          text: 'hi',
          emoji: '🔥',
          color: BlockColor.red,
          indent: 1,
        ),
      ],
    );
    final q = NotePage.fromJson(p.toJson());
    expect(q.id, p.id);
    expect(q.title, 'X');
    expect(q.cover, 2);
    expect(q.favorite, isTrue);
    expect(q.blocks.single.emoji, '🔥');
    expect(q.blocks.single.color, BlockColor.red);
    expect(q.blocks.single.indent, 1);
  });
}
