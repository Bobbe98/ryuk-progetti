import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/workspace.dart';
import '../theme.dart';

/// Ricerca in titoli e contenuti. Restituisce l'id della pagina scelta.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final ws = context.watch<Workspace>();
    final c = NotionColors.of(context);
    final hits = ws.search(_query);
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          autofocus: true,
          style: TextStyle(fontSize: 17, color: c.text),
          decoration: InputDecoration(
            hintText: 'Cerca in ${ws.name}…',
            border: InputBorder.none,
            hintStyle: TextStyle(color: c.faint),
          ),
          onChanged: (v) => setState(() => _query = v),
        ),
      ),
      body: ListView(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text(
              _query.trim().isEmpty ? 'Recenti' : '${hits.length} risultati',
              style: TextStyle(fontSize: 12, color: c.secondary),
            ),
          ),
          for (final h in hits)
            ListTile(
              leading: SizedBox(
                width: 28,
                child: h.page.icon.isNotEmpty
                    ? Text(h.page.icon, style: const TextStyle(fontSize: 20))
                    : Icon(Icons.description_outlined, color: c.secondary),
              ),
              title: Text(
                h.page.displayTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                h.snippet ??
                    ws
                        .breadcrumb(h.page.id)
                        .map((p) => p.displayTitle)
                        .join(' / '),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: c.secondary, fontSize: 12),
              ),
              onTap: () => Navigator.pop(context, h.page.id),
            ),
          if (hits.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Text(
                  'Nessun risultato',
                  style: TextStyle(color: c.secondary),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
