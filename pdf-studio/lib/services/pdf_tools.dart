import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui';

import 'package:syncfusion_flutter_pdf/pdf.dart';

/// Pagina nell'organizzatore: [source] = indice originale (null = pagina vuota),
/// [rotation] = numero di rotazioni di 90° in senso orario.
class PageSpec {
  PageSpec(this.source, {this.rotation = 0});
  final int? source;
  int rotation;
}

/// Operazioni sui PDF (unisci, dividi, comprimi, firma, ...).
class PdfTools {
  PdfTools._();

  static const Size a4 = Size(595, 842);

  static PdfDocument _open(Uint8List bytes, [String? password]) =>
      PdfDocument(inputBytes: bytes, password: password);

  static Uint8List _save(PdfDocument doc) {
    final out = Uint8List.fromList(doc.saveSync());
    doc.dispose();
    return out;
  }

  /// true se il file è protetto da password.
  static bool needsPassword(Uint8List bytes) {
    try {
      _open(bytes).dispose();
      return false;
    } catch (e) {
      return e.toString().toLowerCase().contains('password');
    }
  }

  static bool checkPassword(Uint8List bytes, String password) {
    try {
      _open(bytes, password).dispose();
      return true;
    } catch (_) {
      return false;
    }
  }

  static int pageCount(Uint8List bytes, [String? password]) {
    final doc = _open(bytes, password);
    final n = doc.pages.count;
    doc.dispose();
    return n;
  }

  /// Info sul documento (titolo, autore, pagine, ...).
  static Map<String, String> info(Uint8List bytes, [String? password]) {
    final doc = _open(bytes, password);
    final i = doc.documentInformation;
    final first = doc.pages.count > 0 ? doc.pages[0].size : Size.zero;
    final map = <String, String>{
      'Pagine': '${doc.pages.count}',
      'Formato prima pagina': '${first.width.round()} × ${first.height.round()} pt',
      'Dimensione': _formatBytes(bytes.length),
      if (i.title.isNotEmpty) 'Titolo': i.title,
      if (i.author.isNotEmpty) 'Autore': i.author,
      if (i.subject.isNotEmpty) 'Oggetto': i.subject,
      if (i.creator.isNotEmpty) 'Creato con': i.creator,
      if (i.producer.isNotEmpty) 'Prodotto da': i.producer,
      'Protetto': password != null ? 'Sì' : 'No',
    };
    doc.dispose();
    return map;
  }

  static String _formatBytes(int b) {
    if (b < 1024) return '$b B';
    if (b < 1024 * 1024) return '${(b / 1024).toStringAsFixed(1)} KB';
    return '${(b / (1024 * 1024)).toStringAsFixed(2)} MB';
  }

  /// Crea un nuovo documento copiando le pagine indicate da [refs]
  /// (coppia documento/pagina; null = pagina bianca).
  static Uint8List _compose(List<PdfDocument> sources, List<(int, int)?> refs) {
    final out = PdfDocument();
    var lastSize = a4;
    for (final ref in refs) {
      final section = out.sections!.add();
      section.pageSettings.margins.all = 0;
      if (ref == null) {
        section.pageSettings.size = lastSize;
        section.pages.add();
        continue;
      }
      final src = sources[ref.$1].pages[ref.$2];
      final size = src.size;
      lastSize = size;
      section.pageSettings.size = size;
      section.pageSettings.rotate = src.rotation;
      final page = section.pages.add();
      page.graphics.drawPdfTemplate(src.createTemplate(), Offset.zero, size);
    }
    final bytes = _save(out);
    for (final s in sources) {
      s.dispose();
    }
    return bytes;
  }

  static Uint8List merge(List<Uint8List> files) {
    final docs = [for (final f in files) _open(f)];
    final refs = <(int, int)?>[
      for (var d = 0; d < docs.length; d++)
        for (var p = 0; p < docs[d].pages.count; p++) (d, p),
    ];
    return _compose(docs, refs);
  }

  /// Estrae le pagine (indici 0-based) in un nuovo PDF.
  static Uint8List extract(Uint8List bytes, List<int> pages, [String? password]) =>
      _compose([_open(bytes, password)], [for (final p in pages) (0, p)]);

  /// Divide in un file per ogni pagina.
  static List<Uint8List> splitEach(Uint8List bytes, [String? password]) {
    final n = pageCount(bytes, password);
    return [for (var i = 0; i < n; i++) extract(bytes, [i], password)];
  }

  /// "1-3, 5, 8-" → indici 0-based. Lancia FormatException se non valido.
  static List<int> parseRanges(String input, int count) {
    final result = <int>[];
    for (final raw in input.split(',')) {
      final part = raw.trim();
      if (part.isEmpty) continue;
      final m = RegExp(r'^(\d*)\s*-\s*(\d*)$').firstMatch(part);
      int from, to;
      if (m != null) {
        from = m.group(1)!.isEmpty ? 1 : int.parse(m.group(1)!);
        to = m.group(2)!.isEmpty ? count : int.parse(m.group(2)!);
      } else {
        final v = int.tryParse(part);
        if (v == null) throw FormatException('Intervallo non valido: "$part"');
        from = to = v;
      }
      if (from < 1 || to > count || from > to) {
        throw FormatException('Pagine fuori intervallo: "$part" (1-$count)');
      }
      for (var i = from; i <= to; i++) {
        result.add(i - 1);
      }
    }
    if (result.isEmpty) throw const FormatException('Nessuna pagina indicata');
    return result;
  }

  static PdfPageRotateAngle _rotate(PdfPageRotateAngle angle, int steps) {
    const order = [
      PdfPageRotateAngle.rotateAngle0,
      PdfPageRotateAngle.rotateAngle90,
      PdfPageRotateAngle.rotateAngle180,
      PdfPageRotateAngle.rotateAngle270,
    ];
    return order[(order.indexOf(angle) + steps) % 4];
  }

  /// Applica ordine, rotazioni, eliminazioni e pagine vuote dell'organizzatore.
  static Uint8List organize(Uint8List bytes, List<PageSpec> pages, [String? password]) {
    final doc = _open(bytes, password);
    for (final p in pages) {
      if (p.source != null && p.rotation % 4 != 0) {
        final page = doc.pages[p.source!];
        page.rotation = _rotate(page.rotation, p.rotation);
      }
    }
    final sources = pages.map((p) => p.source).toList();
    final keepsOrder = !sources.contains(null) &&
        List.generate(sources.length - 1, (i) => sources[i]! < sources[i + 1]!).every((v) => v);
    if (keepsOrder) {
      // Solo rotazioni/eliminazioni: modifica in place (mantiene annotazioni e link).
      final keep = sources.cast<int>().toSet();
      for (var i = doc.pages.count - 1; i >= 0; i--) {
        if (!keep.contains(i)) doc.pages.removeAt(i);
      }
      return _save(doc);
    }
    return _compose([doc], [for (final s in sources) s == null ? null : (0, s)]);
  }

  static Uint8List rotateAll(Uint8List bytes, int steps, [String? password]) {
    final doc = _open(bytes, password);
    for (var i = 0; i < doc.pages.count; i++) {
      doc.pages[i].rotation = _rotate(doc.pages[i].rotation, steps);
    }
    return _save(doc);
  }

  static Uint8List imagesToPdf(List<Uint8List> images) {
    final doc = PdfDocument();
    for (final img in images) {
      final bmp = PdfBitmap(img);
      final landscape = bmp.width > bmp.height;
      final size = landscape ? Size(a4.height, a4.width) : a4;
      final section = doc.sections!.add();
      section.pageSettings.margins.all = 0;
      section.pageSettings.size = size;
      final page = section.pages.add();
      const margin = 18.0;
      final maxW = size.width - margin * 2, maxH = size.height - margin * 2;
      final scale = math.min(maxW / bmp.width, maxH / bmp.height);
      final w = bmp.width * scale, h = bmp.height * scale;
      page.graphics.drawImage(
        bmp,
        Rect.fromLTWH((size.width - w) / 2, (size.height - h) / 2, w, h),
      );
    }
    return _save(doc);
  }

  static Uint8List blankDocument({int pages = 1}) {
    final doc = PdfDocument();
    doc.pageSettings.margins.all = 0;
    doc.pageSettings.size = a4;
    for (var i = 0; i < pages; i++) {
      doc.pages.add();
    }
    return _save(doc);
  }

  static Uint8List compress(Uint8List bytes, [String? password]) {
    final doc = _open(bytes, password);
    doc.compressionLevel = PdfCompressionLevel.best;
    doc.fileStructure.incrementalUpdate = false;
    return _save(doc);
  }

  static Uint8List protect(Uint8List bytes, String password, [String? currentPassword]) {
    final doc = _open(bytes, currentPassword);
    doc.security.algorithm = PdfEncryptionAlgorithm.aesx256Bit;
    doc.security.userPassword = password;
    doc.security.ownerPassword = password;
    return _save(doc);
  }

  static Uint8List unlock(Uint8List bytes, String password) {
    final doc = _open(bytes, password);
    doc.security.userPassword = '';
    doc.security.ownerPassword = '';
    return _save(doc);
  }

  static Uint8List watermark(Uint8List bytes, String text, [String? password]) {
    final doc = _open(bytes, password);
    for (var i = 0; i < doc.pages.count; i++) {
      final page = doc.pages[i];
      final size = page.size;
      final fontSize = math.min(size.width, size.height) / 9;
      final font = PdfStandardFont(PdfFontFamily.helvetica, fontSize, style: PdfFontStyle.bold);
      final textSize = font.measureString(text);
      final g = page.graphics;
      final state = g.save();
      g.setTransparency(0.22);
      g.translateTransform(size.width / 2, size.height / 2);
      g.rotateTransform(-45);
      g.drawString(
        text,
        font,
        brush: PdfSolidBrush(PdfColor(200, 30, 30)),
        bounds: Rect.fromLTWH(-textSize.width / 2, -textSize.height / 2, textSize.width, textSize.height),
      );
      g.restore(state);
    }
    return _save(doc);
  }

  static Uint8List addPageNumbers(Uint8List bytes, [String? password]) {
    final doc = _open(bytes, password);
    final n = doc.pages.count;
    final font = PdfStandardFont(PdfFontFamily.helvetica, 10);
    for (var i = 0; i < n; i++) {
      final page = doc.pages[i];
      final size = page.size;
      page.graphics.drawString(
        '${i + 1} / $n',
        font,
        brush: PdfSolidBrush(PdfColor(80, 80, 80)),
        bounds: Rect.fromLTWH(0, size.height - 28, size.width, 16),
        format: PdfStringFormat(alignment: PdfTextAlignment.center),
      );
    }
    return _save(doc);
  }

  static PdfColor _pdfColor(Color c) =>
      PdfColor((c.r * 255).round(), (c.g * 255).round(), (c.b * 255).round());

  /// Scrive testo libero su una pagina (coordinate in punti, origine in alto a sinistra).
  static Uint8List stampText(
    Uint8List bytes,
    int pageIndex,
    Offset position,
    String text,
    double fontSize,
    Color color, [
    String? password,
  ]) {
    final doc = _open(bytes, password);
    final page = doc.pages[pageIndex];
    final font = PdfStandardFont(PdfFontFamily.helvetica, fontSize);
    final maxWidth = math.max(40.0, page.size.width - position.dx - 12);
    page.graphics.drawString(
      text,
      font,
      brush: PdfSolidBrush(_pdfColor(color)),
      bounds: Rect.fromLTWH(position.dx, position.dy - fontSize / 2, maxWidth, 0),
    );
    return _save(doc);
  }

  /// Adatta la dimensione del testo dei campi modulo all'altezza (e larghezza)
  /// della loro casella, così il testo non esce né viene tagliato.
  /// Ritorna null se il documento non ha campi da sistemare.
  static Uint8List? fitFormFonts(Uint8List bytes, [String? password]) {
    final doc = _open(bytes, password);
    var changed = false;
    final fields = doc.form.fields;
    for (var i = 0; i < fields.count; i++) {
      final f = fields[i];
      if (f is! PdfTextBoxField || f.multiline) continue;
      final box = f.bounds;
      if (box.height <= 0 || box.width <= 0) continue;
      final current = f.font.size;
      final family = f.font is PdfStandardFont
          ? (f.font as PdfStandardFont).fontFamily
          : PdfFontFamily.helvetica;
      var target = math.min(current, box.height * 0.7);
      if (f.text.isNotEmpty) {
        final width = PdfStandardFont(family, target).measureString(f.text).width;
        final room = box.width - 8; // il viewer aggiunge spaziatura interna
        if (width > room && room > 0) target *= room / width;
      }
      target = math.max(4, target);
      if ((current - target).abs() > 0.3) {
        f.font = PdfStandardFont(family, target);
        changed = true;
      }
    }
    if (!changed) {
      doc.dispose();
      return null;
    }
    return _save(doc);
  }

  /// Copia con i campi "stampati" sulla pagina (per la vista lettura o l'invio).
  static Uint8List flattenForm(Uint8List bytes, [String? password]) {
    final doc = _open(bytes, password);
    doc.form.flattenAllFields();
    return _save(doc);
  }

  /// Disegna una spunta (✓) o una croce (✗) centrata in [c].
  static Uint8List stampMark(
    Uint8List bytes,
    int pageIndex,
    Offset c, {
    required bool cross,
    required double size,
    required Color color,
    String? password,
  }) {
    final doc = _open(bytes, password);
    final g = doc.pages[pageIndex].graphics;
    final pen = PdfPen(_pdfColor(color), width: math.max(1.2, size / 7))
      ..lineCap = PdfLineCap.round
      ..lineJoin = PdfLineJoin.round;
    final h = size / 2;
    if (cross) {
      g.drawLine(pen, Offset(c.dx - h, c.dy - h), Offset(c.dx + h, c.dy + h));
      g.drawLine(pen, Offset(c.dx + h, c.dy - h), Offset(c.dx - h, c.dy + h));
    } else {
      final mid = Offset(c.dx - h * 0.2, c.dy + h * 0.7);
      g.drawLine(pen, Offset(c.dx - h, c.dy), mid);
      g.drawLine(pen, mid, Offset(c.dx + h, c.dy - h * 0.9));
    }
    return _save(doc);
  }

  /// Inserisce un'immagine (firma, timbro, foto) nel rettangolo indicato.
  static Uint8List stampImage(
    Uint8List bytes,
    int pageIndex,
    Rect rect,
    Uint8List image, [
    String? password,
  ]) {
    final doc = _open(bytes, password);
    doc.pages[pageIndex].graphics.drawImage(PdfBitmap(image), rect);
    return _save(doc);
  }
}
