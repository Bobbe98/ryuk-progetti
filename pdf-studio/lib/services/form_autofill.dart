import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

/// Un dato del profilo usato per la compilazione automatica dei moduli.
class ProfileField {
  const ProfileField(this.key, this.label, this.patterns, {this.hint});
  final String key;
  final String label;
  final String? hint;

  /// Frammenti (già normalizzati) cercati nel nome del campo PDF.
  final List<String> patterns;
}

/// Ordine importante: i più specifici prima (es. "luogo nascita" prima di "nascita").
const profileFields = <ProfileField>[
  ProfileField('azienda', 'Azienda', ['azienda', 'ditta', 'societa', 'company', 'ragionesociale']),
  ProfileField('cognome', 'Cognome', ['cognome', 'surname', 'lastname', 'familyname']),
  ProfileField('nome', 'Nome', ['nome', 'firstname', 'givenname', 'name']),
  ProfileField('codiceFiscale', 'Codice fiscale', ['codicefiscale', 'codfisc', 'fiscalcode', 'taxcode', 'cf']),
  ProfileField('luogoNascita', 'Luogo di nascita', ['luogonascita', 'luogodinascita', 'natoa', 'birthplace', 'placeofbirth']),
  ProfileField('dataNascita', 'Data di nascita', ['datanascita', 'datadinascita', 'natoil', 'nascita', 'birth', 'dob'],
      hint: 'gg/mm/aaaa'),
  ProfileField('indirizzo', 'Indirizzo', ['indirizzo', 'address', 'residenza', 'street', 'via']),
  ProfileField('cap', 'CAP', ['cap', 'zip', 'postal', 'postcode']),
  ProfileField('citta', 'Città', ['citta', 'comune', 'city', 'town', 'localita']),
  ProfileField('provincia', 'Provincia', ['provincia', 'prov', 'county']),
  ProfileField('telefono', 'Telefono', ['telefono', 'cellulare', 'phone', 'mobile', 'tel', 'cell']),
  ProfileField('email', 'Email', ['email', 'mail', 'pec']),
  ProfileField('piva', 'Partita IVA', ['partitaiva', 'piva', 'vat']),
];

String _normalize(String s) {
  const accents = {'à': 'a', 'è': 'e', 'é': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u'};
  final lower = s.toLowerCase().split('').map((c) => accents[c] ?? c).join();
  return lower.replaceAll(RegExp(r'[^a-z0-9]'), '');
}

bool _matches(String name, String pattern) {
  // Frammenti corti (cf, cap, tel, via...) solo come parola intera o prefisso/suffisso.
  if (pattern.length <= 4) {
    return name == pattern || name.startsWith(pattern) || name.endsWith(pattern);
  }
  return name.contains(pattern);
}

String today() {
  final d = DateTime.now();
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.day)}/${two(d.month)}/${d.year}';
}

/// Valore suggerito per un campo dal suo nome, oppure null.
String? suggestValue(String fieldName, Map<String, String> profile) {
  final name = _normalize(fieldName.split('.').last);
  if (name.isEmpty) return null;
  final nome = profile['nome'] ?? '', cognome = profile['cognome'] ?? '';
  if (['nomecognome', 'cognomenome', 'nominativo', 'fullname', 'nomeecognome', 'cognomeenome']
      .any(name.contains)) {
    final full = name.startsWith('cognome') ? '$cognome $nome' : '$nome $cognome';
    return full.trim().isEmpty ? null : full.trim();
  }
  for (final f in profileFields) {
    if (f.patterns.any((p) => _matches(name, p))) {
      final v = profile[f.key];
      return (v == null || v.trim().isEmpty) ? null : v.trim();
    }
  }
  if (name.startsWith('data') || name.startsWith('date') || name == 'il') return today();
  return null;
}

/// Compila i campi di testo vuoti. Ritorna il numero di campi compilati.
int autofill(List<PdfFormField> fields, Map<String, String> profile) {
  var count = 0;
  for (final f in fields) {
    if (f is! PdfTextFormField || f.readOnly || f.text.trim().isNotEmpty) continue;
    final v = suggestValue(f.name, profile);
    if (v != null) {
      f.text = v;
      count++;
    }
  }
  return count;
}
