import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart' show DataFormat;
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

import '../app_state.dart';
import '../models/pdf_file.dart';
import '../services/file_service.dart';
import '../services/form_autofill.dart';
import '../services/pdf_tools.dart';
import '../widgets/dialogs.dart';
import '../widgets/form_panel.dart';
import 'organizer_screen.dart';
import 'profile_screen.dart';
import 'signature_screen.dart';

enum Tool { read, highlight, underline, strikethrough, squiggly, note, text, check, cross, date, signature, image }

extension on Tool {
  String get label => switch (this) {
        Tool.read => 'Leggi',
        Tool.highlight => 'Evidenzia',
        Tool.underline => 'Sottolinea',
        Tool.strikethrough => 'Barrato',
        Tool.squiggly => 'Ondulato',
        Tool.note => 'Nota',
        Tool.text => 'Testo',
        Tool.check => 'Spunta',
        Tool.cross => 'Croce',
        Tool.date => 'Data',
        Tool.signature => 'Firma',
        Tool.image => 'Immagine',
      };

  IconData get icon => switch (this) {
        Tool.read => Icons.pan_tool_alt_outlined,
        Tool.highlight => Icons.border_color,
        Tool.underline => Icons.format_underlined,
        Tool.strikethrough => Icons.format_strikethrough,
        Tool.squiggly => Icons.waves,
        Tool.note => Icons.sticky_note_2_outlined,
        Tool.text => Icons.title,
        Tool.check => Icons.check,
        Tool.cross => Icons.close,
        Tool.date => Icons.today,
        Tool.signature => Icons.draw_outlined,
        Tool.image => Icons.image_outlined,
      };

  PdfAnnotationMode get annotationMode => switch (this) {
        Tool.highlight => PdfAnnotationMode.highlight,
        Tool.underline => PdfAnnotationMode.underline,
        Tool.strikethrough => PdfAnnotationMode.strikethrough,
        Tool.squiggly => PdfAnnotationMode.squiggly,
        Tool.note => PdfAnnotationMode.stickyNote,
        _ => PdfAnnotationMode.none,
      };

  /// Strumenti "Compila e firma": restano attivi dopo ogni inserimento.
  bool get isFill => this == Tool.text || this == Tool.check || this == Tool.cross || this == Tool.date;

  bool get usesColor => this != Tool.read && this != Tool.signature && this != Tool.image;
}

/// Immagine pronta da posizionare (firma o foto).
class _Stamp {
  _Stamp(this.png, this.aspect);
  final Uint8List png;
  final double aspect;
}

class ViewerScreen extends StatefulWidget {
  const ViewerScreen({super.key, required this.file, this.password, this.initialPage = 1});

  final PdfFile file;
  final String? password;
  final int initialPage;

  @override
  State<ViewerScreen> createState() => _ViewerScreenState();
}

class _ViewerScreenState extends State<ViewerScreen> {
  static const _palette = [
    Colors.yellow,
    Colors.lightGreenAccent,
    Colors.cyanAccent,
    Colors.pinkAccent,
    Colors.orange,
    Colors.red,
    Color(0xFF1565C0),
    Colors.black,
  ];
  static const _invert = ColorFilter.matrix(<double>[
    -1, 0, 0, 0, 255, //
    0, -1, 0, 0, 255, //
    0, 0, -1, 0, 255, //
    0, 0, 0, 1, 0, //
  ]);

  late PdfFile _file = widget.file;
  late String? _password = widget.password;
  PdfViewerController _controller = PdfViewerController();
  GlobalKey<SfPdfViewerState> _viewerKey = GlobalKey();
  late int _restorePage = widget.initialPage;

  int _page = 1;
  int _pageCount = 0;
  bool _dirty = false;
  bool _night = false;
  bool _continuous = true;
  bool _horizontal = false;
  bool _fullscreen = false;
  Tool _tool = Tool.read;
  Color _color = Colors.yellow;
  double _textSize = 14;
  _Stamp? _stamp;
  Annotation? _selected;
  List<PdfFormField> _formFields = [];
  bool _formHintShown = false;

  bool _searching = false;
  final _searchCtrl = TextEditingController();
  PdfTextSearchResult _search = PdfTextSearchResult();

  @override
  void dispose() {
    _search.removeListener(_onSearchChanged);
    _searchCtrl.dispose();
    super.dispose();
  }

  // ---------- Documento ----------

  void _onLoaded(PdfDocumentLoadedDetails d) {
    setState(() => _pageCount = d.document.pages.count);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _formFields = _controller.getFormFields());
      if (_formFields.isNotEmpty && !_formHintShown) {
        _formHintShown = true;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Questo PDF è un modulo con ${_formFields.length} campi'),
          action: SnackBarAction(label: 'Compila', onPressed: _openFormPanel),
          duration: const Duration(seconds: 6),
        ));
      }
    });
    final target = _restorePage.clamp(1, _pageCount);
    if (target > 1) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _controller.jumpToPage(target));
    }
  }

  Future<Uint8List> _currentBytes() async => Uint8List.fromList(await _controller.saveDocument());

  /// Applica una modifica al PDF e ricarica il visualizzatore sulla stessa pagina.
  Future<void> _modify(Uint8List Function(Uint8List bytes) op, {String message = 'Elaborazione...'}) async {
    final current = await _currentBytes();
    if (!mounted) return;
    final out = await runBusy(context, () async => op(current), message: message);
    if (out == null || !mounted) return;
    _reload(out, page: _controller.pageNumber, dirty: true);
  }

  void _reload(Uint8List bytes, {int? page, bool dirty = true, String? password}) {
    _search.removeListener(_onSearchChanged);
    setState(() {
      _file = _file.copyWith(bytes: bytes);
      if (password != null) _password = password.isEmpty ? null : password;
      _restorePage = page ?? _page;
      _controller = PdfViewerController();
      _viewerKey = GlobalKey();
      _search = PdfTextSearchResult();
      _searching = false;
      _selected = null;
      _dirty = _dirty || dirty;
      _setToolState(_tool.isFill ? _tool : Tool.read);
      _formFields = [];
    });
  }

  Future<bool> _save({bool quiet = false}) async {
    final bytes = await _currentBytes();
    if (!mounted) return false;
    if (!FileService.hasLibrary) {
      final ok = await FileService.saveAs(_file.name, bytes);
      if (ok) setState(() => _dirty = false);
      return ok;
    }
    final path = await FileService.saveToLibrary(_file.name, bytes);
    if (!mounted || path == null) return false;
    await context.read<AppState>().addRecent(_file.name, path, lastPage: _page);
    setState(() {
      _file = _file.copyWith(bytes: bytes, path: path);
      _dirty = false;
    });
    if (!quiet && mounted) showSnack(context, 'Salvato');
    return true;
  }

  Future<void> _saveAs() async {
    final name = await promptText(context, title: 'Salva come', initial: _file.name, confirm: 'Salva');
    if (name == null || !mounted) return;
    final bytes = await _currentBytes();
    if (FileService.hasLibrary) {
      final unique = await FileService.uniqueName(name);
      final path = await FileService.saveToLibrary(unique, bytes);
      if (!mounted || path == null) return;
      await context.read<AppState>().addRecent(unique, path, lastPage: _page);
      setState(() {
        _file = PdfFile(name: unique, bytes: bytes, path: path);
        _dirty = false;
      });
      if (mounted) showSnack(context, 'Salvato come $unique');
    } else {
      await FileService.saveAs(name, bytes);
    }
  }

  Future<void> _export() async {
    final ok = await FileService.saveAs(_file.name, await _currentBytes());
    if (ok && mounted) showSnack(context, 'Esportato');
  }

  Future<void> _share() async => FileService.share(_file.name, await _currentBytes());

  Future<void> _onPop(bool didPop, Object? _) async {
    if (didPop) return;
    final choice = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Modifiche non salvate'),
        content: const Text('Vuoi salvare le modifiche prima di uscire?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, 'discard'), child: const Text('Non salvare')),
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annulla')),
          FilledButton(onPressed: () => Navigator.pop(ctx, 'save'), child: const Text('Salva')),
        ],
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'save' && !await _save(quiet: true)) return;
    if (!mounted) return;
    setState(() => _dirty = false);
    Navigator.of(context).pop();
  }

  void _onPageChanged(PdfPageChangedDetails d) {
    setState(() => _page = d.newPageNumber);
    final path = _file.path;
    if (path != null) context.read<AppState>().setLastPage(path, d.newPageNumber);
  }

  // ---------- Strumenti ----------

  void _setToolState(Tool t) {
    _tool = t;
    _controller.annotationMode = t.annotationMode;
    _applyColor();
  }

  void _applyColor() {
    final s = _controller.annotationSettings;
    switch (_tool) {
      case Tool.highlight:
        s.highlight.color = _color;
      case Tool.underline:
        s.underline.color = _color;
      case Tool.strikethrough:
        s.strikethrough.color = _color;
      case Tool.squiggly:
        s.squiggly.color = _color;
      case Tool.note:
        s.stickyNote.color = _color;
      default:
        break;
    }
  }

  Future<void> _selectTool(Tool t) async {
    if (t == _tool) t = Tool.read;
    if (t == Tool.signature || t == Tool.image) {
      final stamp = t == Tool.signature ? await _pickSignature() : await _pickImage();
      if (stamp == null || !mounted) return;
      _stamp = stamp;
    }
    setState(() {
      if (t == Tool.highlight) _color = Colors.yellow;
      if (t == Tool.underline || t == Tool.squiggly) _color = Colors.green;
      if (t == Tool.strikethrough) _color = Colors.red;
      if (t.isFill) _color = Colors.black;
      if (t == Tool.note) _color = Colors.yellow;
      _setToolState(t);
    });
    final hint = switch (t) {
      Tool.highlight || Tool.underline || Tool.strikethrough || Tool.squiggly =>
        'Seleziona il testo da marcare',
      Tool.note => 'Tocca la pagina per aggiungere una nota',
      Tool.text => 'Tocca la pagina dove scrivere',
      Tool.check => 'Tocca le caselle da spuntare',
      Tool.cross => 'Tocca le caselle da barrare',
      Tool.date => 'Tocca dove inserire la data di oggi',
      Tool.signature => 'Tocca la pagina dove inserire la firma',
      Tool.image => "Tocca la pagina dove inserire l'immagine",
      Tool.read => null,
    };
    if (hint != null && mounted) showSnack(context, hint);
  }

  Future<_Stamp?> _toStamp(Uint8List png) async {
    final img = await decodeImageFromList(png);
    final aspect = img.width / img.height;
    img.dispose();
    return _Stamp(png, aspect);
  }

  Future<_Stamp?> _pickSignature() async {
    final state = context.read<AppState>();
    Uint8List? png = state.savedSignature;
    if (png != null) {
      final choice = await showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        builder: (ctx) => SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              height: 110,
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Image.memory(png!),
            ),
            ListTile(
              leading: const Icon(Icons.check),
              title: const Text('Usa firma salvata'),
              onTap: () => Navigator.pop(ctx, 'use'),
            ),
            ListTile(
              leading: const Icon(Icons.draw_outlined),
              title: const Text('Disegna nuova firma'),
              onTap: () => Navigator.pop(ctx, 'new'),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('Elimina firma salvata'),
              onTap: () => Navigator.pop(ctx, 'delete'),
            ),
          ]),
        ),
      );
      if (choice == null) return null;
      if (choice == 'delete') {
        await state.setSignature(null);
        png = null;
      } else if (choice == 'new') {
        png = null;
      }
    }
    if (png == null) {
      if (!mounted) return null;
      final res = await Navigator.of(context).push<(Uint8List, bool)>(
        MaterialPageRoute(builder: (_) => const SignatureScreen(), fullscreenDialog: true),
      );
      if (res == null) return null;
      png = res.$1;
      if (res.$2) await state.setSignature(png);
    }
    return _toStamp(png);
  }

  Future<_Stamp?> _pickImage() async {
    final images = await FileService.pickImages();
    if (images.isEmpty) return null;
    return _toStamp(images.first);
  }

  Future<void> _onTap(PdfGestureDetails d) async {
    if (d.pageNumber < 1) return;
    final pageIndex = d.pageNumber - 1;
    final pos = d.pagePosition;
    switch (_tool) {
      case Tool.text:
        final text = await _askText();
        if (text == null || text.trim().isEmpty) return;
        await _modify((b) => PdfTools.stampText(b, pageIndex, pos, text, _textSize, _color, _password));
      case Tool.check:
      case Tool.cross:
        final cross = _tool == Tool.cross;
        await _modify((b) => PdfTools.stampMark(b, pageIndex, pos,
            cross: cross, size: _textSize, color: _color, password: _password));
      case Tool.date:
        await _modify((b) => PdfTools.stampText(b, pageIndex, pos, today(), _textSize, _color, _password));
      case Tool.signature:
      case Tool.image:
        final stamp = _stamp;
        if (stamp == null) return;
        final width = _tool == Tool.signature ? 150.0 : 200.0;
        final rect = Rect.fromCenter(center: pos, width: width, height: width / stamp.aspect);
        await _modify((b) => PdfTools.stampImage(b, pageIndex, rect, stamp.png, _password));
      default:
        break;
    }
  }

  Future<String?> _askText() {
    final ctrl = TextEditingController();
    final profile = context.read<AppState>().profile;
    final quick = <String>{
      today(),
      if ((profile['nome'] ?? '').isNotEmpty || (profile['cognome'] ?? '').isNotEmpty)
        '${profile['nome'] ?? ''} ${profile['cognome'] ?? ''}'.trim(),
      for (final f in profileFields)
        if (f.key != 'nome' && f.key != 'cognome' && (profile[f.key] ?? '').isNotEmpty) profile[f.key]!,
    }.toList();
    return showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Aggiungi testo'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              controller: ctrl,
              autofocus: true,
              maxLines: 4,
              minLines: 1,
              decoration: const InputDecoration(hintText: 'Scrivi qui...'),
            ),
            if (quick.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 4, children: [
                for (final q in quick)
                  ActionChip(
                    label: Text(q, overflow: TextOverflow.ellipsis),
                    onPressed: () {
                      ctrl.text = ctrl.text.isEmpty ? q : '${ctrl.text} $q';
                      ctrl.selection = TextSelection.collapsed(offset: ctrl.text.length);
                    },
                  ),
              ]),
            ],
            const SizedBox(height: 12),
            Row(children: [
              const Text('Dimensione'),
              Expanded(
                child: Slider(
                  value: _textSize,
                  min: 8,
                  max: 48,
                  divisions: 20,
                  label: _textSize.round().toString(),
                  onChanged: (v) => setLocal(() => _textSize = v),
                ),
              ),
            ]),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annulla')),
            FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Inserisci')),
          ],
        ),
      ),
    );
  }

  // ---------- Ricerca ----------

  void _onSearchChanged() {
    if (mounted) setState(() {});
  }

  void _startSearch(String q) {
    _search.removeListener(_onSearchChanged);
    _search.clear();
    if (q.trim().isEmpty) return;
    setState(() {
      _search = _controller.searchText(q.trim());
      _search.addListener(_onSearchChanged);
    });
  }

  void _closeSearch() {
    _search.removeListener(_onSearchChanged);
    _search.clear();
    _searchCtrl.clear();
    setState(() => _searching = false);
  }

  // ---------- Moduli ----------

  Future<void> _openFormPanel() async {
    if (_formFields.isEmpty) {
      showSnack(context, 'Nessun campo modulo: usa Testo, Spunta, Croce e Data per compilarlo');
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (ctx) => FormPanel(
        fields: _formFields,
        onChanged: () => setState(() => _dirty = true),
        onJump: (page) {
          Navigator.pop(ctx);
          _controller.jumpToPage(page);
        },
        onSign: _signField,
        onAutofill: _autofill,
      ),
    );
  }

  Future<void> _signField(PdfSignatureFormField field) async {
    final stamp = await _pickSignature();
    if (stamp == null) return;
    field.signature = stamp.png;
    setState(() => _dirty = true);
  }

  int _autofill() {
    final n = autofill(_formFields, context.read<AppState>().profile);
    if (n > 0) setState(() => _dirty = true);
    return n;
  }

  Future<void> _openProfile() => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const ProfileScreen()),
      );

  Future<void> _flattenForm() async {
    final ok = await confirmDialog(
      context,
      'Appiattisci modulo',
      'I valori diventano testo fisso e i campi non saranno più modificabili. '
          'Utile prima di inviare il modulo compilato.',
      confirm: 'Appiattisci',
    );
    if (!ok) return;
    final bytes = await _controller.saveDocument(flattenOption: PdfFlattenOption.formFields);
    if (mounted) _reload(Uint8List.fromList(bytes));
  }

  String get _baseName => _file.name.replaceAll(RegExp(r'\.pdf$', caseSensitive: false), '');

  Future<void> _exportFormData() async {
    final data = Uint8List.fromList(_controller.exportFormData(dataFormat: DataFormat.json));
    await FileService.shareData('$_baseName - dati.json', data, 'application/json');
  }

  Future<void> _importFormData() async {
    final file = await FileService.pickData(const ['json', 'xfdf', 'fdf', 'xml']);
    if (file == null) return;
    final format = switch (file.$1.split('.').last.toLowerCase()) {
      'xfdf' => DataFormat.xfdf,
      'fdf' => DataFormat.fdf,
      'xml' => DataFormat.xml,
      _ => DataFormat.json,
    };
    try {
      _controller.importFormData(file.$2, format);
      setState(() => _dirty = true);
      if (mounted) showSnack(context, 'Dati importati');
    } catch (e) {
      if (mounted) showSnack(context, 'Importazione non riuscita: $e');
    }
  }

  // ---------- Menu ----------

  Future<void> _goToPage() async {
    final v = await promptText(context, title: 'Vai a pagina', hint: '1 - $_pageCount', confirm: 'Vai');
    final n = int.tryParse(v ?? '');
    if (n == null) return;
    if (n < 1 || n > _pageCount) {
      if (mounted) showSnack(context, 'Pagina non valida');
      return;
    }
    _controller.jumpToPage(n);
  }

  Future<void> _organize() async {
    final bytes = await _currentBytes();
    if (!mounted) return;
    final out = await Navigator.of(context).push<Uint8List>(MaterialPageRoute(
      builder: (_) => OrganizerScreen(bytes: bytes, password: _password, name: _file.name),
    ));
    if (out != null) _reload(out, page: 1);
  }

  Future<void> _watermark() async {
    final text = await promptText(context, title: 'Filigrana', hint: 'es. BOZZA, RISERVATO', confirm: 'Applica');
    if (text == null || text.trim().isEmpty) return;
    await _modify((b) => PdfTools.watermark(b, text.trim(), _password));
  }

  Future<void> _protect() async {
    if (_password != null) {
      final ok = await confirmDialog(context, 'Rimuovi password',
          'Il documento non sarà più protetto da password.', confirm: 'Rimuovi');
      if (!ok) return;
      final bytes = await _currentBytes();
      if (!mounted) return;
      final out = await runBusy(context, () async => PdfTools.unlock(bytes, _password!));
      if (out != null) _reload(out, password: '');
      return;
    }
    final pwd = await promptText(context, title: 'Proteggi con password', hint: 'Nuova password',
        obscure: true, confirm: 'Proteggi');
    if (pwd == null || pwd.isEmpty || !mounted) return;
    final bytes = await _currentBytes();
    if (!mounted) return;
    final out = await runBusy(context, () async => PdfTools.protect(bytes, pwd));
    if (out != null) _reload(out, password: pwd);
  }

  Future<void> _showInfo() async {
    final info = PdfTools.info(await _currentBytes(), _password);
    if (!mounted) return;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(_file.name),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final e in info.entries)
              ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text(e.key), subtitle: Text(e.value)),
          ],
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Chiudi'))],
      ),
    );
  }

  Future<void> _onMenu(String v) async {
    switch (v) {
      case 'goto':
        await _goToPage();
      case 'layout':
        setState(() => _continuous = !_continuous);
      case 'direction':
        setState(() => _horizontal = !_horizontal);
      case 'fullscreen':
        setState(() => _fullscreen = true);
      case 'organize':
        await _organize();
      case 'rotate':
        await _modify((b) => PdfTools.rotateAll(b, 1, _password));
      case 'watermark':
        await _watermark();
      case 'numbers':
        await _modify((b) => PdfTools.addPageNumbers(b, _password));
      case 'compress':
        final before = _file.bytes.length;
        await _modify((b) => PdfTools.compress(b, _password), message: 'Compressione...');
        if (mounted) {
          final after = _file.bytes.length;
          showSnack(context, 'Dimensione: ${(before / 1024).round()} KB → ${(after / 1024).round()} KB');
        }
      case 'protect':
        await _protect();
      case 'formpanel':
        await _openFormPanel();
      case 'autofill':
        final n = _autofill();
        showSnack(context, n == 0 ? 'Nessun campo riconosciuto: completa il profilo' : '$n campi compilati');
      case 'clearform':
        if (await confirmDialog(context, 'Svuota modulo', 'Cancellare tutti i valori inseriti?', confirm: 'Svuota')) {
          _controller.clearFormData();
          setState(() => _dirty = true);
        }
      case 'flatten':
        await _flattenForm();
      case 'exportform':
        await _exportFormData();
      case 'importform':
        await _importFormData();
      case 'profile':
        await _openProfile();
      case 'clear':
        if (await confirmDialog(context, 'Rimuovi annotazioni', 'Eliminare tutte le annotazioni?',
            confirm: 'Elimina')) {
          _controller.removeAllAnnotations();
          setState(() => _dirty = true);
        }
      case 'save':
        await _save();
      case 'saveas':
        await _saveAs();
      case 'export':
        await _export();
      case 'share':
        await _share();
      case 'info':
        await _showInfo();
    }
  }

  // ---------- UI ----------

  PreferredSizeWidget _appBar() {
    if (_searching) {
      final total = _search.totalInstanceCount;
      return AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: _closeSearch),
        title: TextField(
          controller: _searchCtrl,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(hintText: 'Cerca nel documento', border: InputBorder.none),
          onSubmitted: _startSearch,
        ),
        actions: [
          if (_search.hasResult)
            Center(child: Text('${_search.currentInstanceIndex}/$total'))
          else if (_searchCtrl.text.isNotEmpty && _search.isSearchCompleted)
            const Center(child: Text('0 risultati')),
          IconButton(
            icon: const Icon(Icons.keyboard_arrow_up),
            onPressed: _search.hasResult ? _search.previousInstance : null,
          ),
          IconButton(
            icon: const Icon(Icons.keyboard_arrow_down),
            onPressed: _search.hasResult ? _search.nextInstance : null,
          ),
        ],
      );
    }
    return AppBar(
      title: Text(_file.name, overflow: TextOverflow.ellipsis),
      actions: [
        if (_selected != null)
          IconButton(
            tooltip: 'Elimina annotazione',
            icon: const Icon(Icons.delete_outline),
            onPressed: () {
              _controller.removeAnnotation(_selected!);
              setState(() {
                _selected = null;
                _dirty = true;
              });
            },
          ),
        if (_formFields.isNotEmpty)
          IconButton(
            tooltip: 'Compila modulo',
            icon: Badge(label: Text('${_formFields.length}'), child: const Icon(Icons.assignment_outlined)),
            onPressed: _openFormPanel,
          ),
        IconButton(tooltip: 'Cerca', icon: const Icon(Icons.search), onPressed: () => setState(() => _searching = true)),
        IconButton(
          tooltip: 'Segnalibri',
          icon: const Icon(Icons.bookmark_border),
          onPressed: () => _viewerKey.currentState?.openBookmarkView(),
        ),
        IconButton(
          tooltip: 'Modalità notte',
          icon: Icon(_night ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
          onPressed: () => setState(() => _night = !_night),
        ),
        if (_dirty)
          IconButton(tooltip: 'Salva', icon: const Icon(Icons.save_outlined), onPressed: _save),
        PopupMenuButton<String>(
          onSelected: _onMenu,
          itemBuilder: (_) => [
            _item('goto', Icons.numbers, 'Vai a pagina'),
            _item('layout', _continuous ? Icons.view_carousel_outlined : Icons.view_day_outlined,
                _continuous ? 'Pagina singola' : 'Scorrimento continuo'),
            _item('direction', Icons.swap_horiz, _horizontal ? 'Scorrimento verticale' : 'Scorrimento orizzontale'),
            _item('fullscreen', Icons.fullscreen, 'Lettura a schermo intero'),
            const PopupMenuDivider(),
            if (_formFields.isNotEmpty) ...[
              _item('formpanel', Icons.assignment_outlined, 'Compila modulo'),
              _item('autofill', Icons.auto_fix_high, 'Compilazione automatica'),
              _item('clearform', Icons.backspace_outlined, 'Svuota modulo'),
              _item('flatten', Icons.layers_outlined, 'Appiattisci modulo'),
              _item('exportform', Icons.upload_file, 'Esporta dati modulo'),
              _item('importform', Icons.download_for_offline_outlined, 'Importa dati modulo'),
            ],
            _item('profile', Icons.badge_outlined, 'Profilo di compilazione'),
            const PopupMenuDivider(),
            _item('organize', Icons.dashboard_customize_outlined, 'Organizza pagine'),
            _item('rotate', Icons.rotate_right, 'Ruota tutte le pagine'),
            _item('watermark', Icons.water_drop_outlined, 'Aggiungi filigrana'),
            _item('numbers', Icons.format_list_numbered, 'Numera pagine'),
            _item('compress', Icons.compress, 'Comprimi'),
            _item('protect', _password == null ? Icons.lock_outline : Icons.lock_open,
                _password == null ? 'Proteggi con password' : 'Rimuovi password'),
            _item('clear', Icons.layers_clear_outlined, 'Rimuovi annotazioni'),
            const PopupMenuDivider(),
            _item('save', Icons.save_outlined, 'Salva'),
            if (FileService.hasLibrary) _item('saveas', Icons.save_as_outlined, 'Salva come...'),
            if (FileService.hasLibrary) _item('export', Icons.download_outlined, 'Esporta su dispositivo'),
            _item('share', Icons.share_outlined, 'Condividi'),
            _item('info', Icons.info_outline, 'Proprietà'),
          ],
        ),
      ],
    );
  }

  PopupMenuItem<String> _item(String v, IconData icon, String text) => PopupMenuItem(
        value: v,
        child: ListTile(leading: Icon(icon), title: Text(text), contentPadding: EdgeInsets.zero, dense: true),
      );

  Widget _toolbar() {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (_tool.usesColor)
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  for (final c in _palette)
                    Padding(
                      padding: const EdgeInsets.all(6),
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _color = c;
                          _applyColor();
                        }),
                        child: Container(
                          width: 30,
                          decoration: BoxDecoration(
                            color: c,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: _color == c ? scheme.primary : scheme.outlineVariant,
                              width: _color == c ? 3 : 1,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          SizedBox(
            height: 64,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                for (final t in Tool.values)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => _selectTool(t),
                      child: Container(
                        width: 72,
                        decoration: BoxDecoration(
                          color: _tool == t ? scheme.secondaryContainer : null,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(t.icon, size: 22),
                          const SizedBox(height: 2),
                          Text(t.label, style: const TextStyle(fontSize: 11)),
                        ]),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget viewer = SfPdfViewer.memory(
      _file.bytes,
      key: _viewerKey,
      controller: _controller,
      password: _password,
      canShowPasswordDialog: false,
      pageLayoutMode: _continuous ? PdfPageLayoutMode.continuous : PdfPageLayoutMode.single,
      scrollDirection: _horizontal ? PdfScrollDirection.horizontal : PdfScrollDirection.vertical,
      onDocumentLoaded: _onLoaded,
      onDocumentLoadFailed: (d) => showSnack(context, '${d.error}: ${d.description}'),
      onPageChanged: _onPageChanged,
      onTap: _onTap,
      onFormFieldValueChanged: (_) => setState(() => _dirty = true),
      onAnnotationAdded: (_) => setState(() => _dirty = true),
      onAnnotationEdited: (_) => setState(() => _dirty = true),
      onAnnotationRemoved: (_) => setState(() => _dirty = true),
      onAnnotationSelected: (a) => setState(() => _selected = a),
      onAnnotationDeselected: (_) => setState(() => _selected = null),
    );
    if (_night) viewer = ColorFiltered(colorFilter: _invert, child: viewer);

    final pageBadge = Positioned(
      right: 12,
      bottom: 12,
      child: IgnorePointer(
        child: AnimatedOpacity(
          opacity: _pageCount > 0 ? 1 : 0,
          duration: const Duration(milliseconds: 200),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(16)),
            child: Text('$_page / $_pageCount', style: const TextStyle(color: Colors.white)),
          ),
        ),
      ),
    );

    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: _onPop,
      child: Scaffold(
        appBar: _fullscreen ? null : _appBar(),
        backgroundColor: _night ? const Color(0xFF121212) : null,
        body: Stack(children: [
          Positioned.fill(child: viewer),
          pageBadge,
          if (_fullscreen)
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              right: 8,
              child: IconButton.filledTonal(
                icon: const Icon(Icons.fullscreen_exit),
                onPressed: () => setState(() => _fullscreen = false),
              ),
            ),
        ]),
        bottomNavigationBar: _fullscreen || _searching ? null : _toolbar(),
      ),
    );
  }
}
