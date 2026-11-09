// PHAL BAUCHHAR - each player has their own jungle lane and basket. Catch fruit, dodge bombs, grab stars!
(() => {
const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;
const TIME = 60;
const FR = [['🍎', 1], ['🍌', 1], ['🍇', 2], ['🍉', 2], ['🍊', 1], ['🍓', 2], ['🍍', 3]];

AX.register({
  id: 'fruits', name: 'PHAL BAUCHHAR', tag: 'Tokri se phal pakdo|💣 se bacho, ⭐ = +5', color: '#7cff4d', min: 1, max: 8, order: 32,
  layout: { stick: true, buttons: [], hint: 'Stick ◀ ▶ = tokri hilao' },
  art(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b3d2e'); g.addColorStop(1, '#14532d'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) text(c, FR[i][0], 40 + i * 58, ((t * 70 + i * 53) % 180) + 10, 40);
    text(c, '💣', 250, ((t * 90) % 170) + 10, 36);
    c.fillStyle = '#b45309'; rr(c, 120 + Math.sin(t * 2) * 60, 200, 90, 40, 10); c.fill(); c.fillStyle = '#fbbf24'; c.fillRect(120 + Math.sin(t * 2) * 60, 200, 90, 8);
  },
  create(env) {
    const ps = env.players, n = ps.length, LW = W / n;
    const L = ps.map((p, i) => ({ p, i, x0: i * LW, bx: i * LW + LW / 2, vx: 0, score: 0, stun: 0, items: [], spawn: rand(0, 0.5), color: p.color, name: p.name, pop: [] }));
    let left = TIME, t = 0, over = false, endT = 0;
    const BY = H - 130, BW = Math.min(150, LW * 0.6);
    function finish() {
      const rank = L.slice().sort((a, b) => b.score - a.score), tie = rank.length > 1 && rank[0].score === rank[1].score;
      env.end({ title: n === 1 ? `SCORE ${rank[0].score}` : tie ? 'DRAW!' : `${rank[0].name} WINS!`, color: tie ? '#ffd400' : rank[0].color, sub: 'Sabse zyada phal', lines: rank.map(m => ({ name: m.name, color: m.color, text: String(m.score) })) });
    }
    return {
      update(dt, pl) {
        t += dt; if (over) { endT -= dt; if (endT <= 0) finish(); } else { left -= dt; if (left <= 0) { left = 0; over = true; endT = 1.2; sfx.go(); } }
        const rate = Math.max(0.28, 0.85 - t * 0.01);
        for (const m of L) {
          const p = pl[m.i]; m.stun -= dt;
          if (m.stun <= 0) m.vx += p.stick.x * 5200 * dt; m.vx *= Math.exp(-7 * dt);
          m.bx = clamp(m.bx + m.vx * dt, m.x0 + BW / 2 + 6, m.x0 + LW - BW / 2 - 6);
          m.spawn -= dt;
          if (m.spawn <= 0 && !over) {
            m.spawn = rate * rand(0.7, 1.3); const k = Math.random();
            const it = k < 0.16 ? { e: '💣', v: -3, bomb: 1 } : k < 0.22 ? { e: '⭐', v: 5 } : { e: FR[Math.floor(rand(0, FR.length))][0], v: FR[Math.floor(rand(0, FR.length))][1] };
            if (!it.bomb && it.e !== '⭐') it.v = (FR.find(f => f[0] === it.e) || [0, 1])[1];
            m.items.push(Object.assign(it, { x: m.x0 + rand(50, LW - 50), y: -50, vy: rand(280, 420) + t * 3, rot: rand(0, 6), vr: rand(-3, 3) }));
          }
          for (let i = m.items.length - 1; i >= 0; i--) {
            const it = m.items[i]; it.y += it.vy * dt; it.rot += it.vr * dt;
            if (it.y > BY - 30 && it.y < BY + 40 && Math.abs(it.x - m.bx) < BW / 2 + 10) {
              m.items.splice(i, 1);
              if (it.bomb) { m.score = Math.max(0, m.score + it.v); m.stun = 0.9; fx.burst(m.bx, BY, '#ff8a00', 40, 520, 0.8, 7); fx.shake(10); sfx.boom(); vib(m.p, 200); }
              else { m.score += it.v; fx.burst(it.x, BY, m.color, 10, 260, 0.5, 5); sfx.coin(); if (it.e === '⭐') fx.ring(it.x, BY, '#ffd400', 160, 0.5); }
              m.pop.push({ t: 0, v: it.v, x: m.bx }); continue;
            }
            if (it.y > H + 60) m.items.splice(i, 1);
          }
          for (let i = m.pop.length - 1; i >= 0; i--) { m.pop[i].t += dt; if (m.pop[i].t > 0.8) m.pop.splice(i, 1); }
        }
      },
      draw(c) {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#062a24'); g.addColorStop(0.6, '#0f4c34'); g.addColorStop(1, '#1b6b3a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 14; i++) { const x = (i * 157) % W; c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(x - 90, H); c.quadraticCurveTo(x, 200 + (i % 3) * 80, x + 90, H); c.fill(); }
        c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const x = (i * 480 + t * 15) % (W + 300) - 150; const rg = c.createLinearGradient(x, 0, x + 200, H); rg.addColorStop(0, 'rgba(255,240,160,0.13)'); rg.addColorStop(1, 'rgba(255,240,160,0)'); c.fillStyle = rg; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 90, 0); c.lineTo(x + 330, H); c.lineTo(x + 140, H); c.fill(); } c.restore();
        for (const m of L) {
          if (m.i > 0) { c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 2; c.setLineDash([12, 12]); c.beginPath(); c.moveTo(m.x0, 90); c.lineTo(m.x0, H); c.stroke(); c.setLineDash([]); }
          for (const it of m.items) { c.save(); c.translate(it.x, it.y); c.rotate(Math.sin(it.rot) * 0.4); if (it.bomb) { c.shadowColor = '#ff3030'; c.shadowBlur = 20; } if (it.e === '⭐') { c.shadowColor = '#ffd400'; c.shadowBlur = 24; } text(c, it.e, 0, 0, 62); c.restore(); }
          const bx = m.bx, st = m.stun > 0;
          c.save(); c.translate(bx, BY); if (st) c.translate(Math.sin(t * 60) * 4, 0); c.globalAlpha = st ? 0.55 : 1;
          c.shadowColor = m.color; c.shadowBlur = 22; const bg = c.createLinearGradient(0, -20, 0, 60); bg.addColorStop(0, '#d97706'); bg.addColorStop(1, '#78350f');
          c.fillStyle = bg; c.beginPath(); c.moveTo(-BW / 2, -8); c.lineTo(BW / 2, -8); c.lineTo(BW / 2 - 16, 56); c.lineTo(-BW / 2 + 16, 56); c.closePath(); c.fill(); c.shadowBlur = 0;
          c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 3; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * BW / 5, -8); c.lineTo(k * BW / 6, 56); c.stroke(); }
          c.fillStyle = m.color; rr(c, -BW / 2 - 4, -18, BW + 8, 18, 9); c.fill(); c.restore();
          if (st) text(c, '💫', bx, BY - 50, 44);
          text(c, m.name, bx, BY + 88, 24, '#fff', 'center', 800, LW - 20);
          m.pop.forEach(pp => text(c, (pp.v > 0 ? '+' : '') + pp.v, pp.x, BY - 40 - pp.t * 90, 40, pp.v > 0 ? '#7cff4d' : '#ff6b6b', 'center', 900));
          c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, m.x0 + LW / 2 - 70, 14, 140, 56, 28); c.fill(); text(c, String(m.score), m.x0 + LW / 2, 43, 38, m.color, 'center', 900);
        }
        text(c, `${Math.ceil(left)}s`, W - 70, 100, 40, left < 10 ? '#ff6b6b' : '#fff', 'right', 900);
      }
    };
  }
});
})();
