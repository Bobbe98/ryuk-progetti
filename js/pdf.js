/* ===== Ryuk Docs — Editor PDF =====
 * Visualizzazione con PDF.js. Modifica diretta senza modalità:
 *  - tocca una scritta esistente per cambiarla (copri e riscrivi)
 *  - tocca un punto vuoto della pagina per aggiungere testo
 * Le modifiche vengono applicate al salvataggio con pdf-lib.
 * Tutte le posizioni sono salvate in coordinate PDF, quindi restano
 * corrette a qualsiasi zoom, rotazione o dimensione dello schermo.
 */
(function () {
  'use strict';

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  var pagesEl = document.getElementById('pdf-pages');
  var statusEl = document.getElementById('pdf-status');
  var fileNameEl = document.getElementById('pdf-filename');
  var btnSave = document.getElementById('pdf-save');
  var btnExtract = document.getElementById('pdf-extract');
  var fontSizeEl = document.getElementById('pdf-font-size');
  var colorEl = document.getElementById('pdf-text-color');
  var textPanel = document.getElementById('pdf-text-panel');
  var extractedEl = document.getElementById('pdf-extracted');

  var originalBytes = null;   // ArrayBuffer del PDF originale
  var pdfDoc = null;          // documento PDF.js
  var fileName = '';
  // Moduli compilabili (AcroForm): valori inseriti dall'utente, per nome campo
  var formValues = {};        // nome campo → valore
  var formMeta = {};          // nome campo → { type: 'text'|'check'|'radio'|'choice' }
  // Stato per pagina (indice 0-based):
  // { deleted, extraRotation, pageRotate,
  //   texts: [{px,py,size,color,text}]   — testo aggiunto (coordinate PDF)
  //   edits: [{x,y,w,h,size,text}]       — sostituzioni di testo esistente
  //   viewport (CSS), scale, textCount }
  var pageState = [];

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
          formValues = {};
          formMeta = {};
          for (var i = 0; i < doc.numPages; i++) {
            pageState.push({
              deleted: false, extraRotation: 0, pageRotate: 0,
              texts: [], edits: [], viewport: null, scale: 1,
              textCount: 0, fieldCount: 0
            });
          }
          btnSave.disabled = false;
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
        chain = chain.then(function () {
          if (pageState[num - 1].deleted) return;
          return renderPage(num);
        });
      })(i);
    }
    chain.then(function () {
      var totalText = pageState.reduce(function (a, st) { return a + (st.textCount || 0); }, 0);
      var totalFields = pageState.reduce(function (a, st) { return a + (st.fieldCount || 0); }, 0);
      if (totalFields > 0) {
        setStatus('📋 Modulo compilabile: ' + totalFields + ' campi. Tocca un campo e scrivi; ' +
          'puoi anche modificare le altre scritte o aggiungere testo. Poi salva.');
      } else if (totalText === 0) {
        setStatus('⚠️ In questo PDF non c’è testo modificabile (probabilmente è una scansione). ' +
          'Puoi comunque toccare la pagina per scriverci sopra.');
      } else {
        setStatus(fileName + ' — ' + pdfDoc.numPages + ' pagine. ' +
          '✏️ Tocca una scritta per modificarla, tocca un punto vuoto per aggiungere testo.');
      }
    });
  }

  function renderPage(num, container) {
    return pdfDoc.getPage(num).then(function (page) {
      var st = pageState[num - 1];
      st.pageRotate = page.rotate || 0;
      var rot = (st.pageRotate + st.extraRotation) % 360;

      // La pagina si adatta alla larghezza disponibile: niente zoom CSS,
      // così le coordinate di tocco e i riquadri combaciano sempre.
      var base = page.getViewport({ scale: 1, rotation: rot });
      var avail = Math.max(280, (pagesEl.clientWidth || 800) - 36);
      var scale = Math.min(1.6, Math.max(0.4, avail / base.width));
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var renderViewport = page.getViewport({ scale: scale * dpr, rotation: rot });
      var cssViewport = page.getViewport({ scale: scale, rotation: rot });
      st.viewport = cssViewport;
      st.scale = scale;

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
      wrap.className = 'pdf-canvas-wrap';
      wrap.dataset.page = num;
      var canvas = document.createElement('canvas');
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = cssViewport.width + 'px';
      canvas.style.height = cssViewport.height + 'px';
      wrap.appendChild(canvas);
      box.appendChild(wrap);
      (container || pagesEl).appendChild(box);

      // tocco su un punto vuoto della pagina = scrivi qui
      wrap.addEventListener('click', function (e) {
        if (e.target.closest('.pdf-overlay-text') || e.target.closest('.pdf-text-input') ||
            e.target.closest('.pdf-textbox') || e.target.closest('.pdf-edit-overlay') ||
            e.target.closest('.pdf-field') || e.target.closest('.pdf-field-wrap')) return;
        var rect = wrap.getBoundingClientRect();
        placeTextInput(wrap, num, e.clientX - rect.left, e.clientY - rect.top);
      });

      st.texts.forEach(function (t) { addOverlay(wrap, num, t); });
      st.edits.forEach(function (ed) { addEditOverlay(wrap, num, ed); });

      // ENABLE_FORMS: il canvas NON disegna i campi modulo, che vengono
      // sostituiti dalle nostre caselle HTML compilabili
      var annotationMode = (pdfjsLib.AnnotationMode && pdfjsLib.AnnotationMode.ENABLE_FORMS) || 2;
      return Promise.all([
        page.render({ canvasContext: canvas.getContext('2d'), viewport: renderViewport, annotationMode: annotationMode }).promise,
        buildTextBoxes(wrap, num),
        buildFormFields(page, wrap, num)
      ]);
    });
  }

  // ---------- moduli compilabili (AcroForm) ----------
  function buildFormFields(page, wrap, num) {
    var st = pageState[num - 1];
    return page.getAnnotations().then(function (annots) {
      var count = 0;
      annots.forEach(function (a) {
        if (a.subtype !== 'Widget' || !a.fieldName) return;
        var p0 = st.viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
        var p1 = st.viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
        var left = Math.min(p0[0], p1[0]), top = Math.min(p0[1], p1[1]);
        var w = Math.abs(p1[0] - p0[0]), h = Math.abs(p1[1] - p0[1]);
        var el = null;

        if (a.fieldType === 'Tx') {
          el = document.createElement(a.multiLine ? 'textarea' : 'input');
          if (!a.multiLine) el.type = 'text';
          el.value = (a.fieldName in formValues) ? formValues[a.fieldName] : (a.fieldValue || '');
          el.style.fontSize = Math.max(10, Math.min(h * 0.62, 22)) + 'px';
          formMeta[a.fieldName] = { type: 'text' };
          el.addEventListener('input', function () {
            formValues[a.fieldName] = el.value;
            setStatus('Campo «' + a.fieldName + '» compilato. Ricorda di salvare.');
          });
        } else if (a.fieldType === 'Btn' && a.checkBox) {
          el = document.createElement('input');
          el.type = 'checkbox';
          var cur = (a.fieldName in formValues) ? formValues[a.fieldName]
                    : (a.fieldValue && a.fieldValue !== 'Off');
          el.checked = !!cur;
          formMeta[a.fieldName] = { type: 'check' };
          el.addEventListener('change', function () {
            formValues[a.fieldName] = el.checked;
            setStatus('Casella «' + a.fieldName + '» ' + (el.checked ? 'spuntata' : 'tolta') + '. Ricorda di salvare.');
          });
        } else if (a.fieldType === 'Btn' && a.radioButton) {
          el = document.createElement('input');
          el.type = 'radio';
          el.name = 'pdf-radio-' + a.fieldName;
          var val = a.buttonValue || a.exportValue || '';
          el.checked = (a.fieldName in formValues)
            ? formValues[a.fieldName] === val
            : a.fieldValue === val;
          formMeta[a.fieldName] = { type: 'radio' };
          el.addEventListener('change', function () {
            if (el.checked) {
              formValues[a.fieldName] = val;
              setStatus('Opzione selezionata. Ricorda di salvare.');
            }
          });
        } else if (a.fieldType === 'Ch') {
          el = document.createElement('select');
          (a.options || []).forEach(function (o) {
            var opt = document.createElement('option');
            opt.value = o.exportValue !== undefined ? o.exportValue : o.displayValue;
            opt.textContent = o.displayValue !== undefined ? o.displayValue : o.exportValue;
            el.appendChild(opt);
          });
          var chosen = (a.fieldName in formValues) ? formValues[a.fieldName]
                       : (Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue);
          if (chosen !== undefined && chosen !== null) el.value = chosen;
          el.style.fontSize = Math.max(10, Math.min(h * 0.55, 18)) + 'px';
          formMeta[a.fieldName] = { type: 'choice' };
          el.addEventListener('change', function () {
            formValues[a.fieldName] = el.value;
            setStatus('Campo «' + a.fieldName + '» impostato. Ricorda di salvare.');
          });
        }

        if (!el) return;
        count++;
        el.className = 'pdf-field';
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.title = 'Campo del modulo: ' + a.fieldName;
        wrap.appendChild(el);
      });
      st.fieldCount = count;
      return count;
    }).catch(function () { st.fieldCount = 0; return 0; });
  }

  // Riadatta le pagine SOLO quando cambia la larghezza (rotazione del
  // telefono). La tastiera virtuale cambia solo l'altezza: in quel caso
  // non bisogna ridisegnare, altrimenti la casella che l'utente sta
  // usando verrebbe distrutta e la tastiera si chiuderebbe da sola.
  var resizeTimer = null;
  var lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    if (!pdfDoc) return;
    if (window.innerWidth === lastWidth) return;      // è solo la tastiera
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth === lastWidth) return;
      if (document.querySelector('.pdf-text-input')) return; // non mentre si scrive
      lastWidth = window.innerWidth;
      renderAllPages();
    }, 350);
  });

  // ---------- modifica del testo esistente ----------
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
      st.textCount = count;
      return count;
    });
  }

  function openEditInput(wrap, pageNum, item, r, boxEl) {
    var st = pageState[pageNum - 1];
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
    setStatus('Modifica il testo e premi Invio (vuoto = cancella). Esc per annullare.');

    var committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      var text = input.value;
      input.remove();
      if (text === item.str) { setStatus(''); return; } // nessuna modifica
      var tx = item.transform;
      var ed = {
        x: tx[4], y: tx[5],            // baseline in coordinate PDF
        w: item.width, h: r.fontH,
        size: Math.round(r.fontH),
        text: text
      };
      st.edits.push(ed);
      if (boxEl) boxEl.remove();
      addEditOverlay(wrap, pageNum, ed);
      setStatus('Testo modificato a pagina ' + pageNum + '. Ricorda di salvare.');
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { committed = true; input.remove(); setStatus(''); }
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
    div.style.fontSize = (ed.h * st.scale * 0.95) + 'px';
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

  // ---------- aggiunta di testo nuovo ----------
  function placeTextInput(wrap, pageNum, x, y) {
    var st = pageState[pageNum - 1];
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'pdf-text-input';
    input.placeholder = 'Scrivi e premi Invio…';
    var size = parseInt(fontSizeEl.value, 10) || 14;
    input.style.left = x + 'px';
    input.style.top = y + 'px';
    input.style.fontSize = (size * st.scale) + 'px';
    input.style.color = colorEl.value;
    wrap.appendChild(input);
    input.focus();
    setStatus('Scrivi il testo e premi Invio. Esc per annullare.');

    var committed = false;
    function commit() {
      if (committed) return; // la rimozione dell'input scatena anche il blur
      committed = true;
      var text = input.value.trim();
      input.remove();
      if (!text) { setStatus(''); return; }
      var pdfPt = st.viewport.convertToPdfPoint(x, y);
      var t = {
        px: pdfPt[0], py: pdfPt[1],   // coordinate PDF: valide a ogni zoom
        size: size,
        color: colorEl.value,
        text: text
      };
      st.texts.push(t);
      addOverlay(wrap, pageNum, t);
      setStatus('Testo aggiunto alla pagina ' + pageNum + '. Ricorda di salvare.');
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { committed = true; input.remove(); setStatus(''); }
      e.stopPropagation();
    });
    input.addEventListener('blur', function () { commit(); });
  }

  function addOverlay(wrap, pageNum, t) {
    var st = pageState[pageNum - 1];
    var vp = st.viewport.convertToViewportPoint(t.px, t.py);
    var div = document.createElement('div');
    div.className = 'pdf-overlay-text';
    div.textContent = t.text;
    div.style.left = vp[0] + 'px';
    div.style.top = vp[1] + 'px';
    div.style.fontSize = (t.size * st.scale) + 'px';
    div.style.color = t.color;
    div.title = 'Trascina per spostare';
    var del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Rimuovi questo testo';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      var arr = st.texts;
      var i = arr.indexOf(t);
      if (i >= 0) arr.splice(i, 1);
      div.remove();
    });
    div.appendChild(del);
    wrap.appendChild(div);

    // trascinamento per riposizionare (pointer events: mouse e dito)
    div.addEventListener('pointerdown', function (e) {
      if (e.target === del) return;
      e.preventDefault();
      div.setPointerCapture(e.pointerId);
      var start = st.viewport.convertToViewportPoint(t.px, t.py);
      var startX = e.clientX, startY = e.clientY;
      function move(ev) {
        var nx = start[0] + (ev.clientX - startX);
        var ny = start[1] + (ev.clientY - startY);
        div.style.left = nx + 'px';
        div.style.top = ny + 'px';
        var p = st.viewport.convertToPdfPoint(nx, ny);
        t.px = p[0]; t.py = p[1];
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

  function drawTextSafe(page, text, opts, PDFLib) {
    try {
      page.drawText(text, opts);
    } catch (encErr) {
      // caratteri non supportati dal font standard: sostituiscili
      var safe = text.replace(/[^\x20-\x7EàèéìòùÀÈÉÌÒÙçÇ°€£'’"«»\-]/g, '?');
      page.drawText(safe, opts);
    }
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

        // scrivi i valori dei campi del modulo (AcroForm)
        if (Object.keys(formValues).length) {
          try {
            var form = doc.getForm();
            Object.keys(formValues).forEach(function (name) {
              var v = formValues[name];
              var meta = formMeta[name] || {};
              try {
                if (meta.type === 'text') {
                  form.getTextField(name).setText(String(v == null ? '' : v));
                } else if (meta.type === 'check') {
                  var cb = form.getCheckBox(name);
                  if (v) cb.check(); else cb.uncheck();
                } else if (meta.type === 'radio') {
                  form.getRadioGroup(name).select(String(v));
                } else if (meta.type === 'choice') {
                  form.getDropdown(name).select(String(v));
                }
              } catch (fieldErr) {
                console.warn('Campo modulo non aggiornato:', name, fieldErr);
              }
            });
            try { form.updateFieldAppearances(font); } catch (e2) {}
          } catch (formErr) {
            console.warn('Modulo non aggiornabile:', formErr);
          }
        }

        pageState.forEach(function (st, idx) {
          if (st.deleted || idx >= pages.length) return;
          var page = pages[idx];
          var rot = (st.pageRotate + st.extraRotation) % 360;

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
              drawTextSafe(page, ed.text,
                { x: ed.x, y: ed.y, size: ed.size, font: font, color: PDFLib.rgb(0, 0, 0) }, PDFLib);
            }
          });

          // testi aggiunti (coordinate PDF già pronte)
          st.texts.forEach(function (t) {
            var col = hexToRgb(t.color);
            drawTextSafe(page, t.text, {
              x: t.px,
              y: t.py - t.size * 0.35, // il punto toccato è il centro verticale del testo
              size: t.size,
              font: font,
              color: PDFLib.rgb(col.r, col.g, col.b),
              // compensa la rotazione di visualizzazione: il testo resta orizzontale
              rotate: PDFLib.degrees(rot)
            }, PDFLib);
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
