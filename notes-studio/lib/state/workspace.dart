import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/block.dart';
import '../models/note_page.dart';
import 'templates.dart';

/// Dove viene salvato lo spazio di lavoro (sostituibile nei test).
abstract class WorkspaceStore {
  Future<String?> load();
  Future<void> save(String data);
}

class PrefsStore implements WorkspaceStore {
  static const _key = 'workspace_v1';

  @override
  Future<String?> load() async =>
      (await SharedPreferences.getInstance()).getString(_key);

  @override
  Future<void> save(String data) async =>
      (await SharedPreferences.getInstance()).setString(_key, data);
}

class MemoryStore implements WorkspaceStore {
  String? data;

  @override
  Future<String?> load() async => data;

  @override
  Future<void> save(String data) async => this.data = data;
}

class SearchHit {
  const SearchHit(this.page, this.snippet);
  final NotePage page;
  final String? snippet;
}

class Workspace extends ChangeNotifier {
  Workspace(this._store);

  final WorkspaceStore _store;
  final Map<String, NotePage> _pages = {};
  Timer? _saveTimer;

  String name = 'Il mio spazio';
  ThemeMode themeMode = ThemeMode.system;
  String? currentPageId;

  bool loaded = false;

  // ------------------------------------------------------------ persistenza

  Future<void> load() async {
    final raw = await _store.load();
    if (raw != null) {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      name = j['name'] as String? ?? name;
      themeMode = ThemeMode.values.asNameMap()[j['theme']] ?? ThemeMode.system;
      currentPageId = j['current'] as String?;
      for (final p in (j['pages'] as List? ?? [])) {
        final page = NotePage.fromJson(Map<String, dynamic>.from(p as Map));
        _pages[page.id] = page;
      }
    } else {
      final welcome = welcomePage();
      _pages[welcome.id] = welcome;
      for (final child in welcomeChildren(welcome.id)) {
        _pages[child.id] = child;
      }
      currentPageId = welcome.id;
      scheduleSave();
    }
    if (currentPageId != null && page(currentPageId!)?.trashed != false) {
      currentPageId = rootPages.firstOrNull?.id;
    }
    loaded = true;
    notifyListeners();
  }

  String encode() => jsonEncode({
    'name': name,
    'theme': themeMode.name,
    if (currentPageId != null) 'current': currentPageId,
    'pages': _pages.values.map((p) => p.toJson()).toList(),
  });

  void scheduleSave() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 400), flush);
  }

  Future<void> flush() async {
    _saveTimer?.cancel();
    _saveTimer = null;
    await _store.save(encode());
  }

  /// Da chiamare dopo aver modificato direttamente una pagina.
  void touch(NotePage page) {
    page.updatedAt = DateTime.now().millisecondsSinceEpoch;
    scheduleSave();
    notifyListeners();
  }

  void _changed() {
    scheduleSave();
    notifyListeners();
  }

  // ---------------------------------------------------------------- lettura

  NotePage? page(String id) => _pages[id];

  Iterable<NotePage> get allPages => _pages.values;

  List<NotePage> _sorted(Iterable<NotePage> it) =>
      it.toList()..sort((a, b) => a.createdAt.compareTo(b.createdAt));

  List<NotePage> childrenOf(String? parentId) =>
      _sorted(_pages.values.where((p) => p.parentId == parentId && !p.trashed));

  List<NotePage> get rootPages => childrenOf(null);

  List<NotePage> get favorites =>
      _sorted(_pages.values.where((p) => p.favorite && !p.trashed));

  /// Pagine nel cestino (solo le "radici" eliminate, non i loro figli).
  List<NotePage> get trash =>
      _pages.values
          .where(
            (p) =>
                p.trashed &&
                (p.parentId == null || _pages[p.parentId]?.trashed != true),
          )
          .toList()
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

  List<NotePage> recent({int limit = 6}) =>
      (_pages.values.where((p) => !p.trashed).toList()
            ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt)))
          .take(limit)
          .toList();

  /// Percorso dalla radice alla pagina (inclusa).
  List<NotePage> breadcrumb(String id) {
    final out = <NotePage>[];
    var cur = _pages[id];
    final seen = <String>{};
    while (cur != null && seen.add(cur.id)) {
      out.insert(0, cur);
      cur = cur.parentId == null ? null : _pages[cur.parentId];
    }
    return out;
  }

  List<String> descendants(String id) {
    final out = <String>[];
    final stack = [id];
    while (stack.isNotEmpty) {
      final cur = stack.removeLast();
      for (final p in _pages.values.where((p) => p.parentId == cur)) {
        out.add(p.id);
        stack.add(p.id);
      }
    }
    return out;
  }

  List<SearchHit> search(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return recent().map((p) => SearchHit(p, null)).toList();
    final hits = <SearchHit>[];
    for (final p in _pages.values.where((p) => !p.trashed)) {
      if (p.title.toLowerCase().contains(q)) {
        hits.add(SearchHit(p, null));
        continue;
      }
      for (final b in p.blocks) {
        final i = b.text.toLowerCase().indexOf(q);
        if (i >= 0) {
          final start = (i - 30).clamp(0, b.text.length);
          final end = (i + q.length + 50).clamp(0, b.text.length);
          hits.add(
            SearchHit(
              p,
              '${start > 0 ? '…' : ''}${b.text.substring(start, end)}${end < b.text.length ? '…' : ''}',
            ),
          );
          break;
        }
      }
    }
    hits.sort((a, b) {
      if ((a.snippet == null) != (b.snippet == null)) {
        return a.snippet == null ? -1 : 1;
      }
      return b.page.updatedAt.compareTo(a.page.updatedAt);
    });
    return hits;
  }

  // ------------------------------------------------------------- modifiche

  NotePage createPage({
    String? parentId,
    String title = '',
    String icon = '',
    List<Block>? blocks,
    int? cover,
  }) {
    final p = NotePage(
      parentId: parentId,
      title: title,
      icon: icon,
      blocks: blocks,
      cover: cover,
    );
    _pages[p.id] = p;
    _changed();
    return p;
  }

  /// Aggiunge una pagina già costruita (es. da un modello).
  NotePage insertPage(NotePage p, {String? parentId}) {
    p.parentId = parentId;
    _pages[p.id] = p;
    if (parentId != null) {
      _pages[parentId]?.blocks.add(Block(type: BlockType.page, pageId: p.id));
    }
    _changed();
    return p;
  }

  void open(String? id) {
    if (currentPageId == id) return;
    currentPageId = id;
    _changed();
  }

  void setFavorite(String id, bool value) {
    final p = _pages[id];
    if (p == null) return;
    p.favorite = value;
    _changed();
  }

  void setTheme(ThemeMode mode) {
    themeMode = mode;
    _changed();
  }

  void rename(String newName) {
    name = newName.trim().isEmpty ? 'Il mio spazio' : newName.trim();
    _changed();
  }

  /// Sposta la pagina e tutte le sottopagine nel cestino.
  void moveToTrash(String id) {
    final p = _pages[id];
    if (p == null) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    for (final pid in [id, ...descendants(id)]) {
      _pages[pid]!
        ..trashed = true
        ..updatedAt = now;
    }
    if (currentPageId != null && (_pages[currentPageId!]?.trashed ?? true)) {
      currentPageId = p.parentId != null && _pages[p.parentId]?.trashed == false
          ? p.parentId
          : rootPages.firstOrNull?.id;
    }
    _changed();
  }

  void restore(String id) {
    final p = _pages[id];
    if (p == null) return;
    for (final pid in [id, ...descendants(id)]) {
      _pages[pid]!.trashed = false;
    }
    // Se la pagina madre non esiste più o è nel cestino torna alla radice.
    if (p.parentId != null && _pages[p.parentId]?.trashed != false) {
      p.parentId = null;
    }
    _changed();
  }

  void deleteForever(String id) {
    final ids = {id, ...descendants(id)};
    ids.forEach(_pages.remove);
    for (final p in _pages.values) {
      p.blocks.removeWhere(
        (b) => b.type == BlockType.page && ids.contains(b.pageId),
      );
      if (p.blocks.isEmpty) p.blocks.add(Block());
    }
    if (ids.contains(currentPageId)) currentPageId = rootPages.firstOrNull?.id;
    _changed();
  }

  void emptyTrash() {
    for (final p in trash) {
      deleteForever(p.id);
    }
  }

  /// Duplica una pagina (con le sottopagine) accanto all'originale.
  NotePage duplicate(String id, {String? parentId, bool rename = true}) {
    final src = _pages[id]!;
    final copy = NotePage(
      parentId: parentId ?? src.parentId,
      title: rename ? '${src.title} (copia)'.trim() : src.title,
      icon: src.icon,
      cover: src.cover,
      fullWidth: src.fullWidth,
      blocks: [],
    );
    _pages[copy.id] = copy;
    for (final b in src.blocks) {
      final nb = b.copy();
      if (b.type == BlockType.page && b.pageId != null) {
        final child = _pages[b.pageId!];
        if (child != null && !child.trashed) {
          nb.pageId = duplicate(child.id, parentId: copy.id, rename: false).id;
        } else {
          continue;
        }
      }
      copy.blocks.add(nb);
    }
    if (copy.blocks.isEmpty) copy.blocks.add(Block());
    _changed();
    return copy;
  }

  /// Sposta una pagina sotto un'altra (o alla radice con null).
  bool movePage(String id, String? newParentId) {
    if (newParentId == id || descendants(id).contains(newParentId)) {
      return false;
    }
    final p = _pages[id];
    if (p == null) return false;
    final old = p.parentId;
    if (old != null) {
      _pages[old]?.blocks.removeWhere(
        (b) => b.type == BlockType.page && b.pageId == id,
      );
      if (_pages[old]?.blocks.isEmpty ?? false) {
        _pages[old]!.blocks.add(Block());
      }
    }
    p.parentId = newParentId;
    if (newParentId != null) {
      _pages[newParentId]?.blocks.add(Block(type: BlockType.page, pageId: id));
    }
    _changed();
    return true;
  }

  /// Crea una sottopagina e aggiunge il collegamento nella pagina madre.
  NotePage addSubpage(String parentId, {int? atIndex}) {
    final child = createPage(parentId: parentId);
    final parent = _pages[parentId]!;
    final link = Block(type: BlockType.page, pageId: child.id);
    if (atIndex == null) {
      final last = parent.blocks.lastOrNull;
      if (last != null &&
          last.type == BlockType.text &&
          last.text.isEmpty &&
          parent.blocks.length == 1) {
        parent.blocks[0] = link;
      } else {
        parent.blocks.add(link);
      }
    } else {
      parent.blocks.insert(atIndex, link);
    }
    touch(parent);
    return child;
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    super.dispose();
  }
}
