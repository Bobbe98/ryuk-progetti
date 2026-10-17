import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:notes_studio/models/block.dart';
import 'package:notes_studio/state/workspace.dart';
import 'package:notes_studio/theme.dart';
import 'package:notes_studio/widgets/page_editor.dart';

Future<(Workspace, String)> _pump(WidgetTester tester) async {
  final ws = Workspace(MemoryStore());
  await ws.load();
  final page = ws.createPage(title: 'Test');
  await tester.pumpWidget(
    ChangeNotifierProvider.value(
      value: ws,
      child: MaterialApp(
        theme: buildTheme(Brightness.light),
        home: Scaffold(
          body: PageEditor(pageId: page.id, onOpenPage: (_) {}),
        ),
      ),
    ),
  );
  await tester.pump();
  return (ws, page.id);
}

void editorTest(
  String name,
  Future<void> Function(WidgetTester tester, Workspace ws, String id) body,
) {
  testWidgets(name, (tester) async {
    final (ws, id) = await _pump(tester);
    await body(tester, ws, id);
    // Lascia scadere il salvataggio ritardato prima della fine del test.
    await tester.pump(const Duration(seconds: 1));
  });
}

/// Il primo TextField è il titolo, i successivi sono i blocchi.
Finder _block(int i) => find.byType(TextField).at(i + 1);

void main() {
  editorTest('"# " trasforma il blocco in titolo', (tester, ws, id) async {
    await tester.enterText(_block(0), '# ');
    await tester.pump();
    expect(ws.page(id)!.blocks.first.type, BlockType.h1);
    expect(find.text('Titolo 1'), findsOneWidget);
  });

  editorTest('Invio divide il blocco e continua gli elenchi', (
    tester,
    ws,
    id,
  ) async {
    await tester.enterText(_block(0), '- ');
    await tester.pump();
    await tester.enterText(_block(0), 'uno\ndue');
    await tester.pumpAndSettle();
    final blocks = ws.page(id)!.blocks;
    expect(blocks.map((b) => b.text), ['uno', 'due']);
    expect(blocks.every((b) => b.type == BlockType.bullet), isTrue);
  });

  editorTest('Invio su elenco vuoto torna a testo', (tester, ws, id) async {
    await tester.enterText(_block(0), '[] ');
    await tester.pump();
    expect(ws.page(id)!.blocks.first.type, BlockType.todo);
    await tester.enterText(_block(0), '\n');
    await tester.pump();
    expect(ws.page(id)!.blocks.single.type, BlockType.text);
  });

  editorTest('il menu "/" trasforma il blocco', (tester, ws, id) async {
    await tester.showKeyboard(_block(0));
    await tester.enterText(_block(0), '/cita');
    await tester.pump();
    expect(find.text('Citazione'), findsWidgets);
    await tester.tap(find.text('Citazione').last);
    await tester.pumpAndSettle();
    final b = ws.page(id)!.blocks.first;
    expect(b.type, BlockType.quote);
    expect(b.text, isEmpty);
  });

  editorTest('incollare più righe crea più blocchi', (tester, ws, id) async {
    await tester.enterText(_block(0), 'titolo\n## Sezione\n- a\n- b');
    await tester.pumpAndSettle();
    final types = ws.page(id)!.blocks.map((b) => b.type).toList();
    expect(types, [
      BlockType.text,
      BlockType.h2,
      BlockType.bullet,
      BlockType.bullet,
    ]);
  });
}
