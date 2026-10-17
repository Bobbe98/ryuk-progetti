import 'package:flutter_test/flutter_test.dart';
import 'package:notes_studio/models/block.dart';
import 'package:notes_studio/state/workspace.dart';

void main() {
  late MemoryStore store;
  late Workspace ws;

  setUp(() async {
    store = MemoryStore();
    ws = Workspace(store);
    await ws.load();
  });

  test('al primo avvio crea la pagina di benvenuto', () {
    expect(ws.rootPages, hasLength(1));
    expect(ws.rootPages.single.title, contains('Benvenuto'));
    expect(ws.childrenOf(ws.rootPages.single.id), hasLength(1));
    expect(ws.currentPageId, ws.rootPages.single.id);
  });

  test('salva e ricarica', () async {
    final p = ws.createPage(title: 'Note');
    p.blocks.first.text = 'ciao';
    await ws.flush();
    final again = Workspace(store);
    await again.load();
    expect(again.page(p.id)!.blocks.first.text, 'ciao');
  });

  test('sottopagine, cestino e ripristino', () {
    final parent = ws.createPage(title: 'Padre');
    final child = ws.addSubpage(parent.id);
    final grandchild = ws.addSubpage(child.id);
    expect(parent.blocks.single.type, BlockType.page);
    expect(ws.descendants(parent.id), containsAll([child.id, grandchild.id]));

    ws.moveToTrash(parent.id);
    expect(ws.page(grandchild.id)!.trashed, isTrue);
    expect(ws.trash.map((p) => p.id), [parent.id]);

    ws.restore(parent.id);
    expect(ws.page(grandchild.id)!.trashed, isFalse);
    expect(ws.trash, isEmpty);
  });

  test('eliminazione definitiva rimuove i collegamenti', () {
    final parent = ws.createPage(title: 'Padre');
    final child = ws.addSubpage(parent.id);
    ws.moveToTrash(child.id);
    ws.deleteForever(child.id);
    expect(ws.page(child.id), isNull);
    expect(parent.blocks.where((b) => b.pageId == child.id), isEmpty);
    expect(parent.blocks, isNotEmpty);
  });

  test(
    'ripristinare una figlia con la madre nel cestino la porta alla radice',
    () {
      final parent = ws.createPage(title: 'Padre');
      final child = ws.addSubpage(parent.id);
      ws.moveToTrash(child.id);
      ws.moveToTrash(parent.id);
      ws.restore(child.id);
      expect(ws.page(child.id)!.parentId, isNull);
    },
  );

  test('duplica con le sottopagine', () {
    final parent = ws.createPage(title: 'Padre');
    final child = ws.addSubpage(parent.id);
    child.title = 'Figlia';
    final copy = ws.duplicate(parent.id);
    expect(copy.title, 'Padre (copia)');
    final copiedChild = ws.childrenOf(copy.id).single;
    expect(copiedChild.title, 'Figlia');
    expect(copiedChild.id, isNot(child.id));
    expect(copy.blocks.single.pageId, copiedChild.id);
  });

  test('sposta pagina senza creare cicli', () {
    final a = ws.createPage(title: 'A');
    final b = ws.addSubpage(a.id);
    expect(ws.movePage(a.id, b.id), isFalse);
    final c = ws.createPage(title: 'C');
    expect(ws.movePage(b.id, c.id), isTrue);
    expect(ws.page(b.id)!.parentId, c.id);
    expect(a.blocks.where((x) => x.pageId == b.id), isEmpty);
    expect(c.blocks.where((x) => x.pageId == b.id), hasLength(1));
    expect(ws.breadcrumb(b.id).map((p) => p.title), ['C', '']);
  });

  test('ricerca in titoli e contenuti', () {
    final p = ws.createPage(title: 'Spesa');
    p.blocks.first.text = 'Comprare il latte e il pane';
    expect(ws.search('spesa').first.page.id, p.id);
    final hit = ws.search('latte').firstWhere((h) => h.page.id == p.id);
    expect(hit.snippet, contains('latte'));
  });
}
