/* ===== Ryuk Docs — Editor Word =====
 * Lettura .docx con Mammoth, modifica con editor rich-text,
 * salvataggio in .docx con html-docx-js.
 */
(function () {
  'use strict';

  var editor = document.getElementById('wd-editor');
  var statusEl = document.getElementById('wd-status');
  var fileNameEl = document.getElementById('wd-filename');
  var fileName = '';

  function setStatus(msg) { statusEl.textContent = msg || ''; }

  function updateCount() {
    var text = editor.innerText || '';
    var words = (text.trim().match(/\S+/g) || []).length;
    setStatus(words + ' parole · ' + text.length + ' caratteri');
  }
  editor.addEventListener('input', updateCount);

  // ---------- apertura ----------
  function openFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      mammoth.convertToHtml({ arrayBuffer: e.target.result })
        .then(function (result) {
          editor.innerHTML = result.value || '<p></p>';
          fileName = file.name;
          fileNameEl.textContent = file.name;
          updateCount();
          if (result.messages && result.messages.length) {
            console.warn('Mammoth:', result.messages);
          }
        })
        .catch(function (err) {
          alert('Impossibile aprire il documento: ' + err.message);
        });
    };
    reader.readAsArrayBuffer(file);
  }
  window.RyukDocs.wordOpenFile = openFile;

  // ---------- salvataggio ----------
  function saveDocx() {
    var content =
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
      editor.innerHTML +
      '</body></html>';
    var blob = htmlDocx.asBlob(content, { orientation: 'portrait' });
    var name = fileName ? fileName.replace(/\.docx$/i, '') + '.docx' : 'documento.docx';
    window.RyukDocs.download(blob, name);
    setStatus('Documento salvato: ' + name);
  }

  // ---------- toolbar ----------
  document.querySelectorAll('#panel-word .btn-fmt').forEach(function (b) {
    b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // non perdere la selezione
    b.addEventListener('click', function () {
      document.execCommand(b.dataset.cmd, false, null);
      editor.focus();
    });
  });

  document.getElementById('wd-block').addEventListener('change', function (e) {
    document.execCommand('formatBlock', false, e.target.value);
    editor.focus();
  });
  document.getElementById('wd-fontsize').addEventListener('change', function (e) {
    document.execCommand('fontSize', false, e.target.value);
    editor.focus();
  });
  document.getElementById('wd-color').addEventListener('input', function (e) {
    document.execCommand('foreColor', false, e.target.value);
    editor.focus();
  });
  document.getElementById('wd-bgcolor').addEventListener('input', function (e) {
    document.execCommand('hiliteColor', false, e.target.value);
    editor.focus();
  });
  document.getElementById('wd-link').addEventListener('click', function () {
    var url = prompt('Indirizzo del collegamento (es. https://esempio.it):');
    if (url) document.execCommand('createLink', false, url);
    editor.focus();
  });

  document.getElementById('wd-new').addEventListener('click', function () {
    if (confirm('Creare un nuovo documento vuoto? Le modifiche non salvate andranno perse.')) {
      editor.innerHTML = '<p></p>';
      fileName = '';
      fileNameEl.textContent = '';
      updateCount();
      editor.focus();
    }
  });
  document.getElementById('wd-open').addEventListener('click', function () {
    document.getElementById('wd-file-input').click();
  });
  document.getElementById('wd-file-input').addEventListener('change', function (e) {
    if (e.target.files.length) { openFile(e.target.files[0]); e.target.value = ''; }
  });
  document.getElementById('wd-save').addEventListener('click', saveDocx);
  document.getElementById('wd-print').addEventListener('click', function () {
    // Stampa solo il documento: finestra dedicata con il contenuto dell'editor
    var w = window.open('', '_blank');
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      (fileName || 'Documento') +
      '</title><style>body{font-family:Segoe UI,Arial,sans-serif;line-height:1.6;max-width:800px;margin:40px auto;padding:0 20px}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}</style></head><body>' +
      editor.innerHTML + '</body></html>');
    w.document.close();
    w.focus();
    w.print();
  });

  updateCount();
})();
