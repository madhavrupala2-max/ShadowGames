// GUBBARE POP - move your crosshair and pop balloons. Gold = +5, bomb = -3.
(() => {
const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;
const TIME = 50;

function balloon(c, x, y, r, col, t, kind) {
  c.save(); c.translate(x, y);
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, r * 1.25); c.quadraticCurveTo(Math.sin(t * 3) * 10, r * 2, 0, r * 2.6); c.stroke();
  c.shadowColor = col; c.shadowBlur = kind === 'gold' ? 34 : 16;
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.2); g.addColorStop(0, '#fff'); g.addColorStop(0.25, col); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r * 0.88, r * 1.1, 0, 0, TAU); c.fill(); c.shadowBlur = 0;
  c.fillStyle = col; c.beginPath(); c.moveTo(0, r * 1.1); c.lineTo(-7, r * 1.32); c.lineTo(7, r * 1.32); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.45, r * 0.14, r * 0.26, -0.5, 0, TAU); c.fill();
  if (kind === 'gold') text(c, '★', 0, 2, r * 0.9, '#fff', 'center', 900);
  if (kind === 'bomb') text(c, '☠', 0, 2, r * 0.9, '#fff', 'center', 900);
  c.restore();
}
const PAL = ['#ff3d71', '#22d3ee', '#ffd400', '#7cff4d', '#c264ff', '#ff8a00', '#ff6ec7'];

AX.register({
  id: 'balloons', name: 'GUBBARE POP', tag: 'Gubbare phodo, ★ = +5|☠ se bacho!', color: '#22d3ee', min: 1, max: 8, order: 31,
  layout: { stick: true, buttons: [{ id: 'a', label: 'POP!', color: '#22d3ee' }], hint: 'Stick = nishana · POP = gubbara phodo' },
  art(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a1f7a'); g.addColorStop(1, '#ff7eb6'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) balloon(c, 40 + i * 50, 150 - ((t * 30 + i * 37) % 160) + 70, 24, PAL[i], t + i, i === 2 ? 'gold' : 'n');
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(170, 110, 20, 0, TAU); c.moveTo(170, 80); c.lineTo(170, 140); c.moveTo(140, 110); c.lineTo(200, 110); c.stroke();
  },
  create(env) {
    const ps = env.players, n = ps.length;
    const cur = ps.map((p, i) => ({ p, i, x: W * (i + 1) / (n + 1), y: H / 2, score: 0, cd: 0, flash: 0, color: p.color, name: p.name }));
    const bl = []; let left = TIME, t = 0, spawn = 0, over = false, endT = 0;
    const clouds = Array.from({ length: 7 }, () => ({ x: rand(0, W), y: rand(80, 700), s: rand(0.6, 1.4), v: rand(8, 26) }));
    function spawnB() {
      const k = Math.random(), kind = k < 0.08 ? 'gold' : k < 0.2 ? 'bomb' : 'n', r = kind === 'gold' ? 34 : rand(38, 62);
      bl.push({ x: rand(100, W - 100), y: H + 100, r, vy: rand(90, 190) * (kind === 'gold' ? 1.5 : 1), sw: rand(0, 6), kind, col: kind === 'bomb' ? '#2b2b3a' : kind === 'gold' ? '#ffd400' : PAL[Math.floor(rand(0, PAL.length))] });
    }
    function finish() {
      const rank = cur.slice().sort((a, b) => b.score - a.score), tie = rank.length > 1 && rank[0].score === rank[1].score;
      env.end({ title: n === 1 ? `SCORE ${rank[0].score}` : tie ? 'DRAW!' : `${rank[0].name} WINS!`, color: tie ? '#ffd400' : rank[0].color, sub: 'Sabse zyada gubbare', lines: rank.map(m => ({ name: m.name, color: m.color, text: String(m.score) })) });
    }
    return {
      update(dt, pl) {
        t += dt; if (over) { endT -= dt; if (endT <= 0) finish(); } else { left -= dt; if (left <= 0) { left = 0; over = true; endT = 1.2; sfx.go(); } }
        spawn -= dt; if (spawn <= 0 && !over) { spawnB(); spawn = Math.max(0.16, 0.5 - t * 0.004) / Math.max(1, Math.sqrt(n) * 0.8); }
        for (const b of bl) { b.y -= b.vy * dt; b.sw += dt * 2; b.x += Math.sin(b.sw) * 22 * dt; }
        for (let i = bl.length - 1; i >= 0; i--) if (bl[i].y < -140) bl.splice(i, 1);
        for (const c of clouds) { c.x += c.v * dt; if (c.x > W + 200) c.x = -200; }
        for (const m of cur) {
          const p = pl[m.i]; m.cd -= dt; m.flash -= dt;
          m.x = clamp(m.x + p.stick.x * 950 * dt, 20, W - 20); m.y = clamp(m.y + p.stick.y * 950 * dt, 20, H - 20);
          if (p.hit.a && m.cd <= 0 && !over) {
            m.cd = 0.18; m.flash = 0.15; let hit = null, best = 1e9;
            for (const b of bl) { const d = Math.hypot(b.x - m.x, b.y - m.y * 1); if (d < b.r * 1.1 && d < best) { best = d; hit = b; } }
            fx.ring(m.x, m.y, m.color, 60, 0.25);
            if (hit) {
              bl.splice(bl.indexOf(hit), 1);
              const pts = hit.kind === 'gold' ? 5 : hit.kind === 'bomb' ? -3 : 1; m.score = Math.max(0, m.score + pts);
              fx.burst(hit.x, hit.y, hit.col, 26, 460, 0.8, 7); fx.burst(hit.x, hit.y, '#fff', 8, 300, 0.4, 4);
              if (hit.kind === 'bomb') { sfx.boom(); fx.shake(14); vib(m.p, 200); } else { sfx.pop(); if (hit.kind === 'gold') { sfx.coin(); fx.ring(hit.x, hit.y, '#ffd400', 200, 0.6); } vib(m.p, 25); }
            }
          }
        }
      },
      draw(c) {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1f7a'); g.addColorStop(0.55, '#8a3fb5'); g.addColorStop(1, '#ff8ab5'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        const sun = c.createRadialGradient(W * 0.8, H * 0.78, 20, W * 0.8, H * 0.78, 420); sun.addColorStop(0, 'rgba(255,230,150,0.9)'); sun.addColorStop(1, 'rgba(255,150,100,0)'); c.fillStyle = sun; c.fillRect(0, 0, W, H);
        for (const cl of clouds) { c.fillStyle = 'rgba(255,255,255,0.16)'; for (const [dx, dy, r] of [[0, 0, 60], [55, -20, 70], [120, 0, 55], [60, 15, 60]]) { c.beginPath(); c.arc(cl.x + dx * cl.s, cl.y + dy * cl.s, r * cl.s, 0, TAU); c.fill(); } }
        for (const b of bl) balloon(c, b.x, b.y, b.r, b.col, t + b.sw, b.kind);
        for (const m of cur) {
          c.save(); c.shadowColor = m.color; c.shadowBlur = 18; c.strokeStyle = m.color; c.lineWidth = m.flash > 0 ? 8 : 5; const r = m.flash > 0 ? 34 : 28;
          c.beginPath(); c.arc(m.x, m.y, r, 0, TAU); c.moveTo(m.x - 44, m.y); c.lineTo(m.x - 14, m.y); c.moveTo(m.x + 14, m.y); c.lineTo(m.x + 44, m.y); c.moveTo(m.x, m.y - 44); c.lineTo(m.x, m.y - 14); c.moveTo(m.x, m.y + 14); c.lineTo(m.x, m.y + 44); c.stroke();
          c.fillStyle = '#fff'; c.beginPath(); c.arc(m.x, m.y, 4, 0, TAU); c.fill(); c.restore();
          text(c, m.name, m.x, m.y - 58, 20, '#fff', 'center', 800);
        }
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, W, 78);
        cur.forEach((m, i) => { c.fillStyle = m.color; c.beginPath(); c.arc(50 + i * 210, 38, 11, 0, TAU); c.fill(); text(c, `${m.name}  ${m.score}`, 70 + i * 210, 39, 26, '#fff', 'left', 800, 130); });
        text(c, `${Math.ceil(left)}s`, W - 60, 40, 44, left < 10 ? '#ff6b6b' : '#fff', 'right', 900);
      }
    };
  }
});
})();
