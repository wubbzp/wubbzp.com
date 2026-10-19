/* SpongeBob SquigglePants: Art Studio. A browser recreation of the Wii Art Studio, built from the game's own files.
   Everything is laid out on the game's 854x480 screen; #stage is scaled to fit the window. */
(() => {
'use strict';

const D = window.AS_DATA;
const W = 854, H = 480;
const CX = 239, CY = 43, CW = 538, CH = 400;      // drawing area inside the picture frame
const RES = 2;                                    // canvas pixels per screen pixel
const BRUSH = [2, 5, 9, 15, 24];                  // very tiny .. large, in screen pixels
const STAMP_SCALE = [0.5, 0.75, 1, 1.3, 1.6];
const SIZE_NAMES = ['very_tiny', 'tiny', 'small', 'medium', 'large'];
const HISTORY = 5;                                // "a five-step Undo/Redo"
const SLOT_KEY = 'squigglepants-artstudio-slot-';
const STR = {   // from Boot/ArtStudio.text and UiText.text
  save: 'Are you sure you want to save?',
  overwrite: 'There is already an image saved in this slot.  If you choose to continue this image will be lost.  Are you sure you want to save?',
  noFile: 'No file to load!',
  exit: 'Are you sure you want to exit?',
  yes: 'Yes', no: 'No', coloringBook: 'Coloring Book', empty: 'Empty',
};

const stage = document.getElementById('stage');
const ui = n => 'assets/ui/' + n + '.png';

// ------------------------------------------------------------------ helpers

function el(tag, props = {}, parent = null) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'style') Object.assign(e.style, v);
    else if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e[k] = v;
  }
  if (parent) parent.appendChild(e);
  return e;
}
function place(e, x, y, w, h) {
  e.style.left = x + 'px'; e.style.top = y + 'px';
  if (w != null) e.style.width = w + 'px';
  if (h != null) e.style.height = h + 'px';
  return e;
}
function img(src, x, y, parent, w, h) {
  const i = el('img', { src, class: 'abs', draggable: false, alt: '' }, parent);
  return place(i, x, y, w, h);
}
function label(text, x, y, w, size, parent, color) {
  const l = el('div', { class: 'label', text }, parent);
  place(l, x, y, w);
  l.style.fontSize = size + 'px';
  if (color) { l.style.color = color; l.style.textShadow = 'none'; }
  return l;
}
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); return true; } catch (e) { return null; } }
function unstore(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
function toStage(e) {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.transform = 'scale(' + s + ')';
}
window.addEventListener('resize', fit);
fit();

// ------------------------------------------------------------------ audio

const Sound = {
  ctx: null, master: null, musicGain: null, buffers: {}, loading: {}, current: null, currentName: null,
  muted: store('squigglepants-artstudio-muted') === '1',
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.8;
    this.musicGain.connect(this.master);
    for (const n of ['beep', 'menu_start', 'MenuDing2', 'game_zoom_out']) this.load(n, 'assets/audio/' + n + '.wav');
  },
  load(name, url) {
    if (!this.ctx) return Promise.resolve(null);
    if (!this.loading[name]) {
      this.loading[name] = fetch(url).then(r => r.arrayBuffer())
        .then(b => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej)))
        .then(buf => (this.buffers[name] = buf))
        .catch(err => { console.warn('Could not load', url, err); return null; });
    }
    return this.loading[name];
  },
  sfx(name, vol = 0.9) {
    const b = this.buffers[name];
    if (!this.ctx || !b) return;
    const s = this.ctx.createBufferSource(); s.buffer = b;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.master); s.start();
  },
  async music(name) {
    if (!this.ctx || this.currentName === name) return;
    this.currentName = name;
    this.stopMusic();
    const info = D.music[name];
    let buf = await this.load(name, 'assets/audio/' + name + '.flac');
    if (!buf) buf = await this.load(name + '-mp3', 'assets/audio/' + name + '.mp3');   // browsers without FLAC decoding
    if (!buf || this.currentName !== name) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.loopStart = info.loopStart / info.sampleRate;
    s.loopEnd = info.loopEnd / info.sampleRate;
    const g = this.ctx.createGain(); g.gain.value = 1;
    s.connect(g); g.connect(this.musicGain); s.start();
    this.current = { s, g };
  },
  stopMusic(fade = 0.4) {
    if (!this.current) return;
    const { s, g } = this.current, t = this.ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade);
    s.stop(t + fade + 0.05);
    this.current = null;
  },
  setMuted(m) {
    this.muted = m;
    store('squigglepants-artstudio-muted', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 1;
    document.getElementById('muteBtn').innerHTML = m ? '&#128263;' : '&#128266;';
  },
};
document.getElementById('muteBtn').addEventListener('click', () => Sound.setMuted(!Sound.muted));
Sound.setMuted(Sound.muted);
const help = document.getElementById('help');
document.getElementById('helpBtn').addEventListener('click', () => { help.hidden = false; });
document.getElementById('helpClose').addEventListener('click', () => { help.hidden = true; });

// ------------------------------------------------------------------ scenes

let scene = null, sceneKeys = null;
function setScene(node, keys) {
  if (scene) scene.remove();
  scene = node; sceneKeys = keys || null;
  stage.appendChild(node);
}
window.addEventListener('keydown', e => {
  if (!help.hidden) { if (e.key === 'Escape') help.hidden = true; return; }
  if (e.key === 'm' || e.key === 'M') { Sound.setMuted(!Sound.muted); return; }
  if (sceneKeys) sceneKeys(e);
});
stage.addEventListener('contextmenu', e => e.preventDefault());

function gate() {
  const g = el('div', { id: 'gate', class: 'scene' });
  img('assets/boot/save_icon.gif', 0, 0, g).style.position = 'static';
  el('div', { class: 'big', text: 'Click or tap to start' }, g);
  el('div', { class: 'small', innerHTML: 'A fan recreation of the Art Studio from <i>SpongeBob SquigglePants</i> (Wii, 2011), rebuilt from the game’s own art and music. Sound on!' }, g);
  const go = () => { Sound.init(); Sound.load('title', 'assets/audio/title.flac'); boot(); };
  g.addEventListener('pointerup', go);
  setScene(g, e => { if (e.key === 'Enter' || e.key === ' ') go(); });
}

async function boot() {
  const lang = { fr: 'French', de: 'German', it: 'Italian', es: 'Spanish', nl: 'Dutch', ja: 'Japanese' }[(navigator.language || 'en').slice(0, 2)] || 'English';
  const seq = D.boot.map(b => ({ src: 'assets/boot/' + b.name + '.png', secs: b.secs, skip: b.skippable }));
  seq.push({ src: 'assets/boot/warning_' + lang + '.png', secs: 4, skip: true });
  const s = el('div', { class: 'scene' });
  s.style.background = '#000';
  let skip = null;
  s.addEventListener('pointerup', () => skip && skip());
  setScene(s, e => { if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && skip) skip(); });
  Sound.load('artstudio', 'assets/audio/artstudio.flac');
  for (const item of seq) {
    await loadImage(item.src).catch(() => null);
    if (scene !== s) return;
    const i = img(item.src, 0, 0, s, W, H);
    i.style.opacity = 0; i.style.transition = 'opacity .4s';
    await sleep(30); i.style.opacity = 1;
    await new Promise(res => {
      const t = setTimeout(res, 400 + item.secs * 1000);
      skip = item.skip ? () => { clearTimeout(t); res(); } : null;
    });
    skip = null;
    i.style.opacity = 0; await sleep(420); i.remove();
  }
  if (scene === s) title();
}

function title() {
  const t = el('div', { id: 'title', class: 'scene' });
  const cols = [];
  for (let c = 0; c < 7; c++) {
    const col = el('div', { class: 'tileCol' }, t);
    col.style.left = (-67 + c * 141) + 'px';
    const a = (c * 2) % 9 + 1, b = (c * 2 + 4) % 9 + 1;
    for (const n of [a, b, a]) el('img', { src: 'assets/boot/title_tile_' + n + '.png', alt: '', draggable: false }, col);
    cols.push({ col, dir: c % 2 ? 1 : -1, off: (c * 233) % 1398 });
  }
  const L = D.title.logo;
  img('assets/boot/title_logo.png', L.x, L.y, t, L.w, L.h);
  const b1 = D.title.titlescreen_begin_01, b2 = D.title.titlescreen_begin_02;
  const p1 = img('assets/boot/titlescreen_begin_01.png', b1.x, b1.y, t, b1.w, b1.h);
  const p2 = img('assets/boot/titlescreen_begin_02.png', b2.x, b2.y, t, b2.w, b2.h);
  let last = performance.now(), blink = 0;
  const tick = now => {
    if (scene !== t) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const c of cols) {
      c.off = (c.off + c.dir * 18 * dt + 1398) % 1398;
      c.col.style.transform = 'translateY(' + (-c.off) + 'px)';
    }
    blink += dt;
    const on = Math.floor(blink * 2) % 2 === 0;
    p1.style.display = on ? '' : 'none'; p2.style.display = on ? 'none' : '';
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  t.style.opacity = 0;
  setTimeout(() => { t.style.opacity = 1; }, 20);
  Sound.music('title');
  let started = false;
  const go = async () => {
    if (started) return; started = true;
    Sound.sfx('menu_start');
    Sound.stopMusic(0.6);
    t.style.opacity = 0;
    await sleep(500);
    studio();
  };
  t.addEventListener('pointerup', go);
  setScene(t, e => { if (['Enter', ' ', 'a', 'A'].includes(e.key)) go(); });
}

// ------------------------------------------------------------------ the Art Studio

function studio() {
  const root = el('div', { class: 'scene' });
  stage.classList.add('studio');
  const S = { tool: 'brush', color: '#000000', size: 2, stamp: null, page: 0, swatchTab: 'colors',
              history: [], redo: [], modal: null, stroke: null, alt: false, hover: null };

  img(ui('AS_artstudio_bg'), 0, 0, root);

  // drawing area: paint layer, coloring-book lines on top, then the stamp preview
  const area = place(el('div', { id: 'canvasArea' }, root), CX, CY);
  const mk = () => { const c = el('canvas', { width: CW * RES, height: CH * RES }, area); return c; };
  const paint = mk(), lines = mk(), preview = mk();
  const pctx = paint.getContext('2d', { willReadFrequently: true });
  const lctx = lines.getContext('2d', { willReadFrequently: true });
  const vctx = preview.getContext('2d');
  img(ui('AS_canvas_frame'), 217, 14, root);

  // tool panel (shifted 8px left of the D-pad art's baked position so it clears the frame)
  const panel = place(el('div', { class: 'layer' }, root), -8, 0);
  img(ui('AS_tool_panel'), 20, 40, panel);
  const adj = D.ui.AS_tool_button_adjust_icons;
  img(ui('AS_tool_button_adjust_icons'), adj.x, adj.y, panel, adj.w, adj.h);
  const hit = (x, y, w, h, fn, title) => {
    const d = place(el('div', { class: 'hit', title: title || '' }, panel), x, y, w, h);
    d.addEventListener('pointerup', e => { e.stopPropagation(); fn(); });
    return d;
  };
  hit(104, 58, 38, 32, () => changeSize(1), 'Bigger (↑)');
  hit(104, 138, 38, 22, () => changeSize(-1), 'Smaller (↓)');
  hit(68, 94, 32, 36, undo, 'Undo (←)');
  hit(144, 94, 32, 36, redo, 'Redo (→)');

  // current color (A button)
  const colorBtn = place(el('div', { class: 'hit', title: 'Colors (A)' }, panel), 40, 166, 67, 69);
  img(ui('AS_button_A_current_color'), 0, 0, colorBtn);
  const dot = place(el('div', { class: 'colorDot' }, colorBtn), 6, 5, 56, 56);
  const aBadge = img(ui('AS_button_A'), 58, 40, colorBtn);
  colorBtn.addEventListener('pointerdown', () => { aBadge.src = ui('AS_button_A_pressed'); });
  colorBtn.addEventListener('pointerup', e => { e.stopPropagation(); aBadge.src = ui('AS_button_A'); openSwatches(); });
  colorBtn.addEventListener('pointerleave', () => { aBadge.src = ui('AS_button_A'); });
  const sizeBtn = place(el('div', { class: 'hit', title: 'Pen size' }, panel), 120, 186, 94, 28);
  img(ui('AS_sizeindicator'), 0, 0, sizeBtn);
  sizeBtn.addEventListener('pointerup', e => { e.stopPropagation(); Sound.sfx('beep'); openSizes(); });

  // buttons with normal (01), pressed (02) and highlighted (03) art
  const buttons = {};
  function button(name, x, y, fn, title) {
    const b = place(el('div', { class: 'hit', title: title || '' }, panel), x, y);
    const i = img(ui('AS_tool_button_' + name + '_01'), 0, 0, b);
    b.style.width = i.style.width = D.ui['AS_tool_button_' + name + '_01'].w + 'px';
    b.style.height = D.ui['AS_tool_button_' + name + '_01'].h + 'px';
    const st = { b, i, down: false, over: false, active: false };
    const draw = () => { i.src = ui('AS_tool_button_' + name + (st.down || st.active ? '_02' : st.over ? '_03' : '_01')); };
    st.draw = draw;
    b.addEventListener('pointerenter', () => { st.over = true; draw(); });
    b.addEventListener('pointerleave', () => { st.over = false; st.down = false; draw(); });
    b.addEventListener('pointerdown', e => { e.stopPropagation(); st.down = true; draw(); });
    b.addEventListener('pointerup', e => { e.stopPropagation(); if (!st.down) return; st.down = false; draw(); fn(); });
    buttons[name] = st;
    return st;
  }
  button('brush', 32, 252, () => toolButton('brush'), 'Brush (1)');
  button('eraser', 80, 252, () => toolButton('eraser'), 'Eraser (2)');
  button('fill', 128, 252, () => toolButton('fill'), 'Fill (3)');
  button('stamp', 176, 252, () => toolButton('stamp'), 'Stamps (4)');
  button('undo', 74, 306, () => { Sound.sfx('beep'); undo(); }, 'Undo (←)');
  button('redo', 126, 306, () => { Sound.sfx('beep'); redo(); }, 'Redo (→)');
  button('save', 30, 360, () => { Sound.sfx('beep'); openSave(); }, 'Save');
  button('load', 127, 360, () => { Sound.sfx('beep'); openLoad(); }, 'Load');

  // B: back out of a window, or exit
  const back = place(el('div', { class: 'hit', title: 'Back (B / Esc)' }, root), 14, 416, 135, 60);
  back.style.zIndex = 30;
  img(ui('button_backtab'), 0, 0, back);
  const backLabel = el('div', { class: 'btnLabel', text: 'Exit' }, back);
  Object.assign(backLabel.style, { left: '42px', fontSize: '22px' });
  back.addEventListener('pointerup', e => { e.stopPropagation(); goBack(); });

  // tool cursor (the Wii pointer art, tinted with the current color)
  const cursor = el('canvas', { id: 'cursor', width: 60, height: 60 }, root);
  cursor.style.display = 'none';
  const cctx = cursor.getContext('2d');
  const tipCanvas = document.createElement('canvas'); tipCanvas.width = tipCanvas.height = 60;
  const CURSORS = {
    brush: ['AS_wii_brush', 'AS_wii_brush_tip', 7, 56],
    eraser: ['AS_wii_eraser', null, 5, 55],
    fill: ['AS_wii_paintbucket', 'AS_wii_paintbucketfill', 23, 58],
    eyedropper: ['AS_wii_eyedropper', 'AS_wii_eyedropper_tip', 7, 54],
    pointer: ['AS_wii_pointer', null, 14, 6],
  };
  const cursorImgs = {};
  for (const [, [a, b]] of Object.entries(CURSORS)) {
    for (const n of [a, b]) if (n && !cursorImgs[n]) loadImage(ui(n)).then(i => { cursorImgs[n] = i; drawCursor(); });
  }
  let cursorKind = 'pointer';
  function drawCursor() {
    const [a, b] = CURSORS[cursorKind];
    cctx.clearRect(0, 0, 60, 60);
    if (cursorImgs[a]) cctx.drawImage(cursorImgs[a], 0, 0);
    if (b && cursorImgs[b]) {
      const t = tipCanvas.getContext('2d');
      t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, 60, 60); t.drawImage(cursorImgs[b], 0, 0);
      t.globalCompositeOperation = 'source-in'; t.fillStyle = S.color; t.fillRect(0, 0, 60, 60);
      cctx.drawImage(tipCanvas, 0, 0);
    }
  }
  function moveCursor(p) {
    const overCanvas = !S.modal && p.x >= CX && p.x < CX + CW && p.y >= CY && p.y < CY + CH;
    let kind = 'pointer';
    if (overCanvas) kind = S.alt ? 'eyedropper' : S.tool === 'stamp' ? 'pointer' : S.tool;
    if (kind !== cursorKind) { cursorKind = kind; drawCursor(); }
    const [, , hx, hy] = CURSORS[cursorKind];
    cursor.style.transform = 'translate(' + (p.x - hx) + 'px,' + (p.y - hy) + 'px)';
    cursor.style.display = stage.classList.contains('touch') ? 'none' : '';
    drawPreview(overCanvas ? p : null);
  }

  // ---------------------------------------------------------------- state changes
  function setColor(c) { S.color = c; dot.style.background = c; drawCursor(); }
  function setTool(t) {
    S.tool = t;
    for (const n of ['brush', 'eraser', 'fill', 'stamp']) { buttons[n].active = n === t; buttons[n].draw(); }
  }
  function toolButton(t) {
    Sound.sfx('beep');
    if (t === 'stamp') { openPicker('stamps'); return; }
    if ((t === 'brush' || t === 'eraser') && S.tool === t) { openSizes(); return; }
    setTool(t);
  }
  function changeSize(d) {
    const n = Math.max(0, Math.min(4, S.size + d));
    if (n !== S.size) { S.size = n; Sound.sfx('beep'); }
    drawPreview(S.hover);
  }
  setColor(S.color); setTool('brush');

  // ---------------------------------------------------------------- history (5 steps)
  // The line layer is only saved when a coloring page is up (stamps can cover its lines).
  const snapshot = () => ({ img: pctx.getImageData(0, 0, paint.width, paint.height), page: S.page,
                            lines: S.page ? lctx.getImageData(0, 0, lines.width, lines.height) : null });
  function remember() {
    S.history.push(snapshot());
    if (S.history.length > HISTORY) S.history.shift();
    S.redo = [];
  }
  async function restore(s) {
    pctx.putImageData(s.img, 0, 0);
    if (s.lines) { S.page = s.page; lctx.putImageData(s.lines, 0, 0); } else await showPage(s.page);
  }
  function undo() { if (!S.history.length) return; S.redo.push(snapshot()); restore(S.history.pop()); }
  function redo() { if (!S.redo.length) return; S.history.push(snapshot()); restore(S.redo.pop()); }

  // ---------------------------------------------------------------- coloring pages
  const pageCache = {};
  async function showPage(id) {
    S.page = id;
    lctx.clearRect(0, 0, lines.width, lines.height);
    if (!id) return;
    const p = D.pages.find(q => q.id === id);
    const im = pageCache[id] || (pageCache[id] = await loadImage('assets/pages/' + id + '.png'));
    if (S.page !== id) return;
    lctx.drawImage(im, (p.x - CX) * RES, (p.y - CY) * RES, p.w * RES, p.h * RES);
  }

  // ---------------------------------------------------------------- drawing
  const toCanvas = p => ({ x: (p.x - CX) * RES, y: (p.y - CY) * RES });
  function strokeTo(a, b) {
    pctx.save();
    pctx.globalCompositeOperation = S.tool === 'eraser' ? 'destination-out' : 'source-over';
    pctx.strokeStyle = pctx.fillStyle = S.color;
    pctx.lineWidth = BRUSH[S.size] * RES; pctx.lineCap = pctx.lineJoin = 'round';
    if (a.x === b.x && a.y === b.y) {
      pctx.beginPath(); pctx.arc(a.x, a.y, BRUSH[S.size] * RES / 2, 0, Math.PI * 2); pctx.fill();
    } else {
      pctx.beginPath(); pctx.moveTo(a.x, a.y); pctx.lineTo(b.x, b.y); pctx.stroke();
    }
    pctx.restore();
  }
  const stampCache = {};
  function stampImage(st) {
    if (!stampCache[st.id]) { stampCache[st.id] = new Image(); stampCache[st.id].src = 'assets/stamps/' + st.id + '.png'; }
    return stampCache[st.id];
  }
  function stampRect(st, p) {   // in canvas pixels, centred on the stamp's full (uncropped) size
    const s = STAMP_SCALE[S.size] * RES, c = toCanvas(p);
    return { x: c.x - st.fw * s / 2 + st.x * s, y: c.y - st.fh * s / 2 + st.y * s, w: st.w * s, h: st.h * s };
  }
  function drawPreview(p) {
    S.hover = p;
    vctx.clearRect(0, 0, preview.width, preview.height);
    if (!p || S.modal || S.alt || S.tool !== 'stamp' || !S.stamp) return;
    const im = stampImage(S.stamp);
    if (!im.complete) { im.onload = () => drawPreview(S.hover); return; }
    const r = stampRect(S.stamp, p);
    vctx.globalAlpha = 0.6; vctx.drawImage(im, r.x, r.y, r.w, r.h); vctx.globalAlpha = 1;
  }
  function pickColor(p) {
    const c = toCanvas(p), x = Math.floor(c.x), y = Math.floor(c.y);
    const l = lctx.getImageData(x, y, 1, 1).data, q = pctx.getImageData(x, y, 1, 1).data;
    let rgb;
    if (l[3] >= 128) rgb = [l[0], l[1], l[2]];
    else { const a = q[3] / 255; rgb = [0, 1, 2].map(i => Math.round(q[i] * a + 255 * (1 - a))); }
    setColor('#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''));
    Sound.sfx('beep');
  }

  // Fill: flood the area under the click (lines and paint both bound it), then grow it 2px under the
  // anti-aliased line edges so no white fringe is left (the "anti-alias friendly fill bucket").
  function fill(p) {
    const c = toCanvas(p), w = paint.width, h = paint.height;
    const sx = Math.floor(c.x), sy = Math.floor(c.y);
    const pi = pctx.getImageData(0, 0, w, h), li = lctx.getImageData(0, 0, w, h);
    const pd = pi.data, ld = li.data;
    if (ld[(sy * w + sx) * 4 + 3] >= 128) return false;
    const eff = i => { const a = pd[i + 3] / 255; return [pd[i] * a + 255 * (1 - a), pd[i + 1] * a + 255 * (1 - a), pd[i + 2] * a + 255 * (1 - a)]; };
    const seed = eff((sy * w + sx) * 4);
    const near = (i, tol) => { const e = eff(i); return Math.abs(e[0] - seed[0]) <= tol && Math.abs(e[1] - seed[1]) <= tol && Math.abs(e[2] - seed[2]) <= tol; };
    const ok = j => ld[j * 4 + 3] < 128 && near(j * 4, 40);
    const mask = new Uint8Array(w * h);
    const stack = [sx, sy];
    while (stack.length) {
      const y = stack.pop(), x0 = stack.pop();
      let x = x0;
      while (x > 0 && !mask[y * w + x - 1] && ok(y * w + x - 1)) x--;
      let up = false, down = false;
      for (; x < w; x++) {
        const j = y * w + x;
        if (mask[j] || !ok(j)) break;
        mask[j] = 1;
        if (y > 0) { const k = j - w; if (!mask[k] && ok(k)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
        if (y < h - 1) { const k = j + w; if (!mask[k] && ok(k)) { if (!down) { stack.push(x, y + 1); down = true; } } else down = false; }
      }
    }
    for (let pass = 0; pass < 2 * RES; pass++) {
      const grow = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const j = y * w + x;
        if (mask[j]) continue;
        if (!(mask[j - 1] || mask[j + 1] || mask[j - w] || mask[j + w])) continue;
        if (ld[j * 4 + 3] > 0 || near(j * 4, 110)) grow.push(j);
      }
      for (const j of grow) mask[j] = 1;
    }
    const [r, g, b] = hexToRgb(S.color);
    for (let j = 0; j < w * h; j++) if (mask[j]) { const i = j * 4; pd[i] = r; pd[i + 1] = g; pd[i + 2] = b; pd[i + 3] = 255; }
    pctx.putImageData(pi, 0, 0);
    return true;
  }

  area.addEventListener('pointerdown', e => {
    if (S.modal) return;
    e.preventDefault();
    const p = toStage(e);
    if (e.button === 2 || e.altKey) { pickColor(p); return; }
    if (e.button !== 0) return;
    if (S.tool === 'brush' || S.tool === 'eraser') {
      remember();
      area.setPointerCapture(e.pointerId);
      const c = toCanvas(p);
      S.stroke = { id: e.pointerId, last: c };
      strokeTo(c, c);
    } else if (S.tool === 'fill') {
      const before = snapshot();
      if (fill(p)) { S.history.push(before); if (S.history.length > HISTORY) S.history.shift(); S.redo = []; }
    } else if (S.tool === 'stamp' && S.stamp) {
      const im = stampImage(S.stamp);
      const put = () => {
        remember();
        const r = stampRect(S.stamp, p);
        pctx.drawImage(im, r.x, r.y, r.w, r.h);
        // a stamp sits on top: remove the coloring-page lines it covers
        lctx.save(); lctx.globalCompositeOperation = 'destination-out'; lctx.drawImage(im, r.x, r.y, r.w, r.h); lctx.restore();
        Sound.sfx('beep', 0.6);
      };
      if (im.complete) put(); else im.onload = put;
    }
  });
  area.addEventListener('pointermove', e => {
    if (!S.stroke || e.pointerId !== S.stroke.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const c = toCanvas(toStage(ev));
      strokeTo(S.stroke.last, c); S.stroke.last = c;
    }
  });
  const endStroke = e => { if (S.stroke && e.pointerId === S.stroke.id) S.stroke = null; };
  area.addEventListener('pointerup', endStroke);
  area.addEventListener('pointercancel', endStroke);
  root.addEventListener('pointermove', e => {
    stage.classList.toggle('touch', e.pointerType === 'touch');
    moveCursor(toStage(e));
  });
  root.addEventListener('pointerdown', e => stage.classList.toggle('touch', e.pointerType === 'touch'));
  root.addEventListener('pointerleave', () => { cursor.style.display = 'none'; drawPreview(null); });

  // ---------------------------------------------------------------- windows
  function openModal(build, closeOnBackdrop = true) {
    closeModal();
    const m = el('div', { class: 'modal' }, root);
    if (closeOnBackdrop) m.addEventListener('pointerup', e => { if (e.target === m) { Sound.sfx('beep'); closeModal(); } });
    m.addEventListener('pointerdown', e => e.stopPropagation());
    S.modal = m;
    backLabel.textContent = 'Back';
    drawPreview(null);
    build(m);
    return m;
  }
  function closeModal() { if (S.modal) { S.modal.remove(); S.modal = null; } backLabel.textContent = 'Exit'; }
  function goBack() {
    Sound.sfx('beep');
    if (S.modal) { closeModal(); return; }
    confirm(STR.exit, async () => {
      Sound.sfx('game_zoom_out');
      Sound.stopMusic(0.5);
      root.style.opacity = 0;
      await sleep(400);
      stage.classList.remove('studio', 'touch');
      title();
    });
  }
  function clickable(parent, x, y, w, h, fn) {
    const d = place(el('div', { class: 'hit' }, parent), x, y, w, h);
    d.addEventListener('pointerup', e => { e.stopPropagation(); fn(e); });
    return d;
  }
  function pill(parent, x, y, text, fn, small = true) {
    const name = small ? 'AS_button_small' : 'AS_button', u = D.ui[name];
    const d = clickable(parent, x, y, u.w, u.h, fn);
    const i = img(ui(name), 0, 0, d);
    el('div', { class: 'btnLabel', text }, d).style.fontSize = (small ? 18 : 24) + 'px';
    d.addEventListener('pointerdown', () => { i.src = ui(name + '_pressed'); });
    d.addEventListener('pointerleave', () => { i.src = ui(name); });
    return d;
  }
  function confirm(text, yes) {
    openModal(m => {
      img(ui('AS_textbox2'), 151, 120, m);
      label(text, 171, 140, 512, 19, m);
      pill(m, 151 + 276 - 130, 120 + 219 - 58, STR.yes, () => { Sound.sfx('MenuDing2'); closeModal(); yes(); });
      pill(m, 151 + 276 + 12, 120 + 219 - 58, STR.no, () => { Sound.sfx('beep'); closeModal(); });
    }, false);
  }
  function notice(text) {
    openModal(m => {
      const u = D.ui.AS_NOFILETOLOADBOX;
      img(ui('AS_NOFILETOLOADBOX'), (W - u.w) / 2, 196, m);
      label(text, (W - u.w) / 2, 196 + 30, u.w, 22, m);
      setTimeout(() => { if (S.modal === m) closeModal(); }, 1500);
    });
  }

  function openSwatches() {
    Sound.sfx('beep');
    openModal(m => {
      img(ui('AS_window_swatches'), 199, 68, m);
      const tabs = ['colors', 'bob', 'pat', 'squid', 'krabs', 'gary'];
      const body = el('div', { class: 'layer' }, m);
      const show = tab => {
        S.swatchTab = tab;
        body.innerHTML = '';
        const i = tabs.indexOf(tab);
        img(ui('AS_swatch_button_highlight'), 215 + i * 72 - 4, 80 - 4, body);
        tabs.forEach((t, k) => {
          const d = clickable(body, 215 + k * 72, 80, 65, 65, () => { Sound.sfx('beep'); show(t); });
          img(ui('AS_swatch_button_' + t), 0, 0, d);
        });
        const name = tab === 'colors' ? 'AS_swatch_main' : 'AS_swatch_palette_' + tab;
        const u = D.ui[name], px = Math.round(427 - u.w / 2), py = 160;
        img(ui(tab === 'colors' ? 'AS_swatch_main_shadow' : 'AS_swatch_palette_shadow'), px + 4, py + 5, body);
        img(ui(name), px, py, body);
        for (const cell of D.palettes[name]) {
          clickable(body, px + cell.x, py + cell.y, cell.w, cell.h, () => {
            Sound.sfx('MenuDing2'); setColor(cell.color);
            if (S.tool === 'eraser' || S.tool === 'stamp') setTool('brush');
            closeModal();
          });
        }
      };
      show(S.swatchTab);
    });
  }

  function openSizes() {
    openModal(m => {
      const x0 = 190, y0 = 173;
      img(ui('AS_window_pencil_size'), x0, y0, m);
      SIZE_NAMES.forEach((n, i) => {
        const x = x0 + 8 + i * 93, y = y0 + 24;
        if (i === S.size) img(ui('AS_window_pencil_size_selected'), x - 4, y - 4, m, 93, 93);
        const d = clickable(m, x, y, 85, 85, () => { S.size = i; Sound.sfx('MenuDing2'); closeModal(); });
        img(ui('AS_window_pencil_size_button_' + n), 0, 0, d, 85, 85);
      });
    });
  }

  // 3x3 picker used for stamps and the coloring book
  function openPicker(kind) {
    const items = kind === 'stamps' ? D.stamps.map(s => ({ stamp: s, src: 'assets/stamps/' + s.id + '.png' }))
      : [{ blank: true, src: ui('AS_blank_clearscreenl') }].concat(D.pages.map(p => ({ page: p.id, src: 'assets/pages/' + p.id + '_thumb.png' })));
    const pages = Math.ceil(items.length / 9);
    const key = 'picker-' + kind;
    let at = Math.min(S[key] || 0, pages - 1);
    openModal(m => {
      img(ui('AS_window_swatches'), 199, 68, m);
      const gx = 270, gy = 82;
      img(ui('AS_window_selection_buttons'), gx, gy, m);
      const body = el('div', { class: 'layer' }, m);
      const num = el('div', { class: 'pageNum' }, m);
      place(num, 199, 394, 456);
      const show = () => {
        S[key] = at;
        body.innerHTML = '';
        num.textContent = kind === 'stamps' ? 'Stamps  ' + (at + 1) + ' / ' + pages : STR.coloringBook + '  ' + (at + 1) + ' / ' + pages;
        items.slice(at * 9, at * 9 + 9).forEach((it, k) => {
          const x = gx + 1 + (k % 3) * 106, y = gy + 1 + Math.floor(k / 3) * 106;
          const d = clickable(body, x, y, 99, 99, () => choose(it));
          const t = el('img', { class: 'thumb', src: it.src, alt: '', draggable: false }, d);
          place(t, 7, 7, 85, 85);
        });
      };
      const arrow = (dir, x) => {
        const n = 'AS_button_arrow_' + (dir < 0 ? 'left' : 'right');
        const d = clickable(m, x, gy + 156 - 47, 39, 94, () => { Sound.sfx('beep'); at = (at + dir + pages) % pages; show(); });
        const i = img(ui(n), 0, 0, d);
        d.addEventListener('pointerdown', () => { i.src = ui(n + '_pressed'); });
        d.addEventListener('pointerup', () => { i.src = ui(n); });
        d.addEventListener('pointerleave', () => { i.src = ui(n); });
      };
      arrow(-1, 216); arrow(1, 599);
      m.pickerFlip = dir => { at = (at + dir + pages) % pages; Sound.sfx('beep'); show(); };
      show();
    });
    async function choose(it) {
      Sound.sfx('MenuDing2');
      closeModal();
      if (it.stamp) { S.stamp = it.stamp; stampImage(it.stamp); setTool('stamp'); return; }
      remember();
      pctx.clearRect(0, 0, paint.width, paint.height);
      await showPage(it.blank ? 0 : it.page);
    }
  }

  // ---------------------------------------------------------------- save / load
  function readSlot(n) { try { return JSON.parse(store(SLOT_KEY + n) || 'null'); } catch (e) { return null; } }
  function composite(scale = 1) {
    const c = document.createElement('canvas');
    c.width = paint.width * scale; c.height = paint.height * scale;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(paint, 0, 0, c.width, c.height); x.drawImage(lines, 0, 0, c.width, c.height);
    return c;
  }
  function slotThumb(parent, n, x, y) {
    const s = readSlot(n);
    if (s && s.thumb) place(el('img', { class: 'thumb', src: s.thumb, alt: '' }, parent), x + 6, y + 18, 95, 71);
    else label(String(n), x, y + 30, 107, 34, parent, '#bbb');
  }
  function openSave() {
    openModal(m => {
      const x0 = 172, y0 = 60;
      img(ui('AS_window_loadsave'), x0, y0, m);
      label('Save', x0, y0 + 26, 509, 30, m);
      const sb = D.ui.AS_window_saveboxes;
      img(ui('AS_window_saveboxes'), x0 + sb.x, y0 + sb.y, m);
      [87, 203, 319].forEach((bx, k) => {
        const n = k + 1;
        slotThumb(m, n, x0 + bx, y0 + 90);
        clickable(m, x0 + bx, y0 + 90, 107, 107, () => {
          Sound.sfx('beep');
          confirm(readSlot(n) ? STR.overwrite : STR.save, () => saveSlot(n));
        });
      });
      const sd = D.ui.AS_button_sdcard;
      const d = clickable(m, x0 + (509 - sd.w) / 2, y0 + 216, sd.w, sd.h, () => { Sound.sfx('MenuDing2'); closeModal(); download(); });
      img(ui('AS_button_sdcard'), 0, 0, d);
      el('div', { class: 'btnLabel', text: 'SD Card' }, d).style.fontSize = '26px';
    });
  }
  function saveSlot(n) {
    const t = composite(0.25);   // 269x200 thumbnail
    const data = { page: S.page, paint: paint.toDataURL('image/png'), thumb: t.toDataURL('image/png'), time: Date.now(),
                   lines: S.page ? lines.toDataURL('image/png') : null };
    if (!store(SLOT_KEY + n, JSON.stringify(data))) notice('Not enough space to save image.');
  }
  function download() {
    const d = new Date(), pad = v => String(v).padStart(2, '0');
    const name = 'Art Studio SD Card Image ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.png';
    composite().toBlob(b => {
      const a = el('a', { href: URL.createObjectURL(b), download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }
  function openLoad() {
    openModal(m => {
      const x0 = 172, y0 = 60;
      img(ui('AS_window_loadsave'), x0, y0, m);
      label('Load', x0, y0 + 26, 509, 30, m);
      const cb = D.ui.AS_button_coloringbook;
      const d = clickable(m, x0 + (509 - cb.w) / 2, y0 + 80, cb.w, cb.h, () => { Sound.sfx('beep'); openPicker('pages'); });
      img(ui('AS_button_coloringbook'), 0, 0, d);
      el('div', { class: 'btnLabel', text: STR.coloringBook }, d).style.fontSize = '30px';
      const lb = D.ui.AS_window_loadboxes;
      img(ui('AS_window_loadboxes'), x0 + lb.x, y0 + lb.y, m);
      [25, 141, 257].forEach((bx, k) => {
        const n = k + 1;
        slotThumb(m, n, x0 + bx, y0 + 216);
        clickable(m, x0 + bx, y0 + 216, 107, 107, () => loadSlot(n));
      });
      img(ui('AS_sdcard_symbol'), x0 + 373 + 3, y0 + 216 + 3, m);
      clickable(m, x0 + 373, y0 + 216, 107, 107, () => { Sound.sfx('beep'); upload(); });
    });
  }
  async function loadSlot(n) {
    const s = readSlot(n);
    if (!s) { Sound.sfx('beep'); notice(STR.noFile); return; }
    Sound.sfx('MenuDing2');
    closeModal();
    remember();
    const im = await loadImage(s.paint);
    pctx.clearRect(0, 0, paint.width, paint.height);
    pctx.drawImage(im, 0, 0);
    await showPage(s.page || 0);
    if (s.lines) {
      const li = await loadImage(s.lines);
      lctx.clearRect(0, 0, lines.width, lines.height); lctx.drawImage(li, 0, 0);
    }
  }
  function upload() {
    const inp = el('input', { type: 'file', accept: 'image/*' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      try {
        const im = await loadImage(url);
        closeModal();
        remember();
        pctx.clearRect(0, 0, paint.width, paint.height);
        const s = Math.min(paint.width / im.width, paint.height / im.height);
        pctx.drawImage(im, (paint.width - im.width * s) / 2, (paint.height - im.height * s) / 2, im.width * s, im.height * s);
        await showPage(0);
        Sound.sfx('MenuDing2');
      } catch (e) { notice(STR.noFile); }
      URL.revokeObjectURL(url);
    });
    inp.click();
  }

  // ---------------------------------------------------------------- keyboard (mirrors the Wii Remote)
  const keys = e => {
    if (e.key === 'Alt') { S.alt = true; e.preventDefault(); if (S.hover) moveCursor(S.hover); return; }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (ctrl) return;
    if (S.modal && S.modal.pickerFlip && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); S.modal.pickerFlip(e.key === 'ArrowLeft' ? -1 : 1); return;
    }
    switch (e.key) {
      case 'Escape': case 'b': case 'B': goBack(); break;
      case 'ArrowUp': e.preventDefault(); if (!S.modal) changeSize(1); break;
      case 'ArrowDown': e.preventDefault(); if (!S.modal) changeSize(-1); break;
      case 'ArrowLeft': e.preventDefault(); if (!S.modal) { Sound.sfx('beep'); undo(); } break;
      case 'ArrowRight': e.preventDefault(); if (!S.modal) { Sound.sfx('beep'); redo(); } break;
      case 'a': case 'A': if (!S.modal) openSwatches(); break;
      case '1': if (!S.modal) toolButton('brush'); break;
      case '2': if (!S.modal) toolButton('eraser'); break;
      case '3': if (!S.modal) toolButton('fill'); break;
      case '4': if (!S.modal) toolButton('stamp'); break;
    }
  };
  const keyUp = e => { if (e.key === 'Alt') { S.alt = false; if (S.hover) moveCursor(S.hover); } };
  window.addEventListener('keyup', keyUp);
  root.style.opacity = 0;
  setScene(root, keys);
  const obs = new MutationObserver(() => { if (!root.isConnected) { window.removeEventListener('keyup', keyUp); obs.disconnect(); } });
  obs.observe(stage, { childList: true });
  setTimeout(() => { root.style.opacity = 1; }, 20);
  Sound.music('artstudio');
}

// Deep link for testing: #studio skips straight to the Art Studio after one click.
if (location.hash === '#studio') {
  const g = el('div', { id: 'gate', class: 'scene' });
  el('div', { class: 'big', text: 'Click or tap to open the Art Studio' }, g);
  g.addEventListener('pointerup', () => { Sound.init(); studio(); });
  setScene(g);
} else {
  gate();
}
})();
