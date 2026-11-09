// ROCKET UDAN - everyone flies the same asteroid course. Tap BOOST to rise, gravity pulls you down.
// Squeeze through the gaps; last rocket flying wins (ghosts can overlap).
(() => {
const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;
const RX = 520, GAP = 300, SPACING = 560, SPEED0 = 330;

function rocket(c, x, y, ang, col, flame, s = 1) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  if (flame > 0) { c.save(); c.globalCompositeOperation = 'lighter'; const L = 30 + flame * 36 + Math.random() * 12; const g = c.createLinearGradient(-22, 0, -22 - L, 0); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ffb020'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(-22, -9); c.lineTo(-22 - L, 0); c.lineTo(-22, 9); c.fill(); c.restore(); }
  c.shadowColor = col; c.shadowBlur = 20;
  c.fillStyle = col; c.beginPath(); c.moveTo(-18, -22); c.lineTo(-34, -34); c.lineTo(-30, -6); c.closePath(); c.fill(); c.beginPath(); c.moveTo(-18, 22); c.lineTo(-34, 34); c.lineTo(-30, 6); c.closePath(); c.fill();
  const g2 = c.createLinearGradient(0, -18, 0, 18); g2.addColorStop(0, '#fff'); g2.addColorStop(0.5, '#cfd8f5'); g2.addColorStop(1, '#8a97c8');
  c.fillStyle = g2; c.beginPath(); c.moveTo(40, 0); c.quadraticCurveTo(22, -20, -22, -17); c.lineTo(-22, 17); c.quadraticCurveTo(22, 20, 40, 0); c.fill(); c.shadowBlur = 0;
  c.fillStyle = col; c.beginPath(); c.moveTo(40, 0); c.quadraticCurveTo(30, -10, 22, -14); c.lineTo(22, 14); c.quadraticCurveTo(30, 10, 40, 0); c.fill();
  c.fillStyle = '#0b1e4a'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.fillStyle = '#7fd7ff'; c.beginPath(); c.arc(-1, -1, 5.5, 0, TAU); c.fill();
  c.restore();
}

AX.register({
  id: 'rocket', name: 'ROCKET UDAN', tag: 'BOOST dabao, patthron ke|beech se nikal jao', color: '#ff8a00', min: 1, max: 8, order: 33,
  layout: { stick: false, buttons: [{ id: 'a', label: '🚀 BOOST', color: '#ff8a00' }], hint: 'Tap BOOST = upar uthao' },
  art(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0a0430'); g.addColorStop(1, '#3a0f5c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { c.globalAlpha = 0.5; c.fillRect((i * 83 - t * 60) % w + (i * 83 - t * 60 < 0 ? w : 0), (i * 47) % h, 2, 2); } c.globalAlpha = 1;
    const k = (t * 70) % (w + 80);
    c.fillStyle = '#3b3270'; c.strokeStyle = '#8f7bff'; c.lineWidth = 3; rr(c, w - k, -10, 56, 100, 10); c.fill(); c.stroke(); rr(c, w - k, 190, 56, 120, 10); c.fill(); c.stroke();
    rocket(c, 90, 140 + Math.sin(t * 3) * 25, Math.sin(t * 3) * 0.2, '#ff8a00', 1, 1.1);
  },
  create(env) {
    const ps = env.players, n = ps.length;
    const R = ps.map((p, i) => ({ p, i, x: RX - 30 + (i - (n - 1) / 2) * 18, y: H / 2 + (i - (n - 1) / 2) * 24, vy: 0, alive: true, color: p.color, name: p.name, pass: 0, die: -1, flame: 0 }));
    const obs = []; const stars = Array.from({ length: 120 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(0.2, 1) }));
    let t = 0, dist = 0, nextX = W + 300, over = false, endT = 0, order = [], started = false;
    function addObs() { const gy = rand(GAP / 2 + 90, H - GAP / 2 - 90); obs.push({ x: nextX, gy, passed: false, w: 110, shape: rand(0, 99) }); nextX += SPACING * rand(0.9, 1.15); }
    for (let i = 0; i < 4; i++) addObs();
    function die(r) { r.alive = false; r.die = t; order.push(r); fx.burst(r.x, r.y, r.color, 50, 480, 1, 6); fx.burst(r.x, r.y, '#fff', 14, 360, 0.5, 4); fx.ring(r.x, r.y, r.color, 180, 0.6); fx.shake(14); sfx.boom(); vib(r.p, 250); }
    function finish() {
      const alive = R.filter(r => r.alive), rank = [...alive.sort((a, b) => b.pass - a.pass), ...order.slice().reverse()];
      env.end({ title: n === 1 ? `${rank[0].pass} GATE PAAR!` : `${rank[0].name} WINS!`, color: rank[0].color, sub: 'Aakhri udta rocket', lines: rank.map(r => ({ name: r.name, color: r.color, text: `${r.pass} gates` })) });
    }
    return {
      update(dt, pl) {
        t += dt;
        if (over) { endT -= dt; if (endT <= 0) finish(); }
        const sp = SPEED0 + Math.min(260, t * 5); dist += sp * dt;
        for (const o of obs) o.x -= sp * dt;
        while (obs.length && obs[0].x < -200) obs.shift();
        nextX -= sp * dt; while (nextX < W + 300) addObs();
        for (const r of R) {
          if (!r.alive) { r.y += 380 * dt; r.x -= sp * dt * 0.5; continue; }
          const p = pl[r.i]; r.flame = Math.max(0, r.flame - dt * 4);
          if (!started && p.hit.a) started = true;
          if (p.hit.a) { r.vy = -520; r.flame = 1; sfx.dash(); fx.burst(r.x - 30, r.y, '#ffa030', 6, 220, 0.4, 5); }
          if (started) r.vy += 1500 * dt; r.vy = clamp(r.vy, -620, 760); r.y += r.vy * dt;
          if (r.y < 24 || r.y > H - 24) { die(r); continue; }
          for (const o of obs) {
            if (!o.passed && o.x + o.w / 2 < r.x) { o.passed = true; }
            if (Math.abs(r.x - o.x) < o.w / 2 + 28 && (r.y < o.gy - GAP / 2 + 12 || r.y > o.gy + GAP / 2 - 12)) { die(r); break; }
          }
          if (r.alive) { for (const o of obs) if (o.x + o.w / 2 < r.x && !o['p' + r.i]) { o['p' + r.i] = 1; r.pass++; if (n > 1 || r.pass % 1 === 0) sfx.coin(); } }
          if (Math.random() < 0.5) fx.burst(r.x - 32, r.y, '#ffb347', 1, 80, 0.4, 5);
        }
        const alive = R.filter(r => r.alive).length;
        if (!over && ((n > 1 && alive <= 1) || alive === 0)) { over = true; endT = 1.4; }
      },
      draw(c) {
        const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#080224'); g.addColorStop(0.6, '#1c0a46'); g.addColorStop(1, '#3a0f5c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        for (const [x, y, r, col] of [[1500, 260, 600, 'rgba(255,61,150,0.12)'], [500, 850, 700, 'rgba(34,211,238,0.09)']]) { const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H); }
        for (const s of stars) { c.globalAlpha = 0.3 + 0.6 * s.z; c.fillStyle = '#fff'; c.fillRect(((s.x - dist * s.z * 0.25) % W + W) % W, s.y, 2 * s.z + 0.5, 2 * s.z + 0.5); } c.globalAlpha = 1;
        const px = ((1450 - dist * 0.05) % (W + 600) + W + 600) % (W + 600) - 300; c.save(); const pg = c.createRadialGradient(px - 30, 330, 10, px, 360, 150); pg.addColorStop(0, '#ffb86b'); pg.addColorStop(1, '#5a1a6b'); c.fillStyle = pg; c.beginPath(); c.arc(px, 360, 140, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,220,160,0.5)'; c.lineWidth = 8; c.beginPath(); c.ellipse(px, 360, 230, 40, -0.3, 0, TAU); c.stroke(); c.restore();
        for (const o of obs) {
          for (const [y0, y1] of [[-20, o.gy - GAP / 2], [o.gy + GAP / 2, H + 20]]) {
            const hgt = y1 - y0, x = o.x - o.w / 2; c.save(); c.shadowColor = '#7a5cff'; c.shadowBlur = 24;
            const rg = c.createLinearGradient(x, 0, x + o.w, 0); rg.addColorStop(0, '#2a2060'); rg.addColorStop(0.5, '#4a3a9a'); rg.addColorStop(1, '#2a2060'); c.fillStyle = rg; rr(c, x, y0, o.w, hgt, 22); c.fill(); c.strokeStyle = '#a99bff'; c.lineWidth = 4; c.stroke(); c.shadowBlur = 0;
            c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + 25 + ((k * 37 + o.shape) % 60), y0 + 40 + ((k * 91 + o.shape * 3) % Math.max(60, hgt - 80)), 8 + (k % 3) * 4, 0, TAU); c.fill(); }
            c.restore();
          }
          c.strokeStyle = 'rgba(124,255,77,0.35)'; c.setLineDash([10, 10]); c.lineWidth = 2; c.beginPath(); c.moveTo(o.x, o.gy - GAP / 2); c.lineTo(o.x, o.gy + GAP / 2); c.stroke(); c.setLineDash([]);
        }
        for (const r of R) {
          if (!r.alive) { c.globalAlpha = 0.25; rocket(c, r.x, r.y, 1.2, r.color, 0); c.globalAlpha = 1; continue; }
          rocket(c, r.x, r.y, clamp(r.vy / 900, -0.5, 0.6), r.color, r.flame); text(c, r.name, r.x, r.y - 52, 20, '#fff', 'center', 700);
        }
        R.forEach((r, i) => { c.fillStyle = r.alive ? r.color : '#444'; c.beginPath(); c.arc(50 + i * 220, 40, 10, 0, TAU); c.fill(); text(c, `${r.name}  ${r.pass}`, 70 + i * 220, 41, 24, r.alive ? '#fff' : '#667', 'left', 800, 140); });
        if (!started) text(c, 'BOOST dabao aur udo!', W / 2, 200, 60, '#fff', 'center', 900);
      }
    };
  }
});
})();
