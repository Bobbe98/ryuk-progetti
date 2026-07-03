/* ===== Ryuk Docs — Editor Excel =====
 * Griglia editabile con motore di calcolo HyperFormula (380+ funzioni Excel)
 * e import/export .xlsx/.xls/.csv tramite SheetJS.
 */
(function () {
  'use strict';

  var MIN_ROWS = 60, MIN_COLS = 26, PAD = 5;

  var hf = null;             // istanza HyperFormula
  var sheetIds = [];         // id dei fogli, in ordine di tab
  var activeSheet = 0;       // id foglio attivo
  var rows = MIN_ROWS, cols = MIN_COLS;
  var sel = { row: 0, col: 0 };
  var editing = null;        // input di modifica dentro la cella
  var fileName = '';

  var gridWrap = document.getElementById('xl-grid-wrap');
  var cellNameEl = document.getElementById('xl-cellname');
  var formulaInput = document.getElementById('xl-formula-input');
  var sheetTabsEl = document.getElementById('xl-sheet-tabs');
  var statusEl = document.getElementById('xl-status');
  var fileNameEl = document.getElementById('xl-filename');

  // ---------- utilità ----------
  function colName(i) {
    var s = '';
    i += 1;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  function cellRef(r, c) { return colName(c) + (r + 1); }
  function setStatus(msg) { statusEl.textContent = msg || ''; }

  function displayValue(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') {
      if (!isFinite(v)) return '#NUM!';
      if (Number.isInteger(v)) return String(v);
      return String(parseFloat(v.toPrecision(12)));
    }
    if (typeof v === 'boolean') return v ? 'VERO' : 'FALSO';
    if (v instanceof Date) return v.toLocaleDateString();
    if (typeof v === 'object' && v.value) return String(v.value); // DetailedCellError → "#DIV/0!" ecc.
    return String(v);
  }
  function isErrorValue(v) {
    return v && typeof v === 'object' && typeof v.value === 'string' && v.value.charAt(0) === '#';
  }

  // ---------- motore ----------
  function newWorkbook() {
    if (hf) hf.destroy();
    hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' });
    sheetIds = [];
    var name = hf.addSheet('Foglio1');
    sheetIds.push(hf.getSheetId(name));
    activeSheet = sheetIds[0];
    rows = MIN_ROWS; cols = MIN_COLS;
    sel = { row: 0, col: 0 };
    fileName = '';
    fileNameEl.textContent = '';
    buildGrid();
    renderSheetTabs();
    setStatus('Nuovo foglio di lavoro pronto. Suggerimento: scrivi =SUM(A1:A5) in una cella.');
  }

  function ensureSize(sheetId) {
    var dim = hf.getSheetDimensions(sheetId);
    rows = Math.max(MIN_ROWS, dim.height + PAD);
    cols = Math.max(MIN_COLS, dim.width + PAD);
  }

  function setCell(r, c, raw) {
    var content = raw;
    if (typeof raw === 'string' && raw.trim() === '') content = null;
    try {
      hf.setCellContents({ sheet: activeSheet, row: r, col: c }, [[content]]);
    } catch (e) {
      // formula non valida: salvala come testo per non perdere il lavoro
      hf.setCellContents({ sheet: activeSheet, row: r, col: c }, [["'" + raw]]);
      setStatus('⚠️ Formula non riconosciuta, salvata come testo: ' + raw);
    }
  }

  // ---------- griglia ----------
  function buildGrid() {
    ensureSize(activeSheet);
    var html = '<table class="grid"><thead><tr><th class="corner"></th>';
    for (var c = 0; c < cols; c++) html += '<th data-c="' + c + '">' + colName(c) + '</th>';
    html += '</tr></thead><tbody>';
    for (var r = 0; r < rows; r++) {
      html += '<tr><th data-r="' + r + '">' + (r + 1) + '</th>';
      for (var c2 = 0; c2 < cols; c2++) {
        html += '<td data-r="' + r + '" data-c="' + c2 + '"></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    gridWrap.innerHTML = html;
    refreshValues();
    updateSelection();
  }

  function refreshValues() {
    var tds = gridWrap.querySelectorAll('td');
    for (var i = 0; i < tds.length; i++) {
      var td = tds[i];
      var r = +td.dataset.r, c = +td.dataset.c;
      var v;
      try { v = hf.getCellValue({ sheet: activeSheet, row: r, col: c }); }
      catch (e) { v = null; }
      td.textContent = displayValue(v);
      td.className = '';
      if (typeof v === 'number') td.classList.add('num');
      if (isErrorValue(v)) td.classList.add('err');
    }
    var selTd = tdAt(sel.row, sel.col);
    if (selTd) selTd.classList.add('sel');
  }

  function tdAt(r, c) {
    return gridWrap.querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
  }

  function updateSelection() {
    gridWrap.querySelectorAll('td.sel').forEach(function (td) { td.classList.remove('sel'); });
    gridWrap.querySelectorAll('th.hl').forEach(function (th) { th.classList.remove('hl'); });
    var td = tdAt(sel.row, sel.col);
    if (td) {
      td.classList.add('sel');
      td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    var ch = gridWrap.querySelector('thead th[data-c="' + sel.col + '"]');
    var rh = gridWrap.querySelector('tbody th[data-r="' + sel.row + '"]');
    if (ch) ch.classList.add('hl');
    if (rh) rh.classList.add('hl');
    cellNameEl.textContent = cellRef(sel.row, sel.col);
    var serialized = '';
    try { serialized = hf.getCellSerialized({ sheet: activeSheet, row: sel.row, col: sel.col }); } catch (e) {}
    if (serialized === null || serialized === undefined) serialized = '';
    formulaInput.value = String(serialized);
    var v = hf.getCellValue({ sheet: activeSheet, row: sel.row, col: sel.col });
    if (String(serialized).charAt(0) === '=') {
      setStatus(cellRef(sel.row, sel.col) + '  →  ' + displayValue(v));
    } else {
      setStatus('');
    }
  }

  function selectCell(r, c) {
    commitEditor(true);
    sel.row = Math.max(0, Math.min(rows - 1, r));
    sel.col = Math.max(0, Math.min(cols - 1, c));
    updateSelection();
  }

  // ---------- editing in cella ----------
  function startEdit(initial) {
    if (editing) return;
    var td = tdAt(sel.row, sel.col);
    if (!td) return;
    var current = '';
    try {
      var s = hf.getCellSerialized({ sheet: activeSheet, row: sel.row, col: sel.col });
      if (s !== null && s !== undefined) current = String(s);
    } catch (e) {}
    var input = document.createElement('input');
    input.className = 'cell-editor';
    input.value = initial !== undefined ? initial : current;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    if (initial === undefined) input.select();
    editing = input;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitEditor(true); selectCell(sel.row + 1, sel.col); }
      else if (e.key === 'Tab') { e.preventDefault(); commitEditor(true); selectCell(sel.row, sel.col + 1); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEditor(); }
      e.stopPropagation();
    });
    input.addEventListener('blur', function () { commitEditor(true); });
  }

  function commitEditor(apply) {
    if (!editing) return;
    var input = editing;
    editing = null;
    var val = input.value;
    var td = input.parentElement;
    if (td) input.remove();
    if (apply) setCell(sel.row, sel.col, val);
    refreshValues();
    updateSelection();
  }

  function cancelEditor() {
    if (!editing) return;
    var input = editing;
    editing = null;
    input.remove();
    refreshValues();
    updateSelection();
  }

  // ---------- eventi griglia ----------
  gridWrap.addEventListener('mousedown', function (e) {
    var td = e.target.closest('td');
    if (!td || e.target.classList.contains('cell-editor')) return;
    selectCell(+td.dataset.r, +td.dataset.c);
  });
  gridWrap.addEventListener('dblclick', function (e) {
    var td = e.target.closest('td');
    if (!td) return;
    selectCell(+td.dataset.r, +td.dataset.c);
    startEdit();
  });

  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('panel-excel').classList.contains('active')) return;
    if (editing || document.activeElement === formulaInput) return;
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) &&
        !document.activeElement.classList.contains('cell-editor')) return;
    if (document.activeElement && document.activeElement.isContentEditable) return;

    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); selectCell(sel.row - 1, sel.col); return;
      case 'ArrowDown': case 'Enter': e.preventDefault(); selectCell(sel.row + 1, sel.col); return;
      case 'ArrowLeft': e.preventDefault(); selectCell(sel.row, sel.col - 1); return;
      case 'ArrowRight': case 'Tab': e.preventDefault(); selectCell(sel.row, sel.col + 1); return;
      case 'Delete': case 'Backspace':
        e.preventDefault();
        setCell(sel.row, sel.col, null);
        refreshValues(); updateSelection();
        return;
      case 'F2': e.preventDefault(); startEdit(); return;
    }
    // Iniziare a digitare apre l'editor con il carattere digitato
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      startEdit(e.key);
    }
  });

  // ---------- barra della formula ----------
  formulaInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      setCell(sel.row, sel.col, formulaInput.value);
      refreshValues();
      selectCell(sel.row + 1, sel.col);
      gridWrap.focus();
    } else if (e.key === 'Escape') {
      updateSelection();
      formulaInput.blur();
    }
  });

  // ---------- fogli ----------
  function renderSheetTabs() {
    sheetTabsEl.innerHTML = '';
    sheetIds.forEach(function (id) {
      var b = document.createElement('button');
      b.className = 'sheet-tab' + (id === activeSheet ? ' active' : '');
      b.textContent = hf.getSheetName(id);
      b.addEventListener('click', function () {
        commitEditor(true);
        activeSheet = id;
        sel = { row: 0, col: 0 };
        buildGrid();
        renderSheetTabs();
      });
      b.addEventListener('dblclick', function () {
        var name = prompt('Nuovo nome del foglio:', hf.getSheetName(id));
        if (name) {
          try { hf.renameSheet(id, name); renderSheetTabs(); }
          catch (err) { alert('Nome non valido o già in uso.'); }
        }
      });
      b.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (sheetIds.length <= 1) { alert('Non puoi eliminare l’unico foglio.'); return; }
        if (confirm('Eliminare il foglio "' + hf.getSheetName(id) + '"?')) {
          hf.removeSheet(id);
          sheetIds = sheetIds.filter(function (s) { return s !== id; });
          if (activeSheet === id) activeSheet = sheetIds[0];
          buildGrid();
          renderSheetTabs();
        }
      });
      sheetTabsEl.appendChild(b);
    });
  }

  document.getElementById('xl-add-sheet').addEventListener('click', function () {
    var base = 'Foglio', n = sheetIds.length + 1;
    while (hf.getSheetId(base + n) !== undefined) n++;
    var name = hf.addSheet(base + n);
    var id = hf.getSheetId(name);
    sheetIds.push(id);
    activeSheet = id;
    sel = { row: 0, col: 0 };
    buildGrid();
    renderSheetTabs();
  });

  // ---------- apertura file ----------
  function openFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: false });
        loadWorkbook(wb, file.name);
      } catch (err) {
        alert('Impossibile aprire il file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }
  window.RyukDocs.excelOpenFile = openFile;

  function loadWorkbook(wb, name) {
    if (hf) hf.destroy();
    hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' });
    sheetIds = [];
    var formulasAsText = 0;

    wb.SheetNames.forEach(function (sn) {
      var ws = wb.Sheets[sn];
      var added = hf.addSheet(sn);
      var id = hf.getSheetId(added);
      sheetIds.push(id);
      if (!ws || !ws['!ref']) return;
      var range = XLSX.utils.decode_range(ws['!ref']);
      var data = [];
      for (var r = range.s.r; r <= range.e.r; r++) {
        var row = [];
        for (var c = range.s.c; c <= range.e.c; c++) {
          var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
          if (!cell) { row.push(null); continue; }
          if (cell.f) row.push('=' + cell.f);
          else if (cell.v === undefined) row.push(null);
          else row.push(cell.v);
        }
        data.push(row);
      }
      try {
        hf.setSheetContent(id, data);
      } catch (err) {
        // qualche formula non è supportata: riprova cella per cella
        for (var r2 = 0; r2 < data.length; r2++) {
          for (var c2 = 0; c2 < data[r2].length; c2++) {
            var v = data[r2][c2];
            if (v === null) continue;
            try {
              hf.setCellContents({ sheet: id, row: r2, col: c2 }, [[v]]);
            } catch (err2) {
              hf.setCellContents({ sheet: id, row: r2, col: c2 }, [[String(v)]]);
              formulasAsText++;
            }
          }
        }
      }
    });

    if (!sheetIds.length) {
      var n0 = hf.addSheet('Foglio1');
      sheetIds.push(hf.getSheetId(n0));
    }
    activeSheet = sheetIds[0];
    sel = { row: 0, col: 0 };
    fileName = name;
    fileNameEl.textContent = name;
    buildGrid();
    renderSheetTabs();
    setStatus('File aperto: ' + name +
      (formulasAsText ? ' (⚠️ ' + formulasAsText + ' formule non supportate importate come testo)' : ''));
  }

  // ---------- salvataggio ----------
  function buildXlsxWorkbook() {
    commitEditor(true);
    var wb = XLSX.utils.book_new();
    sheetIds.forEach(function (id) {
      var dim = hf.getSheetDimensions(id);
      var aoa = [];
      for (var r = 0; r < dim.height; r++) {
        var row = [];
        for (var c = 0; c < dim.width; c++) {
          var v = hf.getCellValue({ sheet: id, row: r, col: c });
          if (isErrorValue(v)) v = null;
          if (v !== null && typeof v === 'object' && !(v instanceof Date)) v = String(v);
          row.push(v === undefined ? null : v);
        }
        aoa.push(row);
      }
      var ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [[]]);
      // conserva le formule nel file salvato
      for (var r2 = 0; r2 < dim.height; r2++) {
        for (var c2 = 0; c2 < dim.width; c2++) {
          var f = hf.getCellFormula({ sheet: id, row: r2, col: c2 });
          if (f) {
            var addr = XLSX.utils.encode_cell({ r: r2, c: c2 });
            if (!ws[addr]) ws[addr] = { t: 'n', v: 0 };
            ws[addr].f = f.slice(1);
          }
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, hf.getSheetName(id).slice(0, 31));
    });
    return wb;
  }

  document.getElementById('xl-save').addEventListener('click', function () {
    var wb = buildXlsxWorkbook();
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    var blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var name = fileName ? fileName.replace(/\.(xlsx|xls|csv)$/i, '') + '.xlsx' : 'foglio-di-lavoro.xlsx';
    window.RyukDocs.download(blob, name);
    setStatus('File salvato: ' + name);
  });

  document.getElementById('xl-csv').addEventListener('click', function () {
    var wb = buildXlsxWorkbook();
    var sheetName = hf.getSheetName(activeSheet).slice(0, 31);
    var csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    window.RyukDocs.download(blob, sheetName + '.csv');
    setStatus('CSV esportato: ' + sheetName + '.csv');
  });

  // ---------- altri pulsanti ----------
  document.getElementById('xl-new').addEventListener('click', function () {
    if (confirm('Creare un nuovo foglio di lavoro vuoto? Le modifiche non salvate andranno perse.')) newWorkbook();
  });
  document.getElementById('xl-open').addEventListener('click', function () {
    document.getElementById('xl-file-input').click();
  });
  document.getElementById('xl-file-input').addEventListener('change', function (e) {
    if (e.target.files.length) { openFile(e.target.files[0]); e.target.value = ''; }
  });
  document.getElementById('xl-add-row').addEventListener('click', function () {
    rows += 10; buildGrid();
    setStatus('Aggiunte 10 righe (totale ' + rows + ').');
  });
  document.getElementById('xl-add-col').addEventListener('click', function () {
    cols += 5; buildGrid();
    setStatus('Aggiunte 5 colonne (totale ' + cols + ').');
  });

  // ---------- pannello funzioni ----------
  // Descrizioni in italiano delle funzioni più usate (il motore usa i nomi inglesi).
  var FX_DESC = {
    SUM: 'Somma i numeri. Es: =SUM(A1:A10)',
    AVERAGE: 'Media aritmetica. Es: =AVERAGE(B1:B20)',
    COUNT: 'Conta le celle che contengono numeri. Es: =COUNT(A1:A10)',
    COUNTA: 'Conta le celle non vuote. Es: =COUNTA(A1:A10)',
    COUNTIF: 'Conta le celle che rispettano un criterio. Es: =COUNTIF(A1:A10,">5")',
    COUNTIFS: 'Conta con più criteri. Es: =COUNTIFS(A:A,">5",B:B,"sì")',
    SUMIF: 'Somma con un criterio. Es: =SUMIF(A1:A10,">5")',
    SUMIFS: 'Somma con più criteri. Es: =SUMIFS(C:C,A:A,"mele",B:B,">10")',
    SUMPRODUCT: 'Somma dei prodotti. Es: =SUMPRODUCT(A1:A5,B1:B5)',
    MIN: 'Valore minimo. Es: =MIN(A1:A10)',
    MAX: 'Valore massimo. Es: =MAX(A1:A10)',
    MEDIAN: 'Mediana. Es: =MEDIAN(A1:A10)',
    ROUND: 'Arrotonda. Es: =ROUND(A1,2)',
    ROUNDUP: 'Arrotonda per eccesso. Es: =ROUNDUP(A1,0)',
    ROUNDDOWN: 'Arrotonda per difetto. Es: =ROUNDDOWN(A1,0)',
    INT: 'Parte intera. Es: =INT(A1)',
    ABS: 'Valore assoluto. Es: =ABS(A1)',
    MOD: 'Resto della divisione. Es: =MOD(10,3)',
    POWER: 'Potenza. Es: =POWER(2,8)',
    SQRT: 'Radice quadrata. Es: =SQRT(A1)',
    IF: 'Condizione SE. Es: =IF(A1>10,"alto","basso")',
    IFS: 'Più condizioni in sequenza. Es: =IFS(A1>90,"A",A1>80,"B")',
    IFERROR: 'Valore alternativo in caso di errore. Es: =IFERROR(A1/B1,0)',
    AND: 'E logico. Es: =AND(A1>0,B1>0)',
    OR: 'O logico. Es: =OR(A1>0,B1>0)',
    NOT: 'Negazione. Es: =NOT(A1>0)',
    VLOOKUP: 'Cerca verticale (CERCA.VERT). Es: =VLOOKUP("mela",A1:C10,2,FALSE())',
    HLOOKUP: 'Cerca orizzontale. Es: =HLOOKUP("gen",A1:M2,2,FALSE())',
    XLOOKUP: 'Ricerca moderna. Es: =XLOOKUP(E1,A:A,B:B)',
    INDEX: 'Valore in una posizione. Es: =INDEX(A1:C10,2,3)',
    MATCH: 'Posizione di un valore (CONFRONTA). Es: =MATCH("mela",A1:A10,0)',
    CHOOSE: 'Sceglie da un elenco. Es: =CHOOSE(2,"a","b","c")',
    CONCATENATE: 'Unisce testi. Es: =CONCATENATE(A1," ",B1)',
    TEXT: 'Formatta un numero come testo. Es: =TEXT(A1,"0.00")',
    LEFT: 'Primi caratteri. Es: =LEFT(A1,3)',
    RIGHT: 'Ultimi caratteri. Es: =RIGHT(A1,3)',
    MID: 'Caratteri centrali. Es: =MID(A1,2,4)',
    LEN: 'Lunghezza del testo. Es: =LEN(A1)',
    TRIM: 'Rimuove gli spazi in eccesso. Es: =TRIM(A1)',
    UPPER: 'MAIUSCOLO. Es: =UPPER(A1)',
    LOWER: 'minuscolo. Es: =LOWER(A1)',
    PROPER: 'Iniziali Maiuscole. Es: =PROPER(A1)',
    SUBSTITUTE: 'Sostituisce testo. Es: =SUBSTITUTE(A1,"a","o")',
    FIND: 'Trova testo (maiuscole/minuscole). Es: =FIND("x",A1)',
    SEARCH: 'Trova testo. Es: =SEARCH("x",A1)',
    TODAY: 'Data di oggi. Es: =TODAY()',
    NOW: 'Data e ora attuali. Es: =NOW()',
    DATE: 'Crea una data. Es: =DATE(2026,7,3)',
    YEAR: 'Anno di una data. Es: =YEAR(A1)',
    MONTH: 'Mese di una data. Es: =MONTH(A1)',
    DAY: 'Giorno di una data. Es: =DAY(A1)',
    WEEKDAY: 'Giorno della settimana. Es: =WEEKDAY(A1)',
    DATEDIF: 'Differenza tra date. Es: =DATEDIF(A1,B1,"D")',
    EDATE: 'Data + n mesi. Es: =EDATE(A1,3)',
    EOMONTH: 'Fine mese. Es: =EOMONTH(A1,0)',
    NETWORKDAYS: 'Giorni lavorativi tra due date. Es: =NETWORKDAYS(A1,B1)',
    PMT: 'Rata di un prestito. Es: =PMT(5%/12,120,-10000)',
    FV: 'Valore futuro. Es: =FV(3%/12,60,-100)',
    PV: 'Valore attuale. Es: =PV(3%/12,60,-100)',
    NPV: 'Valore attuale netto. Es: =NPV(8%,B1:B5)',
    IRR: 'Tasso interno di rendimento. Es: =IRR(A1:A6)',
    RATE: 'Tasso per periodo. Es: =RATE(120,-100,10000)',
    NPER: 'Numero di rate. Es: =NPER(5%/12,-200,10000)',
    RAND: 'Numero casuale 0-1. Es: =RAND()',
    RANDBETWEEN: 'Numero casuale intero. Es: =RANDBETWEEN(1,100)',
    RANK: 'Posizione in classifica. Es: =RANK(A1,A1:A10)',
    LARGE: 'N-esimo più grande. Es: =LARGE(A1:A10,2)',
    SMALL: 'N-esimo più piccolo. Es: =SMALL(A1:A10,2)',
    STDEV: 'Deviazione standard (campione). Es: =STDEV(A1:A10)',
    'STDEV.P': 'Deviazione standard (popolazione). Es: =STDEV.P(A1:A10)',
    AVERAGEIF: 'Media con un criterio. Es: =AVERAGEIF(A:A,">0")',
    AVERAGEIFS: 'Media con più criteri. Es: =AVERAGEIFS(C:C,A:A,"si",B:B,">2")',
    ISBLANK: 'Vero se la cella è vuota. Es: =ISBLANK(A1)',
    ISNUMBER: 'Vero se è un numero. Es: =ISNUMBER(A1)',
    ISTEXT: 'Vero se è testo. Es: =ISTEXT(A1)'
  };

  var fxPanel = document.getElementById('xl-fx-panel');
  var fxList = document.getElementById('xl-fx-list');
  var fxSearch = document.getElementById('xl-fx-search');

  function allFunctionNames() {
    try { return hf.getRegisteredFunctionNames(); }
    catch (e) {
      try { return HyperFormula.getRegisteredFunctionNames('enGB'); }
      catch (e2) { return Object.keys(FX_DESC); }
    }
  }

  function renderFxList(filter) {
    var names = allFunctionNames().slice().sort();
    var q = (filter || '').trim().toUpperCase();
    // consenti la ricerca anche con i nomi italiani più comuni
    var ALIAS = {
      'SOMMA': 'SUM', 'MEDIA': 'AVERAGE', 'CONTA': 'COUNT', 'SE': 'IF',
      'CERCA.VERT': 'VLOOKUP', 'CERCA.ORIZZ': 'HLOOKUP', 'CONFRONTA': 'MATCH',
      'INDICE': 'INDEX', 'CONCATENA': 'CONCATENATE', 'OGGI': 'TODAY',
      'ADESSO': 'NOW', 'ARROTONDA': 'ROUND', 'ASS': 'ABS', 'MAIUSC': 'UPPER',
      'MINUSC': 'LOWER', 'LUNGHEZZA': 'LEN', 'ANNULLA.SPAZI': 'TRIM',
      'PIU.SE': 'SUMIF', 'SOMMA.SE': 'SUMIF', 'CONTA.SE': 'COUNTIF',
      'MEDIA.SE': 'AVERAGEIF', 'RATA': 'PMT', 'CASUALE': 'RAND', 'RADQ': 'SQRT'
    };
    if (ALIAS[q]) q = ALIAS[q];
    var shown = 0;
    fxList.innerHTML = '';
    names.forEach(function (n) {
      var desc = FX_DESC[n] || '';
      if (q && n.indexOf(q) === -1 && desc.toUpperCase().indexOf(q) === -1) return;
      if (shown >= 400) return;
      shown++;
      var div = document.createElement('div');
      div.className = 'fx-item';
      div.innerHTML = '<b>' + n + '</b>' + (desc ? '<small>' + desc + '</small>' : '');
      div.title = 'Clicca per inserire nella barra della formula';
      div.addEventListener('click', function () {
        var cur = formulaInput.value;
        if (!cur || cur.charAt(0) !== '=') cur = '=';
        formulaInput.value = cur + n + '(';
        formulaInput.focus();
      });
      fxList.appendChild(div);
    });
    if (!shown) fxList.innerHTML = '<div class="fx-item"><small>Nessuna funzione trovata.</small></div>';
  }

  document.getElementById('xl-fx-help').addEventListener('click', function () {
    fxPanel.classList.toggle('hidden');
    if (!fxPanel.classList.contains('hidden')) { renderFxList(''); fxSearch.focus(); }
  });
  document.getElementById('xl-fx-close').addEventListener('click', function () {
    fxPanel.classList.add('hidden');
  });
  fxSearch.addEventListener('input', function () { renderFxList(fxSearch.value); });

  // ---------- avvio ----------
  newWorkbook();
})();
