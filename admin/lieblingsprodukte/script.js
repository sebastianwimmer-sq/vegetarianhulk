/* ============================================================
   vegetarianhulk · /admin/lieblingsprodukte
   Vanilla JS · no framework
   ============================================================ */

(function () {
  'use strict';

  // ─── Storage keys ────────────────────────────────────────
  const LS_PRODUCTS = 'vh_admin_products_v1';
  const LS_DRAFT    = 'vh_admin_draft_v1';
  const API         = '/api/products';

  // ─── DOM ──────────────────────────────────────────────────
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const topbar     = $('#topbar');
  const list       = $('#list');
  const empty      = $('#empty');
  const fab        = $('#fab');
  const emptyAdd   = $('#emptyAddBtn');
  const logoutBtn  = $('#logoutBtn');
  const sheet      = $('#sheet');
  const sheetTitle = $('#sheetTitle');
  const form       = $('#form');
  const cardTpl    = $('#cardTpl');
  const toast      = $('#toast');
  const saveStatus = $('#saveStatus');
  const countTotal = $('#countTotal');
  const countDraft = $('#countDraft');

  const dropzone     = $('#dropzone');
  const fileInput    = $('#fileInput');
  const previewImg   = $('#previewImg');
  const previewWrap  = dropzone.querySelector('.dropzone__preview');
  const removeImgBtn = $('#removeImgBtn');
  const replaceBtn   = $('#replaceBtn');
  const aspectToggle = $('#aspectToggle');

  const fName     = $('#f-name');
  const fVoice    = $('#f-voice');
  const fAsin     = $('#f-asin');
  const voiceCnt  = $('#voiceCount');
  const stars     = $('#stars');
  const starClear = $('#starClear');
  const ratingIn  = form.elements['rating'];
  const idIn      = form.elements['id'];
  const catHidden = form.elements['category'];
  const pillBtns  = $$('.pill-select .pill');

  const deleteBtn  = $('#deleteBtn');
  const previewBtn = $('#previewBtn');
  const saveBtn    = $('#saveBtn');
  const catbarBtns = $$('.catbar__btn');

  // ─── State ────────────────────────────────────────────────
  /** @type {Array<Product>} */
  let products = loadProducts();
  let filter   = 'all';
  let editingId = null;          // null = new
  let saveTimer = null;
  let isProcessingImage = false;

  // Default category labels (must match HTML)
  const CAT_LABELS = {
    fruehstueck: 'Frühstück',
    gym:         'Gym',
    faith:       'Faith',
    daily:       'Daily',
  };

  // ─── Boot ─────────────────────────────────────────────────
  render();
  bindEvents();
  hydrateDraftCount();

  // Scroll-shadow on topbar
  let lastScrolled = false;
  const onScroll = () => {
    const s = window.scrollY > 4;
    if (s !== lastScrolled) { topbar.classList.toggle('is-scrolled', s); lastScrolled = s; }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ─── Persistence ──────────────────────────────────────────
  function loadProducts() {
    try {
      const raw = localStorage.getItem(LS_PRODUCTS);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function saveProducts() {
    try { localStorage.setItem(LS_PRODUCTS, JSON.stringify(products)); }
    catch (e) { console.warn('localStorage full?', e); }
  }
  function loadDraft() {
    try {
      const raw = localStorage.getItem(LS_DRAFT);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function saveDraft(d) {
    try {
      if (d) localStorage.setItem(LS_DRAFT, JSON.stringify({ ...d, ts: Date.now() }));
      else   localStorage.removeItem(LS_DRAFT);
      hydrateDraftCount();
    } catch {}
  }
  function hydrateDraftCount() {
    const d = loadDraft();
    countDraft.textContent = d && hasDraftContent(d) ? '1' : '0';
  }
  function hasDraftContent(d) {
    return !!(d && (d.name || d.voice || d.asin || d.image || d.rating || (d.category && d.category !== 'fruehstueck')));
  }

  // ─── Rendering ────────────────────────────────────────────
  function render() {
    countTotal.textContent = String(products.length);

    const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);

    if (products.length === 0) {
      list.hidden = true;
      empty.hidden = false;
      list.innerHTML = '';
      return;
    }
    empty.hidden = true;
    list.hidden = false;

    // Re-render the list. (Could diff, but list sizes are small.)
    list.innerHTML = '';
    const frag = document.createDocumentFragment();
    filtered.forEach(p => frag.appendChild(buildCard(p)));
    list.appendChild(frag);
  }

  function buildCard(p) {
    const node = cardTpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = p.id;

    const img  = $('img', node);
    const name = $('.card__name', node);
    const cat  = $('.card__cat', node);
    const v    = $('.card__voice', node);
    const a    = $('.card__asin', node);
    const r    = $('.card__rating', node);

    if (p.image) {
      img.src = p.image;
      img.alt = p.name || '';
    } else {
      img.removeAttribute('src');
      img.alt = '';
    }
    name.textContent = p.name || '(ohne Namen)';
    cat.textContent  = CAT_LABELS[p.category] || p.category || '—';
    v.textContent    = p.voice || '';
    a.textContent    = p.asin ? `ASIN · ${p.asin}` : '';
    r.textContent    = p.rating ? '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating) : '';

    if (p._new) {
      node.classList.add('is-new');
      delete p._new;
      setTimeout(() => node.classList.remove('is-new'), 500);
    }

    // Open editor when card (or any non-handle child) is clicked
    node.addEventListener('click', (e) => {
      if (e.target.closest('.card__handle')) return;
      openEditor(p.id);
    });
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(p.id); }
    });

    // Drag-to-reorder
    wireDrag(node);

    return node;
  }

  // ─── Drag-to-reorder ──────────────────────────────────────
  let dragId = null;
  function wireDrag(card) {
    card.addEventListener('dragstart', (e) => {
      dragId = card.dataset.id;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch {}
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      $$('.card.is-drag-over').forEach(c => c.classList.remove('is-drag-over'));
      dragId = null;
    });
    card.addEventListener('dragover', (e) => {
      if (!dragId || dragId === card.dataset.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('is-drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('is-drag-over');
      if (!dragId || dragId === card.dataset.id) return;
      reorder(dragId, card.dataset.id);
    });
  }
  function reorder(fromId, toId) {
    const fromIdx = products.findIndex(p => p.id === fromId);
    const toIdx   = products.findIndex(p => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = products.splice(fromIdx, 1);
    products.splice(toIdx, 0, item);
    saveProducts();
    render();
    queueServerSync({ kind: 'reorder', ids: products.map(p => p.id) });
    showToast('Reihenfolge gespeichert');
  }

  // ─── Category filter ──────────────────────────────────────
  catbarBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catbarBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      filter = btn.dataset.cat;
      render();
    });
  });

  // ─── Editor open / close ──────────────────────────────────
  function openEditor(id) {
    editingId = id || null;
    if (id) {
      const p = products.find(x => x.id === id);
      if (!p) return;
      fillForm(p);
      sheetTitle.textContent = 'Produkt bearbeiten';
      deleteBtn.hidden = false;
    } else {
      // New — try restoring draft first
      const draft = loadDraft();
      if (draft && hasDraftContent(draft) && !draft.id) {
        fillForm(draft);
        sheetTitle.textContent = 'Neues Produkt · Draft';
        showToast('Draft wiederhergestellt');
      } else {
        fillForm(null);
        sheetTitle.textContent = 'Neues Produkt';
      }
      deleteBtn.hidden = true;
    }
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    // Focus name field after the slide-up
    setTimeout(() => fName.focus({ preventScroll: true }), 280);
  }
  function closeEditor() {
    sheet.hidden = true;
    document.body.style.overflow = '';
    editingId = null;
  }

  $$('[data-close]', sheet).forEach(el => el.addEventListener('click', closeEditor));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) closeEditor();
  });

  fab.addEventListener('click', () => openEditor(null));
  emptyAdd.addEventListener('click', () => openEditor(null));
  logoutBtn.addEventListener('click', () => {
    showToast('Logout (Mock) — Endpoint folgt');
  });

  // ─── Form fill / read ─────────────────────────────────────
  function fillForm(p) {
    p = p || {};
    idIn.value      = p.id || '';
    fName.value     = p.name || '';
    fVoice.value    = p.voice || '';
    fAsin.value     = p.asin || '';
    setRating(p.rating || 0);
    setCategory(p.category || 'fruehstueck');
    setImage(p.image || null);
    setAspect(p.aspect || '16:9');
    updateVoiceCount();
  }
  function readForm() {
    return {
      id:       idIn.value || null,
      name:     fName.value.trim(),
      voice:    fVoice.value.trim(),
      asin:     fAsin.value.trim().toUpperCase(),
      rating:   Number(ratingIn.value) || 0,
      category: catHidden.value || 'fruehstueck',
      image:    previewImg.dataset.src || null,
      aspect:   dropzone.classList.contains('is-aspect-1-1') ? '1:1' : '16:9',
    };
  }

  // ─── Category pill-select ─────────────────────────────────
  pillBtns.forEach(p => {
    p.addEventListener('click', () => setCategory(p.dataset.value));
  });
  function setCategory(v) {
    pillBtns.forEach(b => {
      const on = b.dataset.value === v;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    catHidden.value = v;
    autosave();
  }

  // ─── Rating stars ─────────────────────────────────────────
  const starBtns = $$('.star', stars);
  starBtns.forEach(s => {
    s.addEventListener('click',     () => setRating(Number(s.dataset.v)));
    s.addEventListener('mouseenter', () => hoverRating(Number(s.dataset.v)));
    s.addEventListener('mouseleave', () => hoverRating(0));
  });
  starClear.addEventListener('click', () => setRating(0));
  function setRating(n) {
    ratingIn.value = n ? String(n) : '';
    starBtns.forEach(s => s.classList.toggle('is-on', Number(s.dataset.v) <= n));
    stars.classList.toggle('has-rating', n > 0);
    autosave();
  }
  function hoverRating(n) {
    starBtns.forEach(s => s.classList.toggle('is-hover', n > 0 && Number(s.dataset.v) <= n));
  }

  // ─── Voice count ──────────────────────────────────────────
  function updateVoiceCount() { voiceCnt.textContent = String(fVoice.value.length); }
  fVoice.addEventListener('input', updateVoiceCount);

  // ─── Auto-save on every keystroke ─────────────────────────
  ['input', 'change'].forEach(evt => form.addEventListener(evt, autosave, true));
  function autosave() {
    if (saveTimer) clearTimeout(saveTimer);
    setSaveStatus('saving');
    saveTimer = setTimeout(() => {
      const data = readForm();
      if (data.id) {
        // Editing an existing card → mirror live edits to the record
        const i = products.findIndex(p => p.id === data.id);
        if (i >= 0) {
          products[i] = { ...products[i], ...data };
          saveProducts();
          updateCardInline(products[i]);
        }
      } else {
        // New card → keep as draft
        saveDraft(data);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1400);
    }, 280);
  }

  function updateCardInline(p) {
    const card = list.querySelector(`.card[data-id="${cssEscape(p.id)}"]`);
    if (!card) return;
    $('.card__name', card).textContent = p.name || '(ohne Namen)';
    $('.card__cat',  card).textContent = CAT_LABELS[p.category] || p.category;
    $('.card__voice',card).textContent = p.voice || '';
    $('.card__asin', card).textContent = p.asin ? `ASIN · ${p.asin}` : '';
    $('.card__rating', card).textContent = p.rating ? '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating) : '';
    const img = $('img', card);
    if (p.image) { img.src = p.image; img.alt = p.name || ''; }
    else { img.removeAttribute('src'); img.alt = ''; }
  }

  function setSaveStatus(state) {
    saveStatus.dataset.state = state;
    const label = $('.chip__label', saveStatus);
    label.textContent =
      state === 'saving' ? 'Speichert…' :
      state === 'saved'  ? 'Gespeichert' :
      state === 'error'  ? 'Fehler' :
                           'Auto-Save bereit';
  }

  // ─── Image: drag-drop, resize, WebP ───────────────────────
  function setImage(dataUrl) {
    if (dataUrl) {
      previewImg.src = dataUrl;
      previewImg.dataset.src = dataUrl;
      dropzone.dataset.hasImage = 'true';
      aspectToggle.hidden = false;
      previewWrap.hidden = false;
    } else {
      previewImg.removeAttribute('src');
      delete previewImg.dataset.src;
      dropzone.dataset.hasImage = 'false';
      aspectToggle.hidden = true;
      previewWrap.hidden = true;
    }
  }

  function setAspect(a) {
    const is11 = a === '1:1';
    dropzone.classList.toggle('is-aspect-1-1', is11);
    $$('.aspect-btn', aspectToggle).forEach(b => b.classList.toggle('is-active', b.dataset.aspect === a));
  }

  $$('.aspect-btn', aspectToggle).forEach(b => {
    b.addEventListener('click', () => { setAspect(b.dataset.aspect); autosave(); });
  });

  // Click / keyboard to open file picker
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;          // ignore overlay buttons
    if (e.target.closest('.dropzone__aspect')) return;
    fileInput.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  replaceBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  removeImgBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setImage(null);
    autosave();
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleImage(f);
    fileInput.value = '';
  });

  // Drag-drop on the dropzone
  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImage(file);
  });

  // Also accept a drop anywhere on the whole window to OPEN editor + load image
  window.addEventListener('dragover', (e) => { if (hasImage(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!hasImage(e)) return;
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (sheet.hidden) openEditor(null);
    setTimeout(() => handleImage(file), 50);
  });
  function hasImage(e) {
    return e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0] &&
           e.dataTransfer.files[0].type.startsWith('image/');
  }

  async function handleImage(file) {
    if (isProcessingImage) return;
    isProcessingImage = true;
    dropzone.classList.add('is-processing');
    try {
      const dataUrl = await resizeAndEncode(file, 1200);
      setImage(dataUrl);
      autosave();
    } catch (err) {
      console.error(err);
      showToast('Foto konnte nicht verarbeitet werden', 'error');
    } finally {
      dropzone.classList.remove('is-processing');
      isProcessingImage = false;
    }
  }

  function resizeAndEncode(file, maxDim) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode failed'));
        img.onload = () => {
          let { width: w, height: h } = img;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale);
          h = Math.round(h * scale);

          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          // Try WebP first, fall back to JPEG if unsupported
          let url = canvas.toDataURL('image/webp', 0.85);
          if (!url.startsWith('data:image/webp')) {
            url = canvas.toDataURL('image/jpeg', 0.86);
          }
          resolve(url);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ─── Save / Delete / Preview ──────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });

  function save() {
    const data = readForm();
    if (!data.name) {
      fName.focus();
      showToast('Name fehlt', 'error');
      return;
    }
    if (data.asin && !/^[A-Z0-9]{10}$/.test(data.asin)) {
      fAsin.focus();
      showToast('ASIN muss 10 Zeichen (A–Z, 0–9) sein', 'error');
      return;
    }

    // Optimistic UI
    if (data.id) {
      const i = products.findIndex(p => p.id === data.id);
      if (i >= 0) products[i] = { ...products[i], ...data, updatedAt: Date.now() };
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      data._new = true;
      products.unshift(data);
      saveDraft(null); // clear draft
    }
    saveProducts();
    render();
    closeEditor();
    showToast(data.id && editingId ? 'Gespeichert' : 'Neues Produkt hinzugefügt', 'success');

    queueServerSync({ kind: 'upsert', product: products.find(p => p.id === data.id) });
  }

  deleteBtn.addEventListener('click', () => {
    const id = idIn.value;
    if (!id) return;
    const p = products.find(x => x.id === id);
    const ok = confirm(`„${p ? p.name : 'Produkt'}" wirklich löschen?`);
    if (!ok) return;
    products = products.filter(x => x.id !== id);
    saveProducts();
    render();
    closeEditor();
    showToast('Gelöscht');
    queueServerSync({ kind: 'delete', id });
  });

  previewBtn.addEventListener('click', () => {
    const data = readForm();
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) { showToast('Popup blockiert', 'error'); return; }
    w.document.write(buildPreviewHTML(data));
    w.document.close();
  });

  function buildPreviewHTML(p) {
    const safe = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const rating = p.rating ? '★'.repeat(p.rating) + '☆'.repeat(5 - p.rating) : '';
    const imgHtml = p.image
      ? `<img src="${safe(p.image)}" alt="" style="display:block;width:100%;aspect-ratio:${p.aspect==='1:1'?'1/1':'16/9'};object-fit:cover;border-radius:14px;"/>`
      : `<div style="aspect-ratio:${p.aspect==='1:1'?'1/1':'16/9'};border:1.5px dashed #cfbf9d;border-radius:14px;display:grid;place-items:center;color:#807260;font-size:13px;">kein Foto</div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vorschau · ${safe(p.name) || 'Produkt'}</title>
<link rel="stylesheet" href="/fonts.css">
<style>
body{margin:0;font-family:'Inter',sans-serif;background:#f7efde;color:#1a1410;padding:24px;}
.frame{max-width:380px;margin:0 auto;background:#efe5cf;border:1px solid #cfbf9d;border-radius:20px;padding:18px;}
.cat{font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#2d6a3e;}
h1{font-family:'Playfair Display',serif;font-weight:600;font-size:24px;letter-spacing:-0.5px;line-height:1.2;margin:14px 0 6px;}
.rating{color:#2d6a3e;font-size:13px;letter-spacing:1px;margin:0 0 12px;}
p{font-size:14px;line-height:1.5;color:#4a3f33;margin:12px 0;}
.asin{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#807260;letter-spacing:0.4px;padding-top:12px;border-top:1px dashed rgba(45,106,62,.2);}
</style></head><body>
<div class="frame">
  ${imgHtml}
  <div class="cat">${safe(CAT_LABELS[p.category] || p.category || '')}</div>
  <h1>${safe(p.name) || 'Ohne Namen'}</h1>
  ${rating ? `<div class="rating">${rating}</div>` : ''}
  ${p.voice ? `<p>${safe(p.voice)}</p>` : ''}
  ${p.asin ? `<div class="asin">ASIN · ${safe(p.asin)}</div>` : ''}
</div></body></html>`;
  }

  // ─── Server sync (placeholder, fire-and-forget) ───────────
  function queueServerSync(payload) {
    // The endpoint is a placeholder; we never block UI on this.
    if (!('fetch' in window)) return;
    try {
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      }).catch(() => { /* swallow — wire later */ });
    } catch {}
  }

  // ─── Toast ────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, kind) {
    toast.textContent = msg;
    toast.className = 'toast' + (kind ? ` is-${kind}` : '');
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-show');
      setTimeout(() => { toast.hidden = true; }, 260);
    }, 2200);
  }

  // ─── Helpers ──────────────────────────────────────────────
  function bindEvents() { /* most events bound inline above */ }
  function uid() { return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c);
  }

  // ─── Seed a couple of demo cards on very first load so the UI ─────
  //     isn't empty when Sebi opens it. Skipped if products exist or
  //     if user has explicitly emptied + reloaded.
  if (products.length === 0 && !localStorage.getItem('vh_admin_seeded_v1')) {
    products = [
      {
        id: uid(),
        name: 'Kölln Blütenzarte Haferflocken',
        category: 'fruehstueck',
        voice: 'Seit Jahren jeden Morgen. Keine Marketing-Bullshit-Verpackung — einfach gute Flocken. 70 g, kalt, mit Quark.',
        asin: 'B0028GIBQE',
        rating: 5,
        aspect: '16:9',
        image: null,
        createdAt: Date.now() - 86400000 * 2,
      },
      {
        id: uid(),
        name: 'Schlachter 2000 Bibel',
        category: 'faith',
        voice: 'Standard-Ausgabe, Leder. Liegt neben dem Bett. Wenn ich morgens nicht lese, läuft der Tag schief.',
        asin: '',
        rating: 5,
        aspect: '16:9',
        image: null,
        createdAt: Date.now() - 86400000,
      },
    ];
    saveProducts();
    localStorage.setItem('vh_admin_seeded_v1', '1');
    render();
  }

})();
