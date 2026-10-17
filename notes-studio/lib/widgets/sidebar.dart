import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/note_page.dart';
import '../state/workspace.dart';
import '../theme.dart';

/// Barra laterale con l'albero delle pagine, come in Notion.
class Sidebar extends StatefulWidget {
  const Sidebar({
    super.key,
    required this.onOpen,
    required this.onSearch,
    required this.onTrash,
    required this.onTemplates,
    required this.onPageMenu,
  });

  final void Function(String id) onOpen;
  final VoidCallback onSearch;
  final VoidCallback onTrash;
  final VoidCallback onTemplates;
  final void Function(NotePage page, String action) onPageMenu;

  @override
  State<Sidebar> createState() => _SidebarState();
}

class _SidebarState extends State<Sidebar> {
  static final _expanded = <String>{};
  static String? _lastCurrent;

  @override
  Widget build(BuildContext context) {
    final ws = context.watch<Workspace>();
    final c = NotionColors.of(context);
    final favorites = ws.favorites;
    final roots = ws.rootPages;

    // Espande automaticamente il percorso della pagina aperta.
    if (ws.currentPageId != null && ws.currentPageId != _lastCurrent) {
      _lastCurrent = ws.currentPageId;
      for (final p in ws.breadcrumb(ws.currentPageId!)) {
        if (p.id != ws.currentPageId) _expanded.add(p.id);
      }
    }

    Widget section(String label, {Widget? trailing}) => Padding(
      padding: const EdgeInsets.fromLTRB(14, 16, 6, 2),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: c.secondary,
            ),
          ),
          const Spacer(),
          ?trailing,
        ],
      ),
    );

    return Container(
      color: c.sidebar,
      child: SafeArea(
        right: false,
        child: Column(
          children: [
            _WorkspaceHeader(ws: ws),
            _NavTile(
              icon: Icons.search,
              label: 'Cerca',
              onTap: widget.onSearch,
            ),
            _NavTile(
              icon: Icons.dashboard_customize_outlined,
              label: 'Modelli',
              onTap: widget.onTemplates,
            ),
            _NavTile(
              icon: Icons.add_circle_outline,
              label: 'Nuova pagina',
              onTap: () => widget.onOpen(ws.createPage().id),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 12),
                children: [
                  if (favorites.isNotEmpty) ...[
                    section('Preferiti'),
                    for (final p in favorites) _tree(ws, p, 0, 'fav'),
                  ],
                  section(
                    'Pagine',
                    trailing: IconButton(
                      visualDensity: VisualDensity.compact,
                      iconSize: 18,
                      tooltip: 'Nuova pagina',
                      icon: Icon(Icons.add, color: c.secondary),
                      onPressed: () => widget.onOpen(ws.createPage().id),
                    ),
                  ),
                  for (final p in roots) _tree(ws, p, 0, 'root'),
                  if (roots.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 4, 18, 4),
                      child: Text(
                        'Nessuna pagina',
                        style: TextStyle(color: c.faint, fontSize: 13),
                      ),
                    ),
                ],
              ),
            ),
            Divider(height: 1, color: c.border),
            _NavTile(
              icon: Icons.delete_outline,
              label: 'Cestino',
              trailing: ws.trash.isEmpty
                  ? null
                  : Text(
                      '${ws.trash.length}',
                      style: TextStyle(color: c.secondary, fontSize: 12),
                    ),
              onTap: widget.onTrash,
            ),
            const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }

  Widget _tree(Workspace ws, NotePage p, int depth, String scope) {
    final children = ws.childrenOf(p.id);
    final key = scope == 'root' ? p.id : '$scope/${p.id}';
    final open = _expanded.contains(key);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PageTile(
          page: p,
          depth: depth,
          selected: ws.currentPageId == p.id,
          expanded: open,
          hasChildren: children.isNotEmpty,
          onToggle: () => setState(() {
            if (open) {
              _expanded.remove(key);
            } else {
              _expanded.add(key);
            }
          }),
          onTap: () => widget.onOpen(p.id),
          onAdd: () {
            _expanded.add(key);
            widget.onOpen(ws.addSubpage(p.id).id);
          },
          onMenu: (action) => widget.onPageMenu(p, action),
        ),
        if (open)
          if (children.isEmpty)
            Padding(
              padding: EdgeInsets.only(
                left: 44.0 + depth * 14,
                top: 2,
                bottom: 4,
              ),
              child: Text(
                'Nessuna pagina all\'interno',
                style: TextStyle(
                  fontSize: 13,
                  color: NotionColors.of(context).faint,
                ),
              ),
            )
          else
            for (final ch in children) _tree(ws, ch, depth + 1, scope),
      ],
    );
  }
}

class _WorkspaceHeader extends StatelessWidget {
  const _WorkspaceHeader({required this.ws});
  final Workspace ws;

  @override
  Widget build(BuildContext context) {
    final c = NotionColors.of(context);
    final initial = ws.name.isEmpty
        ? 'N'
        : ws.name.characters.first.toUpperCase();
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 4, 6),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(6),
              onTap: () => _rename(context),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: c.text.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        initial,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: c.text,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        ws.name,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          color: c.text,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          PopupMenuButton<ThemeMode>(
            tooltip: 'Tema',
            icon: Icon(
              switch (ws.themeMode) {
                ThemeMode.light => Icons.light_mode_outlined,
                ThemeMode.dark => Icons.dark_mode_outlined,
                ThemeMode.system => Icons.brightness_auto_outlined,
              },
              size: 20,
              color: c.secondary,
            ),
            onSelected: ws.setTheme,
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: ThemeMode.system,
                child: Text('Tema di sistema'),
              ),
              PopupMenuItem(value: ThemeMode.light, child: Text('Tema chiaro')),
              PopupMenuItem(value: ThemeMode.dark, child: Text('Tema scuro')),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _rename(BuildContext context) async {
    final ctrl = TextEditingController(text: ws.name);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nome dello spazio'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          onSubmitted: (v) => Navigator.pop(ctx, v),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annulla'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            child: const Text('Salva'),
          ),
        ],
      ),
    );
    if (name != null) ws.rename(name);
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.trailing,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = NotionColors.of(context);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        child: Row(
          children: [
            Icon(icon, size: 19, color: c.secondary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: c.secondary,
                ),
              ),
            ),
            ?trailing,
          ],
        ),
      ),
    );
  }
}

class _PageTile extends StatelessWidget {
  const _PageTile({
    required this.page,
    required this.depth,
    required this.selected,
    required this.expanded,
    required this.hasChildren,
    required this.onToggle,
    required this.onTap,
    required this.onAdd,
    required this.onMenu,
  });

  final NotePage page;
  final int depth;
  final bool selected;
  final bool expanded;
  final bool hasChildren;
  final VoidCallback onToggle;
  final VoidCallback onTap;
  final VoidCallback onAdd;
  final void Function(String action) onMenu;

  @override
  Widget build(BuildContext context) {
    final c = NotionColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      child: Material(
        color: selected ? c.hover : Colors.transparent,
        borderRadius: BorderRadius.circular(5),
        child: InkWell(
          borderRadius: BorderRadius.circular(5),
          onTap: onTap,
          onLongPress: () => onMenu('menu'),
          child: SizedBox(
            height: 32,
            child: Row(
              children: [
                SizedBox(width: 2.0 + depth * 14),
                InkWell(
                  borderRadius: BorderRadius.circular(4),
                  onTap: onToggle,
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: Icon(
                      expanded
                          ? Icons.keyboard_arrow_down
                          : Icons.keyboard_arrow_right,
                      size: 18,
                      color: hasChildren || expanded ? c.secondary : c.faint,
                    ),
                  ),
                ),
                const SizedBox(width: 2),
                SizedBox(
                  width: 22,
                  child: page.icon.isNotEmpty
                      ? Text(page.icon, style: const TextStyle(fontSize: 16))
                      : Icon(
                          Icons.description_outlined,
                          size: 18,
                          color: c.secondary,
                        ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    page.displayTitle,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                      color: page.title.trim().isEmpty ? c.secondary : c.text,
                    ),
                  ),
                ),
                PopupMenuButton<String>(
                  tooltip: 'Altro',
                  padding: EdgeInsets.zero,
                  iconSize: 18,
                  icon: Icon(Icons.more_horiz, color: c.faint),
                  onSelected: onMenu,
                  itemBuilder: (_) => [
                    PopupMenuItem(
                      value: 'fav',
                      child: Text(
                        page.favorite
                            ? 'Rimuovi dai preferiti'
                            : 'Aggiungi ai preferiti',
                      ),
                    ),
                    const PopupMenuItem(value: 'dup', child: Text('Duplica')),
                    const PopupMenuItem(
                      value: 'move',
                      child: Text('Sposta in…'),
                    ),
                    const PopupMenuItem(
                      value: 'trash',
                      child: Text('Sposta nel cestino'),
                    ),
                  ],
                ),
                SizedBox(
                  width: 32,
                  child: IconButton(
                    tooltip: 'Aggiungi una pagina all\'interno',
                    padding: EdgeInsets.zero,
                    iconSize: 18,
                    icon: Icon(Icons.add, color: c.faint),
                    onPressed: onAdd,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
