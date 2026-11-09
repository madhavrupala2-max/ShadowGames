// LAVA PEHELWAN (sumo) - shove rivals off a shrinking lava platform.
(() => {
const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;
const CX = 960, CY = 540, R0 = 470, RMIN = 240, BR = 42, DASH_CD = 1.3;

function drawBall(c, x, y, color, dx, dy, s = 1, glow = 22) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.shadowColor = color; c.shadowBlur = glow;
  const g = c.createRadialGradient(-12, -14, 4, 0, 0, BR);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, color); g.addColorStop(1, '#14102e');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, BR, 0, TAU); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.stroke();
  for (const sx of [-1, 1]) {
    const ex = dx * 8 + sx * 13 - dy * 0, ey = dy * 8 - 6 + sx * 0;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 10, 0, TAU); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(ex + dx * 4, ey + dy * 4, 5, 0, TAU); c.fill();
  }
  c.restore();
}

AX.register({
  id: 'sumo', name: 'SUMO SMASH', tag: 'Dash & shove rivals|off the crumbling arena', color: '#ff8a00', min: 2, max: 8, order: 21,
  layout: { stick: true, buttons: [{ id: 'a', label: 'DASH', color: '#ff8a00' }], hint: 'Stick = ludhko · DASH = takkar!' },
  art(c, w, h, t) {
    const g = c.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 230); g.addColorStop(0, '#3a1030'); g.addColorStop(1, '#1a0508');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save(); c.shadowColor = '#ff5a1e'; c.shadowBlur = 30; c.fillStyle = '#2a2250'; c.strokeStyle = '#ff8a00'; c.lineWidth = 4;
    c.beginPath(); c.arc(w / 2, h / 2 + 20, 110, 0, TAU); c.fill(); c.stroke(); c.restore();
    const o = Math.sin(t * 3) * 14;
    c.save(); c.translate(w / 2, h / 2 + 20);
    c.scale(0.7, 0.7); drawBall(c, -70 + o, 0, '#ff3d71', 1, 0, 1, 18); drawBall(c, 70 - o, 10, '#22d3ee', -1, 0, 1, 18); c.restore();
  },
  create(env) {
    const ps = env.players, n = ps.length;
    let t = 0, over = false, endT = 0, arenaR = R0;
    const order = [];
    const balls = ps.map((p, i) => {
      const a = TAU * i / n - Math.PI / 2, d = R0 * 0.55;
      return { p, i, x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, vx: 0, vy: 0, dx: -Math.cos(a), dy: -Math.sin(a), cd: 0, dashT: 0, falling: false, fallT: 0, alive: true, color: p.color, name: p.name };
    });
    const embers = Array.from({ length: 40 }, () => ({ a: rand(0, TAU), r: rand(0.9, 1.5), s: rand(0.05, 0.2), z: rand(2, 6) }));

    function finish() {
      const alive = balls.filter(b => !b.falling), win = alive.length === 1 ? alive[0] : null;
      const rank = [...alive, ...order.slice().reverse()];
      const lines = rank.map((b, i) => ({ name: b.name, color: b.color, text: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][i] }));
      env.end({ title: win ? `${win.name} WINS!` : 'DRAW', color: win ? win.color : '#ffd400', sub: 'Aakhri pehelwan', lines });
    }

    return {
      update(dt, pl) {
        t += dt; arenaR = Math.max(RMIN, R0 - Math.max(0, t - 8) * 13);
        if (over) { endT -= dt; if (endT <= 0) finish(); }
        for (const b of balls) {
          if (!b.alive) continue;
          if (b.falling) { b.fallT += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.fallT > 0.8) b.alive = false; continue; }
          const p = pl[b.i];
          b.cd -= dt; b.dashT -= dt;
          const m = over ? 0 : Math.min(1, Math.hypot(p.stick.x, p.stick.y));
          if (m > 0.15) { const a = Math.atan2(p.stick.y, p.stick.x); b.dx = Math.cos(a); b.dy = Math.sin(a); b.vx += b.dx * m * 1500 * dt; b.vy += b.dy * m * 1500 * dt; }
          if (p.hit.a && b.cd <= 0 && !over) { b.vx += b.dx * 950; b.vy += b.dy * 950; b.cd = DASH_CD; b.dashT = 0.28; sfx.dash(); fx.ring(b.x, b.y, b.color, 110, 0.4); }
          const f = Math.exp(-2.1 * dt); b.vx *= f; b.vy *= f; b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.dashT > 0) fx.burst(b.x, b.y, b.color, 2, 70, 0.4, 7);
        }
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const a = balls[i], b = balls[j]; if (!a.alive || !b.alive || a.falling || b.falling) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d < 2 * BR && d > 0.01) {
            const nx = dx / d, ny = dy / d, ov = 2 * BR - d;
            a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) {
              const j2 = -(1 + 1.0) * rv / 2;
              a.vx -= nx * j2; a.vy -= ny * j2; b.vx += nx * j2; b.vy += ny * j2;
              if (a.dashT > 0) { b.vx += nx * 560; b.vy += ny * 560; }
              if (b.dashT > 0) { a.vx -= nx * 560; a.vy -= ny * 560; }
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              fx.burst(mx, my, '#fff', 12, 380, 0.4, 5); fx.burst(mx, my, a.color, 6, 300, 0.4, 5); fx.burst(mx, my, b.color, 6, 300, 0.4, 5);
              fx.ring(mx, my, '#fff', 90, 0.3); fx.shake(Math.min(16, 5 + Math.abs(rv) * 0.02)); sfx.hit(); vib(a.p, 40); vib(b.p, 40);
            }
          }
        }
        for (const b of balls) {
          if (!b.alive || b.falling || over) continue;
          if (Math.hypot(b.x - CX, b.y - CY) > arenaR + BR * 0.4) {
            b.falling = true; b.fallT = 0; order.push(b); fx.burst(b.x, b.y, '#ff7a1e', 30, 300, 0.8, 7); fx.shake(10); sfx.boom(); vib(b.p, 250);
          }
        }
        if (!over && n >= 2 && balls.filter(b => !b.falling).length <= 1) { over = true; endT = 1.5; }
      },
      draw(c) {
        c.fillStyle = '#080309'; c.fillRect(0, 0, W, H);
        const lg = c.createRadialGradient(CX, CY, arenaR * 0.9, CX, CY, arenaR + 520);
        lg.addColorStop(0, 'rgba(255,100,20,0.75)'); lg.addColorStop(0.3, 'rgba(255,40,60,0.32)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = lg; c.fillRect(0, 0, W, H);
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const e of embers) { const a = e.a + t * e.s, r = (arenaR + 40) * e.r + Math.sin(t * 2 + e.a * 5) * 20; c.fillStyle = 'rgba(255,150,40,0.55)'; c.beginPath(); c.arc(CX + Math.cos(a) * r, CY + Math.sin(a) * r * 0.98, e.z, 0, TAU); c.fill(); }
        c.restore();
        const shrinking = arenaR < R0 - 1;
        c.save(); c.shadowColor = shrinking ? '#ff3030' : '#8f7bff'; c.shadowBlur = 40;
        const pg = c.createRadialGradient(CX, CY - 60, 40, CX, CY, arenaR); pg.addColorStop(0, '#352c68'); pg.addColorStop(1, '#171236');
        c.fillStyle = pg; c.beginPath(); c.arc(CX, CY, arenaR, 0, TAU); c.fill();
        c.lineWidth = 10; c.strokeStyle = shrinking ? '#ff5a4a' : '#9d8bff'; c.stroke(); c.restore();
        c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 3;
        for (let r = arenaR - 80; r > 40; r -= 90) { c.beginPath(); c.arc(CX, CY, r, 0, TAU); c.stroke(); }
        c.save(); c.translate(CX, CY); c.rotate(t * 0.15); c.strokeStyle = 'rgba(255,255,255,0.08)';
        for (let k = 0; k < 12; k++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(arenaR - 40, 0); c.lineTo(arenaR - 8, 0); c.stroke(); } c.restore();
        const list = balls.filter(b => b.alive).sort((a, b) => a.y - b.y);
        for (const b of list) {
          if (b.falling) { const k = 1 - b.fallT / 0.8; c.save(); c.globalAlpha = Math.max(0, k); drawBall(c, b.x, b.y, b.color, b.dx, b.dy, Math.max(0.05, k), 10); c.restore(); continue; }
          c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(b.x + 6, b.y + 14, BR * 0.95, BR * 0.6, 0, 0, TAU); c.fill();
          drawBall(c, b.x, b.y, b.color, b.dx, b.dy, 1 + (b.dashT > 0 ? 0.12 : 0));
          text(c, b.name, b.x, b.y - BR - 18, 22, '#fff', 'center', 700);
          if (b.cd > 0) { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 4; c.beginPath(); c.arc(b.x, b.y, BR + 8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - b.cd / DASH_CD)); c.stroke(); }
        }
        balls.forEach((b, i) => { c.fillStyle = b.falling || !b.alive ? '#555' : b.color; c.beginPath(); c.arc(70 + i * 220, 44, 12, 0, TAU); c.fill(); text(c, b.name, 92 + i * 220, 45, 24, b.falling || !b.alive ? '#667' : '#fff', 'left', 700); });
        if (shrinking && !over) { c.globalAlpha = 0.55 + Math.sin(t * 6) * 0.35; text(c, 'ARENA SIKUD RAHA HAI!', W / 2, 1030, 30, '#ff8a6a', 'center', 900); c.globalAlpha = 1; }
      }
    };
  }
});
})();
