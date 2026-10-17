import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../logic/editor_logic.dart';
import '../models/block.dart';
import '../models/note_page.dart';
import '../state/workspace.dart';
import '../theme.dart';
import 'pickers.dart';
import 'rich_controller.dart';

/// Editor a blocchi di una pagina, in stile Notion.
class PageEditor extends StatefulWidget {
  const PageEditor({super.key, required this.pageId, required this.onOpenPage});

  final String pageId;
  final void Function(String id) onOpenPage;

  @override
  State<PageEditor> createState() => _PageEditorState();
}

class _PageEditorState extends State<PageEditor> {
  late final Workspace ws = context.read<Workspace>();
  NotePage get page => ws.page(widget.pageId)!;
  List<Block> get blocks => page.blocks;

  final _ctrls = <String, RichTextController>{};
  final _nodes = <String, FocusNode>{};
  late final TextEditingController _title = TextEditingController(
    text: page.title,
  );
  final _titleNode = FocusNode();

  String? _focusedId;
  String? _slashId;
  String _slashQuery = '';
  int _slashIndex = 0;

  @override
  void initState() {
    super.initState();
    if (blocks.isEmpty) blocks.add(Block());
    // Pagina appena creata: il cursore parte dal titolo.
    if (page.title.isEmpty &&
        blocks.length == 1 &&
        blocks.first.text.isEmpty &&
        blocks.first.type == BlockType.text) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _titleNode.requestFocus(),
      );
    }
  }

  @override
  void dispose() {
    for (final c in _ctrls.values) {
      c.dispose();
    }
    for (final n in _nodes.values) {
      n.dispose();
    }
    _title.dispose();
    _titleNode.dispose();
    super.dispose();
  }

  // ------------------------------------------------------------ utilità

  RichTextController _ctrl(Block b) =>
      _ctrls.putIfAbsent(b.id, () => RichTextController(text: b.text));

  FocusNode _node(Block b) => _nodes.putIfAbsent(b.id, () {
    final n = FocusNode(debugLabel: b.id);
    n.addListener(() {
      if (!mounted) return;
      setState(() {
        if (n.hasFocus) {
          _focusedId = b.id;
        } else if (_slashId == b.id) {
          _slashId = null;
        }
      });
    });
    return n;
  });

  bool get _editing =>
      _focusedId != null && (_nodes[_focusedId]?.hasFocus ?? false);

  Block? get _focused => _focusedId == null
      ? null
      : blocks.where((b) => b.id == _focusedId).firstOrNull;

  void _save() => ws.touch(page);

  void _setText(Block b, String text) {
    b.text = text;
    final c = _ctrls[b.id];
    if (c != null && c.text != text) c.text = text;
  }

  void _focus(Block b, {int? offset}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !b.type.hasText) return;
      final c = _ctrl(b);
      final o = (offset ?? c.text.length).clamp(0, c.text.length);
      _node(b).requestFocus();
      c.selection = TextSelection.collapsed(offset: o);
    });
  }

  void _forget(Block b) {
    final c = _ctrls.remove(b.id);
    final n = _nodes.remove(b.id);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      c?.dispose();
      n?.dispose();
    });
  }

  /// Blocco di testo visibile più vicino prima di [index].
  int? _prevTextIndex(int index) {
    final vis = visibleIndices(blocks);
    for (var k = vis.indexOf(index) - 1; k >= 0; k--) {
      if (blocks[vis[k]].type.hasText) return vis[k];
    }
    return null;
  }

  int? _nextTextIndex(int index) {
    final vis = visibleIndices(blocks);
    for (var k = vis.indexOf(index) + 1; k < vis.length; k++) {
      if (blocks[vis[k]].type.hasText) return vis[k];
    }
    return null;
  }

  // ------------------------------------------------------------ modifiche

  void _onChanged(Block b, String value) {
    // Invio: divide il blocco (nei blocchi di codice si va a capo).
    if (value.contains('\n') && b.type != BlockType.code) {
      if (_slashId == b.id) {
        _ctrl(b).text = b.text;
        _runSlash(b);
        return;
      }
      _split(b, value);
      return;
    }
    b.text = value;

    // Scorciatoie Markdown all'inizio di un blocco di testo.
    if (b.type == BlockType.text) {
      final s = detectShortcut(value);
      if (s != null) {
        _setText(b, s.rest);
        b.checked = s.checked;
        _ctrl(b).selection = const TextSelection.collapsed(offset: 0);
        _applyType(b, s.type);
        return;
      }
    }

    // Menu "/".
    if (value.startsWith('/') && b.type != BlockType.code) {
      final q = value.substring(1);
      final matches = filterCommands(q);
      setState(() {
        if (matches.isEmpty && q.length > 3 || q.contains('  ')) {
          _slashId = null;
        } else {
          if (_slashId != b.id || _slashQuery != q) _slashIndex = 0;
          _slashId = b.id;
          _slashQuery = q;
        }
      });
    } else if (_slashId == b.id) {
      setState(() => _slashId = null);
    }
    ws.scheduleSave();
    page.updatedAt = DateTime.now().millisecondsSinceEpoch;
  }

  void _split(Block b, String value) {
    final index = blocks.indexOf(b);
    final lines = value.split('\n');
    final before = lines.first;

    // Invio su una voce di elenco vuota: diventa testo (o esce di un livello).
    if (lines.length == 2 &&
        before.isEmpty &&
        lines[1].isEmpty &&
        b.type != BlockType.text) {
      setState(() {
        _setText(b, '');
        if (b.indent > 0 && b.type.continuesOnEnter) {
          _shiftGroup(index, -1);
        } else {
          b.type = BlockType.text;
        }
      });
      _focus(b, offset: 0);
      _save();
      return;
    }

    _setText(b, before);
    var type = b.type.continuesOnEnter ? b.type : BlockType.text;
    var indent = b.indent;
    var at = index + 1;
    if (b.type == BlockType.toggle) {
      if (b.collapsed) {
        at = groupEnd(blocks, index);
      } else {
        indent = b.indent + 1;
      }
    }
    // Se il blocco aveva dei figli, il nuovo blocco va dopo come primo figlio
    // solo per i toggle aperti; per gli altri resta subito sotto.
    final created = <Block>[];
    final pasted = lines.length > 2;
    for (final line in lines.skip(1)) {
      if (pasted) {
        final s = detectShortcut(line);
        created.add(
          s == null
              ? Block(type: type, text: line, indent: indent)
              : Block(
                  type: s.type,
                  text: s.rest,
                  checked: s.checked,
                  indent: s.type.isHeading ? 0 : indent,
                ),
        );
      } else {
        created.add(Block(type: type, text: line, indent: indent));
      }
    }
    setState(() {
      blocks.insertAll(at, created);
      _slashId = null;
    });
    _focus(created.last, offset: pasted ? null : 0);
    _save();
  }

  /// Trasforma un blocco in un altro tipo.
  void _applyType(Block b, BlockType type) {
    final index = blocks.indexOf(b);
    if (type == BlockType.page) {
      final child = ws.createPage(parentId: page.id, title: b.text);
      setState(() {
        if (b.text.isEmpty) {
          b
            ..type = BlockType.page
            ..pageId = child.id;
          _forget(b);
        } else {
          blocks.insert(
            index + 1,
            Block(type: BlockType.page, pageId: child.id),
          );
          _setText(b, '');
        }
      });
      _save();
      widget.onOpenPage(child.id);
      return;
    }
    setState(() {
      b.type = type;
      if (type == BlockType.callout) b.emoji ??= '💡';
      if (type.isHeading) _shiftGroup(index, -b.indent);
      if (type == BlockType.divider) {
        _setText(b, '');
        _forget(b);
        Block? next = index + 1 < blocks.length ? blocks[index + 1] : null;
        if (next == null || !next.type.hasText) {
          next = Block(indent: b.indent);
          blocks.insert(index + 1, next);
        }
        _focus(next, offset: 0);
      }
    });
    if (type.hasText) _focus(b);
    _save();
  }

  /// Sposta a destra/sinistra il blocco [index] insieme ai suoi figli.
  void _shiftGroup(int index, int delta) {
    final end = groupEnd(blocks, index);
    final b = blocks[index];
    if (delta > 0) {
      final max = maxIndentFor(blocks, index);
      delta = math.min(delta, max - b.indent);
    } else {
      delta = math.max(delta, -b.indent);
    }
    if (delta == 0) return;
    for (var i = index; i < end; i++) {
      blocks[i].indent = (blocks[i].indent + delta).clamp(0, Block.maxIndent);
    }
  }

  void _indent(Block b, int delta) {
    final index = blocks.indexOf(b);
    if (index < 0) return;
    setState(() => _shiftGroup(index, delta));
    _save();
  }

  void _move(Block b, {required bool up}) {
    final index = blocks.indexOf(b);
    if (index < 0) return;
    setState(() {
      if (moveUpDown(blocks, index, up: up)) normalizeIndents(blocks);
    });
    if (b.type.hasText) _focus(b, offset: _ctrl(b).selection.baseOffset);
    _save();
  }

  void _backspaceAtStart(Block b) {
    final index = blocks.indexOf(b);
    if (b.type != BlockType.text) {
      setState(() => b.type = BlockType.text);
      _focus(b, offset: 0);
      _save();
      return;
    }
    if (b.indent > 0) {
      _indent(b, -1);
      _focus(b, offset: 0);
      return;
    }
    if (index == 0) return;
    final prev = blocks[index - 1];
    if (prev.type == BlockType.divider) {
      setState(() => blocks.removeAt(index - 1));
      _save();
      return;
    }
    final target = _prevTextIndex(index);
    if (target == null) return;
    final t = blocks[target];
    final offset = t.text.length;
    setState(() {
      _setText(t, t.text + b.text);
      blocks.remove(b);
      _forget(b);
    });
    _focus(t, offset: offset);
    _save();
  }

  void _delete(Block b) {
    final index = blocks.indexOf(b);
    if (index < 0) return;
    final linked = b.type == BlockType.page ? b.pageId : null;
    setState(() {
      blocks.removeAt(index);
      _forget(b);
      if (blocks.isEmpty) blocks.add(Block());
      normalizeIndents(blocks);
    });
    _save();
    if (linked != null && ws.page(linked) != null) {
      ws.moveToTrash(linked);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: const Text('Sottopagina spostata nel cestino'),
            action: SnackBarAction(
              label: 'Annulla',
              onPressed: () {
                ws.restore(linked);
                final p = ws.page(linked);
                if (p != null) p.parentId = page.id;
                if (!mounted) return;
                setState(
                  () => blocks.insert(math.min(index, blocks.length), b),
                );
                _save();
              },
            ),
          ),
        );
    } else {
      final focusIdx = math.min(index, blocks.length) - 1;
      if (focusIdx >= 0 && blocks[focusIdx].type.hasText) {
        _focus(blocks[focusIdx]);
      }
    }
  }

  void _duplicate(Block b) {
    final index = blocks.indexOf(b);
    final end = groupEnd(blocks, index);
    final copies = <Block>[];
    for (final src in blocks.sublist(index, end)) {
      final c = src.copy();
      if (src.type == BlockType.page && src.pageId != null) {
        if (ws.page(src.pageId!) == null) continue;
        c.pageId = ws.duplicate(src.pageId!, parentId: page.id).id;
      }
      copies.add(c);
    }
    setState(() => blocks.insertAll(end, copies));
    _save();
  }

  void _insertBlock(int at, BlockType type, {int indent = 0}) {
    final nb = Block(type: type, indent: indent);
    if (type == BlockType.callout) nb.emoji = '💡';
    setState(() => blocks.insert(at, nb));
    if (type == BlockType.page) {
      blocks.remove(nb);
      _applyTypeAt(at, indent);
      return;
    }
    if (type == BlockType.divider) {
      final next = Block(indent: indent);
      setState(() => blocks.insert(at + 1, next));
      _focus(next);
    } else {
      _focus(nb);
    }
    _save();
  }

  void _applyTypeAt(int at, int indent) {
    final child = ws.addSubpage(page.id, atIndex: at);
    blocks[at].indent = indent;
    widget.onOpenPage(child.id);
  }

  void _addAtEnd() {
    final last = blocks.lastOrNull;
    if (last != null && last.type == BlockType.text && last.text.isEmpty) {
      _focus(last);
      return;
    }
    _insertBlock(blocks.length, BlockType.text);
  }

  void _toggleWrap(Block b, String mark) {
    final c = _ctrl(b);
    var sel = c.selection;
    if (!sel.isValid) sel = TextSelection.collapsed(offset: c.text.length);
    final r = toggleWrap(c.text, sel.start, sel.end, mark);
    b.text = r.text;
    c.value = TextEditingValue(
      text: r.text,
      selection: TextSelection(baseOffset: r.start, extentOffset: r.end),
    );
    _save();
  }

  // ------------------------------------------------------------ menu "/"

  void _runSlash(Block b, [SlashCommand? cmd]) {
    final matches = filterCommands(_slashQuery);
    cmd ??= matches.isEmpty
        ? null
        : matches[_slashIndex.clamp(0, matches.length - 1)];
    setState(() => _slashId = null);
    _setText(b, '');
    if (cmd == null) return;
    if (cmd.id == 'date') {
      final d = DateTime.now();
      final s =
          '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
      _setText(b, s);
      _focus(b);
      _save();
      return;
    }
    _applyType(b, cmd.type!);
  }

  KeyEventResult _onKey(Block b, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    final key = event.logicalKey;
    final c = _ctrl(b);
    final sel = c.selection;

    if (_slashId == b.id) {
      final n = filterCommands(_slashQuery).length;
      if (key == LogicalKeyboardKey.arrowDown && n > 0) {
        setState(() => _slashIndex = (_slashIndex + 1) % n);
        return KeyEventResult.handled;
      }
      if (key == LogicalKeyboardKey.arrowUp && n > 0) {
        setState(() => _slashIndex = (_slashIndex - 1 + n) % n);
        return KeyEventResult.handled;
      }
      if (key == LogicalKeyboardKey.escape) {
        setState(() => _slashId = null);
        return KeyEventResult.handled;
      }
    }

    final shift = HardwareKeyboard.instance.isShiftPressed;
    if (key == LogicalKeyboardKey.backspace &&
        sel.isValid &&
        sel.isCollapsed &&
        sel.baseOffset == 0) {
      _backspaceAtStart(b);
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.tab) {
      _indent(b, shift ? -1 : 1);
      _focus(b, offset: sel.baseOffset);
      return KeyEventResult.handled;
    }
    final index = blocks.indexOf(b);
    if (key == LogicalKeyboardKey.arrowUp &&
        sel.isCollapsed &&
        !c.text
            .substring(0, sel.baseOffset.clamp(0, c.text.length))
            .contains('\n')) {
      final p = _prevTextIndex(index);
      if (p != null && sel.baseOffset == 0) {
        _focus(blocks[p]);
        return KeyEventResult.handled;
      }
    }
    if (key == LogicalKeyboardKey.arrowDown &&
        sel.isCollapsed &&
        sel.baseOffset == c.text.length) {
      final nx = _nextTextIndex(index);
      if (nx != null) {
        _focus(blocks[nx], offset: 0);
        return KeyEventResult.handled;
      }
    }
    final ctrl =
        HardwareKeyboard.instance.isControlPressed ||
        HardwareKeyboard.instance.isMetaPressed;
    if (ctrl && key == LogicalKeyboardKey.keyB) {
      _toggleWrap(b, '**');
      return KeyEventResult.handled;
    }
    if (ctrl && key == LogicalKeyboardKey.keyI) {
      _toggleWrap(b, '*');
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  // ------------------------------------------------------------ fogli

  Future<void> _showBlockMenu(Block b) async {
    FocusManager.instance.primaryFocus?.unfocus();
    final c = NotionColors.of(context);
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        Widget tile(IconData icon, String label, String id, {Color? color}) =>
            ListTile(
              dense: true,
              leading: Icon(icon, color: color ?? c.secondary),
              title: Text(label, style: TextStyle(color: color ?? c.text)),
              onTap: () => Navigator.pop(ctx, id),
            );
        return SafeArea(
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (b.type == BlockType.page)
                  tile(Icons.open_in_new, 'Apri pagina', 'open'),
                tile(Icons.swap_horiz, 'Trasforma in…', 'turn'),
                if (b.type.hasText)
                  tile(Icons.palette_outlined, 'Colore…', 'color'),
                if (b.type == BlockType.callout)
                  tile(Icons.emoji_emotions_outlined, 'Cambia emoji', 'emoji'),
                tile(Icons.add, 'Aggiungi blocco sotto', 'add'),
                tile(Icons.content_copy, 'Duplica', 'dup'),
                tile(Icons.arrow_upward, 'Sposta su', 'up'),
                tile(Icons.arrow_downward, 'Sposta giù', 'down'),
                tile(Icons.format_indent_increase, 'Aumenta rientro', 'in'),
                tile(Icons.format_indent_decrease, 'Riduci rientro', 'out'),
                tile(
                  Icons.delete_outline,
                  'Elimina',
                  'del',
                  color: Colors.red.shade400,
                ),
              ],
            ),
          ),
        );
      },
    );
    if (!mounted || action == null) return;
    switch (action) {
      case 'open':
        if (b.pageId != null) widget.onOpenPage(b.pageId!);
      case 'turn':
        await _turnInto(b);
      case 'color':
        await _pickColor(b);
      case 'emoji':
        final e = await pickEmoji(context, allowRemove: false);
        if (e != null && e.isNotEmpty) {
          setState(() => b.emoji = e);
          _save();
        }
      case 'add':
        await _addBelow(b);
      case 'dup':
        _duplicate(b);
      case 'up':
        _move(b, up: true);
      case 'down':
        _move(b, up: false);
      case 'in':
        _indent(b, 1);
      case 'out':
        _indent(b, -1);
      case 'del':
        _delete(b);
    }
  }

  Future<void> _turnInto(Block b) async {
    final cmd = await pickBlockType(context, title: 'Trasforma in');
    if (cmd == null || !mounted) return;
    if (cmd.id == 'date') {
      _setText(b, '${b.text}${b.text.isEmpty ? '' : ' '}${_todayString()}');
      setState(() {});
      _save();
      return;
    }
    if (b.type == BlockType.page && cmd.type != BlockType.page) {
      return; // un collegamento a pagina non si trasforma
    }
    _applyType(b, cmd.type!);
  }

  Future<void> _addBelow(Block b) async {
    final cmd = await pickBlockType(context, title: 'Aggiungi blocco');
    if (cmd == null || !mounted) return;
    final index = blocks.indexOf(b);
    final at = groupEnd(blocks, index);
    if (cmd.id == 'date') {
      final nb = Block(text: _todayString(), indent: b.indent);
      setState(() => blocks.insert(at, nb));
      _focus(nb);
      _save();
      return;
    }
    _insertBlock(at, cmd.type!, indent: cmd.type!.isHeading ? 0 : b.indent);
  }

  String _todayString() {
    final d = DateTime.now();
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  Future<void> _pickColor(Block b) async {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final color = await showModalBottomSheet<BlockColor>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final col in BlockColor.values)
                ListTile(
                  dense: true,
                  leading: Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: b.type == BlockType.callout
                          ? blockBackground(col, dark)
                          : null,
                      border: Border.all(color: NotionColors.of(ctx).border),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'A',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color:
                            blockTextColor(col, dark) ??
                            NotionColors.of(ctx).text,
                      ),
                    ),
                  ),
                  title: Text(blockColorNames[col]!),
                  trailing: b.color == col ? const Icon(Icons.check) : null,
                  onTap: () => Navigator.pop(ctx, col),
                ),
            ],
          ),
        ),
      ),
    );
    if (color == null || !mounted) return;
    setState(() => b.color = color);
    _save();
  }

  // ------------------------------------------------------------ interfaccia

  @override
  Widget build(BuildContext context) {
    final vis = visibleIndices(blocks);
    final wide = MediaQuery.sizeOf(context).width > 700;
    final hPad = wide ? 48.0 : 12.0;
    final maxWidth = page.fullWidth ? double.infinity : 760.0;
    final slashMatches = _slashId == null
        ? const <SlashCommand>[]
        : filterCommands(_slashQuery);

    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              ReorderableListView.builder(
                buildDefaultDragHandles: false,
                padding: const EdgeInsets.only(bottom: 24),
                header: _Header(
                  page: page,
                  title: _title,
                  titleNode: _titleNode,
                  hPad: hPad,
                  maxWidth: maxWidth,
                  onTitleChanged: (v) {
                    page.title = v;
                    _save();
                  },
                  onTitleSubmitted: () {
                    final first = blocks.firstOrNull;
                    if (first != null && first.type.hasText) {
                      _focus(first, offset: 0);
                    } else {
                      _insertBlock(0, BlockType.text);
                    }
                  },
                  onChanged: () {
                    setState(() {});
                    _save();
                  },
                ),
                footer: _Centered(
                  maxWidth: maxWidth,
                  hPad: hPad,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _addAtEnd,
                    child: const SizedBox(height: 240, width: double.infinity),
                  ),
                ),
                itemCount: vis.length,
                onReorderItem: (oldIndex, newIndex) {
                  setState(() {
                    // newIndex è la posizione finale: il blocco va prima di
                    // quello che oggi occupa quella posizione (saltando sé stesso).
                    final slot = newIndex >= oldIndex ? newIndex + 1 : newIndex;
                    final before = slot < vis.length ? vis[slot] : null;
                    if (moveGroup(blocks, vis[oldIndex], before)) {
                      normalizeIndents(blocks);
                    }
                  });
                  _save();
                },
                itemBuilder: (context, k) {
                  final i = vis[k];
                  final b = blocks[i];
                  return _Centered(
                    key: ValueKey(b.id),
                    maxWidth: maxWidth,
                    hPad: hPad,
                    child: _blockRow(b, i, k),
                  );
                },
              ),
              if (slashMatches.isNotEmpty)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 8,
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        maxWidth: 420,
                        maxHeight: 300,
                      ),
                      child: Material(
                        elevation: 8,
                        borderRadius: BorderRadius.circular(8),
                        color: Theme.of(context)
                            .bottomSheetTheme
                            .backgroundColor,
                        clipBehavior: Clip.antiAlias,
                        child: ListView(
                          shrinkWrap: true,
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                              child: Text(
                                'Blocchi base',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: NotionColors.of(context).secondary,
                                ),
                              ),
                            ),
                            for (var j = 0; j < slashMatches.length; j++)
                              CommandTile(
                                command: slashMatches[j],
                                selected: j == _slashIndex,
                                onTap: () {
                                  final b =
                                      _focused ??
                                      blocks.firstWhere(
                                        (x) => x.id == _slashId,
                                      );
                                  _runSlash(b, slashMatches[j]);
                                },
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (_editing && _focused != null) _toolbar(_focused!),
      ],
    );
  }

  Widget _toolbar(Block b) {
    final c = NotionColors.of(context);
    Widget btn(IconData icon, String tip, VoidCallback onTap) => IconButton(
      icon: Icon(icon, size: 22, color: c.text),
      tooltip: tip,
      onPressed: onTap,
    );
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: c.border)),
        ),
        height: 48,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          children: [
            btn(Icons.add, 'Aggiungi blocco', () => _addBelow(b)),
            btn(Icons.swap_horiz, 'Trasforma in', () => _turnInto(b)),
            btn(Icons.format_bold, 'Grassetto', () => _toggleWrap(b, '**')),
            btn(Icons.format_italic, 'Corsivo', () => _toggleWrap(b, '*')),
            btn(
              Icons.format_strikethrough,
              'Barrato',
              () => _toggleWrap(b, '~~'),
            ),
            btn(Icons.code, 'Codice in linea', () => _toggleWrap(b, '`')),
            btn(Icons.check_box_outlined, 'Casella', () {
              if (b.type == BlockType.todo) {
                setState(() => b.checked = !b.checked);
                _save();
              } else {
                _applyType(b, BlockType.todo);
              }
            }),
            btn(Icons.format_indent_increase, 'Aumenta rientro', () {
              _indent(b, 1);
              _focus(b, offset: _ctrl(b).selection.baseOffset);
            }),
            btn(Icons.format_indent_decrease, 'Riduci rientro', () {
              _indent(b, -1);
              _focus(b, offset: _ctrl(b).selection.baseOffset);
            }),
            btn(Icons.arrow_upward, 'Sposta su', () => _move(b, up: true)),
            btn(Icons.arrow_downward, 'Sposta giù', () => _move(b, up: false)),
            btn(Icons.palette_outlined, 'Colore', () => _pickColor(b)),
            btn(Icons.delete_outline, 'Elimina blocco', () => _delete(b)),
            btn(
              Icons.keyboard_hide_outlined,
              'Chiudi tastiera',
              () => FocusManager.instance.primaryFocus?.unfocus(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _blockRow(Block b, int index, int visibleIndex) {
    final c = NotionColors.of(context);
    final focused = _focusedId == b.id && _editing;
    return Padding(
      padding: EdgeInsets.only(
        top: b.type == BlockType.h1
            ? 18
            : b.type.isHeading
            ? 12
            : 1,
        bottom: 1,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ReorderableDelayedDragStartListener(
            index: visibleIndex,
            child: InkWell(
              borderRadius: BorderRadius.circular(4),
              onTap: () => _showBlockMenu(b),
              child: SizedBox(
                width: 22,
                height: _lineHeight(b) + _vPad(b) * 2,
                child: Icon(
                  Icons.drag_indicator,
                  size: 18,
                  color: focused ? c.secondary : c.faint.withValues(alpha: 0.5),
                ),
              ),
            ),
          ),
          SizedBox(width: 24.0 * b.indent),
          Expanded(child: _blockBody(b, index)),
        ],
      ),
    );
  }

  double _fontSize(Block b) => switch (b.type) {
    BlockType.h1 => 28,
    BlockType.h2 => 22,
    BlockType.h3 => 19,
    BlockType.code => 14,
    _ => 16,
  };

  double _lineHeight(Block b) => _fontSize(b) * 1.5;

  double _vPad(Block b) =>
      b.type == BlockType.callout || b.type == BlockType.code ? 12 : 2;

  Widget _blockBody(Block b, int index) {
    final c = NotionColors.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;

    switch (b.type) {
      case BlockType.divider:
        return GestureDetector(
          onTap: () => _showBlockMenu(b),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 13),
            child: Divider(height: 1, thickness: 1, color: c.border),
          ),
        );
      case BlockType.page:
        return _PageLink(
          pageId: b.pageId,
          onOpen: widget.onOpenPage,
          onMenu: () => _showBlockMenu(b),
        );
      default:
        break;
    }

    final color = blockTextColor(b.color, dark) ?? c.text;
    final style = TextStyle(
      fontSize: _fontSize(b),
      height: 1.5,
      color: b.type == BlockType.todo && b.checked ? c.secondary : color,
      fontWeight: switch (b.type) {
        BlockType.h1 => FontWeight.w700,
        BlockType.h2 || BlockType.h3 => FontWeight.w600,
        _ => FontWeight.w400,
      },
      fontFamily: b.type == BlockType.code ? 'monospace' : null,
      decoration: b.type == BlockType.todo && b.checked
          ? TextDecoration.lineThrough
          : null,
    );
    final focused = _focusedId == b.id && _editing;
    final hint = switch (b.type) {
      BlockType.text =>
        focused ? "Scrivi qualcosa, o '/' per i comandi…" : null,
      BlockType.h1 => 'Titolo 1',
      BlockType.h2 => 'Titolo 2',
      BlockType.h3 => 'Titolo 3',
      BlockType.bullet || BlockType.numbered => 'Elenco',
      BlockType.todo => 'Da fare',
      BlockType.toggle => 'Elenco a scomparsa',
      BlockType.quote => 'Citazione',
      BlockType.code => 'Codice',
      _ => focused ? 'Scrivi qualcosa…' : null,
    };

    final ctrl = _ctrl(b)
      ..markerColor = c.faint
      ..codeBackground = c.codeBg
      ..codeColor = dark ? const Color(0xFFFF7369) : const Color(0xFFEB5757);
    if (ctrl.text != b.text) ctrl.text = b.text;

    Widget field = Focus(
      canRequestFocus: false,
      skipTraversal: true,
      onKeyEvent: (_, e) => _onKey(b, e),
      child: TextField(
        controller: ctrl,
        focusNode: _node(b),
        maxLines: null,
        keyboardType: TextInputType.multiline,
        textCapitalization: TextCapitalization.sentences,
        style: style,
        cursorColor: c.text,
        decoration: InputDecoration.collapsed(
          hintText: hint,
          hintStyle: style.copyWith(
            color: c.faint,
            decoration: TextDecoration.none,
          ),
        ),
        onChanged: (v) => _onChanged(b, v),
      ),
    );

    final lh = _lineHeight(b);
    Widget leading(Widget child) => SizedBox(
      width: 26,
      height: lh,
      child: Center(child: child),
    );

    switch (b.type) {
      case BlockType.bullet:
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            leading(
              Text(
                const ['•', '◦', '▪'][b.indent % 3],
                style: TextStyle(fontSize: 20, color: color, height: 1),
              ),
            ),
            Expanded(child: field),
          ],
        );
      case BlockType.numbered:
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ConstrainedBox(
              constraints: BoxConstraints(minWidth: 26, minHeight: lh),
              child: Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Text(
                  '${numberFor(blocks, index)}.',
                  style: style.copyWith(decoration: TextDecoration.none),
                ),
              ),
            ),
            Expanded(child: field),
          ],
        );
      case BlockType.todo:
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            leading(
              SizedBox(
                width: 20,
                height: 20,
                child: Checkbox(
                  value: b.checked,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                  side: BorderSide(color: c.text, width: 1.5),
                  onChanged: (v) {
                    setState(() => b.checked = v ?? false);
                    _save();
                  },
                ),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(child: field),
          ],
        );
      case BlockType.toggle:
        final hasChildren =
            index + 1 < blocks.length && blocks[index + 1].indent > b.indent;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(4),
              onTap: () {
                setState(() => b.collapsed = !b.collapsed);
                _save();
              },
              child: leading(
                AnimatedRotation(
                  turns: b.collapsed ? 0 : 0.25,
                  duration: const Duration(milliseconds: 150),
                  child: Icon(
                    Icons.play_arrow_rounded,
                    size: 18,
                    color: hasChildren ? color : c.faint,
                  ),
                ),
              ),
            ),
            Expanded(child: field),
          ],
        );
      case BlockType.quote:
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 2),
          padding: const EdgeInsets.only(left: 14),
          decoration: BoxDecoration(
            border: Border(left: BorderSide(color: color, width: 3)),
          ),
          child: field,
        );
      case BlockType.callout:
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 2),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: blockBackground(b.color, dark),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: () async {
                  final e = await pickEmoji(context, allowRemove: false);
                  if (e != null && e.isNotEmpty && mounted) {
                    setState(() => b.emoji = e);
                    _save();
                  }
                },
                child: SizedBox(
                  height: lh,
                  child: Center(
                    child: Text(
                      b.emoji ?? '💡',
                      style: const TextStyle(fontSize: 20),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Focus(
                  canRequestFocus: false,
                  skipTraversal: true,
                  onKeyEvent: (_, e) => _onKey(b, e),
                  child: TextField(
                    controller: ctrl,
                    focusNode: _node(b),
                    maxLines: null,
                    keyboardType: TextInputType.multiline,
                    textCapitalization: TextCapitalization.sentences,
                    style: style.copyWith(color: c.text),
                    cursorColor: c.text,
                    decoration: InputDecoration.collapsed(
                      hintText: 'Scrivi qualcosa…',
                      hintStyle: style.copyWith(color: c.faint),
                    ),
                    onChanged: (v) => _onChanged(b, v),
                  ),
                ),
              ),
            ],
          ),
        );
      case BlockType.code:
        return Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          decoration: BoxDecoration(
            color: c.codeBg,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Text(
                    'Codice',
                    style: TextStyle(fontSize: 11, color: c.secondary),
                  ),
                  const Spacer(),
                  InkWell(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: b.text));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Codice copiato')),
                      );
                    },
                    child: Icon(Icons.copy, size: 14, color: c.secondary),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              field,
            ],
          ),
        );
      default:
        return Padding(
          padding: EdgeInsets.symmetric(vertical: _vPad(b)),
          child: field,
        );
    }
  }
}

/// Collegamento a una sottopagina.
class _PageLink extends StatelessWidget {
  const _PageLink({
    required this.pageId,
    required this.onOpen,
    required this.onMenu,
  });
  final String? pageId;
  final void Function(String id) onOpen;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final ws = context.watch<Workspace>();
    final c = NotionColors.of(context);
    final p = pageId == null ? null : ws.page(pageId!);
    final missing = p == null || p.trashed;
    return InkWell(
      borderRadius: BorderRadius.circular(4),
      onTap: missing ? onMenu : () => onOpen(p.id),
      onLongPress: onMenu,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            SizedBox(
              width: 26,
              child: p != null && p.icon.isNotEmpty
                  ? Text(p.icon, style: const TextStyle(fontSize: 18))
                  : Icon(
                      Icons.description_outlined,
                      size: 20,
                      color: c.secondary,
                    ),
            ),
            const SizedBox(width: 2),
            Expanded(
              child: Text(
                missing ? 'Pagina eliminata' : p.displayTitle,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 16,
                  height: 1.5,
                  fontWeight: FontWeight.w500,
                  color: missing ? c.faint : c.text,
                  decoration: TextDecoration.underline,
                  decorationColor: c.faint,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Centered extends StatelessWidget {
  const _Centered({
    super.key,
    required this.maxWidth,
    required this.hPad,
    required this.child,
  });
  final double maxWidth;
  final double hPad;
  final Widget child;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: hPad),
        child: child,
      ),
    ),
  );
}

/// Copertina, icona e titolo della pagina.
class _Header extends StatelessWidget {
  const _Header({
    required this.page,
    required this.title,
    required this.titleNode,
    required this.hPad,
    required this.maxWidth,
    required this.onTitleChanged,
    required this.onTitleSubmitted,
    required this.onChanged,
  });

  final NotePage page;
  final TextEditingController title;
  final FocusNode titleNode;
  final double hPad;
  final double maxWidth;
  final ValueChanged<String> onTitleChanged;
  final VoidCallback onTitleSubmitted;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final c = NotionColors.of(context);
    final hasCover = page.cover != null;
    final hasIcon = page.icon.isNotEmpty;

    Future<void> changeIcon() async {
      final e = await pickEmoji(context);
      if (e == null) return;
      page.icon = e;
      onChanged();
    }

    Future<void> changeCover() async {
      final i = await pickCover(context);
      if (i == null) return;
      page.cover = i < 0 ? null : i;
      onChanged();
    }

    Widget ghostButton(IconData icon, String label, VoidCallback onTap) =>
        TextButton.icon(
          style: TextButton.styleFrom(
            foregroundColor: c.secondary,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            visualDensity: VisualDensity.compact,
          ),
          onPressed: onTap,
          icon: Icon(icon, size: 18),
          label: Text(label, style: const TextStyle(fontSize: 13)),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (hasCover)
          GestureDetector(
            onTap: changeCover,
            child: Container(
              height: 170,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: coverGradients[page.cover! % coverGradients.length],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
        _Centered(
          maxWidth: maxWidth,
          hPad: hPad + 22,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (hasIcon && hasCover)
                SizedBox(
                  height: 46,
                  child: OverflowBox(
                    alignment: Alignment.bottomLeft,
                    minHeight: 0,
                    maxHeight: 90,
                    child: GestureDetector(
                      onTap: changeIcon,
                      child: Text(
                        page.icon,
                        style: const TextStyle(fontSize: 64, height: 1.15),
                      ),
                    ),
                  ),
                )
              else if (hasIcon)
                Padding(
                  padding: const EdgeInsets.only(top: 36),
                  child: GestureDetector(
                    onTap: changeIcon,
                    child: Text(
                      page.icon,
                      style: const TextStyle(fontSize: 64, height: 1.15),
                    ),
                  ),
                )
              else
                SizedBox(height: hasCover ? 16 : 40),
              if (!hasIcon || !hasCover)
                Wrap(
                  children: [
                    if (!hasIcon)
                      ghostButton(
                        Icons.emoji_emotions_outlined,
                        'Aggiungi icona',
                        changeIcon,
                      ),
                    if (!hasCover)
                      ghostButton(
                        Icons.image_outlined,
                        'Aggiungi copertina',
                        changeCover,
                      ),
                  ],
                ),
              TextField(
                controller: title,
                focusNode: titleNode,
                maxLines: null,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                  color: c.text,
                ),
                cursorColor: c.text,
                decoration: InputDecoration.collapsed(
                  hintText: 'Senza titolo',
                  hintStyle: TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w700,
                    color: c.faint.withValues(alpha: 0.6),
                  ),
                ),
                onChanged: (v) {
                  if (v.contains('\n')) {
                    final clean = v.replaceAll('\n', '');
                    title.value = TextEditingValue(
                      text: clean,
                      selection: TextSelection.collapsed(offset: clean.length),
                    );
                    onTitleChanged(clean);
                    onTitleSubmitted();
                    return;
                  }
                  onTitleChanged(v);
                },
                onSubmitted: (_) => onTitleSubmitted(),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ],
    );
  }
}
