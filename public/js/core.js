// Shadow Arcade host core: network, lobby/menu, game loop, FX, sound, voice.
// Games live in public/js/games/*.js and are auto-loaded (see host.html + /games.json).
(() => {
'use strict';
const W = 1920, H = 1080, TAU = Math.PI * 2;
const COLORS = ['#ff3d71', '#22d3ee', '#ffd400', '#7cff4d', '#c264ff', '#ff8a00', '#f5f5f5', '#ff6ec7'];
const APP_NAME = 'SHADOW ARCADE';
const PER_PAGE = 6;
const BTN_KEYS = ['a', 'b', 'c', 'd', 'h', 'l', 'r'];

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
const FONT = '"Segoe UI","Noto Sans Devanagari","Nirmala UI",Mangal,system-ui,-apple-system,sans-serif';
function text(c, s, x, y, size = 40, color = '#fff', align = 'center', weight = 800, maxW) {
  c.font = `${weight} ${size}px ${FONT}`;
  c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = color;
  if (maxW) c.fillText(s, x, y, maxW); else c.fillText(s, x, y);
}
// word-wrap helper for Hindi/English text -> array of lines
function wrap(c, s, size, weight, maxW) {
  c.font = `${weight} ${size}px ${FONT}`;
  const words = String(s).split(/\s+/), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- particles / effects ----------
const fx = {
  parts: [], rings: [], shakeV: 0, max: 1600,
  burst(x, y, color, n = 20, speed = 300, life = 0.7, size = 5) {
    for (let i = 0; i < n && this.parts.length < this.max; i++) {
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
  win() { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.07), i * 130)); },
  // quiz sounds
  pop() { tone(900, 0.07, 'sine', 0.06, 500); },
  coin() { tone(988, 0.07, 'square', 0.04); setTimeout(() => tone(1319, 0.16, 'square', 0.04), 70); },
  bad() { tone(200, 0.25, 'sawtooth', 0.06, -90); },
  lock() { tone(220, 0.35, 'triangle', 0.09); setTimeout(() => tone(165, 0.5, 'triangle', 0.09), 220); },
  heartbeat() { tone(70, 0.12, 'sine', 0.16); setTimeout(() => tone(60, 0.14, 'sine', 0.12), 160); },
  right() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), i * 90)); },
  wrong() { tone(220, 0.3, 'sawtooth', 0.07, -120); setTimeout(() => tone(150, 0.5, 'sawtooth', 0.07, -80), 260); }
};

// ---------- voice (browser text-to-speech, generic host voice) ----------
let voiceOn = true;
function speak(parts) { // parts: [[text, 'hi-IN'|'en-IN'], ...]
  try {
    const ss = window.speechSynthesis; if (!ss || !voiceOn) return;
    ss.cancel();
    const voices = ss.getVoices();
    for (const [txt, lang] of parts) {
      const u = new SpeechSynthesisUtterance(txt); u.lang = lang; u.rate = 0.92; u.pitch = 0.9;
      const v = voices.find(x => x.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) || voices.find(x => x.lang.toLowerCase().startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      ss.speak(u);
    }
  } catch (e) {}
}
function stopSpeak() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} }

// ---------- players ----------
const players = [];
const KB = {
  1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'Space', b: 'KeyE', c: 'KeyQ', d: 'KeyR', h: 'KeyT', l: 'KeyA', r: 'KeyD' },
  2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'ShiftRight', c: 'Slash', d: 'Period', h: 'Backspace', l: 'ArrowLeft', r: 'ArrowRight' }
};
const keys = new Set();
function freeColor() { const used = new Set(players.map(p => p.ci)); for (let i = 0; i < COLORS.length; i++) if (!used.has(i)) return i; return players.length % COLORS.length; }
function newBtn() { return { a: 0, b: 0, c: 0, d: 0, h: 0, l: 0, r: 0 }; }
function addPlayer(o) {
  const ci = freeColor();
  const p = Object.assign({ name: 'Player', ci, color: COLORS[ci], stick: { x: 0, y: 0 }, btn: newBtn(), hit: {}, remote: false, rid: -1, kb: 0, left: false }, o);
  p.color = COLORS[p.ci];
  players.push(p);
  return p;
}
function resetInput(p) { p.stick.x = p.stick.y = 0; p.btn = newBtn(); }

// ---------- network ----------
let ws = null, roomCode = null, netOk = false, info = null, qrImg = null, qrFor = '', baseUrl = '';
try { roomCode = sessionStorage.getItem('ax_room'); } catch (e) {}
function sendTo(id, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'to', id, msg })); }
function vib(p, ms = 40) { if (p && p.remote) sendTo(p.rid, { t: 'vib', ms }); }
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
let state = 'menu', cur = null, curDef = null, sel = 0, countdown = 0, lastCount = 4, resultT = 0, result = null;
let T = 0, menuStick = 0, toastMsg = '', toastT = 0;
function toast(m) { toastMsg = m; toastT = 2.6; }

const MENU_LAYOUT = { stick: true, buttons: [{ id: 'a', label: 'START', color: '#22d3ee' }, { id: 'b', label: 'GRAPHICS', color: '#ffd400' }], hint: 'Stick ◀ ▶ = game chuno · START = khelo' };
const WAIT_LAYOUT = { stick: false, buttons: [], hint: 'Player 1 game chun raha hai…' };
const RESULT_LAYOUT = { stick: false, buttons: [{ id: 'a', label: 'AGAIN', color: '#7cff4d' }, { id: 'b', label: 'MENU', color: '#ff8a00' }], hint: 'Round over' };
function layoutFor(p) {
  if (state === 'menu') return p === players[0] ? MENU_LAYOUT : WAIT_LAYOUT;
  if (state === 'result') return RESULT_LAYOUT;
  // games may give every player their own layout (e.g. quiz host vs. players)
  if (cur && cur.layoutFor) { const l = cur.layoutFor(p); if (l) return l; }
  return curDef.layout;
}
function pushLayout(p) { if (p.remote) sendTo(p.rid, { t: 'layout', layout: layoutFor(p) }); }
function pushLayouts() { players.forEach(pushLayout); }

function startGame(i) {
  if (state !== 'menu') return;
  const def = GAMES[i]; if (!def) return;
  if (players.length < def.min) { toast(`${def.name} ke liye ${def.min}+ players chahiye  (K / L = keyboard players)`); return; }
  curDef = def; fx.clear();
  const list = players.slice(0, def.max);
  list.forEach(p => { p.hit = {}; });
  cur = def.create({ W, H, players: list, end, fx, sfx, speak, stopSpeak, relayout: pushLayouts, toast, vib });
  state = 'countdown'; countdown = 3.4; lastCount = 4;
  pushLayouts();
}
function end(res) {
  if (state !== 'play') return;
  result = res; state = 'result'; resultT = 0; sfx.win(); pushLayouts();
}
function toMenu() {
  stopSpeak();
  for (let i = players.length - 1; i >= 0; i--) if (players[i].left) players.splice(i, 1);
  state = 'menu'; cur = null; fx.clear(); pushLayouts();
}
function replay() { const i = GAMES.indexOf(curDef); state = 'menu'; for (let k = players.length - 1; k >= 0; k--) if (players[k].left) players.splice(k, 1); startGame(i); }

// ---------- input ----------
function addKb(n) {
  if (players.some(p => p.kb === n)) { toast(`Keyboard player ${n} already added`); return; }
  addPlayer({ kb: n, name: n === 1 ? 'WASD' : 'ARROWS' });
  toast(n === 1 ? 'Keyboard player: WASD + Space(A) E(B) Q(C) R(D) T(host)' : 'Keyboard player: Arrows + Enter(A) R-Shift(B) /(C) .(D) Backspace(host)');
  pushLayouts();
}
function moveSel(d) { if (!GAMES.length) return; sel = (sel + d + GAMES.length) % GAMES.length; sfx.select(); }
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
}
window.addEventListener('keydown', e => {
  ensureAudio();
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Slash'].includes(c)) e.preventDefault();
  if (e.repeat) return;
  keys.add(c);
  if (state === 'menu') {
    if (c === 'ArrowLeft') moveSel(-1); else if (c === 'ArrowRight') moveSel(1);
    else if (c === 'Enter') startGame(sel);
    else if (c === 'KeyK') addKb(1); else if (c === 'KeyL') addKb(2);
  } else {
    if (c === 'Escape') toMenu();
    if (state === 'result' && resultT > 1.2 && c === 'Enter') replay();
  }
  if (c === 'KeyF') toggleFullscreen();
  if (c === 'KeyG') setLite(!LITE);
  if (c === 'KeyM') { voiceOn = !voiceOn; if (!voiceOn) stopSpeak(); toast(voiceOn ? 'Voice ON' : 'Voice OFF'); }
  for (const p of players) {
    if (!p.kb) continue;
    const map = KB[p.kb];
    for (const b of BTN_KEYS) if (map[b] === c) { p.btn[b] = 1; p.hit[b] = true; }
  }
});
window.addEventListener('keyup', e => {
  keys.delete(e.code);
  for (const p of players) { if (!p.kb) continue; const map = KB[p.kb]; for (const b of BTN_KEYS) if (map[b] === e.code) p.btn[b] = 0; }
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

// mouse (host laptop)
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
let scale = 1, ox = 0, oy = 0;

// ---------- LITE MODE (Android TV / slow devices) ----------
// Lite = no glow (shadowBlur is the #1 canvas slowdown on TV), canvas capped at 1280 px wide, 30 fps, fewer particles.
// Auto-ON for Android TV browsers and when FPS is low; toggle with the GRAPHICS button on Player-1's phone, key G, or ?lite=1 / ?lite=0.
let LITE = false;
try {
  const ua = navigator.userAgent, q = new URLSearchParams(location.search).get('lite'), s = localStorage.getItem('ax_lite');
  LITE = q != null ? q === '1' : s != null ? s === '1' : ((/Android/i.test(ua) && !/Mobile/i.test(ua)) || /\bTV\b|AFTT|AFTM|BRAVIA|SMART-TV|SmartTV|Tizen|Web0S|CrKey|Fire/i.test(ua));
} catch (e) {}
fx.max = LITE ? 450 : 1600;
try { // make every shadowBlur assignment a no-op in lite mode, so no game code has to change
  const sd = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
  Object.defineProperty(ctx, 'shadowBlur', { configurable: true, get() { return sd.get.call(ctx); }, set(v) { sd.set.call(ctx, LITE ? 0 : v); } });
} catch (e) {}
function setLite(v, why) {
  LITE = !!v; fx.max = LITE ? 450 : 1600; if (!LITE) fx.parts.length = Math.min(fx.parts.length, 1600);
  try { localStorage.setItem('ax_lite', LITE ? '1' : '0'); } catch (e) {}
  resize(); toast(LITE ? `Graphics: LITE (tez)${why ? ' - ' + why : ''}` : 'Graphics: FULL (sundar)');
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = LITE ? Math.min(1, 1280 / Math.max(1, w)) : Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  scale = Math.min(canvas.width / W, canvas.height / H);
  ox = (canvas.width - W * scale) / 2; oy = (canvas.height - H * scale) / 2;
}
const cardRects = []; // sparse: index = game index
function toLogical(e) {
  const dpr = canvas.width / (parseFloat(canvas.style.width) || canvas.width);
  return { x: (e.clientX * dpr - ox) / scale, y: (e.clientY * dpr - oy) / scale };
}
canvas.addEventListener('mousemove', e => {
  if (state !== 'menu') return;
  const m = toLogical(e);
  cardRects.forEach((r, i) => { if (m.x > r.x && m.x < r.x + r.w && m.y > r.y && m.y < r.y + r.h && sel !== i) { sel = i; sfx.select(); } });
});
canvas.addEventListener('mousedown', e => {
  ensureAudio();
  if (state !== 'menu') return;
  const m = toLogical(e);
  cardRects.forEach((r, i) => { if (m.x > r.x && m.x < r.x + r.w && m.y > r.y && m.y < r.y + r.h) { sel = i; startGame(i); } });
});
canvas.addEventListener('dblclick', toggleFullscreen);

// ---------- update ----------
function update(dt) {
  T += dt; toastT -= dt;
  pollKeyboards();
  if (state === 'menu') {
    fx.update(dt);
    const L = players[0];
    if (L) {
      if (!L.kb) {
        if (Math.abs(L.stick.x) > 0.6) { if (!menuStick) { menuStick = 1; moveSel(Math.sign(L.stick.x)); } } else menuStick = 0;
      }
      if (L.hit.a) startGame(sel);
      if (L.hit.b) setLite(!LITE);
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
function drawMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0620'); g.addColorStop(1, '#17093a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  blob(500 + Math.sin(T * 0.2) * 220, 330, 760, 'rgba(255,61,113,0.20)');
  blob(1500 + Math.cos(T * 0.25) * 160, 760, 860, 'rgba(34,211,238,0.17)');
  blob(960, 1100, 700, 'rgba(194,100,255,0.15)');
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = (T * 12) % 60; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // title
  ctx.save(); ctx.shadowColor = '#ff3d71'; ctx.shadowBlur = 40;
  text(ctx, APP_NAME, 100, 120, 118, '#ffffff', 'left', 900); ctx.restore();
  text(ctx, 'Phone = controller · 8 players tak · बच्चों के लिए मज़ेदार खेल', 104, 205, 32, '#9fb0d6', 'left', 600);

  // join panel
  const px = 1250, py = 50, pw = 580, ph = 340;
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; rr(ctx, px, py, pw, ph, 28); ctx.fill();
  ctx.strokeStyle = 'rgba(34,211,238,0.6)'; ctx.lineWidth = 3; rr(ctx, px, py, pw, ph, 28); ctx.stroke();
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
  text(ctx, 'Phone se QR scan karo,', px + 290, py + 214, 24, '#cdd7f5', 'left', 600);
  text(ctx, 'ya neeche wala link kholo', px + 290, py + 246, 24, '#cdd7f5', 'left', 600);
  const shown = baseUrl.replace(/^https?:\/\//, '') + '/c';
  text(ctx, shown, px + pw / 2, py + 300, 32, '#22d3ee', 'center', 800);

  // players
  text(ctx, `PLAYERS  ${players.length}/8`, 104, 262, 26, '#9fb0d6', 'left', 800);
  if (!players.length) {
    text(ctx, 'Players ka intezaar… QR code scan karo', 104, 325, 38, '#ffffff', 'left', 700);
  }
  players.forEach((p, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 104 + col * 270, y = 296 + row * 74;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(ctx, x, y, 252, 60, 30); ctx.fill();
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(x + 30, y + 30, 16, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    text(ctx, p.name + (i === 0 ? '  ★' : ''), x + 58, y + 31, 28, '#fff', 'left', 700, 180);
  });

  // cards (PER_PAGE per page)
  const CW = 290, CHh = 470, GAP = 24, y0 = 450;
  cardRects.length = 0;
  if (!GAMES.length) text(ctx, 'Games load ho rahe hain…', W / 2, 650, 40, '#9fb0d6', 'center', 700);
  const page = Math.floor(sel / PER_PAGE), pages = Math.max(1, Math.ceil(GAMES.length / PER_PAGE));
  const vis = GAMES.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const total = vis.length * CW + (vis.length - 1) * GAP, x0 = (W - total) / 2;
  vis.forEach((d, k) => {
    const i = page * PER_PAGE + k;
    const x = x0 + k * (CW + GAP), y = y0, s = i === sel ? 1.06 + Math.sin(T * 4) * 0.004 : 1, ok = players.length >= d.min;
    cardRects[i] = { x, y, w: CW, h: CHh };
    ctx.save(); ctx.translate(x + CW / 2, y + CHh / 2); ctx.scale(s, s); ctx.translate(-CW / 2, -CHh / 2);
    if (i === sel) { ctx.shadowColor = d.color; ctx.shadowBlur = 50; }
    ctx.fillStyle = '#120b30'; rr(ctx, 0, 0, CW, CHh, 26); ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); rr(ctx, 0, 0, CW, 270, 26); ctx.clip();
    try { d.art(ctx, CW, 270, LITE && i !== sel ? 0 : T); } catch (e) {}
    const sh = ctx.createLinearGradient(0, 180, 0, 270); sh.addColorStop(0, 'rgba(18,11,48,0)'); sh.addColorStop(1, 'rgba(18,11,48,1)');
    ctx.fillStyle = sh; ctx.fillRect(0, 150, CW, 120); ctx.restore();
    ctx.lineWidth = i === sel ? 5 : 2; ctx.strokeStyle = i === sel ? d.color : 'rgba(255,255,255,0.14)'; rr(ctx, 0, 0, CW, CHh, 26); ctx.stroke();
    text(ctx, d.name, CW / 2, 306, 33, '#fff', 'center', 900, CW - 24);
    d.tag.split('|').forEach((ln, kk) => text(ctx, ln, CW / 2, 352 + kk * 30, 21, '#9fb0d6', 'center', 600, CW - 20));
    text(ctx, `${d.min}-${d.max} PLAYERS`, CW / 2, 430, 21, d.color, 'center', 800);
    if (!ok) {
      ctx.fillStyle = 'rgba(8,5,24,0.6)'; rr(ctx, 0, 0, CW, CHh, 26); ctx.fill();
      text(ctx, `${d.min}+ players chahiye`, CW / 2, 215, 26, '#ffd400', 'center', 800, CW - 20);
    }
    ctx.restore();
  });
  if (pages > 1) text(ctx, `◀   Page ${page + 1} / ${pages}   ▶   (${GAMES.length} games)`, W / 2, 968, 22, '#cdd7f5', 'center', 700);

  // footer
  text(ctx, 'Player ★:  stick ◀ ▶ chuno · START        Keyboard:  ← →  Enter        K / L  keyboard players   M voice   G graphics (' + (LITE ? 'LITE' : 'FULL') + ')   F fullscreen', W / 2, 1010, 22, '#8d9bc4', 'center', 600);
  if (!audioReady) text(ctx, 'Awaaz ke liye ek baar screen par click karo', W / 2, 1048, 22, '#ffd400', 'center', 700);
  else if (location.hostname === 'localhost' && !(info && info.lan)) text(ctx, 'Tip: Wi-Fi se connect karo taaki phones join kar sakein', W / 2, 1048, 22, '#ff8a00', 'center', 700);
  else if (info && info.gemini === false) text(ctx, 'Quiz: offline sawal (Gemini key nahi mili - .env me GEMINI_API_KEY daalo)', W / 2, 1048, 20, '#ff8a00', 'center', 700);
}

function drawResult() {
  const k = Math.min(1, resultT * 3);
  ctx.fillStyle = `rgba(5,3,20,${0.74 * k})`; ctx.fillRect(0, 0, W, H);
  const pw = 1040, ph = 660, px = (W - pw) / 2, py = (H - ph) / 2;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(18,11,48,0.96)'; rr(ctx, px, py, pw, ph, 36); ctx.fill();
  ctx.strokeStyle = result.color || '#22d3ee'; ctx.lineWidth = 4; ctx.shadowColor = result.color || '#22d3ee'; ctx.shadowBlur = 30; rr(ctx, px, py, pw, ph, 36); ctx.stroke(); ctx.shadowBlur = 0;
  text(ctx, result.title, W / 2, py + 100, 80, result.color || '#fff', 'center', 900, pw - 60);
  if (result.sub) text(ctx, result.sub, W / 2, py + 170, 30, '#9fb0d6', 'center', 600, pw - 60);
  (result.lines || []).slice(0, 8).forEach((l, i) => {
    const y = py + 235 + i * 52;
    ctx.fillStyle = l.color || '#fff'; ctx.beginPath(); ctx.arc(px + 130, y, 14, 0, TAU); ctx.fill();
    text(ctx, l.name, px + 165, y + 1, 32, '#fff', 'left', 700, 520);
    text(ctx, l.text, px + pw - 120, y + 1, 32, l.color || '#fff', 'right', 800, 300);
  });
  text(ctx, 'A  Dobara khelo          B  Menu        (Enter = dobara · Esc = menu)', W / 2, py + ph - 44, 26, '#8d9bc4', 'center', 700);
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (state === 'menu') drawMenu();
  else {
    ctx.save();
    if (fx.shakeV > 0.5) ctx.translate(rand(-fx.shakeV, fx.shakeV), rand(-fx.shakeV, fx.shakeV));
    cur.draw(ctx); fx.draw(ctx);
    ctx.restore();
    if (state === 'countdown') {
      ctx.fillStyle = 'rgba(5,3,20,0.55)'; ctx.fillRect(0, 0, W, H);
      const n = Math.max(1, Math.ceil(countdown)), f = countdown - Math.floor(countdown), sc = 1 + (1 - f) * 0.5;
      text(ctx, curDef.name, W / 2, 330, 70, curDef.color, 'center', 900, W - 200);
      text(ctx, curDef.layout.hint || '', W / 2, 410, 32, '#cdd7f5', 'center', 600, W - 200);
      ctx.save(); ctx.translate(W / 2, 640); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, f * 2 + 0.3);
      ctx.shadowColor = curDef.color; ctx.shadowBlur = 50;
      text(ctx, countdown <= 0.4 ? 'GO!' : String(Math.min(3, n)), 0, 0, 260, '#fff', 'center', 900); ctx.restore();
    } else if (state === 'result') drawResult();
  }
  if (toastT > 0) {
    const a = Math.min(1, toastT * 2);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const w = Math.min(1700, toastMsg.length * 17 + 80); rr(ctx, W / 2 - w / 2, 925, w, 64, 32); ctx.fill();
    text(ctx, toastMsg, W / 2, 957, 28, '#fff', 'center', 700, w - 40); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- boot ----------
let last = 0, acc = 0, mFrames = 0, mTime = 0, slowHits = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.1, (t - last) / 1000 || 0.016); last = t;
  acc += raw;
  if (LITE && acc < 1 / 31) return;                 // lite: ~30 fps, half the GPU/CPU work
  const dt = Math.min(0.05, acc); const spent = acc; acc = 0;
  update(dt); draw();
  // auto-detect slowness: if the average frame is slow for ~3 s in FULL mode, switch to LITE by itself
  if (!LITE) {
    mFrames++; mTime += spent;
    if (mTime >= 3) { const fps = mFrames / mTime; slowHits = fps < 40 ? slowHits + 1 : 0; mFrames = 0; mTime = 0; if (slowHits >= 1) { slowHits = 0; setLite(true, 'device slow tha'); } }
  }
}
function start() {
  resize(); window.addEventListener('resize', resize);
  fetch('/info').then(r => r.json()).then(i => { info = i; refreshQR(); }).catch(() => {});
  try { ['600', '800', '900'].forEach(w => document.fonts.load(`${w} 24px "Noto Sans Devanagari"`, 'अ')); } catch (e) {}
  try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch (e) {}
  connect();
  requestAnimationFrame(frame);
}
window.addEventListener('load', start);

window.AX = {
  W, H, TAU, COLORS, clamp, rand, lerp, angDiff, turnToward, rr, text, wrap, fx, sfx, vib, speak,
  // g = { id, name, tag:'line1|line2', color, min, max, order?, layout, art(c,w,h,t), create(env) }
  register(g) { if (g.order == null) g.order = 100; GAMES.push(g); GAMES.sort((a, b) => a.order - b.order); },
  debug: { players, addPlayer, addKb, startGame, step(dt) { update(dt); draw(); }, state: () => state, result: () => result, toMenu, setCount: n => { countdown = n; }, games: () => GAMES }
};
})();
