(function () {
'use strict';

/* ===================== GAME CONFIG ===================== */
const TITLE = 'Tic-Tac-Toe';

/* ===================== SHARED SHELL (UI, input, loop) ===================== */
const CSS = `
body{margin:0;min-height:100vh;display:flex;justify-content:center;align-items:flex-start;padding:20px 0;box-sizing:border-box;background:radial-gradient(circle at top,#1b2150 0%,#0b0d1a 60%);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e8ecff}
#g-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(900px,96vw)}
#g-title{font-size:1.6rem;letter-spacing:4px;margin:0;background:linear-gradient(90deg,#00e5ff,#ff2d95);-webkit-background-clip:text;background-clip:text;color:transparent}
#g-hud{width:100%;display:flex;justify-content:space-between;align-items:center;background:#141833;border:1px solid #2a3170;border-radius:14px;padding:12px 18px;font-weight:600;gap:10px;box-sizing:border-box}
#g-score{font-size:1.5rem;letter-spacing:3px}
#g-canvas{background:#070a18;border-radius:16px;border:1px solid #2a3170;box-shadow:0 0 40px rgba(0,229,255,.12);max-width:100%;height:auto;touch-action:none}
#g-status{min-height:28px;font-size:1.05rem;color:#00e5ff;text-align:center}
.g-bar{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.g-bar button{font:inherit;color:#e8ecff;background:#141833;border:1px solid #2a3170;border-radius:10px;padding:10px 16px;cursor:pointer;transition:.2s}
.g-bar button:hover{border-color:#00e5ff;box-shadow:0 0 12px rgba(0,229,255,.35)}
.g-bar button.active{border-color:#ff2d95;box-shadow:0 0 14px rgba(255,45,149,.45)}
#g-hint{color:#8b93c7;font-size:.85rem;text-align:center;max-width:700px}
`;

const keys = {};
const MODE = { value: 'cpu' };
let game = null, canvas = null, ctx = null, last = 0;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function clear(bg = '#070a18') { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
function neonLine(x1, y1, x2, y2, color, w = 6, blur = 18) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function neonCircle(x, y, r, color, w = 6, blur = 18) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function fillCircle(x, y, r, color, blur = 0) {
  ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function fillRect(x, y, w, h, color, blur = 0, rad = 0) {
  ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.fill(); ctx.restore();
}
function label(s, x, y, size = 28, color = '#e8ecff', align = 'center') {
  ctx.save(); ctx.font = `bold ${size}px system-ui, sans-serif`; ctx.fillStyle = color;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); ctx.restore();
}

function buildUI() {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  document.title = TITLE;

  const wrap = document.createElement('div');
  wrap.id = 'g-wrap';
  wrap.innerHTML = `
    <h1 id="g-title">${TITLE}</h1>
    <div id="g-hud"><span id="g-p1"></span><span id="g-score"></span><span id="g-p2"></span></div>
    <canvas id="g-canvas" width="600" height="600"></canvas>
    <div id="g-status"></div>
    <div class="g-bar">
      <button id="g-cpu">🤖 vs Computer</button>
      <button id="g-pvp">👥 2 Players</button>
      <button id="g-restart">↻ Restart</button>
    </div>
    <div id="g-hint"></div>`;
  document.body.appendChild(wrap);

  canvas = document.getElementById('g-canvas');
  ctx = canvas.getContext('2d');

  document.getElementById('g-cpu').onclick = () => setMode('cpu');
  document.getElementById('g-pvp').onclick = () => setMode('pvp');
  document.getElementById('g-restart').onclick = () => startGame();

  canvas.addEventListener('pointerdown', e => {
    const p = canvasPoint(e);
    if (game && game.onPointer) game.onPointer(p.x, p.y);
  });
  canvas.addEventListener('pointermove', e => {
    const p = canvasPoint(e);
    if (game && game.onHover) game.onHover(p.x, p.y);
  });
  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (keys[e.code]) return;
    keys[e.code] = true;
    if (game && game.onKey) game.onKey(e.code);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  startGame();
  requestAnimationFrame(frame);
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}
function setMode(m) { MODE.value = m; startGame(); }
function startGame() {
  game = makeGame(MODE.value);
  canvas.width = game.size[0];
  canvas.height = game.size[1];
  document.getElementById('g-p1').textContent = game.names[0];
  document.getElementById('g-p2').textContent = game.names[1];
  document.getElementById('g-hint').textContent = game.hint;
  document.getElementById('g-cpu').classList.toggle('active', MODE.value === 'cpu');
  document.getElementById('g-pvp').classList.toggle('active', MODE.value === 'pvp');
}
function frame(t) {
  const dt = Math.min(50, t - (last || t));
  last = t;
  if (game) {
    game.update(dt);
    game.draw();
    document.getElementById('g-score').textContent = game.score();
    document.getElementById('g-status').textContent = game.status();
  }
  requestAnimationFrame(frame);
}

/* ===================== GAME: TIC-TAC-TOE ===================== */
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function winnerOf(b) {
  for (const l of LINES) {
    const [a, c, d] = l;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { p: b[a], line: l };
  }
  return b.every(Boolean) ? { p: 'draw', line: [] } : null;
}
function minimax(b, depth, isO) {
  const w = winnerOf(b);
  if (w) return w.p === 'O' ? 10 - depth : (w.p === 'X' ? depth - 10 : 0);
  let best = isO ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = isO ? 'O' : 'X';
    const s = minimax(b, depth + 1, !isO);
    b[i] = null;
    best = isO ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}
function bestMove(board) {
  const b = [...board];
  let best = -Infinity, move = -1;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = 'O';
    const s = minimax(b, 1, false);
    b[i] = null;
    if (s > best) { best = s; move = i; }
  }
  return move;
}
const cellC = i => ({ x: (i % 3) * 200 + 100, y: Math.floor(i / 3) * 200 + 100 });
function drawX(x, y) {
  const d = 55;
  neonLine(x - d, y - d, x + d, y + d, '#ff2d95', 12, 22);
  neonLine(x + d, y - d, x - d, y + d, '#ff2d95', 12, 22);
}
function drawO(x, y) { neonCircle(x, y, 55, '#00e5ff', 12, 22); }

class TicTacToe {
  constructor(mode) {
    this.mode = mode;
    this.size = [600, 600];
    this.names = mode === 'cpu' ? ['You (X)', 'Computer (O)'] : ['Player 1 (X)', 'Player 2 (O)'];
    this.hint = 'Click a square, or press keys 1–9 (left to right, top to bottom). Click the board after a round to start the next one.';
    this.wins = { X: 0, O: 0, draw: 0 };
    this.hover = -1;
    this.reset();
  }
  reset() {
    this.board = Array(9).fill(null);
    this.turn = 'X';
    this.over = false;
    this.result = null;
    this.line = [];
    this.cpuTimer = 0;
  }
  canHuman() { return !this.over && !(this.mode === 'cpu' && this.turn === 'O'); }
  place(i) {
    if (this.over || this.board[i]) return;
    this.board[i] = this.turn;
    const w = winnerOf(this.board);
    if (w) {
      this.over = true; this.result = w.p; this.line = w.line;
      if (w.p === 'draw') this.wins.draw++; else this.wins[w.p]++;
    } else {
      this.turn = this.turn === 'X' ? 'O' : 'X';
      if (this.mode === 'cpu' && this.turn === 'O') this.cpuTimer = 450;
    }
  }
  update(dt) {
    if (this.cpuTimer > 0) {
      this.cpuTimer -= dt;
      if (this.cpuTimer <= 0 && !this.over) this.place(bestMove(this.board));
    }
  }
  onPointer(x, y) {
    if (this.over) { this.reset(); return; }
    if (!this.canHuman()) return;
    const i = Math.floor(y / 200) * 3 + Math.floor(x / 200);
    if (i >= 0 && i < 9) this.place(i);
  }
  onHover(x, y) { this.hover = Math.floor(y / 200) * 3 + Math.floor(x / 200); }
  onKey(code) {
    const m = /^(Digit|Numpad)([1-9])$/.exec(code);
    if (!m) return;
    if (this.over) { this.reset(); return; }
    if (this.canHuman()) this.place(Number(m[2]) - 1);
  }
  draw() {
    clear();
    for (let i = 1; i < 3; i++) {
      neonLine(i * 200, 24, i * 200, 576, '#00e5ff', 6, 16);
      neonLine(24, i * 200, 576, i * 200, '#00e5ff', 6, 16);
    }
    if (this.canHuman() && this.hover >= 0 && this.hover < 9 && !this.board[this.hover]) {
      const c = cellC(this.hover);
      ctx.globalAlpha = 0.25;
      if (this.turn === 'X') drawX(c.x, c.y); else drawO(c.x, c.y);
      ctx.globalAlpha = 1;
    }
    this.board.forEach((v, i) => {
      const c = cellC(i);
      if (v === 'X') drawX(c.x, c.y);
      else if (v === 'O') drawO(c.x, c.y);
    });
    if (this.line.length) {
      const a = cellC(this.line[0]), b = cellC(this.line[2]);
      neonLine(a.x, a.y, b.x, b.y, '#ffd166', 10, 28);
    }
  }
  score() { return `${this.wins.X} – ${this.wins.O}  ·  Draws ${this.wins.draw}`; }
  status() {
    if (this.over) {
      if (this.result === 'draw') return "It's a draw! Click to play again.";
      return `${this.result === 'X' ? this.names[0] : this.names[1]} wins! Click to play again.`;
    }
    if (this.mode === 'cpu') return this.turn === 'X' ? 'Your turn (X)' : 'Computer is thinking…';
    return `${this.turn === 'X' ? this.names[0] : this.names[1]} to move`;
  }
}
function makeGame(m) { return new TicTacToe(m); }

/* ===================== START ===================== */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
else buildUI();
})();
