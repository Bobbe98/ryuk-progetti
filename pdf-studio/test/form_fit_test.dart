import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:pdf_studio/services/pdf_tools.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

/// Modulo stile scheda personaggio: caselle piccole, testo a 12 pt.
Uint8List sheet() {
  final doc = PdfDocument();
  final page = doc.pages.add();
  final big = PdfTextBoxField(page, 'NomePersonaggio', const Rect.fromLTWH(20, 20, 200, 24),
      text: 'Thorin Scudodiquercia', font: PdfStandardFont(PdfFontFamily.helvetica, 12));
  final small = PdfTextBoxField(page, 'FOR', const Rect.fromLTWH(20, 60, 24, 10),
      text: '18', font: PdfStandardFont(PdfFontFamily.helvetica, 12));
  final narrow = PdfTextBoxField(page, 'Classe', const Rect.fromLTWH(20, 80, 40, 14),
      text: 'Paladino Livello 5', font: PdfStandardFont(PdfFontFamily.helvetica, 12));
  final notes = PdfTextBoxField(page, 'Note', const Rect.fromLTWH(20, 100, 200, 100),
      multiline: true, font: PdfStandardFont(PdfFontFamily.helvetica, 10));
  doc.form.fields..add(big)..add(small)..add(narrow)..add(notes);
  final out = Uint8List.fromList(doc.saveSync());
  doc.dispose();
  return out;
}

double sizeOf(Uint8List bytes, String name) {
  final doc = PdfDocument(inputBytes: bytes);
  for (var i = 0; i < doc.form.fields.count; i++) {
    final f = doc.form.fields[i];
    if (f.name == name) {
      final s = (f as PdfTextBoxField).font.size;
      doc.dispose();
      return s;
    }
  }
  throw StateError(name);
}

void main() {
  test('adatta il testo alle caselle piccole', () {
    final fitted = PdfTools.fitFormFonts(sheet());
    expect(fitted, isNotNull);
    expect(sizeOf(fitted!, 'FOR'), lessThanOrEqualTo(7.1)); // 10 pt * 0.7
    expect(sizeOf(fitted, 'NomePersonaggio'), 12); // c'è spazio: invariato
    final classe = sizeOf(fitted, 'Classe');
    expect(classe, lessThan(9.8)); // ristretto anche in larghezza
    final w = PdfStandardFont(PdfFontFamily.helvetica, classe).measureString('Paladino Livello 5').width;
    expect(w, lessThanOrEqualTo(32.5));
    expect(sizeOf(fitted, 'Note'), 10); // multilinea non toccato
    expect(PdfTools.fitFormFonts(fitted), isNull); // già sistemato
  });

  test('vista lettura: campi stampati sulla pagina', () {
    final flat = PdfTools.flattenForm(sheet());
    final doc = PdfDocument(inputBytes: flat);
    expect(doc.form.fields.count, 0);
    final text = PdfTextExtractor(doc).extractText();
    expect(text, contains('Thorin'));
    doc.dispose();
  });
}
