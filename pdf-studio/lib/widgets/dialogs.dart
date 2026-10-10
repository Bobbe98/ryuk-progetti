import 'package:flutter/material.dart';

/// Chiede un testo all'utente.
Future<String?> promptText(
  BuildContext context, {
  required String title,
  String? hint,
  String initial = '',
  bool obscure = false,
  String confirm = 'OK',
}) {
  final ctrl = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: ctrl,
        autofocus: true,
        obscureText: obscure,
        decoration: InputDecoration(hintText: hint),
        onSubmitted: (v) => Navigator.pop(ctx, v),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annulla')),
        FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: Text(confirm)),
      ],
    ),
  );
}

Future<bool> confirmDialog(BuildContext context, String title, String message,
    {String confirm = 'Conferma'}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annulla')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(confirm)),
      ],
    ),
  );
  return r ?? false;
}

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Esegue [task] mostrando un indicatore di caricamento; in caso di errore
/// mostra un messaggio e ritorna null.
Future<T?> runBusy<T>(BuildContext context, Future<T> Function() task,
    {String message = 'Elaborazione...'}) async {
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => PopScope(
      canPop: false,
      child: AlertDialog(
        content: Row(children: [
          const CircularProgressIndicator(),
          const SizedBox(width: 20),
          Expanded(child: Text(message)),
        ]),
      ),
    ),
  );
  // Lascia disegnare il dialog prima del lavoro sincrono pesante.
  await Future<void>.delayed(const Duration(milliseconds: 60));
  try {
    final result = await task();
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
    return result;
  } catch (e) {
    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop();
      showSnack(context, 'Errore: ${_clean(e)}');
    }
    return null;
  }
}

String _clean(Object e) {
  final s = e.toString();
  return s.replaceFirst(RegExp(r'^(Exception|FormatException|Invalid argument\(s\)):\s*'), '');
}
