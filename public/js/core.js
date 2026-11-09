// SHADOW Arcade host core: network, lobby/menu, game loop, FX, sound.
(() => {
'use strict';
const W = 1920, H = 1080, TAU = Math.PI * 2;
const COLORS = ['#ff3d71', '#22d3ee', '#ffd400', '#7cff4d', '#c264ff', '#ff8a00', '#f5f5f5', '#ff6ec7'];
const isTouch = (window.matchMedia ? matchMedia('(pointer:coarse)').matches : false) || new URLSearchParams(location.search).has('touch');

// ---------- helpers ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
const turnToward = (a, b, k) => a + angDiff(a, b) * Math.min(1, k);
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function text(c, s, x, y, size = 40, color = '#fff', align = 'center', weight = 800) {
  c.font = `${weight} ${size}px Mukta,"Noto Sans Devanagari","Nirmala UI","Segoe UI",system-ui,sans-serif`;
  c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(s, x, y);
}

// ---------- particles / effects ----------
const fx = {
  parts: [], rings: [], shakeV: 0,
  burst(x, y, color, n = 20, speed = 300, life = 0.7, size = 5) {
    if (lowPerf) n = Math.max(4, n >> 1);
    for (let i = 0; i < n && this.parts.length < (lowPerf ? 400 : 1600); i++) {
      const a = Math.random() * TAU, s = speed * (0.2 + Math.random() * 0.8);
      const l = life * (0.5 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, size: size * (0.5 + Math.random()), color, drag: 2.4 });
    }
  },
  ring(x, y, color, r = 120, life = 0.5) { if (this.rings.length < 80) this.rings.push({ x, y, color, r, life, max: life }); },
  shake(a) { this.shakeV = Math.max(this.shakeV, a); },
  clear() { this.parts.length = 0; this.rings.length = 0; this.shakeV = 0; },
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life -= dt; if (this.rings[i].life <= 0) this.rings.splice(i, 1); }
    this.shakeV *= Math.exp(-9 * dt); if (this.shakeV < 0.3) this.shakeV = 0;
  },
  draw(c) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const a = p.life / p.max; c.globalAlpha = a; c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, Math.max(0.5, p.size * (0.4 + a * 0.6)), 0, TAU); c.fill();
    }
    for (const r of this.rings) {
      const a = r.life / r.max; c.globalAlpha = a * 0.85; c.strokeStyle = r.color; c.lineWidth = 2 + 6 * a;
      c.beginPath(); c.arc(r.x, r.y, r.r * (1 - a) + 8, 0, TAU); c.stroke();
    }
    c.restore();
  }
};

// ---------- sound (WebAudio, no assets) ----------
let ac = null, audioReady = false;
function ensureAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac) { if (ac.state === 'suspended') ac.resume(); audioReady = ac.state === 'running' || audioReady; }
}
function tone(f, d, type = 'square', vol = 0.05, slide = 0) {
  if (!ac || ac.state !== 'running') return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, vol = 0.15) {
  if (!ac || ac.state !== 'running') return;
  const n = Math.floor(ac.sampleRate * d), buf = ac.createBuffer(1, n, ac.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; g.gain.value = vol;
  s.connect(g); g.connect(ac.destination); s.start();
}
const settings = { voice: true, music: true };
let lowPerf = new URLSearchParams(location.search).get('fx') === 'low';
let renderScale = lowPerf ? 0.6 : 1;
function enableLowPerf() {
  if (lowPerf && renderScale < 1) return;
  lowPerf = true; renderScale = 0.6; resize();
  toast('Performance mode ON — smooth play ke liye quality kam');
}
let voicesReady = false; const speakQ = [];
function pickVoice(lang) {
  try { const vs = speechSynthesis.getVoices(); return vs.find(v => v.lang === lang) || vs.find(v => v.lang.slice(0, 2) === lang.slice(0, 2)) || null; } catch (e) { return null; }
}
function hostCanSpeak() { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; }
function doSpeak(txt, lang, rate) {
  try {
    if (speechSynthesis.paused) speechSynthesis.resume();   // Android Chrome gets stuck paused and swallows speak()
    const u = new SpeechSynthesisUtterance(String(txt)); u.lang = lang; const v = pickVoice(lang); if (v) u.voice = v; u.rate = rate;
    speechSynthesis.speak(u);
  } catch (e) {}
}
// Chrome (esp. Android/TV) loads voices async: speaking before voiceschanged fires is silently dropped
function initSpeech() {
  if (!hostCanSpeak()) return;
  const ready = () => { if (voicesReady) return; voicesReady = true; const q = speakQ.splice(0); q.forEach(x => doSpeak(x.txt, x.lang, x.rate)); };
  try { if (speechSynthesis.getVoices().length) return ready(); speechSynthesis.onvoiceschanged = ready; setTimeout(ready, 1500); } catch (e) { ready(); }
}
function speak(txt, lang = 'hi-IN', rate = 0.9) {
  if (!settings.voice) return;
  if (hostCanSpeak()) { if (voicesReady) doSpeak(txt, lang, rate); else speakQ.push({ txt, lang, rate }); return; }
  const r = players.find(p => p.remote && !p.left);   // host has no TTS (some TV browsers): a joined phone speaks instead
  if (r) sendTo(r.rid, { t: 'speak', txt: String(txt), lang, rate });
}
function stopSpeak() {
  speakQ.length = 0;
  try { if (hostCanSpeak()) speechSynthesis.cancel(); } catch (e) {}
  for (const p of players) if (p.remote) sendTo(p.rid, { t: 'stopSpeak' });
}
let lastShoot = 0;
const sfx = {
  shoot() { const n = performance.now(); if (n - lastShoot < 60) return; lastShoot = n; tone(680, 0.1, 'square', 0.03, -420); },
  hit() { tone(240, 0.14, 'sawtooth', 0.05, -130); },
  boom() { noise(0.5, 0.18); tone(120, 0.4, 'sine', 0.1, -80); },
  dash() { tone(300, 0.16, 'triangle', 0.06, 500); },
  kick() { tone(150, 0.1, 'sine', 0.12, -70); },
  tick() { tone(880, 0.08, 'square', 0.04); },
  go() { tone(1320, 0.28, 'square', 0.05); },
  select() { tone(520, 0.06, 'triangle', 0.05); },
  goal() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'square', 0.04), i * 110)); },
  win() { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.07), i * 130)); }
};

// ---------- players ----------
const players = [];
const KB = {
  1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'Space', b: 'KeyE', l: 'KeyA', r: 'KeyD', c: 'KeyZ', d: 'KeyX', e: 'KeyC' },
  2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'ShiftRight', l: 'ArrowLeft', r: 'ArrowRight', c: 'Comma', d: 'Period', e: 'Slash' }
};
const keys = new Set();
function freeColor() { const used = new Set(players.map(p => p.ci)); for (let i = 0; i < COLORS.length; i++) if (!used.has(i)) return i; return players.length % COLORS.length; }
function addPlayer(o) {
  const ci = freeColor();
  const p = Object.assign({ name: 'Player', ci, color: COLORS[ci], stick: { x: 0, y: 0 }, btn: { a: 0, b: 0, l: 0, r: 0, c: 0, d: 0, e: 0 }, hit: {}, remote: false, rid: -1, kb: 0, left: false }, o);
  p.color = COLORS[p.ci];
  players.push(p);
  return p;
}
function resetInput(p) { p.stick.x = p.stick.y = 0; p.btn.a = p.btn.b = p.btn.l = p.btn.r = p.btn.c = p.btn.d = p.btn.e = 0; }

// ---------- network ----------
let ws = null, roomCode = null, netOk = false, info = null, qrImg = null, qrFor = '', baseUrl = '';
try { roomCode = sessionStorage.getItem('ax_room'); } catch (e) {}
function sendTo(id, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'to', id, msg })); }
function vib(p, ms = 40) {
  if (!p) return;
  if (p.remote) sendTo(p.rid, { t: 'vib', ms });
  else if (p.touch) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
}
function computeBase() {
  const h = location.hostname;
  if ((h === 'localhost' || h === '127.0.0.1') && info && info.lan) return `http://${info.lan}:${location.port || info.port}`;
  return location.origin;
}
function refreshQR() {
  baseUrl = computeBase();
  const url = `${baseUrl}/c?room=${roomCode || ''}`;
  if (qrFor === url || !roomCode) return;
  qrFor = url; qrImg = new Image(); qrImg.src = '/qr?data=' + encodeURIComponent(url);
}
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'host', code: roomCode }));
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'room') {
      roomCode = m.code; netOk = true;
      try { sessionStorage.setItem('ax_room', roomCode); } catch (e2) {}
      refreshQR();
    } else if (m.t === 'join') {
      if (players.some(p => p.remote && p.rid === m.id)) return;
      const p = addPlayer({ remote: true, rid: m.id, name: m.name || 'Player' });
      sendTo(p.rid, { t: 'me', color: p.color, name: p.name });
      pushLayouts();
      if (!m.re) { toast(`${p.name} joined`); sfx.select(); }
    } else if (m.t === 'rejoin') {
      const p = players.find(q => q.remote && q.rid === m.id);
      if (p) { sendTo(p.rid, { t: 'me', color: p.color, name: p.name }); pushLayout(p); }
    } else if (m.t === 'leave') {
      const i = players.findIndex(q => q.remote && q.rid === m.id);
      if (i >= 0) {
        toast(`${players[i].name} left`);
        if (state === 'menu') players.splice(i, 1); else { players[i].left = true; resetInput(players[i]); }
        pushLayouts();
      }
    } else if (m.t === 'in') {
      const p = players.find(q => q.remote && q.rid === m.id);
      if (!p || p.left) return;
      if (m.k === 's') { p.stick.x = clamp(+m.x || 0, -1, 1); p.stick.y = clamp(+m.y || 0, -1, 1); }
      else if (m.k === 'b' && p.btn[m.b] !== undefined) {
        const v = m.v ? 1 : 0;
        if (v && !p.btn[m.b]) p.hit[m.b] = true;
        p.btn[m.b] = v;
      }
    }
  };
  ws.onclose = () => { netOk = false; setTimeout(connect, 1500); };
  ws.onerror = () => { try { ws.close(); } catch (e) {} };
}

// ---------- game registry / state ----------
const GAMES = [];
let mode = 'host';
try { if (isTouch && !sessionStorage.getItem('ax_mode')) mode = 'choice'; } catch (e) {}
let state = mode === 'choice' ? 'choice' : 'lobby', cur = null, curDef = null, sel = 0, countdown = 0, lastCount = 4, resultT = 0, result = null;
let T = 0, menuStick = 0, toastMsg = '', toastT = 0;
function toast(m) { toastMsg = m; toastT = 2.6; }

const MENU_LAYOUT = { stick: true, buttons: [{ id: 'a', label: 'START', color: '#22d3ee' }, { id: 'b', label: 'LOBBY', color: '#ff8a00' }], hint: 'Stick ◀ ▶ picks a game · START plays' };
const LOBBY_LAYOUT = { stick: false, buttons: [], hint: 'Room open hai — code/link share karo.\nHost game select karega.' };
const WAIT_LAYOUT = { stick: false, buttons: [], hint: 'Player 1 is choosing the game…' };
const RESULT_LAYOUT = { stick: false, buttons: [{ id: 'a', label: 'AGAIN', color: '#7cff4d' }, { id: 'b', label: 'MENU', color: '#ff8a00' }], hint: 'Round over' };
function layoutFor(p) {
  if (state === 'lobby' || state === 'choice') return LOBBY_LAYOUT;
  if (state === 'menu') return p === players[0] ? MENU_LAYOUT : WAIT_LAYOUT;
  if (state === 'result') return RESULT_LAYOUT;
  return (cur && cur.layoutFor) ? cur.layoutFor(p, players) : curDef.layout;
}
function pushLayout(p) { if (p.remote) sendTo(p.rid, { t: 'layout', layout: layoutFor(p) }); }
function pushLayouts() { players.forEach(pushLayout); }

function startGame(i) {
  if (state !== 'menu') return;
  const def = GAMES[i]; if (!def) return;
  if (players.length < def.min) { toast(`${def.name} needs ${def.min}+ players  (press K / L for keyboard players)`); return; }
  if (isTouch && !def.touch && players.length === 1 && players[0].touch) { toast('Ye game screen-touch se nahi kheli ja sakti · Not touch-playable — friends join via /c remote'); return; }
  if (cur && cur.destroy) { try { cur.destroy(); } catch (e) {} }
  stopSpeak();
  curDef = def; fx.clear();
  const list = players.slice(0, def.max);
  list.forEach(p => { p.hit = {}; });
  cur = def.create({ W, H, players: list, end, fx, sfx, base: def.base || '', relayout: () => pushLayouts(), relayoutOne: p => pushLayout(p), speak, stopSpeak, settings, audio: { tone, noise, ready: () => !!ac && ac.state === 'running' }, toast });
  if (def.noCountdown) { state = 'play'; } else { state = 'countdown'; countdown = 3.4; lastCount = 4; }
  pushLayouts();
}
function end(res) {
  if (state !== 'play') return;
  result = res; state = 'result'; resultT = 0; sfx.win(); pushLayouts();
}
function toMenu() {
  for (let i = players.length - 1; i >= 0; i--) if (players[i].left) players.splice(i, 1);
  if (cur && cur.destroy) { try { cur.destroy(); } catch (e) {} }
  stopSpeak();
  state = 'menu'; cur = null; fx.clear(); pushLayouts();
}
function toGames() { if (state !== 'lobby') return; state = 'menu'; sfx.select(); pushLayouts(); }
function goLobby() { if (state !== 'menu') return; state = 'lobby'; sfx.select(); pushLayouts(); }
function replay() { const i = GAMES.indexOf(curDef); state = 'menu'; for (let k = players.length - 1; k >= 0; k--) if (players[k].left) players.splice(k, 1); startGame(i); }

// ---------- input ----------
function addKb(n) {
  if (players.some(p => p.kb === n)) { toast(`Keyboard player ${n} already added`); return; }
  addPlayer({ kb: n, name: n === 1 ? 'WASD' : 'ARROWS' });
  toast(n === 1 ? 'Keyboard player added: WASD + Space + E' : 'Keyboard player added: Arrows + Enter + Right-Shift');
  pushLayouts();
}
function moveSel(d) { if (!GAMES.length) return; sel = (sel + d + GAMES.length) % GAMES.length; sfx.select(); }
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
}
window.addEventListener('keydown', e => {
  ensureAudio();
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
  if (e.repeat) return;
  keys.add(c);
  if (state === 'menu') {
    if (c === 'ArrowLeft') moveSel(-1); else if (c === 'ArrowRight') moveSel(1);
    else if (c === 'Enter') startGame(sel);
    else if (c === 'KeyK') addKb(1); else if (c === 'KeyL') addKb(2);
  } else if (state === 'lobby') {
    if (c === 'Enter') toGames();
  } else {
    if (c === 'Escape') toMenu();
    if (state === 'result' && resultT > 1.2 && c === 'Enter') replay();
  }
  if (c === 'KeyF') toggleFullscreen();
  if (c === 'KeyV') { settings.voice = !settings.voice; if (!settings.voice) stopSpeak(); toast('Voice ' + (settings.voice ? 'ON' : 'OFF')); }
  if (c === 'KeyM') { settings.music = !settings.music; toast('Music ' + (settings.music ? 'ON' : 'OFF')); }
  for (const p of players) {
    if (!p.kb) continue;
    const map = KB[p.kb];
    for (const b of ['a', 'b', 'l', 'r', 'c', 'd', 'e']) if (map[b] === c) { p.btn[b] = 1; p.hit[b] = true; }
  }
});
window.addEventListener('keyup', e => {
  keys.delete(e.code);
  for (const p of players) { if (!p.kb) continue; const map = KB[p.kb]; for (const b of ['a', 'b', 'l', 'r', 'c', 'd', 'e']) if (map[b] === e.code) p.btn[b] = 0; }
});
window.addEventListener('blur', () => { keys.clear(); players.forEach(p => { if (p.kb) resetInput(p); }); });
function pollKeyboards() {
  for (const p of players) {
    if (!p.kb) continue;
    const m = KB[p.kb];
    p.stick.x = (keys.has(m.right) ? 1 : 0) - (keys.has(m.left) ? 1 : 0);
    p.stick.y = (keys.has(m.down) ? 1 : 0) - (keys.has(m.up) ? 1 : 0);
    const l = Math.hypot(p.stick.x, p.stick.y); if (l > 1) { p.stick.x /= l; p.stick.y /= l; }
  }
}

// mouse / touch (host screen; on a phone the screen itself is the controller, see js/touch.js)
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
// glow (shadowBlur) is the #1 cost on weak GPUs (Android TV): in low-perf mode every assignment becomes 0
(() => {
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
  if (d && d.set) Object.defineProperty(ctx, 'shadowBlur', { get() { return d.get.call(this); }, set(v) { d.set.call(this, lowPerf ? 0 : v); } });
})();
let scale = 1, ox = 0, oy = 0;
function resize() {
  // renderScale < 1 = fewer pixels to fill (biggest win on weak Android GPUs); browser upscales for free
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * renderScale, w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.max(320, Math.round(w * dpr)); canvas.height = Math.max(180, Math.round(h * dpr));
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  scale = Math.min(canvas.width / W, canvas.height / H);
  ox = (canvas.width - W * scale) / 2; oy = (canvas.height - H * scale) / 2;
}
const cardRects = [];
const resultZones = [];
const lobbyZones = [];
const choiceZones = [];
const menuZones = [];
let menuPtr = null;
function toLogical(e) {
  const dpr = canvas.width / (parseFloat(canvas.style.width) || canvas.width);
  return { x: (e.clientX * dpr - ox) / scale, y: (e.clientY * dpr - oy) / scale };
}
canvas.addEventListener('pointermove', e => {
  if (state !== 'menu' || e.pointerType !== 'mouse') return;
  const m = toLogical(e);
  cardRects.forEach(r => { if (m.x > r.x && m.x < r.x + r.w && m.y > r.y && m.y < r.y + r.h && sel !== r.i) { sel = r.i; sfx.select(); } });
});
function zoneAt(zs, m) { for (const z of zs) if (m.x > z.x && m.x < z.x + z.w && m.y > z.y && m.y < z.y + z.h) return z; return null; }
canvas.addEventListener('pointerdown', e => {
  ensureAudio();
  if (state === 'choice' || state === 'lobby') {
    const z = zoneAt(state === 'choice' ? choiceZones : lobbyZones, toLogical(e));
    if (z) { sfx.select(); z.act(); }
    return;
  }
  if (state === 'menu') {
    if (e.pointerType === 'mouse') {
      const m = toLogical(e);
      const z = zoneAt(menuZones, m);
      if (z) { sfx.select(); z.act(); return; }
      cardRects.forEach(r => { if (m.x > r.x && m.x < r.x + r.w && m.y > r.y && m.y < r.y + r.h) { sel = r.i; startGame(r.i); } });
    } else menuPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  } else if (state === 'result' && resultT > 0.8) {
    const m = toLogical(e);
    for (const z of resultZones) if (m.x > z.x && m.x < z.x + z.w && m.y > z.y && m.y < z.y + z.h) { sfx.select(); z.act(); break; }
  }
});
// touch menu: tap a card = play it, swipe left/right = browse games
canvas.addEventListener('pointermove', e => {
  if (menuPtr && e.pointerId === menuPtr.id && Math.abs(e.clientX - menuPtr.x) > 24) menuPtr.moved = true;
});
canvas.addEventListener('pointerup', e => {
  if (!menuPtr || e.pointerId !== menuPtr.id) return;
  const mp = menuPtr; menuPtr = null;
  if (state !== 'menu') return;
  const dx = e.clientX - mp.x;
  if (!mp.moved) {
    const m = toLogical(e);
    const z = zoneAt(menuZones, m);
    if (z) { sfx.select(); z.act(); return; }
    cardRects.forEach(r => { if (m.x > r.x && m.x < r.x + r.w && m.y > r.y && m.y < r.y + r.h) { sel = r.i; startGame(r.i); } });
  } else if (Math.abs(dx) > 50) moveSel(dx < 0 ? 1 : -1);
});
canvas.addEventListener('pointercancel', () => { menuPtr = null; });
canvas.addEventListener('dblclick', toggleFullscreen);

// ---------- update ----------
function update(dt) {
  T += dt; toastT -= dt;
  pollKeyboards();
  if (state === 'menu') {
    fx.update(dt);
    const L = players[0];
    if (L) {
      if (L.hit.b) goLobby();
      if (!L.kb) {
        if (Math.abs(L.stick.x) > 0.6) { if (!menuStick) { menuStick = 1; moveSel(Math.sign(L.stick.x)); } } else menuStick = 0;
      }
      if (L.hit.a) startGame(sel);
    }
  } else if (state === 'countdown') {
    countdown -= dt;
    const n = Math.ceil(countdown);
    if (n !== lastCount && n <= 3 && n >= 1) { sfx.tick(); lastCount = n; }
    if (countdown <= 0) { state = 'play'; sfx.go(); }
    fx.update(dt);
  } else if (state === 'play') {
    cur.update(dt, players);
    fx.update(dt);
  } else if (state === 'result') {
    resultT += dt; fx.update(dt);
    if (resultT > 1.2) {
      for (const p of players) {
        if (p.hit.a) { replay(); break; }
        if (p.hit.b) { toMenu(); break; }
      }
    }
  }
  for (const p of players) p.hit = {};
}

// ---------- draw ----------
function blob(x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawBG() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0620'); g.addColorStop(1, '#17093a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (lowPerf) return;   // blobs + grid are pure fillrate cost on weak GPUs
  blob(500 + Math.sin(T * 0.2) * 220, 330, 760, 'rgba(255,61,113,0.20)');
  blob(1500 + Math.cos(T * 0.25) * 160, 760, 860, 'rgba(34,211,238,0.17)');
  blob(960, 1100, 700, 'rgba(194,100,255,0.15)');
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = (T * 12) % 60; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}
function drawTitle(sub) {
  ctx.save(); ctx.shadowColor = '#ff3d71'; ctx.shadowBlur = 40;
  text(ctx, 'SHADOW ARCADE', 100, 120, 118, '#ffffff', 'left', 900); ctx.restore();
  if (sub) text(ctx, sub, 104, 205, 34, '#9fb0d6', 'left', 600);
}
function drawJoinPanel() {
  // QR on big screens; on a phone the code + link are shown big instead (you can't scan your own screen)
  const px = 1250, py = 50, pw = 580, ph = isTouch ? 300 : 340;
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; rr(ctx, px, py, pw, ph, 28); ctx.fill();
  ctx.strokeStyle = 'rgba(34,211,238,0.6)'; ctx.lineWidth = 3; rr(ctx, px, py, pw, ph, 28); ctx.stroke();
  if (isTouch) {
    text(ctx, 'ROOM CODE', px + 40, py + 52, 30, '#9fb0d6', 'left', 700);
    ctx.save(); ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 24;
    text(ctx, roomCode || '----', px + 36, py + 140, 120, '#ffffff', 'left', 900); ctx.restore();
    text(ctx, 'Friends open this link + code on their phone:', px + 40, py + 218, 30, '#cdd7f5', 'left', 600);
    text(ctx, baseUrl.replace(/^https?:\/\//, '') + '/c', px + 40, py + 264, 52, '#22d3ee', 'left', 800);
  } else {
    if (qrImg && qrImg.complete && qrImg.naturalWidth) {
      ctx.fillStyle = '#fff'; rr(ctx, px + 24, py + 24, 232, 232, 14); ctx.fill();
      ctx.drawImage(qrImg, px + 30, py + 30, 220, 220);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, px + 24, py + 24, 232, 232, 14); ctx.fill();
      text(ctx, netOk ? '…' : 'Connecting', px + 140, py + 140, 28, '#9fb0d6');
    }
    text(ctx, 'ROOM CODE', px + 290, py + 62, 24, '#9fb0d6', 'left', 700);
    ctx.save(); ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 24;
    text(ctx, roomCode || '----', px + 286, py + 142, 110, '#ffffff', 'left', 900); ctx.restore();
    text(ctx, 'Scan the QR with your phone,', px + 290, py + 214, 24, '#cdd7f5', 'left', 600);
    text(ctx, 'or open the link below', px + 290, py + 246, 24, '#cdd7f5', 'left', 600);
    const shown = baseUrl.replace(/^https?:\/\//, '') + '/c';
    text(ctx, shown, px + pw / 2, py + 300, 32, '#22d3ee', 'center', 800);
  }
}
function drawPlayers(y0) {
  text(ctx, `PLAYERS  ${players.length}/8`, 104, y0 - 34, 26, '#9fb0d6', 'left', 800);
  if (!players.length) {
    text(ctx, 'Waiting for players… share the room code', 104, y0 + 29, 38, '#ffffff', 'left', 700);
  }
  players.forEach((p, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 104 + col * 270, y = y0 + row * 74;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, x, y, 252, 60, 30); ctx.fill();
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(x + 30, y + 30, 16, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    text(ctx, p.name + (i === 0 ? '  ★' : ''), x + 58, y + 31, 28, '#fff', 'left', 700);
  });
}
function drawBigBtn(z, col, label, sub) {
  const pulse = 0.5 + 0.5 * Math.sin(T * 3);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, z.x, z.y, z.w, z.h, z.h / 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.shadowColor = col; ctx.shadowBlur = 14 + pulse * 16;
  rr(ctx, z.x, z.y, z.w, z.h, z.h / 2); ctx.stroke(); ctx.shadowBlur = 0;
  text(ctx, label, z.x + z.w / 2, z.y + (sub ? z.h / 2 - 16 : z.h / 2 + 1), sub ? 42 : 44, col, 'center', 900);
  if (sub) text(ctx, sub, z.x + z.w / 2, z.y + z.h / 2 + 26, 24, '#cdd7f5', 'center', 600);
  ctx.restore();
}
function shareJoin() {
  const url = baseUrl + '/c?room=' + roomCode;
  const txt = 'Shadow Arcade me join karo! Room code: ' + roomCode;
  if (navigator.share) navigator.share({ title: 'Shadow Arcade', text: txt, url }).catch(() => {});
  else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt + ' ' + url).then(() => toast('Join link copy ho gaya — kahin bhi paste karo'), () => toast(url));
  else toast(url);
}
function drawLobby() {
  drawBG();
  drawTitle(isTouch ? 'Room ban gaya! Code/link bhejo — sab join karein, phir game chuno.' : 'Room ready! Share the code/link — sab join hone ke baad Player ★ game chunega.');
  drawJoinPanel();
  drawPlayers(296);
  lobbyZones.length = 0;
  const z1 = { x: W / 2 - 410, y: 756, w: 820, h: 112, act: toGames };
  drawBigBtn(z1, '#7cff4d', 'SAB JOIN HO GAYE · GAME CHUNO ▶', 'Everyone joined? Pick a game');
  lobbyZones.push(z1);
  if (isTouch) {
    const z2 = { x: W / 2 - 410, y: 884, w: 820, h: 76, act: shareJoin };
    drawBigBtn(z2, '#22d3ee', 'SHARE JOIN LINK · WhatsApp / SMS');
    lobbyZones.push(z2);
    const z3 = { x: W / 2 - 410, y: 976, w: 820, h: 64, act: () => { location.href = '/c'; } };
    drawBigBtn(z3, '#ff8a00', 'USE THIS PHONE AS A REMOTE INSTEAD');
    lobbyZones.push(z3);
  } else {
    text(ctx, 'Enter = game chuno', W / 2, 982, 26, '#8d9bc4', 'center', 600);
  }
}
function drawChoice() {
  drawBG();
  ctx.save(); ctx.shadowColor = '#ff3d71'; ctx.shadowBlur = 40;
  text(ctx, 'SHADOW ARCADE', W / 2, 200, 110, '#ffffff', 'center', 900); ctx.restore();
  text(ctx, 'Kaise khelna hai? · How do you want to play?', W / 2, 300, 40, '#9fb0d6', 'center', 600);
  choiceZones.length = 0;
  const z1 = { x: W / 2 - 430, y: 420, w: 860, h: 200, act: () => { try { sessionStorage.setItem('ax_mode', 'host'); } catch (e) {} state = 'lobby'; pushLayouts(); } };
  drawBigBtn(z1, '#7cff4d', 'PLAY ON THIS MOBILE', 'Game isi phone pe khulega · friends remote se join karenge');
  choiceZones.push(z1);
  const z2 = { x: W / 2 - 430, y: 680, w: 860, h: 200, act: () => { location.href = '/c'; } };
  drawBigBtn(z2, '#ff8a00', 'USE MOBILE AS A REMOTE', 'TV/laptop ke room me controller bankar join karo');
  choiceZones.push(z2);
}
function drawMenu() {
  drawBG();
  menuZones.length = 0;

  // lobby pill (top-left) — wait for more players
  const lp = { x: 100, y: 58, w: 430, h: 78, act: goLobby };
  ctx.fillStyle = 'rgba(255,138,0,0.12)'; rr(ctx, lp.x, lp.y, lp.w, lp.h, 39); ctx.fill();
  ctx.strokeStyle = '#ff8a00'; ctx.lineWidth = 3; rr(ctx, lp.x, lp.y, lp.w, lp.h, 39); ctx.stroke();
  text(ctx, '‹ LOBBY · WAIT FOR MORE', lp.x + lp.w / 2, lp.y + lp.h / 2 + 1, 28, '#ff8a00', 'center', 800);
  menuZones.push(lp);

  // title (centered between pill and join panel)
  ctx.save(); ctx.shadowColor = '#ff3d71'; ctx.shadowBlur = 40;
  text(ctx, 'SHADOW ARCADE', 880, 100, 76, '#ffffff', 'center', 900); ctx.restore();
  text(ctx, isTouch ? 'Tap a game to play · swipe ◀ ▶ to browse' : 'Player ★: stick ◀ ▶ choose · START to play', 880, 168, 28, '#9fb0d6', 'center', 600);

  drawJoinPanel();
  drawPlayers(296);

  // cards (5 visible at a time, scrolls with selection)
  const VIS = 5, CW = 330, CHh = 470, GAP = 32, nG = GAMES.length, nv = Math.min(VIS, nG);
  const first = nG > VIS ? clamp(sel - 2, 0, nG - VIS) : 0, total = nv * CW + Math.max(0, nv - 1) * GAP, x0 = (W - total) / 2, y0 = 450;
  cardRects.length = 0;
  if (!nG) text(ctx, 'Loading games…', W / 2, 650, 40, '#9fb0d6', 'center', 700);
  for (let k = 0; k < nv; k++) {
    const i = first + k, d = GAMES[i];
    const x = x0 + k * (CW + GAP), y = y0, s = i === sel ? 1.06 + Math.sin(T * 4) * 0.004 : 1, ok = players.length >= d.min;
    cardRects.push({ i, x, y, w: CW, h: CHh });
    ctx.save(); ctx.translate(x + CW / 2, y + CHh / 2); ctx.scale(s, s); ctx.translate(-CW / 2, -CHh / 2);
    if (i === sel) { ctx.shadowColor = d.color; ctx.shadowBlur = 50; }
    ctx.fillStyle = '#120b30'; rr(ctx, 0, 0, CW, CHh, 26); ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); rr(ctx, 0, 0, CW, 270, 26); ctx.clip();
    try { d.art(ctx, CW, 270, T); } catch (e) {}
    const sh = ctx.createLinearGradient(0, 180, 0, 270); sh.addColorStop(0, 'rgba(18,11,48,0)'); sh.addColorStop(1, 'rgba(18,11,48,1)');
    ctx.fillStyle = sh; ctx.fillRect(0, 150, CW, 120); ctx.restore();
    ctx.lineWidth = i === sel ? 5 : 2; ctx.strokeStyle = i === sel ? d.color : 'rgba(255,255,255,0.14)'; rr(ctx, 0, 0, CW, CHh, 26); ctx.stroke();
    text(ctx, d.name, CW / 2, 306, d.name.length > 14 ? 30 : 36, '#fff', 'center', 900);
    String(d.tag || '').split('|').forEach((ln, kk) => text(ctx, ln, CW / 2, 352 + kk * 30, 23, '#9fb0d6', 'center', 600));
    text(ctx, `${d.min}-${d.max} PLAYERS`, CW / 2, 430, 22, d.color, 'center', 800);
    if (d.touch) { ctx.fillStyle = d.color; rr(ctx, CW - 128, 20, 108, 42, 21); ctx.fill(); text(ctx, 'TOUCH', CW - 74, 42, 24, '#081018', 'center', 900); }
    if (!ok) {
     }
    ctx.restore();
  }
  if (nG > VIS) {
    if (first > 0) text(ctx, '‹', x0 - 44, y0 + CHh / 2, 90, '#9fb0d6', 'center', 800);
    if (first + nv < nG) text(ctx, '›', x0 + total + 44, y0 + CHh / 2, 90, '#9fb0d6', 'center', 800);
    text(ctx, `${sel + 1} / ${nG}`, W / 2, 950, 22, '#8d9bc4', 'center', 700);
  }

  // footer
  text(ctx, isTouch ? 'TOUCH games: screen pe tap/swipe karke khelo · Swipe ◀ ▶ browse        Friends join as remotes:  ' + baseUrl.replace(/^https?:\/\//, '') + '/c  + room code' : 'Player ★:  stick ◀ ▶ choose  ·  START to play        Keyboard:  ← →  Enter        K / L  add keyboard players        F  fullscreen', W / 2, 1010, 24, '#8d9bc4', 'center', 600);
  if (!audioReady) text(ctx, (isTouch ? 'Tap' : 'Click') + ' anywhere once to enable sound', W / 2, 1048, 22, '#ffd400', 'center', 700);
  if (location.hostname === 'localhost' && !(info && info.lan)) text(ctx, 'Tip: connect this computer to Wi-Fi so phones can join', W / 2, 1048, 22, '#ff8a00', 'center', 700);
}

function drawResult() {
  const k = Math.min(1, resultT * 3);
  ctx.fillStyle = `rgba(5,3,20,${0.74 * k})`; ctx.fillRect(0, 0, W, H);
  const pw = 1040, ph = 660, px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(18,11,48,0.96)'; rr(ctx, px, py, pw, ph, 36); ctx.fill();
  ctx.strokeStyle = result.color || '#22d3ee'; ctx.lineWidth = 4; ctx.shadowColor = result.color || '#22d3ee'; ctx.shadowBlur = 30; rr(ctx, px, py, pw, ph, 36); ctx.stroke(); ctx.shadowBlur = 0;
  text(ctx, result.title, W / 2, py + 100, 80, result.color || '#fff', 'center', 900);
  if (result.sub) text(ctx, result.sub, W / 2, py + 170, 30, '#9fb0d6', 'center', 600);
  (result.lines || []).slice(0, 8).forEach((l, i) => {
    const y = py + 235 + i * 52;
    ctx.fillStyle = l.color || '#fff'; ctx.beginPath(); ctx.arc(px + 130, y, 14, 0, TAU); ctx.fill();
    text(ctx, l.name, px + 165, y + 1, 32, '#fff', 'left', 700);
    text(ctx, l.text, px + pw - 120, y + 1, 32, l.color || '#fff', 'right', 800);
  });
  text(ctx, 'A  Play again          B  Menu        (Enter = again · Esc = menu)', W / 2, py + ph - 44, 26, '#8d9bc4', 'center', 700);
  resultZones.length = 0;
  const bw = 400, bh = 78, gy = py + ph + 24;
  for (const z of [{ x: W / 2 - bw - 24, label: 'PLAY AGAIN', col: '#7cff4d', act: replay }, { x: W / 2 + 24, label: 'MENU', col: '#ff8a00', act: toMenu }]) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; rr(ctx, z.x, gy, bw, bh, 39); ctx.fill();
    ctx.strokeStyle = z.col; ctx.lineWidth = 3; ctx.shadowColor = z.col; ctx.shadowBlur = 18; rr(ctx, z.x, gy, bw, bh, 39); ctx.stroke(); ctx.shadowBlur = 0;
    text(ctx, z.label, z.x + bw / 2, gy + bh / 2 + 1, 34, z.col, 'center', 900);
    resultZones.push({ x: z.x, y: gy, w: bw, h: bh, act: z.act });
  }
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (state === 'lobby') drawLobby();
  else if (state === 'choice') drawChoice();
  else if (state === 'menu') drawMenu();
  else {
    ctx.save();
    if (fx.shakeV > 0.5) ctx.translate(rand(-fx.shakeV, fx.shakeV), rand(-fx.shakeV, fx.shakeV));
    cur.draw(ctx); fx.draw(ctx);
    ctx.restore();
    if (state === 'countdown') {
      ctx.fillStyle = 'rgba(5,3,20,0.55)'; ctx.fillRect(0, 0, W, H);
      const n = Math.max(1, Math.ceil(countdown)), f = countdown - Math.floor(countdown), sc = 1 + (1 - f) * 0.5;
      text(ctx, curDef.name, W / 2, 330, 70, curDef.color, 'center', 900);
      text(ctx, curDef.layout.hint || '', W / 2, 410, 32, '#cdd7f5', 'center', 600);
      ctx.save(); ctx.translate(W / 2, 640); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, f * 2 + 0.3);
      ctx.shadowColor = curDef.color; ctx.shadowBlur = 50;
      text(ctx, countdown <= 0.4 ? 'GO!' : String(Math.min(3, n)), 0, 0, 260, '#fff', 'center', 900); ctx.restore();
    } else if (state === 'result') drawResult();
  }
  if (toastT > 0) {
    const a = Math.min(1, toastT * 2);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const w = Math.min(1500, toastMsg.length * 17 + 80); rr(ctx, W / 2 - w / 2, 925, w, 64, 32); ctx.fill();
    text(ctx, toastMsg, W / 2, 957, 28, '#fff', 'center', 700); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- plugin games ----------
function normGame(g) {
  g.name = g.name || g.id || 'GAME'; g.tag = g.tag || ''; g.color = g.color || '#22d3ee'; g.min = g.min || 1; g.max = g.max || 8;
  g.layout = g.layout || { stick: true, buttons: [{ id: 'a', label: 'A', color: '#22d3ee' }, { id: 'b', label: 'B', color: '#ff3d71' }], hint: '' };
  if (typeof g.art !== 'function') g.art = (c, w, h, t) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b0820'); gr.addColorStop(1, g.color); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2); text(c, String(g.name).slice(0, 2), w / 2, h / 2 - 10, 120, '#fff', 'center', 800); c.globalAlpha = 1;
  };
  return g;
}
function loadScript(src) { return new Promise((ok, no) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => no(new Error('cannot load ' + src)); document.head.appendChild(el); }); }
function cleanResult(r) {
  r = r && typeof r === 'object' ? r : {};
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  return { title: str(r.title || 'GAME OVER', 40), sub: str(r.sub, 90), color: /^#[0-9a-f]{3,8}$/i.test(r.color || '') ? r.color : '#22d3ee',
    lines: (Array.isArray(r.lines) ? r.lines : []).slice(0, 8).map(l => ({ name: str(l && l.name, 22), text: str(l && l.text, 18), color: /^#[0-9a-f]{3,8}$/i.test((l && l.color) || '') ? l.color : '#ffffff' })) };
}
// Games written as a normal web page (index.html) run in an iframe and talk to the console through /sdk.js
function makeHtmlGame(m) {
  return normGame({
    id: m.id, name: m.name, tag: m.tag, color: m.color, min: m.min, max: m.max, layout: m.layout, base: m.base, noCountdown: m.noCountdown, touch: !!m.touch,
    create(env) {
      const f = document.createElement('iframe');
      f.src = m.base + m.entry;
      f.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;border:0;background:#000;z-index:5;visibility:hidden';
      document.body.appendChild(f);
      let ready = false, shown = false, ended = false;
      const post = o => { try { f.contentWindow.postMessage(Object.assign({ arc: 1 }, o), '*'); } catch (e) {} };
      const info = () => env.players.map((p, i) => ({ i, name: p.name, color: p.color, touch: !!p.touch }));
      const onMsg = e => {
        if (e.source !== f.contentWindow) return;
        const d = e.data; if (!d || d.arc !== 1) return;
        if (d.t === 'ready') { ready = true; post({ t: 'init', players: info() }); }
        else if (d.t === 'end' && !ended) { ended = true; f.style.visibility = 'hidden'; end(cleanResult(d.result)); }
        else if (d.t === 'vib') { const p = env.players[d.i]; if (p) vib(p, +d.ms || 40); }
        else if (d.t === 'tap') { const p = env.players[+d.i || 0]; if (p && !p.left) p.hit.a = true; }
        else if (d.t === 'sfx' && sfx[d.n]) sfx[d.n]();
      };
      window.addEventListener('message', onMsg);
      return {
        update(dt, pl) {
          if (!shown) { shown = true; f.style.visibility = 'visible'; }
          if (ready && !ended) post({ t: 'frame', dt, players: pl.slice(0, env.players.length).map(p => ({ x: p.stick.x, y: p.stick.y, btn: Object.assign({}, p.btn), hit: Object.assign({}, p.hit) })) });
        },
        draw(c) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); },
        destroy() { window.removeEventListener('message', onMsg); f.remove(); }
      };
    }
  });
}
async function loadGames() {
  let list = [];
  try { const r = await fetch('/games.json'); const j = await r.json(); if (Array.isArray(j)) list = j; } catch (e) { console.warn('games.json failed', e); }
  for (const m of list) {
    try {
      if (m.type === 'html') GAMES.push(makeHtmlGame(m));
      else { AX._manifest = m; const n0 = GAMES.length; await loadScript(m.base + m.entry); if (GAMES.length === n0) console.warn('[games] ' + m.id + ' did not call AX.register()'); }
    } catch (e) { console.warn('[games] ' + m.id + ': ' + e.message); toast('Game "' + m.id + '" failed to load'); }
    AX._manifest = null;
  }
  const ord = new Map(list.map((m, i) => [m.id, i]));
  GAMES.sort((a, b) => (ord.has(a.id) ? ord.get(a.id) : 999) - (ord.has(b.id) ? ord.get(b.id) : 999));
}
function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return Promise.resolve();
  const jobs = [];
  for (const w of [500, 700, 800]) { jobs.push(document.fonts.load(`${w} 32px Mukta`, 'Aa')); jobs.push(document.fonts.load(`${w} 32px Mukta`, 'अआ')); }
  return Promise.race([Promise.all(jobs).catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
}

// ---------- boot ----------
let last = 0, emaDt = 0.016, slowT = 0, lastDraw = 0;
function frame(t) {
  const raw = (t - last) / 1000 || 0.016;
  if (lowPerf && t - lastDraw < 26) { requestAnimationFrame(frame); return; }   // cap ~38fps: weaker GPU load, dt-based games stay correct
  lastDraw = t;
  const dt = Math.min(0.05, raw); last = t;
  if (!lowPerf && T > 2.5) {   // auto-detect slow devices (Android phone/TV) and drop quality
    emaDt += (dt - emaDt) * 0.06;
    if (emaDt > 0.036) slowT += dt; else slowT = Math.max(0, slowT - dt * 2);
    if (slowT > 2) enableLowPerf();
  }
  try { update(dt); draw(); }
  catch (e) {   // a broken game must never freeze the console: go back to the menu and keep running
    console.error('[arcade] error in ' + (curDef ? curDef.id : 'menu') + ':', e);
    if (state !== 'menu') { const nm = curDef ? curDef.name : 'game'; try { toMenu(); } catch (e2) { state = 'menu'; cur = null; } toast('"' + nm + '" crashed - back to menu'); }
  }
  requestAnimationFrame(frame);
}
function start() {
  resize(); window.addEventListener('resize', resize);
  initSpeech();
  if (isTouch) addPlayer({ touch: true, name: 'YOU' });
  fetch('/info').then(r => r.json()).then(i => { info = i; refreshQR(); }).catch(() => {});
  connect();
  loadFonts().then(loadGames).catch(() => {}).then(() => requestAnimationFrame(frame));
}
window.addEventListener('load', start);

window.AX = {
  W, H, TAU, COLORS, clamp, rand, lerp, angDiff, turnToward, rr, text, fx, sfx, vib, speak, stopSpeak, settings,
  isTouch, ensureAudio,
  view: () => ({ scale, ox, oy, cssScale: canvas.width / (parseFloat(canvas.style.width) || canvas.width) }),
  game: () => cur, state: () => state, touchPlayer: () => players.find(p => p.touch) || null,
  register(g) {
    const m = AX._manifest;
    if (m) { for (const k of ['name', 'tag', 'color', 'min', 'max', 'layout', 'noCountdown', 'touch']) if (m[k] !== undefined) g[k] = m[k]; g.id = m.id; g.base = m.base; }
    GAMES.push(normGame(g));
  },
  debug: { players, addPlayer, addKb, startGame, step(dt) { update(dt); draw(); }, state: () => state, result: () => result, toMenu, setCount: n => { countdown = n; } }
};
})();
