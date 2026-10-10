import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../services/form_autofill.dart';

/// Dati personali usati per compilare automaticamente i moduli.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final Map<String, TextEditingController> _ctrls = {
    for (final f in profileFields)
      f.key: TextEditingController(text: context.read<AppState>().profile[f.key] ?? ''),
  };

  @override
  void dispose() {
    for (final c in _ctrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    await context.read<AppState>().setProfile({for (final e in _ctrls.entries) e.key: e.value.text});
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profilo di compilazione'),
        actions: [
          FilledButton(onPressed: _save, child: const Text('Salva')),
          const SizedBox(width: 12),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Questi dati restano solo su questo dispositivo e servono a compilare '
            'automaticamente i campi dei moduli PDF (nome, codice fiscale, indirizzo...).',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          for (final f in profileFields)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                controller: _ctrls[f.key],
                textCapitalization: f.key == 'email' ? TextCapitalization.none : TextCapitalization.words,
                keyboardType: switch (f.key) {
                  'email' => TextInputType.emailAddress,
                  'telefono' => TextInputType.phone,
                  'cap' => TextInputType.number,
                  _ => TextInputType.text,
                },
                decoration: InputDecoration(
                  labelText: f.label,
                  hintText: f.hint,
                  border: const OutlineInputBorder(),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
