import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../logic/editor_logic.dart';
import '../models/note_page.dart';
import '../state/templates.dart';
import '../state/workspace.dart';
import '../theme.dart';
import '../widgets/page_editor.dart';
import '../widgets/sidebar.dart';
import 'search_screen.dart';
import 'trash_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _scaffold = GlobalKey<ScaffoldState>();
  final _history = <String>[];

  Workspace get ws => context.read<Workspace>();

  bool get _wide => MediaQuery.sizeOf(context).width >= 900;

  void _open(String id) {
    final cur = ws.currentPageId;
    if (cur != null && cur != id) {
      _history
        ..remove(id)
        ..add(cur);
    }
    ws.open(id);
    if (!_wide) _scaffold.currentState?.closeDrawer();
  }

  void _back() {
    while (_history.isNotEmpty) {
      final id = _history.removeLast();
      final p = ws.page(id);
      if (p != null && !p.trashed) {
        ws.open(id);
        return;
      }
    }
  }

  Future<void> _search() async {
    final id = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const SearchScreen()),
    );
    if (id != null) _open(id);
  }

  void _trash() {
    if (!_wide) _scaffold.currentState?.closeDrawer();
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const TrashScreen()),
    );
  }

  Future<void> _templates({String? parentId}) async {
    final c = NotionColors.of(context);
    final t = await showModalBottomSheet<PageTemplate>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (ctx, scroll) => ListView(
          controller: scroll,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'Modelli',
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
            ),
            for (final t in templates)
              ListTile(
                leading: Text(t.icon, style: const TextStyle(fontSize: 26)),
                title: Text(t.name),
                subtitle: Text(
                  t.description,
                  style: TextStyle(color: c.secondary, fontSize: 12),
                ),
                onTap: () => Navigator.pop(ctx, t),
              ),
          ],
        ),
      ),
    );
    if (t == null || !mounted) return;
    _open(ws.insertPage(t.build(), parentId: parentId).id);
  }

  Future<void> _pageAction(NotePage p, String action) async {
    switch (action) {
      case 'fav':
        ws.setFavorite(p.id, !p.favorite);
      case 'dup':
        _open(ws.duplicate(p.id).id);
      case 'move':
        await _movePage(p);
      case 'trash':
        ws.moveToTrash(p.id);
        if (!mounted) return;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text('"${p.displayTitle}" spostata nel cestino'),
              action: SnackBarAction(
                label: 'Annulla',
                onPressed: () => ws.restore(p.id),
              ),
            ),
          );
      case 'menu':
        await _pageSheet(p);
    }
  }

  Future<void> _pageSheet(NotePage p) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(p.favorite ? Icons.star : Icons.star_border),
              title: Text(
                p.favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti',
              ),
              onTap: () => Navigator.pop(ctx, 'fav'),
            ),
            ListTile(
              leading: const Icon(Icons.content_copy),
              title: const Text('Duplica'),
              onTap: () => Navigator.pop(ctx, 'dup'),
            ),
            ListTile(
              leading: const Icon(Icons.drive_file_move_outline),
              title: const Text('Sposta in…'),
              onTap: () => Navigator.pop(ctx, 'move'),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('Sposta nel cestino'),
              onTap: () => Navigator.pop(ctx, 'trash'),
            ),
          ],
        ),
      ),
    );
    if (action != null) await _pageAction(p, action);
  }

  Future<void> _movePage(NotePage p) async {
    final blocked = {p.id, ...ws.descendants(p.id)};
    final targets =
        ws.allPages.where((x) => !x.trashed && !blocked.contains(x.id)).toList()
          ..sort((a, b) => a.displayTitle.compareTo(b.displayTitle));
    final c = NotionColors.of(context);
    final target = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (ctx, scroll) => ListView(
          controller: scroll,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'Sposta "${p.displayTitle}" in…',
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
            ),
            ListTile(
              leading: Icon(Icons.home_outlined, color: c.secondary),
              title: const Text('Pagine (livello principale)'),
              onTap: () => Navigator.pop(ctx, ''),
            ),
            for (final t in targets)
              ListTile(
                leading: SizedBox(
                  width: 28,
                  child: t.icon.isNotEmpty
                      ? Text(t.icon, style: const TextStyle(fontSize: 20))
                      : Icon(Icons.description_outlined, color: c.secondary),
                ),
                title: Text(t.displayTitle),
                subtitle: Text(
                  ws.breadcrumb(t.id).map((x) => x.displayTitle).join(' / '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: c.secondary),
                ),
                onTap: () => Navigator.pop(ctx, t.id),
              ),
          ],
        ),
      ),
    );
    if (target == null) return;
    ws.movePage(p.id, target.isEmpty ? null : target);
  }

  Future<void> _pageMenu(NotePage p, String action) async {
    final md = pageToMarkdown(
      p,
      titleOf: (id) => ws.page(id)?.displayTitle ?? 'Pagina',
    );
    switch (action) {
      case 'copy':
        await Clipboard.setData(ClipboardData(text: md));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Markdown copiato negli appunti')),
        );
      case 'share':
        await SharePlus.instance.share(
          ShareParams(text: md, subject: p.displayTitle),
        );
      case 'wide':
        p.fullWidth = !p.fullWidth;
        ws.touch(p);
      case 'paste':
        final data = await Clipboard.getData(Clipboard.kTextPlain);
        final text = data?.text ?? '';
        if (text.trim().isEmpty) return;
        final blocks = markdownToBlocks(text);
        if (p.blocks.length == 1 && p.blocks.first.text.isEmpty) {
          p.blocks.clear();
        }
        p.blocks.addAll(blocks);
        ws.touch(p);
        setState(() {});
      case 'sub':
        _open(ws.addSubpage(p.id).id);
      case 'template':
        await _templates(parentId: p.id);
      case 'info':
        if (!mounted) return;
        final created = DateTime.fromMillisecondsSinceEpoch(p.createdAt);
        final updated = DateTime.fromMillisecondsSinceEpoch(p.updatedAt);
        String f(DateTime d) =>
            '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} '
            '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(p.displayTitle),
            content: Text(
              'Parole: ${wordCount(p)}\n'
              'Blocchi: ${p.blocks.length}\n'
              'Sottopagine: ${ws.descendants(p.id).length}\n'
              'Creata: ${f(created)}\n'
              'Modificata: ${f(updated)}',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Chiudi'),
              ),
            ],
          ),
        );
      default:
        await _pageAction(p, action);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ws = context.watch<Workspace>();
    final c = NotionColors.of(context);
    final wide = _wide;
    final pageId = ws.currentPageId;
    final page = pageId == null ? null : ws.page(pageId);

    final sidebar = Sidebar(
      onOpen: _open,
      onSearch: () {
        if (!wide) _scaffold.currentState?.closeDrawer();
        _search();
      },
      onTrash: _trash,
      onTemplates: () {
        if (!wide) _scaffold.currentState?.closeDrawer();
        _templates();
      },
      onPageMenu: _pageAction,
    );

    final body = page == null || page.trashed
        ? _Empty(onCreate: () => _open(ws.createPage().id))
        : PageEditor(
            key: ValueKey(page.id),
            pageId: page.id,
            onOpenPage: _open,
          );

    final crumbs = page == null ? <NotePage>[] : ws.breadcrumb(page.id);

    final scaffold = Scaffold(
      key: _scaffold,
      drawer: wide
          ? null
          : Drawer(
              width: 300,
              shape: const RoundedRectangleBorder(),
              child: sidebar,
            ),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        titleSpacing: 0,
        leading: wide
            ? (_history.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Indietro',
                      icon: const Icon(Icons.arrow_back),
                      onPressed: () => setState(_back),
                    ))
            : IconButton(
                tooltip: 'Menu',
                icon: const Icon(Icons.menu),
                onPressed: () => _scaffold.currentState?.openDrawer(),
              ),
        title: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          reverse: true,
          child: Row(
            children: [
              if (wide) const SizedBox(width: 16),
              for (var i = 0; i < crumbs.length; i++) ...[
                if (i > 0)
                  Text(' / ', style: TextStyle(color: c.faint, fontSize: 14)),
                InkWell(
                  borderRadius: BorderRadius.circular(4),
                  onTap: () => _open(crumbs[i].id),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 4,
                    ),
                    child: Text(
                      '${crumbs[i].icon.isEmpty ? '' : '${crumbs[i].icon} '}'
                      '${crumbs[i].displayTitle}',
                      style: TextStyle(
                        fontSize: 14,
                        color: i == crumbs.length - 1 ? c.text : c.secondary,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        actions: [
          if (page != null && !page.trashed) ...[
            IconButton(
              tooltip: page.favorite
                  ? 'Rimuovi dai preferiti'
                  : 'Aggiungi ai preferiti',
              icon: Icon(
                page.favorite ? Icons.star : Icons.star_border,
                color: page.favorite ? const Color(0xFFF5B400) : c.secondary,
              ),
              onPressed: () => ws.setFavorite(page.id, !page.favorite),
            ),
            PopupMenuButton<String>(
              tooltip: 'Altro',
              icon: Icon(Icons.more_horiz, color: c.secondary),
              onSelected: (a) => _pageMenu(page, a),
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'sub',
                  child: Text('Nuova sottopagina'),
                ),
                const PopupMenuItem(
                  value: 'template',
                  child: Text('Sottopagina da modello'),
                ),
                PopupMenuItem(
                  value: 'wide',
                  child: Text(
                    page.fullWidth ? 'Larghezza normale' : 'Larghezza piena',
                  ),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(
                  value: 'copy',
                  child: Text('Copia come Markdown'),
                ),
                const PopupMenuItem(
                  value: 'share',
                  child: Text('Esporta / Condividi'),
                ),
                const PopupMenuItem(
                  value: 'paste',
                  child: Text('Incolla Markdown in fondo'),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(value: 'dup', child: Text('Duplica')),
                const PopupMenuItem(value: 'move', child: Text('Sposta in…')),
                const PopupMenuItem(
                  value: 'trash',
                  child: Text('Sposta nel cestino'),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(value: 'info', child: Text('Informazioni')),
              ],
            ),
          ],
        ],
      ),
      body: wide
          ? Row(
              children: [
                SizedBox(width: 280, child: sidebar),
                VerticalDivider(width: 1, color: c.border),
                Expanded(child: body),
              ],
            )
          : body,
    );

    return PopScope(
      canPop: _history.isEmpty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(_back);
      },
      child: scaffold,
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.onCreate});
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final c = NotionColors.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('📝', style: const TextStyle(fontSize: 56)),
          const SizedBox(height: 12),
          Text('Nessuna pagina aperta', style: TextStyle(color: c.secondary)),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onCreate,
            icon: const Icon(Icons.add),
            label: const Text('Nuova pagina'),
          ),
        ],
      ),
    );
  }
}
