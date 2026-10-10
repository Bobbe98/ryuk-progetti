import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../models/pdf_file.dart';

/// Apertura, salvataggio e condivisione dei file.
class FileService {
  FileService._();

  static bool get hasLibrary => !kIsWeb;

  /// Cartella della libreria dell'app.
  static Future<Directory?> libraryDir() async {
    if (kIsWeb) return null;
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}${Platform.pathSeparator}PDF Studio');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  static Future<PdfFile?> pickPdf() async {
    final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: const ['pdf']);
    if (f == null) return null;
    return PdfFile(name: f.name, bytes: await f.readAsBytes());
  }

  static Future<List<PdfFile>> pickPdfs() async {
    final files = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: const ['pdf']);
    return [for (final f in files) PdfFile(name: f.name, bytes: await f.readAsBytes())];
  }

  static Future<List<Uint8List>> pickImages() async {
    final files = await FilePicker.pickFiles(type: FileType.image);
    return [for (final f in files) await f.readAsBytes()];
  }

  /// Scatta una foto con la fotocamera (scansione documento).
  static Future<Uint8List?> takePhoto() async {
    final photo = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 2400,
    );
    return photo?.readAsBytes();
  }

  static Future<Uint8List?> readPath(String path) async {
    if (kIsWeb) return null;
    final f = File(path);
    if (!await f.exists()) return null;
    return f.readAsBytes();
  }

  static String ensurePdfName(String name) {
    var n = name.trim().replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    if (n.isEmpty) n = 'Documento';
    if (!n.toLowerCase().endsWith('.pdf')) n = '$n.pdf';
    return n;
  }

  /// Nome libero nella libreria: "nome.pdf", "nome (1).pdf", ...
  static Future<String> uniqueName(String name) async {
    final dir = await libraryDir();
    name = ensurePdfName(name);
    if (dir == null) return name;
    final base = name.substring(0, name.length - 4);
    var candidate = name;
    var i = 1;
    while (await File('${dir.path}${Platform.pathSeparator}$candidate').exists()) {
      candidate = '$base ($i).pdf';
      i++;
    }
    return candidate;
  }

  /// Scrive [bytes] nella libreria con nome [name]. Ritorna il percorso (null sul web).
  static Future<String?> saveToLibrary(String name, List<int> bytes) async {
    final dir = await libraryDir();
    if (dir == null) return null;
    final file = File('${dir.path}${Platform.pathSeparator}${ensurePdfName(name)}');
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }

  /// Importa un PDF appena aperto nella libreria, evitando duplicati identici.
  static Future<PdfFile> importToLibrary(PdfFile pdf) async {
    final dir = await libraryDir();
    if (dir == null) return pdf;
    final name = ensurePdfName(pdf.name);
    final existing = File('${dir.path}${Platform.pathSeparator}$name');
    if (await existing.exists() && await existing.length() == pdf.bytes.length) {
      return pdf.copyWith(name: name, path: existing.path);
    }
    final unique = await uniqueName(name);
    final path = await saveToLibrary(unique, pdf.bytes);
    return pdf.copyWith(name: unique, path: path);
  }

  /// Elenco dei PDF nella libreria, dal più recente.
  static Future<List<File>> listLibrary() async {
    final dir = await libraryDir();
    if (dir == null) return [];
    final files = await dir
        .list()
        .where((e) => e is File && e.path.toLowerCase().endsWith('.pdf'))
        .cast<File>()
        .toList();
    files.sort((a, b) => b.lastModifiedSync().compareTo(a.lastModifiedSync()));
    return files;
  }

  static Future<String?> rename(String path, String newName) async {
    if (kIsWeb) return null;
    final file = File(path);
    final unique = await uniqueName(newName);
    final renamed = await file.rename('${file.parent.path}${Platform.pathSeparator}$unique');
    return renamed.path;
  }

  static Future<void> delete(String path) async {
    if (kIsWeb) return;
    final f = File(path);
    if (await f.exists()) await f.delete();
  }

  /// "Salva come..." tramite il selettore di sistema.
  static Future<bool> saveAs(String name, Uint8List bytes) async {
    final result = await FilePicker.saveFile(
      dialogTitle: 'Salva PDF',
      fileName: ensurePdfName(name),
      bytes: bytes,
      mimeType: 'application/pdf',
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
    );
    return kIsWeb || result != null;
  }

  /// Seleziona un file di dati (es. JSON/XFDF). Ritorna (nome, byte).
  static Future<(String, Uint8List)?> pickData(List<String> extensions) async {
    final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: extensions);
    if (f == null) return null;
    return (f.name, await f.readAsBytes());
  }

  static Future<void> shareData(String name, Uint8List bytes, String mimeType) async {
    await SharePlus.instance.share(ShareParams(
      files: [XFile.fromData(bytes, name: name, mimeType: mimeType)],
      fileNameOverrides: [name],
      subject: name,
    ));
  }

  static Future<void> share(String name, Uint8List bytes) async {
    await SharePlus.instance.share(ShareParams(
      files: [XFile.fromData(bytes, name: ensurePdfName(name), mimeType: 'application/pdf')],
      fileNameOverrides: [ensurePdfName(name)],
      subject: name,
    ));
  }
}
