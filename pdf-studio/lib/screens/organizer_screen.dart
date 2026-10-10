import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../services/pdf_tools.dart';
import '../widgets/dialogs.dart';
import 'open_pdf.dart';

/// Riordina, ruota, elimina, duplica ed estrae pagine. Ritorna i nuovi byte.
class OrganizerScreen extends StatefulWidget {
  const OrganizerScreen({super.key, required this.bytes, required this.name, this.password});

  final Uint8List bytes;
  final String name;
  final String? password;

  @override
  State<OrganizerScreen> createState() => _OrganizerScreenState();
}

class _Item {
  _Item(this.spec);
  final PageSpec spec;
  final key = UniqueKey();
}

class _OrganizerScreenState extends State<OrganizerScreen> {
  late final List<_Item> _items = [
    for (var i = 0; i < PdfTools.pageCount(widget.bytes, widget.password); i++) _Item(PageSpec(i)),
  ];
  final Set<_Item> _selected = {};
  bool _changed = false;

  void _touch(VoidCallback fn) => setState(() {
        fn();
        _changed = true;
      });

  Iterable<_Item> get _targets => _selected.isEmpty ? const [] : _selected;

  void _rotateSelected() => _touch(() {
        for (final it in _targets) {
          it.spec.rotation = (it.spec.rotation + 1) % 4;
        }
      });

  void _deleteSelected() {
    if (_selected.length >= _items.length) {
      showSnack(context, 'Il documento deve avere almeno una pagina');
      return;
    }
    _touch(() {
      _items.removeWhere(_selected.contains);
      _selected.clear();
    });
  }

  void _addBlank() => _touch(() {
        final at = _selected.isEmpty ? _items.length : _items.indexOf(_selected.last) + 1;
        _items.insert(at, _Item(PageSpec(null)));
      });

  Future<void> _extractSelected() async {
    final specs = [for (final it in _items) if (_selected.contains(it)) it.spec];
    final out = await runBusy(context, () async => PdfTools.organize(widget.bytes, specs, widget.password));
    if (out == null || !mounted) return;
    final base = widget.name.replaceAll(RegExp(r'\.pdf$', caseSensitive: false), '');
    await saveAndOpen(context, '$base - estratto.pdf', out);
  }

  Future<void> _apply() async {
    final specs = [for (final it in _items) it.spec];
    final out = await runBusy(context, () async => PdfTools.organize(widget.bytes, specs, widget.password));
    if (out != null && mounted) Navigator.pop(context, out);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hasSel = _selected.isNotEmpty;
    return Scaffold(
      appBar: AppBar(
        title: Text(hasSel ? '${_selected.length} selezionate' : 'Organizza pagine'),
        actions: [
          IconButton(
            tooltip: hasSel ? 'Deseleziona' : 'Seleziona tutto',
            icon: Icon(hasSel ? Icons.deselect : Icons.select_all),
            onPressed: () => setState(() => hasSel ? _selected.clear() : _selected.addAll(_items)),
          ),
          FilledButton.icon(
            onPressed: _changed ? _apply : null,
            icon: const Icon(Icons.check),
            label: const Text('Applica'),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: ReorderableListView.builder(
        padding: const EdgeInsets.only(bottom: 24),
        itemCount: _items.length,
        onReorderItem: (from, to) => _touch(() {
          _items.insert(to, _items.removeAt(from));
        }),
        itemBuilder: (context, i) {
          final it = _items[i];
          final sel = _selected.contains(it);
          final src = it.spec.source;
          return ListTile(
            key: it.key,
            selected: sel,
            selectedTileColor: scheme.secondaryContainer.withValues(alpha: 0.5),
            onTap: () => setState(() => sel ? _selected.remove(it) : _selected.add(it)),
            leading: RotatedBox(
              quarterTurns: it.spec.rotation,
              child: Container(
                width: 34,
                height: 46,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: src == null ? scheme.surfaceContainerHighest : Colors.white,
                  border: Border.all(color: sel ? scheme.primary : scheme.outlineVariant, width: sel ? 2 : 1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(src == null ? '+' : '${src + 1}',
                    style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
              ),
            ),
            title: Text('Posizione ${i + 1}'),
            subtitle: Text([
              src == null ? 'Pagina vuota' : 'Pagina originale ${src + 1}',
              if (it.spec.rotation != 0) 'ruotata ${it.spec.rotation * 90}°',
            ].join(' · ')),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
              Checkbox(value: sel, onChanged: (v) => setState(() => v! ? _selected.add(it) : _selected.remove(it))),
              ReorderableDragStartListener(index: i, child: const Icon(Icons.drag_handle)),
            ]),
          );
        },
      ),
      bottomNavigationBar: BottomAppBar(
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
          _action(Icons.rotate_right, 'Ruota', hasSel ? _rotateSelected : null),
          _action(Icons.delete_outline, 'Elimina', hasSel ? _deleteSelected : null),
          _action(Icons.note_add_outlined, 'Pagina vuota', _addBlank),
          _action(Icons.file_copy_outlined, 'Estrai', hasSel ? _extractSelected : null),
        ]),
      ),
    );
  }

  Widget _action(IconData icon, String label, VoidCallback? onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Opacity(
          opacity: onTap == null ? 0.4 : 1,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon),
              Text(label, style: const TextStyle(fontSize: 11)),
            ]),
          ),
        ),
      );
}
