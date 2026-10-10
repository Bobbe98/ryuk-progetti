import 'package:flutter_test/flutter_test.dart';
import 'package:pdf_studio/services/form_autofill.dart';

void main() {
  const profile = {
    'nome': 'Roberto',
    'cognome': 'Rossi',
    'codiceFiscale': 'RSSRRT90A01H501U',
    'luogoNascita': 'Roma',
    'dataNascita': '01/01/1990',
    'indirizzo': 'Via Roma 1',
    'cap': '00100',
    'citta': 'Roma',
    'telefono': '3330000000',
    'email': 'a@b.it',
    'azienda': 'ACME',
  };

  test('riconosce i campi italiani e inglesi', () {
    expect(suggestValue('Nome', profile), 'Roberto');
    expect(suggestValue('form1.Cognome_1', profile), 'Rossi');
    expect(suggestValue('LastName', profile), 'Rossi');
    expect(suggestValue('first_name', profile), 'Roberto');
    expect(suggestValue('Codice Fiscale', profile), 'RSSRRT90A01H501U');
    expect(suggestValue('CF', profile), 'RSSRRT90A01H501U');
    expect(suggestValue('luogo_nascita', profile), 'Roma');
    expect(suggestValue('data_nascita', profile), '01/01/1990');
    expect(suggestValue('nato_il', profile), '01/01/1990');
    expect(suggestValue('E-mail', profile), 'a@b.it');
    expect(suggestValue('CAP', profile), '00100');
    expect(suggestValue('Città', profile), 'Roma');
    expect(suggestValue('nome_azienda', profile), 'ACME');
    expect(suggestValue('Nome e Cognome', profile), 'Roberto Rossi');
    expect(suggestValue('cognome_nome', profile), 'Rossi Roberto');
    expect(suggestValue('Data', profile), today());
  });

  test('campi sconosciuti o profilo vuoto', () {
    expect(suggestValue('Note aggiuntive', profile), isNull);
    expect(suggestValue('Nome', const {}), isNull);
  });
}
