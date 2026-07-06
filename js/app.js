/* ===== Ryuk Docs — navigazione e apertura file dalla home ===== */
(function () {
  'use strict';

  window.RyukDocs = window.RyukDocs || {};

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
  }
  window.RyukDocs.switchTab = switchTab;

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { switchTab(t.dataset.tab); });
  });
  document.querySelectorAll('.home-card').forEach(function (c) {
    c.addEventListener('click', function () { switchTab(c.dataset.goto); });
  });

  // Smista un file all'editor giusto in base all'estensione.
  function openFile(file) {
    var name = file.name.toLowerCase();
    if (/\.(xlsx|xls|csv)$/.test(name)) {
      switchTab('excel');
      window.RyukDocs.excelOpenFile(file);
    } else if (/\.docx$/.test(name)) {
      switchTab('word');
      window.RyukDocs.wordOpenFile(file);
    } else if (/\.pdf$/.test(name)) {
      switchTab('pdf');
      window.RyukDocs.pdfOpenFile(file);
    } else {
      alert('Formato non supportato: ' + file.name +
        '\nFormati supportati: .xlsx, .xls, .csv, .docx, .pdf');
    }
  }
  window.RyukDocs.openFile = openFile;

  var dz = document.getElementById('dropzone');
  var input = document.getElementById('home-file-input');
  document.getElementById('btn-home-open').addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () {
    if (input.files.length) { openFile(input.files[0]); input.value = ''; }
  });
  ['dragover', 'dragenter'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('dragover'); });
  });
  dz.addEventListener('drop', function (e) {
    if (e.dataTransfer.files.length) openFile(e.dataTransfer.files[0]);
  });

  // Versione dell'app, visibile in home per capire quale build è in uso
  window.RyukDocs.VERSION = '1.6';
  var verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = 'Versione ' + window.RyukDocs.VERSION;

  // Nell'app Android (Capacitor) i file sono già sul telefono: il service
  // worker serve solo alla versione web. Dentro l'app va rimosso, altrimenti
  // dopo un aggiornamento dell'APK continuerebbe a mostrare i file vecchi.
  if (window.Capacitor) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { r.unregister(); });
      }).catch(function () {});
    }
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) { caches.delete(k); });
      }).catch(function () {});
    }
  } else if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // PWA web: registra il service worker (serve https o localhost)
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline non disponibile */ });
  }

  // Utility comune: scarica un blob come file.
  window.RyukDocs.download = function (blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1500);
  };
})();
