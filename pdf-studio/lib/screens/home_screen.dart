import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models/pdf_file.dart';
import '../services/file_service.dart';
import '../services/pdf_tools.dart';
import '../widgets/dialogs.dart';
import 'open_pdf.dart';
import 'organizer_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  Future<void> _open() async {
    try {
      final pdf = await FileService.pickPdf();
      if (pdf != null && mounted) await openPdf(context, pdf);
    } catch (e) {
      if (mounted) showSnack(context, 'Impossibile aprire il file: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('PDF Studio'),
        actions: [
          PopupMenuButton<ThemeMode>(
            tooltip: 'Tema',
            icon: const Icon(Icons.palette_outlined),
            initialValue: state.themeMode,
            onSelected: state.setTheme,
            itemBuilder: (_) => const [
              PopupMenuItem(value: ThemeMode.system, child: Text('Tema di sistema')),
              PopupMenuItem(value: ThemeMode.light, child: Text('Chiaro')),
              PopupMenuItem(value: ThemeMode.dark, child: Text('Scuro')),
            ],
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: const [_DocumentsTab(), _ToolsTab()]),
      floatingActionButton: _tab == 0
          ? FloatingActionButton.extended(
              onPressed: _open,
              icon: const Icon(Icons.folder_open),
              label: const Text('Apri PDF'),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description), label: 'Documenti'),
          NavigationDestination(icon: Icon(Icons.handyman_outlined), selectedIcon: Icon(Icons.handyman), label: 'Strumenti'),
        ],
      ),
    );
  }
}

// ======================= Documenti =======================

enum _Filter { recent, favorites, library }

class _DocumentsTab extends StatefulWidget {
  const _DocumentsTab();

  @override
  State<_DocumentsTab> createState() => _DocumentsTabState();
}

class _DocumentsTabState extends State<_DocumentsTab> {
  _Filter _filter = _Filter.recent;
  String _query = '';
  List<File> _library = [];

  Future<void> _loadLibrary() async {
    final files = await FileService.listLibrary();
    if (mounted) setState(() => _library = files);
  }

  @override
  Widget build(BuildContext context) {
    if (kIsWeb) return const _WebHint();
    final state = context.watch<AppState>();
    final entries = switch (_filter) {
      _Filter.recent => [for (final r in state.recents) (r.name, r.path, r.openedAt, r.favorite)],
      _Filter.favorites => [
          for (final r in state.recents.where((r) => r.favorite)) (r.name, r.path, r.openedAt, true)
        ],
      _Filter.library => [
          for (final f in _library)
            (
              f.uri.pathSegments.last,
              f.path,
              f.lastModifiedSync(),
              state.recentFor(f.path)?.favorite ?? false,
            )
        ],
    }
        .where((e) => _query.isEmpty || e.$1.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        child: SearchBar(
          hintText: 'Cerca documenti',
          leading: const Icon(Icons.search),
          elevation: const WidgetStatePropertyAll(0),
          onChanged: (v) => setState(() => _query = v),
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: SegmentedButton<_Filter>(
          segments: const [
            ButtonSegment(value: _Filter.recent, label: Text('Recenti'), icon: Icon(Icons.history)),
            ButtonSegment(value: _Filter.favorites, label: Text('Preferiti'), icon: Icon(Icons.star_border)),
            ButtonSegment(value: _Filter.library, label: Text('Libreria'), icon: Icon(Icons.folder_outlined)),
          ],
          selected: {_filter},
          onSelectionChanged: (s) {
            setState(() => _filter = s.first);
            if (_filter == _Filter.library) _loadLibrary();
          },
        ),
      ),
      Expanded(
        child: entries.isEmpty
            ? _EmptyState(filter: _filter)
            : RefreshIndicator(
                onRefresh: _loadLibrary,
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 96),
                  itemCount: entries.length,
                  itemBuilder: (context, i) {
                    final (name, path, date, fav) = entries[i];
                    return _DocTile(
                      name: name,
                      path: path,
                      date: date,
                      favorite: fav,
                      onChanged: _loadLibrary,
                    );
                  },
                ),
              ),
      ),
    ]);
  }
}

class _DocTile extends StatelessWidget {
  const _DocTile({
    required this.name,
    required this.path,
    required this.date,
    required this.favorite,
    required this.onChanged,
  });

  final String name;
  final String path;
  final DateTime date;
  final bool favorite;
  final Future<void> Function() onChanged;

  String _fmt(DateTime d) {
    String two(int v) => v.toString().padLeft(2, '0');
    return '${two(d.day)}/${two(d.month)}/${d.year} ${two(d.hour)}:${two(d.minute)}';
  }

  Future<void> _menu(BuildContext context, String v) async {
    final state = context.read<AppState>();
    switch (v) {
      case 'fav':
        if (state.recentFor(path) == null) await state.addRecent(name, path);
        await state.toggleFavorite(path);
      case 'share':
        final bytes = await FileService.readPath(path);
        if (bytes != null) await FileService.share(name, bytes);
      case 'rename':
        final newName = await promptText(context,
            title: 'Rinomina', initial: name.replaceAll(RegExp(r'\.pdf$', caseSensitive: false), ''));
        if (newName == null || newName.trim().isEmpty) return;
        final newPath = await FileService.rename(path, newName);
        if (newPath != null) {
          await state.renameRecent(path, newPath, newPath.split(Platform.pathSeparator).last);
        }
        await onChanged();
      case 'remove':
        await state.removeRecent(path);
      case 'delete':
        if (!context.mounted) return;
        if (!await confirmDialog(context, 'Elimina file', 'Eliminare definitivamente "$name"?',
            confirm: 'Elimina')) {
          return;
        }
        await FileService.delete(path);
        await state.removeRecent(path);
        await onChanged();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: scheme.errorContainer,
        child: Icon(Icons.picture_as_pdf, color: scheme.onErrorContainer),
      ),
      title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(_fmt(date)),
      onTap: () => openPath(context, path, name),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        if (favorite) const Icon(Icons.star, color: Colors.amber, size: 20),
        PopupMenuButton<String>(
          onSelected: (v) => _menu(context, v),
          itemBuilder: (_) => [
            PopupMenuItem(value: 'fav', child: Text(favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti')),
            const PopupMenuItem(value: 'share', child: Text('Condividi')),
            const PopupMenuItem(value: 'rename', child: Text('Rinomina')),
            const PopupMenuItem(value: 'remove', child: Text('Rimuovi dai recenti')),
            const PopupMenuItem(value: 'delete', child: Text('Elimina file')),
          ],
        ),
      ]),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.filter});
  final _Filter filter;

  @override
  Widget build(BuildContext context) {
    final (icon, text) = switch (filter) {
      _Filter.recent => (Icons.history, 'Nessun documento recente.\nTocca "Apri PDF" per iniziare.'),
      _Filter.favorites => (Icons.star_border, 'Nessun preferito.\nUsa il menu ⋮ di un documento per aggiungerlo.'),
      _Filter.library => (Icons.folder_open, 'La libreria è vuota.'),
    };
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 64, color: Theme.of(context).colorScheme.outline),
        const SizedBox(height: 12),
        Text(text, textAlign: TextAlign.center),
      ]),
    );
  }
}

class _WebHint extends StatelessWidget {
  const _WebHint();

  @override
  Widget build(BuildContext context) => const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'Versione web: apri un PDF con il pulsante in basso.\n'
            'Le modifiche si scaricano con "Salva".',
            textAlign: TextAlign.center,
          ),
        ),
      );
}

// ======================= Strumenti =======================

class _ToolsTab extends StatelessWidget {
  const _ToolsTab();

  static String _base(String name) => name.replaceAll(RegExp(r'\.pdf$', caseSensitive: false), '');

  /// Seleziona un PDF chiedendo la password se protetto.
  static Future<(PdfFile, String?)?> _pickOne(BuildContext context) async {
    final pdf = await FileService.pickPdf();
    if (pdf == null || !context.mounted) return null;
    if (!PdfTools.needsPassword(pdf.bytes)) return (pdf, null);
    final pwd = await promptText(context, title: 'Documento protetto', hint: 'Password', obscure: true);
    if (pwd == null) return null;
    if (!PdfTools.checkPassword(pdf.bytes, pwd)) {
      if (context.mounted) showSnack(context, 'Password errata');
      return null;
    }
    return (pdf, pwd);
  }

  Future<void> _merge(BuildContext context) async {
    final files = await FileService.pickPdfs();
    if (!context.mounted) return;
    if (files.length < 2) {
      if (files.isNotEmpty) showSnack(context, 'Seleziona almeno 2 PDF');
      return;
    }
    final ordered = await showDialog<List<PdfFile>>(
      context: context,
      builder: (_) => _MergeOrderDialog(files: files),
    );
    if (ordered == null || !context.mounted) return;
    final out = await runBusy(context, () async => PdfTools.merge([for (final f in ordered) f.bytes]),
        message: 'Unione in corso...');
    if (out != null && context.mounted) await saveAndOpen(context, 'Unito.pdf', out);
  }

  Future<void> _images(BuildContext context) async {
    final images = await FileService.pickImages();
    if (images.isEmpty || !context.mounted) return;
    final out = await runBusy(context, () async => PdfTools.imagesToPdf(images), message: 'Creazione PDF...');
    if (out != null && context.mounted) await saveAndOpen(context, 'Immagini.pdf', out);
  }

  Future<void> _scan(BuildContext context) async {
    final pages = <Uint8List>[];
    while (true) {
      final photo = await FileService.takePhoto();
      if (photo == null) break;
      pages.add(photo);
      if (!context.mounted) return;
      final more = await confirmDialog(
          context, 'Pagina ${pages.length} acquisita', 'Vuoi scansionare un\'altra pagina?',
          confirm: 'Altra pagina');
      if (!more) break;
    }
    if (pages.isEmpty || !context.mounted) return;
    final out = await runBusy(context, () async => PdfTools.imagesToPdf(pages), message: 'Creazione PDF...');
    if (out != null && context.mounted) await saveAndOpen(context, 'Scansione.pdf', out);
  }

  Future<void> _extract(BuildContext context) async {
    final picked = await _pickOne(context);
    if (picked == null || !context.mounted) return;
    final (pdf, pwd) = picked;
    final count = PdfTools.pageCount(pdf.bytes, pwd);
    final ranges = await promptText(context,
        title: 'Estrai pagine (1-$count)', hint: 'es. 1-3, 5, 8-', confirm: 'Estrai');
    if (ranges == null || !context.mounted) return;
    final out = await runBusy(context, () async {
      final pages = PdfTools.parseRanges(ranges, count);
      return PdfTools.extract(pdf.bytes, pages, pwd);
    });
    if (out != null && context.mounted) await saveAndOpen(context, '${_base(pdf.name)} - pagine.pdf', out);
  }

  Future<void> _split(BuildContext context) async {
    final picked = await _pickOne(context);
    if (picked == null || !context.mounted) return;
    final (pdf, pwd) = picked;
    final parts = await runBusy(context, () async => PdfTools.splitEach(pdf.bytes, pwd), message: 'Divisione...');
    if (parts == null || !context.mounted) return;
    if (!FileService.hasLibrary) {
      for (var i = 0; i < parts.length; i++) {
        await FileService.saveAs('${_base(pdf.name)} - p${i + 1}.pdf', parts[i]);
      }
      return;
    }
    for (var i = 0; i < parts.length; i++) {
      final name = await FileService.uniqueName('${_base(pdf.name)} - p${i + 1}.pdf');
      await FileService.saveToLibrary(name, parts[i]);
    }
    if (context.mounted) showSnack(context, '${parts.length} file salvati nella Libreria');
  }

  Future<void> _organize(BuildContext context) async {
    final picked = await _pickOne(context);
    if (picked == null || !context.mounted) return;
    final (pdf, pwd) = picked;
    final out = await Navigator.of(context).push<Uint8List>(MaterialPageRoute(
      builder: (_) => OrganizerScreen(bytes: pdf.bytes, password: pwd, name: pdf.name),
    ));
    if (out != null && context.mounted) await saveAndOpen(context, pdf.name, out);
  }

  Future<void> _simple(
    BuildContext context,
    String suffix,
    Uint8List Function(Uint8List bytes, String? pwd) op, {
    String message = 'Elaborazione...',
  }) async {
    final picked = await _pickOne(context);
    if (picked == null || !context.mounted) return;
    final (pdf, pwd) = picked;
    final out = await runBusy(context, () async => op(pdf.bytes, pwd), message: message);
    if (out == null || !context.mounted) return;
    if (suffix == 'compresso') {
      showSnack(context, '${(pdf.bytes.length / 1024).round()} KB → ${(out.length / 1024).round()} KB');
    }
    await saveAndOpen(context, '${_base(pdf.name)} - $suffix.pdf', out);
  }

  Future<void> _protect(BuildContext context) async {
    final picked = await _pickOne(context);
    if (picked == null || !context.mounted) return;
    final (pdf, pwd) = picked;
    final newPwd = await promptText(context, title: 'Nuova password', obscure: true, confirm: 'Proteggi');
    if (newPwd == null || newPwd.isEmpty || !context.mounted) return;
    final out = await runBusy(context, () async => PdfTools.protect(pdf.bytes, newPwd, pwd));
    if (out == null || !context.mounted) return;
    if (FileService.hasLibrary) {
      final name = await FileService.uniqueName('${_base(pdf.name)} - protetto.pdf');
      await FileService.saveToLibrary(name, out);
      if (context.mounted) showSnack(context, 'Salvato in Libreria: $name');
    } else {
      await FileService.saveAs('${_base(pdf.name)} - protetto.pdf', out);
    }
  }

  Future<void> _unlock(BuildContext context) async {
    final pdf = await FileService.pickPdf();
    if (pdf == null || !context.mounted) return;
    if (!PdfTools.needsPassword(pdf.bytes)) {
      showSnack(context, 'Il documento non è protetto');
      return;
    }
    final pwd = await promptText(context, title: 'Password attuale', obscure: true, confirm: 'Sblocca');
    if (pwd == null || !context.mounted) return;
    final out = await runBusy(context, () async => PdfTools.unlock(pdf.bytes, pwd));
    if (out != null && context.mounted) await saveAndOpen(context, '${_base(pdf.name)} - sbloccato.pdf', out);
  }

  Future<void> _watermark(BuildContext context) async {
    final picked = await _pickOne(context);
    if (picked == null || !context.mounted) return;
    final (pdf, pwd) = picked;
    final text = await promptText(context, title: 'Testo filigrana', hint: 'es. BOZZA', confirm: 'Applica');
    if (text == null || text.trim().isEmpty || !context.mounted) return;
    final out = await runBusy(context, () async => PdfTools.watermark(pdf.bytes, text.trim(), pwd));
    if (out != null && context.mounted) await saveAndOpen(context, '${_base(pdf.name)} - filigrana.pdf', out);
  }

  Future<void> _blank(BuildContext context) async {
    final n = await promptText(context, title: 'Nuovo PDF vuoto', hint: 'Numero di pagine', initial: '1', confirm: 'Crea');
    final pages = int.tryParse(n ?? '');
    if (pages == null || pages < 1 || pages > 500 || !context.mounted) return;
    await saveAndOpen(context, 'Nuovo documento.pdf', PdfTools.blankDocument(pages: pages));
  }

  @override
  Widget build(BuildContext context) {
    final tools = <(IconData, String, String, Color, Future<void> Function(BuildContext))>[
      (Icons.merge_type, 'Unisci PDF', 'Combina più file in uno', Colors.indigo, _merge),
      (Icons.call_split, 'Dividi PDF', 'Un file per ogni pagina', Colors.teal, _split),
      (Icons.content_cut, 'Estrai pagine', 'Scegli un intervallo', Colors.cyan, _extract),
      (Icons.dashboard_customize_outlined, 'Organizza', 'Riordina, ruota, elimina', Colors.deepPurple, _organize),
      (Icons.photo_library_outlined, 'Immagini → PDF', 'Da galleria/file', Colors.orange, _images),
      if (!kIsWeb) (Icons.document_scanner_outlined, 'Scansiona', 'Usa la fotocamera', Colors.green, _scan),
      (
        Icons.compress,
        'Comprimi',
        'Riduci la dimensione',
        Colors.brown,
        (c) => _simple(c, 'compresso', (b, p) => PdfTools.compress(b, p), message: 'Compressione...'),
      ),
      (Icons.lock_outline, 'Proteggi', 'Aggiungi password', Colors.red, _protect),
      (Icons.lock_open, 'Sblocca', 'Rimuovi password', Colors.pink, _unlock),
      (Icons.water_drop_outlined, 'Filigrana', 'Testo su ogni pagina', Colors.blue, _watermark),
      (
        Icons.format_list_numbered,
        'Numera pagine',
        'Aggiungi numeri a piè di pagina',
        Colors.blueGrey,
        (c) => _simple(c, 'numerato', (b, p) => PdfTools.addPageNumbers(b, p)),
      ),
      (
        Icons.rotate_right,
        'Ruota PDF',
        'Tutte le pagine di 90°',
        Colors.lime.shade800,
        (c) => _simple(c, 'ruotato', (b, p) => PdfTools.rotateAll(b, 1, p)),
      ),
      (Icons.note_add_outlined, 'Nuovo PDF', 'Documento vuoto', Colors.grey, _blank),
    ];
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 220,
        mainAxisExtent: 130,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: tools.length,
      itemBuilder: (context, i) {
        final (icon, title, subtitle, color, action) = tools[i];
        return Card.filled(
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => action(context),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                CircleAvatar(
                  backgroundColor: color.withValues(alpha: 0.15),
                  child: Icon(icon, color: color),
                ),
                const Spacer(),
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
              ]),
            ),
          ),
        );
      },
    );
  }
}

class _MergeOrderDialog extends StatefulWidget {
  const _MergeOrderDialog({required this.files});
  final List<PdfFile> files;

  @override
  State<_MergeOrderDialog> createState() => _MergeOrderDialogState();
}

class _MergeOrderDialogState extends State<_MergeOrderDialog> {
  late final List<PdfFile> _files = [...widget.files];

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ordine di unione'),
      content: SizedBox(
        width: 400,
        height: 360,
        child: ReorderableListView.builder(
          itemCount: _files.length,
          onReorderItem: (from, to) => setState(() {
            _files.insert(to, _files.removeAt(from));
          }),
          itemBuilder: (_, i) => ListTile(
            key: ObjectKey(_files[i]),
            leading: CircleAvatar(child: Text('${i + 1}')),
            title: Text(_files[i].name, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annulla')),
        FilledButton(onPressed: () => Navigator.pop(context, _files), child: const Text('Unisci')),
      ],
    );
  }
}
