import 'dart:convert';

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pdf_studio/services/pdf_tools.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

// PNG 1x1 rosso.
final _png = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==');

void main() {
  test('blank + pageCount', () {
    expect(PdfTools.pageCount(PdfTools.blankDocument(pages: 3)), 3);
  });

  test('merge concatena le pagine', () {
    final out = PdfTools.merge([PdfTools.blankDocument(pages: 2), PdfTools.blankDocument(pages: 3)]);
    expect(PdfTools.pageCount(out), 5);
  });

  test('parseRanges', () {
    expect(PdfTools.parseRanges('1-3, 5, 8-', 9), [0, 1, 2, 4, 7, 8]);
    expect(() => PdfTools.parseRanges('0-2', 5), throwsFormatException);
    expect(() => PdfTools.parseRanges('abc', 5), throwsFormatException);
  });

  test('extract e split', () {
    final src = PdfTools.blankDocument(pages: 4);
    expect(PdfTools.pageCount(PdfTools.extract(src, [3, 0])), 2);
    expect(PdfTools.splitEach(src).length, 4);
  });

  test('organize: elimina, ruota, riordina, pagina vuota', () {
    final src = PdfTools.blankDocument(pages: 3);
    final inPlace = PdfTools.organize(src, [PageSpec(0, rotation: 1), PageSpec(2)]);
    final doc = PdfDocument(inputBytes: inPlace);
    expect(doc.pages.count, 2);
    expect(doc.pages[0].rotation, PdfPageRotateAngle.rotateAngle90);
    doc.dispose();
    final reordered = PdfTools.organize(src, [PageSpec(2), PageSpec(null), PageSpec(0)]);
    expect(PdfTools.pageCount(reordered), 3);
  });

  test('protect / unlock', () {
    final locked = PdfTools.protect(PdfTools.blankDocument(), 'segreta');
    expect(PdfTools.needsPassword(locked), isTrue);
    expect(PdfTools.checkPassword(locked, 'sbagliata'), isFalse);
    expect(PdfTools.checkPassword(locked, 'segreta'), isTrue);
    final open = PdfTools.unlock(locked, 'segreta');
    expect(PdfTools.needsPassword(open), isFalse);
  });

  test('immagini, firma, testo, filigrana, numeri, compressione', () {
    final imgPdf = PdfTools.imagesToPdf([_png, _png]);
    expect(PdfTools.pageCount(imgPdf), 2);
    var b = PdfTools.blankDocument();
    b = PdfTools.stampImage(b, 0, const Rect.fromLTWH(100, 100, 150, 50), _png);
    b = PdfTools.stampText(b, 0, const Offset(50, 50), 'Ciao è così', 14, const Color(0xFF000000));
    b = PdfTools.watermark(b, 'BOZZA');
    b = PdfTools.addPageNumbers(b);
    b = PdfTools.compress(b);
    b = PdfTools.rotateAll(b, 2);
    expect(PdfTools.pageCount(b), 1);
    expect(PdfTools.info(b)['Pagine'], '1');
  });

  test('spunta e croce', () {
    var b = PdfTools.blankDocument();
    b = PdfTools.stampMark(b, 0, const Offset(100, 100), cross: false, size: 14, color: const Color(0xFF000000));
    b = PdfTools.stampMark(b, 0, const Offset(150, 100), cross: true, size: 14, color: const Color(0xFF1565C0));
    expect(PdfTools.pageCount(b), 1);
  });
}
