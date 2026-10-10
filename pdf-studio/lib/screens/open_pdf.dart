import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models/pdf_file.dart';
import '../services/file_service.dart';
import '../services/pdf_tools.dart';
import '../widgets/dialogs.dart';
import 'viewer_screen.dart';

/// Chiede la password se serve e apre il documento nel visualizzatore.
Future<void> openPdf(BuildContext context, PdfFile file, {bool import = true}) async {
  String? password;
  if (PdfTools.needsPassword(file.bytes)) {
    while (true) {
      final p = await promptText(context,
          title: 'Documento protetto', hint: 'Password', obscure: true, confirm: 'Apri');
      if (p == null || !context.mounted) return;
      if (PdfTools.checkPassword(file.bytes, p)) {
        password = p;
        break;
      }
      showSnack(context, 'Password errata');
    }
  }
  var doc = file;
  if (import && doc.path == null) doc = await FileService.importToLibrary(doc);
  if (!context.mounted) return;
  final state = context.read<AppState>();
  if (doc.path != null) await state.addRecent(doc.name, doc.path!);
  if (!context.mounted) return;
  await Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => ViewerScreen(
      file: doc,
      password: password,
      initialPage: doc.path != null ? state.recentFor(doc.path!)?.lastPage ?? 1 : 1,
    ),
  ));
}

/// Apre un file della libreria dal percorso.
Future<void> openPath(BuildContext context, String path, String name) async {
  final bytes = await FileService.readPath(path);
  if (!context.mounted) return;
  if (bytes == null) {
    showSnack(context, 'File non trovato, rimosso dai recenti');
    await context.read<AppState>().removeRecent(path);
    return;
  }
  await openPdf(context, PdfFile(name: name, bytes: bytes, path: path));
}

/// Salva un PDF generato da uno strumento e lo apre.
Future<void> saveAndOpen(BuildContext context, String name, List<int> bytes) async {
  final data = PdfFile(name: name, bytes: Uint8List.fromList(bytes));
  if (!FileService.hasLibrary) {
    await openPdf(context, data, import: false);
    return;
  }
  final unique = await FileService.uniqueName(name);
  final path = await FileService.saveToLibrary(unique, bytes);
  if (!context.mounted) return;
  showSnack(context, 'Salvato: $unique');
  await openPdf(context, data.copyWith(name: unique, path: path));
}
