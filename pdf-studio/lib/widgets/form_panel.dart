import 'package:flutter/material.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

/// Elenco di tutti i campi del modulo, modificabili da qui (comodo su telefono).
class FormPanel extends StatefulWidget {
  const FormPanel({
    super.key,
    required this.fields,
    required this.onChanged,
    required this.onJump,
    required this.onSign,
    required this.onAutofill,
  });

  final List<PdfFormField> fields;
  final VoidCallback onChanged;
  final void Function(int pageNumber) onJump;
  final Future<void> Function(PdfSignatureFormField field) onSign;
  final int Function() onAutofill;

  @override
  State<FormPanel> createState() => _FormPanelState();
}

class _FormPanelState extends State<FormPanel> {
  bool _onlyEmpty = false;
  int _rev = 0;

  static bool _isEmpty(PdfFormField f) => switch (f) {
        PdfTextFormField t => t.text.trim().isEmpty,
        PdfCheckboxFormField c => !c.isChecked,
        PdfComboBoxFormField c => c.selectedItem.isEmpty,
        PdfRadioFormField r => r.selectedItem.isEmpty,
        PdfListBoxFormField l => l.selectedItems?.isEmpty ?? true,
        PdfSignatureFormField s => s.signature == null,
        _ => false,
      };

  /// "dati.nome_1" → "Nome 1"
  static String _label(String name) {
    final last = name.split('.').last.replaceAll(RegExp(r'[_\-]+'), ' ').trim();
    final spaced = last.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}');
    if (spaced.isEmpty) return name;
    return spaced[0].toUpperCase() + spaced.substring(1);
  }

  void _changed() {
    widget.onChanged();
    setState(() {});
  }

  Widget _editor(PdfFormField f) {
    final enabled = !f.readOnly;
    switch (f) {
      case PdfTextFormField t:
        return TextFormField(
          key: ValueKey('${f.name}-$_rev'),
          initialValue: t.text,
          enabled: enabled,
          minLines: 1,
          maxLines: 3,
          decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
          onChanged: (v) {
            t.text = v;
            _changed();
          },
        );
      case PdfCheckboxFormField c:
        return Align(
          alignment: Alignment.centerLeft,
          child: Switch(
            value: c.isChecked,
            onChanged: enabled
                ? (v) {
                    c.isChecked = v;
                    _changed();
                  }
                : null,
          ),
        );
      case PdfComboBoxFormField c:
        return _dropdown(c.items, c.selectedItem, enabled, (v) => c.selectedItem = v);
      case PdfRadioFormField r:
        return Wrap(spacing: 6, children: [
          for (final item in r.items)
            ChoiceChip(
              label: Text(item),
              selected: r.selectedItem == item,
              onSelected: enabled
                  ? (_) {
                      r.selectedItem = item;
                      _changed();
                    }
                  : null,
            ),
        ]);
      case PdfListBoxFormField l:
        final sel = l.selectedItems ?? const <String>[];
        return Wrap(spacing: 6, children: [
          for (final item in l.items)
            FilterChip(
              label: Text(item),
              selected: sel.contains(item),
              onSelected: enabled
                  ? (v) {
                      l.selectedItems = v ? [...sel, item] : sel.where((s) => s != item).toList();
                      _changed();
                    }
                  : null,
            ),
        ]);
      case PdfSignatureFormField s:
        return Row(children: [
          if (s.signature != null)
            Container(
              height: 48,
              width: 120,
              margin: const EdgeInsets.only(right: 8),
              color: Colors.white,
              child: Image.memory(s.signature!),
            ),
          OutlinedButton.icon(
            onPressed: enabled
                ? () async {
                    await widget.onSign(s);
                    _changed();
                  }
                : null,
            icon: const Icon(Icons.draw_outlined),
            label: Text(s.signature == null ? 'Firma' : 'Cambia firma'),
          ),
          if (s.signature != null)
            IconButton(
              tooltip: 'Rimuovi firma',
              onPressed: enabled
                  ? () {
                      s.signature = null;
                      _changed();
                    }
                  : null,
              icon: const Icon(Icons.close),
            ),
        ]);
      default:
        return const Text('Campo non supportato');
    }
  }

  Widget _dropdown(List<String> items, String value, bool enabled, void Function(String) set) {
    return DropdownButtonFormField<String>(
      initialValue: items.contains(value) ? value : null,
      isExpanded: true,
      decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
      items: [for (final i in items) DropdownMenuItem(value: i, child: Text(i, overflow: TextOverflow.ellipsis))],
      onChanged: enabled
          ? (v) {
              if (v == null) return;
              set(v);
              _changed();
            }
          : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final filled = widget.fields.where((f) => !_isEmpty(f)).length;
    final visible = _onlyEmpty ? widget.fields.where(_isEmpty).toList() : widget.fields;
    final scheme = Theme.of(context).colorScheme;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.95,
      builder: (context, scroll) => Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 8, 4),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Compila modulo', style: Theme.of(context).textTheme.titleLarge),
                Text('$filled di ${widget.fields.length} campi compilati',
                    style: Theme.of(context).textTheme.bodySmall),
              ]),
            ),
            TextButton.icon(
              onPressed: () {
                final n = widget.onAutofill();
                setState(() => _rev++);
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: Text(n == 0
                      ? 'Nessun campo riconosciuto: completa il profilo dal menu'
                      : '$n campi compilati dal profilo'),
                ));
              },
              icon: const Icon(Icons.auto_fix_high),
              label: const Text('Auto'),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(children: [
            LinearProgressIndicator(
              value: widget.fields.isEmpty ? 0 : filled / widget.fields.length,
              borderRadius: BorderRadius.circular(4),
            ),
            Row(children: [
              FilterChip(
                label: const Text('Solo campi vuoti'),
                selected: _onlyEmpty,
                onSelected: (v) => setState(() => _onlyEmpty = v),
              ),
            ]),
          ]),
        ),
        Expanded(
          child: ListView.separated(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            itemCount: visible.length,
            separatorBuilder: (_, __) => const SizedBox(height: 14),
            itemBuilder: (context, i) {
              final f = visible[i];
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(
                    child: Text(
                      _label(f.name) + (f.readOnly ? ' (sola lettura)' : ''),
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ),
                  InkWell(
                    onTap: () => widget.onJump(f.pageNumber),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Text('pag. ${f.pageNumber}', style: TextStyle(color: scheme.primary, fontSize: 12)),
                    ),
                  ),
                ]),
                const SizedBox(height: 6),
                _editor(f),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}
