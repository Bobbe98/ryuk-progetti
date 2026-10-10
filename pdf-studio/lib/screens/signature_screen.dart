import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:signature/signature.dart';

/// Schermata per disegnare la firma. Ritorna (png, ricorda).
class SignatureScreen extends StatefulWidget {
  const SignatureScreen({super.key});

  @override
  State<SignatureScreen> createState() => _SignatureScreenState();
}

class _SignatureScreenState extends State<SignatureScreen> {
  static const _colors = [Colors.black, Color(0xFF0D47A1), Color(0xFFB71C1C)];
  Color _color = _colors.first;
  double _width = 3;
  bool _remember = true;
  late SignatureController _ctrl = _newController();

  SignatureController _newController() => SignatureController(
        penColor: _color,
        penStrokeWidth: _width,
        exportBackgroundColor: Colors.transparent,
      );

  void _reset({Color? color, double? width}) {
    setState(() {
      _color = color ?? _color;
      _width = width ?? _width;
      final old = _ctrl;
      _ctrl = _newController();
      WidgetsBinding.instance.addPostFrameCallback((_) => old.dispose());
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _done() async {
    if (_ctrl.isEmpty) return;
    final Uint8List? png = await _ctrl.toPngBytes();
    if (!mounted || png == null) return;
    Navigator.pop(context, (png, _remember));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Firma'),
        actions: [
          IconButton(tooltip: 'Annulla tratto', icon: const Icon(Icons.undo), onPressed: () => _ctrl.undo()),
          IconButton(tooltip: 'Cancella', icon: const Icon(Icons.delete_outline), onPressed: () => _ctrl.clear()),
          const SizedBox(width: 4),
          FilledButton(onPressed: _done, child: const Text('Usa firma')),
          const SizedBox(width: 12),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Stack(children: [
                    Signature(key: ObjectKey(_ctrl), controller: _ctrl, backgroundColor: Colors.white),
                    const Positioned(
                      left: 24,
                      right: 24,
                      bottom: 48,
                      child: IgnorePointer(child: Divider(color: Colors.black26, thickness: 1)),
                    ),
                  ]),
                ),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Wrap(
                spacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  for (final c in _colors)
                    GestureDetector(
                      onTap: () => _reset(color: c),
                      child: CircleAvatar(
                        radius: 16,
                        backgroundColor: c,
                        child: _color == c ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
                      ),
                    ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 160,
                    child: Slider(
                      value: _width,
                      min: 1.5,
                      max: 6,
                      onChanged: (v) => setState(() => _width = v),
                      onChangeEnd: (v) => _reset(width: v),
                    ),
                  ),
                  FilterChip(
                    label: const Text('Ricorda firma'),
                    selected: _remember,
                    onSelected: (v) => setState(() => _remember = v),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
