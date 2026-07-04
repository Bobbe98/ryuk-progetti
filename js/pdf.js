/* ===== Ryuk Docs — Editor PDF =====
 * Visualizzazione con PDF.js, modifiche (testo, elimina/ruota pagine)
 * applicate al salvataggio con pdf-lib.
 */
(function () {
  'use strict';

  var RENDER_SCALE = 1.4;

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  var pagesEl = document.getElementById('pdf-pages');
  var statusEl = document.getElementById('pdf-status');
  var fileNameEl = document.getElementById('pdf-filename');
  var btnSave = document.getElementById('pdf-save');
  var btnAddText = document.getElementById('pdf-add-text');
  var btnExtract = document.getElementById('pdf-extract');
  var fontSizeEl = document.getElementById('pdf-font-size');
  var colorEl = document.getElementById('pdf-text-color');
  var textPanel = document.getElementById('pdf-text-panel');
  var extractedEl = document.getElementById('pdf-extracted');

  var originalBytes = null;   // ArrayBuffer del PDF originale
  var pdfDoc = null;          // documento PDF.js
  var fileName = '';
  var addTextMode = false;
  var editTextMode = false;
  // Stato delle modifiche per pagina (indice 0-based sul documento originale)
  // { deleted, extraRotation, texts: [{x,y,size,color,text}],
  //   edits: [{x,y,w,h,size,text}] (coordinate PDF: sostituzioni di testo esistente),
  //   viewport, widthPts, heightPts }
  var pageState = [];
  var btnEditText = document.getElementById('pdf-edit-text');

  function setStatus(msg) { statusEl.textContent = msg || ''; }

  // ---------- apertura ----------
  function openFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      originalBytes = e.target.result;
      fileName = file.name;
      fileNameEl.textContent = file.name;
      // PDF.js consuma il buffer: passagli una copia
      pdfjsLib.getDocument({ data: originalBytes.slice(0) }).promise
        .then(function (doc) {
          pdfDoc = doc;
          pageState = [];
          for (var i = 0; i < doc.numPages; i++) {
            pageState.push({ deleted: false, extraRotation: 0, texts: [], edits: [], widthPts: 0, heightPts: 0 });
          }
          btnSave.disabled = false;
          btnAddText.disabled = false;
          btnEditText.disabled = false;
          btnExtract.disabled = false;
          renderAllPages();
        })
        .catch(function (err) {
          alert('Impossibile aprire il PDF: ' + err.message);
        });
    };
    reader.readAsArrayBuffer(file);
  }
  window.RyukDocs.pdfOpenFile = openFile;

  // ---------- rendering ----------
  function renderAllPages() {
    pagesEl.innerHTML = '';
    setStatus('Caricamento di ' + pdfDoc.numPages + ' pagine…');
    var chain = Promise.resolve();
    for (var i = 1; i <= pdfDoc.numPages; i++) {
      (function (num) {
        chain = chain.then(function () { return renderPage(num); });
      })(i);
    }
    chain.then(function () {
      setStatus(fileName + ' — ' + pdfDoc.numPages + ' pagine.');
      // modifica diretta: appena il PDF è aperto, il testo è già toccabile
      editTextMode = false;
      enterEditMode();
    });
  }

  function renderPage(num, container) {
    return pdfDoc.getPage(num).then(function (page) {
      var st = pageState[num - 1];
      var viewport = page.getViewport({ scale: RENDER_SCALE, rotation: (page.rotate + st.extraRotation) % 360 });
      st.pageRotate = page.rotate || 0;
      // dimensioni della pagina NON ruotata, in punti PDF
      st.widthPts = page.view[2] - page.view[0];
      st.heightPts = page.view[3] - page.view[1];

      var box = document.createElement('div');
      box.className = 'pdf-page-box';
      box.dataset.page = num;

      var head = document.createElement('div');
      head.className = 'pdf-page-head';
      head.innerHTML = '<span>Pagina ' + num + ' di ' + pdfDoc.numPages + '</span>';
      var actions = document.createElement('div');
      actions.className = 'pdf-page-actions';
      var rotBtn = document.createElement('button');
      rotBtn.className = 'btn btn-small';
      rotBtn.title = 'Ruota di 90°';
      rotBtn.textContent = '↻';
      rotBtn.addEventListener('click', function () {
        st.extraRotation = (st.extraRotation + 90) % 360;
        var fresh = document.createElement('div');
        box.replaceWith(fresh);
        renderPage(num, fresh).then(function () {
          fresh.replaceWith(fresh.firstChild);
        });
        setStatus('Pagina ' + num + ' ruotata. Ricorda di salvare.');
      });
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-small';
      delBtn.title = 'Elimina pagina';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', function () {
        if (pageState.filter(function (p) { return !p.deleted; }).length <= 1) {
          alert('Non puoi eliminare l’ultima pagina rimasta.');
          return;
        }
        if (confirm('Eliminare la pagina ' + num + '? (verrà rimossa al salvataggio)')) {
          st.deleted = true;
          box.remove();
          setStatus('Pagina ' + num + ' eliminata. Ricorda di salvare.');
        }
      });
      actions.appendChild(rotBtn);
      actions.appendChild(delBtn);
      head.appendChild(actions);
      box.appendChild(head);

      var wrap = document.createElement('div');
      wrap.className = 'pdf-canvas-wrap' + (addTextMode ? ' addtext-mode' : '');
      wrap.dataset.page = num;
      var canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      wrap.appendChild(canvas);
      box.appendChild(wrap);
      (container || pagesEl).appendChild(box);
      st.viewport = viewport;

      wrap.addEventListener('click', function (e) {
        if (!addTextMode) return;
        if (e.target.closest('.pdf-overlay-text') || e.target.closest('.pdf-text-input')) return;
        var rect = wrap.getBoundingClientRect();
        placeTextInput(wrap, num, e.clientX - rect.left, e.clientY - rect.top);
      });

      st.texts.forEach(function (t) { addOverlay(wrap, num, t); });
      st.edits.forEach(function (ed) { addEditOverlay(wrap, num, ed); });
      if (editTextMode) buildTextBoxes(wrap, num);

      return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
    });
  }

  // ---------- modifica del testo esistente ----------
  // Riquadro (in pixel del canvas) di un elemento di testo della pagina
  function itemRect(st, item) {
    var tx = item.transform; // [a,b,c,d,e,f]: e,f = origine della riga (baseline)
    var fontH = Math.hypot(tx[2], tx[3]) || item.height || 10;
    var p0 = st.viewport.convertToViewportPoint(tx[4], tx[5] - fontH * 0.25);
    var p1 = st.viewport.convertToViewportPoint(tx[4] + item.width, tx[5] + fontH * 0.8);
    return {
      left: Math.min(p0[0], p1[0]), top: Math.min(p0[1], p1[1]),
      w: Math.abs(p1[0] - p0[0]), h: Math.abs(p1[1] - p0[1]),
      fontH: fontH
    };
  }

  function buildTextBoxes(wrap, num) {
    return pdfDoc.getPage(num).then(function (page) {
      return page.getTextContent();
    }).then(function (tc) {
      var st = pageState[num - 1];
      var count = 0;
      tc.items.forEach(function (item) {
        if (!item.str || !item.str.trim() || !item.width) return;
        count++;
        var r = itemRect(st, item);
        var boxEl = document.createElement('div');
        boxEl.className = 'pdf-textbox';
        boxEl.style.left = r.left + 'px';
        boxEl.style.top = r.top + 'px';
        boxEl.style.width = r.w + 'px';
        boxEl.style.height = r.h + 'px';
        boxEl.title = 'Tocca per modificare: ' + item.str;
        boxEl.addEventListener('click', function (e) {
          e.stopPropagation();
          openEditInput(wrap, num, item, r, boxEl);
        });
        wrap.appendChild(boxEl);
      });
      return count;
    });
  }

  function enterEditMode() {
    if (editTextMode) return;
    editTextMode = true;
    btnEditText.classList.add('on');
    if (addTextMode) {
      addTextMode = false;
      btnAddText.classList.remove('on');
      document.querySelectorAll('.pdf-canvas-wrap').forEach(function (w) { w.classList.remove('addtext-mode'); });
    }
    var jobs = [];
    document.querySelectorAll('.pdf-canvas-wrap').forEach(function (w) {
      jobs.push(buildTextBoxes(w, +w.dataset.page));
    });
    Promise.all(jobs).then(function (counts) {
      var total = counts.reduce(function (a, b) { return a + b; }, 0);
      if (total === 0) {
        setStatus('⚠️ In questo PDF non c’è testo modificabile: probabilmente è una scansione (immagine). Usa «Aggiungi testo» per scriverci sopra.');
      } else {
        setStatus('Modifica attiva: tocca una scritta evidenziata per cambiarla. ' + total + ' testi trovati.');
      }
    });
  }

  function removeTextBoxes() {
    document.querySelectorAll('.pdf-textbox').forEach(function (b) { b.remove(); });
  }

  function openEditInput(wrap, pageNum, item, r, boxEl) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'pdf-text-input pdf-edit-input';
    input.value = item.str;
    input.style.left = r.left + 'px';
    input.style.top = (r.top + r.h / 2) + 'px';
    input.style.minWidth = Math.max(160, r.w + 20) + 'px';
    input.style.fontSize = Math.max(11, r.h * 0.75) + 'px';
    wrap.appendChild(input);
    input.focus();
    input.select();
    setStatus('Modifica il testo e premi Invio (lascia vuoto per cancellarlo). Esc per annullare.');

    var committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      var text = input.value;
      input.remove();
      if (text === item.str) return; // nessuna modifica
      var tx = item.transform;
      var ed = {
        x: tx[4], y: tx[5],            // baseline in coordinate PDF
        w: item.width, h: r.fontH,
        size: Math.round(r.fontH),
        text: text
      };
      pageState[pageNum - 1].edits.push(ed);
      if (boxEl) boxEl.remove();
      addEditOverlay(wrap, pageNum, ed);
      setStatus('Testo modificato a pagina ' + pageNum + '. Ricorda di salvare.');
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { committed = true; input.remove(); }
      e.stopPropagation();
    });
    input.addEventListener('blur', function () { commit(); });
  }

  // Mostra subito l'effetto della sostituzione: toppa bianca + nuovo testo
  function addEditOverlay(wrap, pageNum, ed) {
    var st = pageState[pageNum - 1];
    var p0 = st.viewport.convertToViewportPoint(ed.x, ed.y - ed.h * 0.3);
    var p1 = st.viewport.convertToViewportPoint(ed.x + ed.w, ed.y + ed.h * 0.85);
    var left = Math.min(p0[0], p1[0]), top = Math.min(p0[1], p1[1]);
    var w = Math.abs(p1[0] - p0[0]), h = Math.abs(p1[1] - p0[1]);
    var div = document.createElement('div');
    div.className = 'pdf-edit-overlay';
    div.style.left = left + 'px';
    div.style.top = top + 'px';
    div.style.minWidth = w + 'px';
    div.style.height = h + 'px';
    div.style.fontSize = (ed.h * RENDER_SCALE * 0.95) + 'px';
    div.textContent = ed.text;
    div.title = 'Testo modificato — ✕ per ripristinare l’originale';
    var del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      var arr = st.edits;
      var i = arr.indexOf(ed);
      if (i >= 0) arr.splice(i, 1);
      div.remove();
      setStatus('Modifica annullata: il testo originale è stato ripristinato.');
    });
    div.appendChild(del);
    wrap.appendChild(div);
  }

  // ---------- modalità ----------
  btnEditText.addEventListener('click', function () {
    if (!editTextMode) {
      enterEditMode();
    } else {
      editTextMode = false;
      btnEditText.classList.remove('on');
      removeTextBoxes();
      setStatus('');
    }
  });

  // ---------- aggiunta testo ----------
  btnAddText.addEventListener('click', function () {
    addTextMode = !addTextMode;
    btnAddText.classList.toggle('on', addTextMode);
    if (addTextMode && editTextMode) {
      editTextMode = false;
      btnEditText.classList.remove('on');
      removeTextBoxes();
    }
    document.querySelectorAll('.pdf-canvas-wrap').forEach(function (w) {
      w.classList.toggle('addtext-mode', addTextMode);
    });
    setStatus(addTextMode
      ? 'Modalità testo attiva: clicca sul punto della pagina dove vuoi scrivere.'
      : '');
  });

  function placeTextInput(wrap, pageNum, x, y) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'pdf-text-input';
    input.placeholder = 'Scrivi e premi Invio…';
    var size = parseInt(fontSizeEl.value, 10) || 14;
    input.style.left = x + 'px';
    input.style.top = y + 'px';
    input.style.fontSize = (size * RENDER_SCALE) + 'px';
    input.style.color = colorEl.value;
    wrap.appendChild(input);
    input.focus();

    var committed = false;
    function commit() {
      if (committed) return; // la rimozione dell'input scatena anche il blur
      committed = true;
      var text = input.value.trim();
      input.remove();
      if (!text) return;
      var t = {
        x: x, y: y, // coordinate in pixel del canvas renderizzato
        size: size,
        color: colorEl.value,
        text: text
      };
      pageState[pageNum - 1].texts.push(t);
      addOverlay(wrap, pageNum, t);
      setStatus('Testo aggiunto alla pagina ' + pageNum + '. Ricorda di salvare.');
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { committed = true; input.remove(); }
    });
    input.addEventListener('blur', function () { commit(); });
  }

  function addOverlay(wrap, pageNum, t) {
    var div = document.createElement('div');
    div.className = 'pdf-overlay-text';
    div.textContent = t.text;
    div.style.left = t.x + 'px';
    div.style.top = t.y + 'px';
    div.style.fontSize = (t.size * RENDER_SCALE) + 'px';
    div.style.color = t.color;
    div.title = 'Trascina per spostare';
    var del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Rimuovi questo testo';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      var arr = pageState[pageNum - 1].texts;
      var i = arr.indexOf(t);
      if (i >= 0) arr.splice(i, 1);
      div.remove();
    });
    div.appendChild(del);
    wrap.appendChild(div);

    // trascinamento per riposizionare (pointer events: funziona con mouse e touch)
    div.addEventListener('pointerdown', function (e) {
      if (e.target === del) return;
      e.preventDefault();
      div.setPointerCapture(e.pointerId);
      var startX = e.clientX, startY = e.clientY, origX = t.x, origY = t.y;
      function move(ev) {
        t.x = origX + (ev.clientX - startX);
        t.y = origY + (ev.clientY - startY);
        div.style.left = t.x + 'px';
        div.style.top = t.y + 'px';
      }
      function up(ev) {
        div.releasePointerCapture(ev.pointerId);
        div.removeEventListener('pointermove', move);
        div.removeEventListener('pointerup', up);
      }
      div.addEventListener('pointermove', move);
      div.addEventListener('pointerup', up);
    });
  }

  // ---------- estrazione testo ----------
  btnExtract.addEventListener('click', function () {
    setStatus('Estrazione del testo…');
    var parts = [];
    var chain = Promise.resolve();
    for (var i = 1; i <= pdfDoc.numPages; i++) {
      (function (num) {
        chain = chain.then(function () {
          return pdfDoc.getPage(num).then(function (page) {
            return page.getTextContent();
          }).then(function (tc) {
            var text = tc.items.map(function (it) { return it.str; }).join(' ');
            parts.push('===== Pagina ' + num + ' =====\n' + text);
          });
        });
      })(i);
    }
    chain.then(function () {
      extractedEl.value = parts.join('\n\n');
      textPanel.classList.remove('hidden');
      setStatus('Testo estratto da ' + pdfDoc.numPages + ' pagine.');
    });
  });
  document.getElementById('pdf-text-close').addEventListener('click', function () {
    textPanel.classList.add('hidden');
  });
  document.getElementById('pdf-copy-text').addEventListener('click', function () {
    extractedEl.select();
    navigator.clipboard.writeText(extractedEl.value).then(function () {
      setStatus('Testo copiato negli appunti.');
    }).catch(function () {
      document.execCommand('copy');
      setStatus('Testo copiato negli appunti.');
    });
  });

  // ---------- salvataggio ----------
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
  }

  btnSave.addEventListener('click', function () {
    setStatus('Creazione del PDF…');
    var PDFLib = window.PDFLib;
    PDFLib.PDFDocument.load(originalBytes.slice(0))
      .then(function (doc) {
        return doc.embedFont(PDFLib.StandardFonts.Helvetica).then(function (font) {
          return { doc: doc, font: font };
        });
      })
      .then(function (ctx) {
        var doc = ctx.doc, font = ctx.font;
        var pages = doc.getPages();

        pageState.forEach(function (st, idx) {
          if (st.deleted || idx >= pages.length) return;
          var page = pages[idx];
          // rotazione extra richiesta dall'utente
          if (st.extraRotation) {
            var current = page.getRotation().angle || 0;
            page.setRotation(PDFLib.degrees((current + st.extraRotation) % 360));
          }
          // sostituzioni di testo esistente: toppa bianca + nuovo testo
          st.edits.forEach(function (ed) {
            page.drawRectangle({
              x: ed.x - 1.5,
              y: ed.y - ed.h * 0.3,
              width: ed.w + 3,
              height: ed.h * 1.2,
              color: PDFLib.rgb(1, 1, 1)
            });
            if (ed.text && ed.text.trim()) {
              var safe = ed.text;
              try {
                page.drawText(safe, { x: ed.x, y: ed.y, size: ed.size, font: font, color: PDFLib.rgb(0, 0, 0) });
              } catch (encErr) {
                // caratteri non supportati dal font: sostituiscili
                safe = safe.replace(/[^\x20-\x7EàèéìòùÀÈÉÌÒÙçÇ°€£'’"«»\-]/g, '?');
                page.drawText(safe, { x: ed.x, y: ed.y, size: ed.size, font: font, color: PDFLib.rgb(0, 0, 0) });
              }
            }
          });
          // testi aggiunti: converti i pixel del canvas in punti PDF.
          // Nota: il canvas è renderizzato già ruotato, quindi il click va
          // riportato nel sistema di coordinate non ruotato della pagina.
          st.texts.forEach(function (t) {
            var col = hexToRgb(t.color);
            var pxX = t.x / RENDER_SCALE;   // in punti, nel sistema del canvas ruotato
            var pxY = t.y / RENDER_SCALE;
            var W = st.widthPts, H = st.heightPts;
            var rot = (st.pageRotate + st.extraRotation) % 360;
            var x, y;
            if (rot === 90)      { x = pxY;         y = pxX; }
            else if (rot === 180){ x = W - pxX;     y = pxY; }
            else if (rot === 270){ x = W - pxY;     y = H - pxX; }
            else                 { x = pxX;         y = H - pxY; }
            page.drawText(t.text, {
              x: x,
              y: y - t.size * 0.35, // il click indica il centro verticale del testo
              size: t.size,
              font: font,
              color: PDFLib.rgb(col.r, col.g, col.b),
              // compensa la rotazione di visualizzazione: il testo resta orizzontale
              rotate: PDFLib.degrees(rot)
            });
          });
        });

        // elimina le pagine (dall'ultima alla prima per non spostare gli indici)
        for (var i = pageState.length - 1; i >= 0; i--) {
          if (pageState[i].deleted && i < doc.getPageCount()) doc.removePage(i);
        }
        return doc.save();
      })
      .then(function (bytes) {
        var blob = new Blob([bytes], { type: 'application/pdf' });
        var name = fileName.replace(/\.pdf$/i, '') + '-modificato.pdf';
        window.RyukDocs.download(blob, name);
        setStatus('PDF salvato: ' + name);
      })
      .catch(function (err) {
        alert('Errore durante il salvataggio: ' + err.message);
        setStatus('');
      });
  });

  // ---------- pulsanti ----------
  document.getElementById('pdf-open').addEventListener('click', function () {
    document.getElementById('pdf-file-input').click();
  });
  document.getElementById('pdf-file-input').addEventListener('change', function (e) {
    if (e.target.files.length) { openFile(e.target.files[0]); e.target.value = ''; }
  });
})();
