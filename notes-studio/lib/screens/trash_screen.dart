import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/workspace.dart';
import '../theme.dart';

class TrashScreen extends StatelessWidget {
  const TrashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final ws = context.watch<Workspace>();
    final c = NotionColors.of(context);
    final trash = ws.trash;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cestino'),
        actions: [
          if (trash.isNotEmpty)
            TextButton(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Svuotare il cestino?'),
                    content: const Text(
                      'Le pagine verranno eliminate definitivamente.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Annulla'),
                      ),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.red,
                        ),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Svuota'),
                      ),
                    ],
                  ),
                );
                if (ok == true) ws.emptyTrash();
              },
              child: const Text('Svuota'),
            ),
        ],
      ),
      body: trash.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.delete_outline, size: 48, color: c.faint),
                  const SizedBox(height: 8),
                  Text(
                    'Il cestino è vuoto',
                    style: TextStyle(color: c.secondary),
                  ),
                ],
              ),
            )
          : ListView(
              children: [
                for (final p in trash)
                  ListTile(
                    leading: SizedBox(
                      width: 28,
                      child: p.icon.isNotEmpty
                          ? Text(p.icon, style: const TextStyle(fontSize: 20))
                          : Icon(
                              Icons.description_outlined,
                              color: c.secondary,
                            ),
                    ),
                    title: Text(p.displayTitle),
                    subtitle: Text(
                      '${ws.descendants(p.id).length} sottopagine',
                      style: TextStyle(color: c.secondary, fontSize: 12),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Ripristina',
                          icon: const Icon(Icons.restore),
                          onPressed: () => ws.restore(p.id),
                        ),
                        IconButton(
                          tooltip: 'Elimina definitivamente',
                          icon: const Icon(Icons.delete_forever_outlined),
                          onPressed: () => ws.deleteForever(p.id),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}
