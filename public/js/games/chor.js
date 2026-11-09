// CHOR PAKAD - tag game. One player is the CHOR (siren on). Touch someone to pass it on.
// You score for every second you are NOT the chor. Lowest chor-time wins... so run!
(() => {
const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;
const AR = { x: 60, y: 110, w: 1800, h: 900 }, R = 34, TIME = 75;

AX.register({
  id: 'chor', name: 'CHOR PAKAD', tag: 'Chor-police ka khel|chor bane to daudo & chhuo', color: '#ff3d71', min: 2, max: 8, order: 34,
  layout: { stick: true, buttons: [{ id: 'a', label: 'TURBO', color: '#ffd400' }], hint: 'Stick = bhaago · TURBO = tez daud' },
  art(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#1b1445'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < w; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    const a = t * 1.6;
    for (const [i, col] of [[0, '#22d3ee'], [1, '#7cff4d'], [2, '#ffd400']]) { const x = 170 + Math.cos(a + i * 2) * 110, y = 120 + Math.sin(a * 1.3 + i * 2) * 60; c.save(); c.shadowColor = col; c.shadowBlur = 16; c.fillStyle = col; c.beginPath(); c.arc(x, y, 20, 0, TAU); c.fill(); c.restore(); }
    const x = 170 + Math.cos(a - 1.2) * 110, y = 120 + Math.sin(a * 1.3 - 1.2) * 60; c.save(); c.shadowColor = '#ff3d71'; c.shadowBlur = 30; c.fillStyle = '#ff3d71'; c.beginPath(); c.arc(x, y, 22, 0, TAU); c.fill(); c.restore();
    c.strokeStyle = Math.floor(t * 6) % 2 ? '#ff3d71' : '#22d3ee'; c.lineWidth = 4; c.beginPath(); c.arc(x, y, 34 + Math.sin(t * 10) * 4, 0, TAU); c.stroke();
  },
  create(env) {
    const ps = env.players, n = ps.length;
    const P = ps.map((p, i) => { const a = TAU * i / n; return { p, i, x: 960 + Math.cos(a) * 520, y: 560 + Math.sin(a) * 300, vx: 0, vy: 0, chorT: 0, turbo: 0, turboCd: 0, imm: 0, color: p.color, name: p.name }; });
    let chor = Math.floor(rand(0, n)), left = TIME, t = 0, over = false, endT = 0, lastTag = 0;
    P[chor].imm = 2;
    const lamps = [[300, 300], [1620, 300], [300, 820], [1620, 820], [960, 560]];
    function finish() {
      const rank = P.slice().sort((a, b) => a.chorT - b.chorT), tie = rank.length > 1 && Math.abs(rank[0].chorT - rank[1].chorT) < 0.05;
      env.end({ title: tie ? 'DRAW!' : `${rank[0].name} WINS!`, color: tie ? '#ffd400' : rank[0].color, sub: 'Sabse kam chor bana', lines: rank.map(m => ({ name: m.name, color: m.color, text: `${m.chorT.toFixed(1)}s chor` })) });
    }
    return {
      update(dt, pl) {
        t += dt; if (over) { endT -= dt; if (endT <= 0) finish(); } else { left -= dt; P[chor].chorT += dt; if (left <= 0) { left = 0; over = true; endT = 1.2; sfx.go(); } }
        for (const m of P) {
          const p = pl[m.i]; m.imm -= dt; m.turboCd -= dt; m.turbo -= dt;
          const isChor = m.i === chor, base = isChor ? 1900 : 1750;
          if (p.hit.a && m.turboCd <= 0 && !over) { m.turbo = 0.45; m.turboCd = 3; sfx.dash(); fx.ring(m.x, m.y, m.color, 90, 0.35); }
          const acc = base * (m.turbo > 0 ? 1.8 : 1);
          m.vx += p.stick.x * acc * dt; m.vy += p.stick.y * acc * dt;
          const f = Math.exp(-4 * dt); m.vx *= f; m.vy *= f;
          const mx = (isChor ? 440 : 400) * (m.turbo > 0 ? 1.7 : 1), sp = Math.hypot(m.vx, m.vy); if (sp > mx) { m.vx *= mx / sp; m.vy *= mx / sp; }
          m.x += m.vx * dt; m.y += m.vy * dt;
          if (m.x < AR.x + R) { m.x = AR.x + R; m.vx *= -0.4; } if (m.x > AR.x + AR.w - R) { m.x = AR.x + AR.w - R; m.vx *= -0.4; }
          if (m.y < AR.y + R) { m.y = AR.y + R; m.vy *= -0.4; } if (m.y > AR.y + AR.h - R) { m.y = AR.y + AR.h - R; m.vy *= -0.4; }
          if (m.turbo > 0) fx.burst(m.x, m.y, m.color, 2, 90, 0.35, 6);
        }
        const c0 = P[chor];
        if (!over && c0.imm <= 0) for (const m of P) {
          if (m === c0 || m.imm > 0) continue;
          if (Math.hypot(m.x - c0.x, m.y - c0.y) < R * 2 - 4) {
            chor = m.i; m.imm = 1.6; c0.imm = 1.6; sfx.hit(); sfx.boom(); vib(m.p, 250); vib(c0.p, 60);
            fx.burst(m.x, m.y, '#ff3d71', 40, 520, 0.8, 6); fx.ring(m.x, m.y, '#ff3d71', 240, 0.6); fx.shake(14); break;
          }
        }
      },
      draw(c) {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#070a24'); g.addColorStop(1, '#16103a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.fillStyle = '#10143a'; rr(c, AR.x, AR.y, AR.w, AR.h, 24); c.fill();
        c.strokeStyle = 'rgba(120,140,255,0.08)'; c.lineWidth = 1; c.beginPath(); for (let x = AR.x; x <= AR.x + AR.w; x += 60) { c.moveTo(x, AR.y); c.lineTo(x, AR.y + AR.h); } for (let y = AR.y; y <= AR.y + AR.h; y += 60) { c.moveTo(AR.x, y); c.lineTo(AR.x + AR.w, y); } c.stroke();
        c.save(); c.globalCompositeOperation = 'lighter'; for (const [x, y] of lamps) { const lg = c.createRadialGradient(x, y, 5, x, y, 260); lg.addColorStop(0, 'rgba(255,220,140,0.28)'); lg.addColorStop(1, 'rgba(255,220,140,0)'); c.fillStyle = lg; c.fillRect(x - 260, y - 260, 520, 520); } c.restore();
        for (const [x, y] of lamps) { c.fillStyle = '#ffdf8a'; c.shadowColor = '#ffdf8a'; c.shadowBlur = 20; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); c.shadowBlur = 0; }
        c.save(); c.shadowColor = '#7a5cff'; c.shadowBlur = 24; c.strokeStyle = '#8f7bff'; c.lineWidth = 5; rr(c, AR.x, AR.y, AR.w, AR.h, 24); c.stroke(); c.restore();
        const sorted = P.slice().sort((a, b) => a.y - b.y);
        for (const m of sorted) {
          const isChor = m.i === chor;
          c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(m.x + 4, m.y + 24, R * 0.95, R * 0.5, 0, 0, TAU); c.fill();
          if (isChor) { const flash = Math.floor(t * 8) % 2; c.save(); c.globalCompositeOperation = 'lighter'; const sg = c.createRadialGradient(m.x, m.y, 10, m.x, m.y, 150); sg.addColorStop(0, flash ? 'rgba(255,40,80,0.55)' : 'rgba(40,120,255,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.beginPath(); c.arc(m.x, m.y, 150, 0, TAU); c.fill(); c.restore(); }
          c.save(); if (m.imm > 0 && Math.floor(t * 14) % 2) c.globalAlpha = 0.45; c.shadowColor = m.color; c.shadowBlur = 22;
          const bg = c.createRadialGradient(m.x - 10, m.y - 12, 4, m.x, m.y, R); bg.addColorStop(0, '#fff'); bg.addColorStop(0.3, m.color); bg.addColorStop(1, '#14102e'); c.fillStyle = bg; c.beginPath(); c.arc(m.x, m.y, R, 0, TAU); c.fill(); c.shadowBlur = 0;
          c.lineWidth = isChor ? 6 : 3; c.strokeStyle = isChor ? '#ff3d71' : 'rgba(255,255,255,0.7)'; c.stroke();
          const dx = m.vx, dy = m.vy, l = Math.hypot(dx, dy) || 1;
          for (const s of [-1, 1]) { const ex = m.x + dx / l * 5 + s * 11, ey = m.y - 5 + dy / l * 4; c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 8, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(ex + dx / l * 3, ey + dy / l * 3, 4, 0, TAU); c.fill(); }
          c.restore();
          if (isChor) { text(c, '🚨', m.x, m.y - R - 22, 34); text(c, 'CHOR', m.x, m.y + R + 22, 22, '#ff6b8a', 'center', 900); }
          text(c, m.name, m.x, m.y - R - (isChor ? 58 : 20), 20, '#fff', 'center', 800);
          if (m.turboCd > 0) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.beginPath(); c.arc(m.x, m.y, R + 8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - m.turboCd / 3)); c.stroke(); }
        }
        c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(0, 0, W, 90);
        P.forEach((m, i) => { c.fillStyle = m.color; c.beginPath(); c.arc(50 + i * 215, 36, 10, 0, TAU); c.fill(); text(c, `${m.name}`, 70 + i * 215, 30, 22, i === chor ? '#ff8a9c' : '#fff', 'left', 800, 130); text(c, `chor ${m.chorT.toFixed(1)}s`, 70 + i * 215, 58, 19, '#9fb0d6', 'left', 700); });
        text(c, `${Math.ceil(left)}s`, W - 60, 44, 44, left < 10 ? '#ff6b6b' : '#fff', 'right', 900);
      }
    };
  }
});
})();
