// RANG RASIA - Holi paint war. Run around painting the floor in your colour; RANG BOMB splashes a big area.
(() => {
const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;
const CELL = 40, GX = 48, GY = 25, OX = 0, OY = 80, TIME = 60;

AX.register({
  id: 'paint', name: 'RANG RASIA', tag: 'Holi paint war: zameen|apne rang se bharo', color: '#ff6ec7', min: 2, max: 8, order: 30,
  layout: { stick: true, buttons: [{ id: 'a', label: 'RANG BOMB', color: '#ff6ec7' }], hint: 'Stick = daudo & rang lagao · BOMB = bada dhamaka' },
  art(c, w, h, t) {
    c.fillStyle = '#120a2e'; c.fillRect(0, 0, w, h);
    const cols = ['#ff3d71', '#22d3ee', '#ffd400', '#7cff4d', '#c264ff'];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) { const k = (Math.sin(x * 1.3 + y * 0.9 + t) + Math.cos(x * 0.7 - y * 1.1)) * 0.5; if (k > -0.2) { c.fillStyle = cols[(x * 3 + y * 5 + Math.floor(t)) % 5]; c.globalAlpha = 0.9; rr(c, x * 34 + 4, y * 34 + 4, 28, 28, 8); c.fill(); } }
    c.globalAlpha = 1;
    c.save(); c.shadowColor = '#fff'; c.shadowBlur = 18; c.fillStyle = '#fff'; c.beginPath(); c.arc(150 + Math.sin(t * 2) * 60, 120 + Math.cos(t * 2) * 30, 18, 0, TAU); c.fill(); c.restore();
  },
  create(env) {
    const ps = env.players, n = ps.length;
    const grid = new Int8Array(GX * GY).fill(-1);
    const SP = [[3, 3], [44, 21], [44, 3], [3, 21], [24, 2], [24, 22], [2, 12], [45, 12]];
    const pl = ps.map((p, i) => ({ p, i, x: (SP[i % 8][0] + 0.5) * CELL, y: OY + (SP[i % 8][1] + 0.5) * CELL, vx: 0, vy: 0, cd: 0, bomb: 0, color: p.color, name: p.name, cells: 0, ang: 0 }));
    let left = TIME, t = 0, over = false, endT = 0;
    const splashes = [];

    function paint(cx, cy, i) { if (cx < 0 || cy < 0 || cx >= GX || cy >= GY) return; const k = cy * GX + cx; if (grid[k] !== i) { grid[k] = i; splashes.push({ x: cx, y: cy, i, t: 0 }); } }
    function count() { pl.forEach(m => m.cells = 0); for (let k = 0; k < grid.length; k++) if (grid[k] >= 0) pl[grid[k]].cells++; }
    function finish() {
      count(); const rank = pl.slice().sort((a, b) => b.cells - a.cells), tot = GX * GY;
      const tie = rank.length > 1 && rank[0].cells === rank[1].cells;
      env.end({ title: tie ? 'DRAW!' : `${rank[0].name} WINS!`, color: tie ? '#ffd400' : rank[0].color, sub: 'Sabse zyada zameen par rang', lines: rank.map(m => ({ name: m.name, color: m.color, text: `${Math.round(m.cells / tot * 100)}%` })) });
    }
    return {
      update(dt, pl2) {
        t += dt;
        if (over) { endT -= dt; if (endT <= 0) finish(); }
        else { left -= dt; if (left <= 0) { left = 0; over = true; endT = 1.2; sfx.go(); } }
        for (const m of pl) {
          const p = pl2[m.i]; m.cd -= dt; m.bomb -= dt;
          const s = Math.min(1, Math.hypot(p.stick.x, p.stick.y));
          if (s > 0.1 && !over) { m.vx += p.stick.x * 2600 * dt; m.vy += p.stick.y * 2600 * dt; m.ang = Math.atan2(p.stick.y, p.stick.x); }
          const f = Math.exp(-5.5 * dt); m.vx *= f; m.vy *= f;
          m.x = clamp(m.x + m.vx * dt, 24, W - 24); m.y = clamp(m.y + m.vy * dt, OY + 24, OY + GY * CELL - 24);
          const cx = Math.floor(m.x / CELL), cy = Math.floor((m.y - OY) / CELL);
          for (let dx = -0; dx <= 0; dx++) paint(cx, cy, m.i);
          if (Math.hypot(m.vx, m.vy) > 200 && Math.random() < 0.4) fx.burst(m.x, m.y, m.color, 1, 80, 0.35, 5);
          if (p.hit.a && m.cd <= 0 && !over) {
            m.cd = 4; sfx.boom(); fx.shake(10); vib(m.p, 80);
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) paint(cx + dx, cy + dy, m.i);
            fx.burst(m.x, m.y, m.color, 70, 650, 0.9, 8); fx.burst(m.x, m.y, '#fff', 14, 420, 0.5, 4); fx.ring(m.x, m.y, m.color, 220, 0.6);
          }
        }
        for (let i = splashes.length - 1; i >= 0; i--) { splashes[i].t += dt; if (splashes[i].t > 0.35) splashes.splice(i, 1); }
      },
      draw(c) {
        c.fillStyle = '#0d0724'; c.fillRect(0, 0, W, H);
        const bg = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1200); bg.addColorStop(0, '#1d1050'); bg.addColorStop(1, '#07031a'); c.fillStyle = bg; c.fillRect(0, OY, W, GY * CELL);
        for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
          const v = grid[y * GX + x]; const px = x * CELL, py = OY + y * CELL;
          if (v < 0) { c.fillStyle = 'rgba(255,255,255,0.035)'; rr(c, px + 3, py + 3, CELL - 6, CELL - 6, 8); c.fill(); }
          else { c.fillStyle = pl[v].color; c.globalAlpha = 0.9; rr(c, px + 2, py + 2, CELL - 4, CELL - 4, 10); c.fill(); c.fillStyle = 'rgba(255,255,255,0.22)'; rr(c, px + 6, py + 6, CELL - 18, 8, 4); c.fill(); c.globalAlpha = 1; }
        }
        for (const s of splashes) { const k = 1 - s.t / 0.35; c.globalAlpha = k * 0.8; c.fillStyle = '#fff'; c.beginPath(); c.arc(s.x * CELL + CELL / 2, OY + s.y * CELL + CELL / 2, CELL * (1.1 - k * 0.5), 0, TAU); c.fill(); } c.globalAlpha = 1;
        for (const m of pl) {
          c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(m.x + 4, m.y + 18, 24, 12, 0, 0, TAU); c.fill();
          c.save(); c.shadowColor = m.color; c.shadowBlur = 22; const g = c.createRadialGradient(m.x - 8, m.y - 10, 3, m.x, m.y, 26); g.addColorStop(0, '#fff'); g.addColorStop(0.3, m.color); g.addColorStop(1, '#14102e');
          c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, 26, 0, TAU); c.fill(); c.shadowBlur = 0; c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); c.restore();
          for (const s of [-1, 1]) { const ex = m.x + Math.cos(m.ang) * 6 + s * 9, ey = m.y - 4 + Math.sin(m.ang) * 4; c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 7, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(ex + Math.cos(m.ang) * 3, ey + Math.sin(m.ang) * 3, 3.4, 0, TAU); c.fill(); }
          text(c, m.name, m.x, m.y - 44, 20, '#fff', 'center', 700);
          if (m.cd > 0) { c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 4; c.beginPath(); c.arc(m.x, m.y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - m.cd / 4)); c.stroke(); }
        }
        // scoreboard bar
        count(); const tot = GX * GY; c.fillStyle = '#0a0620'; c.fillRect(0, 0, W, OY);
        let x = 40; const bw = W - 80; pl.forEach(m => { const w = bw * m.cells / tot; c.fillStyle = m.color; c.fillRect(x, 50, w, 16); x += w; });
        c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.strokeRect(40, 50, bw, 16);
        pl.forEach((m, i) => { c.fillStyle = m.color; c.beginPath(); c.arc(60 + i * 200, 24, 9, 0, TAU); c.fill(); text(c, `${m.name} ${Math.round(m.cells / tot * 100)}%`, 78 + i * 200, 25, 20, '#fff', 'left', 700, 120); });
        text(c, `${Math.ceil(left)}s`, W - 70, 26, 36, left < 10 ? '#ff6b6b' : '#fff', 'right', 900);
      }
    };
  }
});
})();
