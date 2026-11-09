// ULKA TOOFAN - co-op space shooter. Survive waves together.
(() => {
const { W, H, TAU, clamp, rand, angDiff, turnToward, rr, text, fx, sfx, vib } = AX;

function drawShip(c, x, y, a, color, thr, t, s = 1) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  if (thr > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const L = 16 + thr * 20 + Math.random() * 10;
    const g = c.createLinearGradient(-10, 0, -10 - L, 0); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ffb020'); g.addColorStop(1, 'rgba(255,60,0,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-10, -7); c.lineTo(-10 - L, 0); c.lineTo(-10, 7); c.fill(); c.restore();
  }
  c.shadowColor = color; c.shadowBlur = 22;
  const g2 = c.createLinearGradient(-16, 0, 24, 0); g2.addColorStop(0, '#12122a'); g2.addColorStop(1, color);
  c.fillStyle = g2; c.beginPath(); c.moveTo(26, 0); c.lineTo(-16, -17); c.lineTo(-7, 0); c.lineTo(-16, 17); c.closePath(); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#fff'; c.lineWidth = 2.2; c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(6, 0, 3.4, 0, TAU); c.fill();
  c.restore();
}

AX.register({
  id: 'asteroids', name: 'ASTEROID STORM', tag: 'Co-op: blast the rocks|together, survive the waves', color: '#c264ff', min: 1, max: 8, order: 22,
  layout: { stick: true, buttons: [{ id: 'a', label: 'FIRE', color: '#ff3d71' }, { id: 'b', label: 'SHIELD', color: '#22d3ee' }], hint: 'Stick = udo · FIRE · SHIELD' },
  art(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#07041a'); g.addColorStop(1, '#1b0b3a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { c.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t + i)); c.fillRect((i * 97) % w, (i * 53) % h, 2, 2); } c.globalAlpha = 1;
    c.save(); c.translate(w * 0.7, 80); c.rotate(t * 0.4); c.strokeStyle = '#9bb0ff'; c.lineWidth = 3; c.shadowColor = '#7a8cff'; c.shadowBlur = 14; c.beginPath();
    for (let k = 0; k < 11; k++) { const a = k / 11 * TAU, r = 42 + (k % 3) * 6; k ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.stroke(); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#ff3d71'; c.lineWidth = 4; c.shadowColor = '#ff3d71'; c.shadowBlur = 14; c.beginPath(); c.moveTo(90, 168); c.lineTo(150 + (t * 60) % 40, 130); c.stroke(); c.restore();
    drawShip(c, 70, 180, -0.5, '#22d3ee', 1, t, 1.2);
  },
  create(env) {
    const ps = env.players, n = ps.length;
    const ships = ps.map((p, i) => ({ p, i, x: W / 2 + (i - (n - 1) / 2) * 120, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, alive: true, lives: 3, inv: 2, cd: 0, shield: 0, shCd: 0, resp: 0, score: 0, thr: 0, color: p.color, name: p.name }));
    const rocks = [], bullets = [];
    let wave = 0, clearT = 0.8, banner = 0, t = 0, over = false, endT = 0;
    const stars = Array.from({ length: 150 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(0.3, 1), p: rand(0, 6) }));

    function mkRock(x, y, lv, vx, vy) {
      const r = [22, 42, 72][lv - 1], k = 10 + Math.floor(rand(0, 4)), pts = [];
      for (let i = 0; i < k; i++) pts.push(rand(0.72, 1.12) * r);
      return { x, y, lv, r, vx, vy, rot: rand(0, TAU), vr: rand(-1, 1), pts };
    }
    function spawnWave() {
      wave++; banner = 2.2;
      const cnt = Math.min(11, 3 + wave);
      for (let i = 0; i < cnt; i++) {
        let x, y, g = 0;
        do { x = rand(0, W); y = rand(0, H); } while (g++ < 30 && ships.some(s => s.alive && Math.hypot(s.x - x, s.y - y) < 320));
        const a = rand(0, TAU), sp = rand(50, 110) + wave * 8;
        rocks.push(mkRock(x, y, 3, Math.cos(a) * sp, Math.sin(a) * sp));
      }
    }
    const wrap = (o, m) => { if (o.x < -m) o.x = W + m; else if (o.x > W + m) o.x = -m; if (o.y < -m) o.y = H + m; else if (o.y > H + m) o.y = -m; };
    function killShip(s) {
      s.alive = false; s.lives--; s.resp = 1.8;
      fx.burst(s.x, s.y, s.color, 50, 480, 1, 6); fx.burst(s.x, s.y, '#fff', 16, 360, 0.5, 4); fx.ring(s.x, s.y, s.color, 200, 0.6); fx.shake(18); sfx.boom(); vib(s.p, 250);
      if (ships.every(q => !q.alive && q.lives <= 0)) { over = true; endT = 1.6; }
    }
    function split(r, idx, by) {
      const pts = [100, 50, 20][r.lv - 1]; if (by) by.score += pts;
      fx.burst(r.x, r.y, '#9bb0ff', 10 + r.lv * 8, 280 + r.lv * 40, 0.8, 5); fx.burst(r.x, r.y, '#ffffff', 4, 200, 0.4, 3); fx.ring(r.x, r.y, '#7a8cff', 60 + r.lv * 30, 0.4);
      fx.shake(r.lv * 3); sfx.hit();
      if (r.lv > 1) for (let k = 0; k < 2; k++) {
        const a = Math.atan2(r.vy, r.vx) + (k ? 1 : -1) * rand(0.5, 1.2), sp = Math.hypot(r.vx, r.vy) * 1.25 + 30;
        rocks.push(mkRock(r.x, r.y, r.lv - 1, Math.cos(a) * sp, Math.sin(a) * sp));
      }
      rocks.splice(idx, 1);
    }
    function finish() {
      const total = ships.reduce((a, s) => a + s.score, 0), top = ships.slice().sort((a, b) => b.score - a.score);
      env.end({ title: 'GAME OVER', color: '#c264ff', sub: `Wave ${wave}  ·  Team score ${total}  ·  MVP ${top[0].name}`, lines: top.map(s => ({ name: s.name, color: s.color, text: String(s.score) })) });
    }

    return {
      update(dt, pl) {
        t += dt; banner -= dt;
        if (over) { endT -= dt; if (endT <= 0) finish(); }
        else if (rocks.length === 0) { clearT -= dt; if (clearT <= 0) { spawnWave(); clearT = 2.2; } } else clearT = 2.2;
        for (const s of ships) {
          const p = pl[s.i];
          if (!s.alive) {
            if (s.lives > 0 && !over) { s.resp -= dt; if (s.resp <= 0) { s.alive = true; s.inv = 2.6; s.x = W / 2; s.y = H / 2; s.vx = s.vy = 0; s.a = -Math.PI / 2; fx.ring(s.x, s.y, s.color, 120, 0.5); } }
            continue;
          }
          s.inv -= dt; s.cd -= dt; s.shield -= dt; s.shCd -= dt; s.thr = 0;
          const m = Math.min(1, Math.hypot(p.stick.x, p.stick.y));
          if (m > 0.25) {
            const ta = Math.atan2(p.stick.y, p.stick.x);
            s.a = turnToward(s.a, ta, dt * 9);
            if (Math.abs(angDiff(s.a, ta)) < 1.1) { s.vx += Math.cos(s.a) * 640 * m * dt; s.vy += Math.sin(s.a) * 640 * m * dt; s.thr = m; }
          }
          const f = Math.exp(-0.55 * dt); s.vx *= f; s.vy *= f;
          const sp = Math.hypot(s.vx, s.vy); if (sp > 640) { s.vx *= 640 / sp; s.vy *= 640 / sp; }
          s.x += s.vx * dt; s.y += s.vy * dt; wrap(s, 30);
          if (s.thr > 0 && Math.random() < 0.6) fx.burst(s.x - Math.cos(s.a) * 22, s.y - Math.sin(s.a) * 22, '#ffa030', 1, 120, 0.35, 5);
          if (p.btn.a && s.cd <= 0 && !over) {
            const ca = Math.cos(s.a), sa = Math.sin(s.a);
            bullets.push({ x: s.x + ca * 28, y: s.y + sa * 28, vx: ca * 980 + s.vx * 0.3, vy: sa * 980 + s.vy * 0.3, life: 0.85, s });
            s.cd = 0.17; sfx.shoot();
          }
          if (p.hit.b && s.shCd <= 0) { s.shield = 1.4; s.shCd = 7; sfx.dash(); fx.ring(s.x, s.y, '#22d3ee', 90, 0.4); }
        }
        for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt; wrap(r, r.r); }
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b, 4);
          let used = b.life <= 0;
          if (!used) for (let j = rocks.length - 1; j >= 0; j--) {
            const r = rocks[j];
            if (Math.hypot(r.x - b.x, r.y - b.y) < r.r + 4) { split(r, j, b.s); used = true; break; }
          }
          if (used) bullets.splice(i, 1);
        }
        for (const s of ships) {
          if (!s.alive || s.inv > 0) continue;
          for (let j = rocks.length - 1; j >= 0; j--) {
            const r = rocks[j];
            if (Math.hypot(r.x - s.x, r.y - s.y) < r.r * 0.85 + 14) {
              if (s.shield > 0) { const a = Math.atan2(r.y - s.y, r.x - s.x), sp = Math.hypot(r.vx, r.vy) + 60; r.vx = Math.cos(a) * sp; r.vy = Math.sin(a) * sp; fx.burst(s.x, s.y, '#22d3ee', 10, 260, 0.4, 4); sfx.hit(); }
              else { killShip(s); split(r, j, null); break; }
            }
          }
        }
      },
      draw(c) {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05030f'); g.addColorStop(1, '#170a33'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        for (const [x, y, r, col] of [[400, 300, 700, 'rgba(120,60,255,0.12)'], [1500, 800, 800, 'rgba(255,61,150,0.09)'], [1700, 200, 500, 'rgba(34,211,238,0.07)']]) {
          const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2);
        }
        for (const s of stars) { c.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + s.p))) * s.z; c.fillStyle = '#fff'; c.fillRect((s.x - t * 8 * s.z + W * 4) % W, s.y, 2 * s.z + 0.6, 2 * s.z + 0.6); }
        c.globalAlpha = 1;
        c.lineJoin = 'round';
        for (const r of rocks) {
          c.save(); c.translate(r.x, r.y); c.rotate(r.rot); c.beginPath();
          r.pts.forEach((d, i) => { const a = i / r.pts.length * TAU; i ? c.lineTo(Math.cos(a) * d, Math.sin(a) * d) : c.moveTo(Math.cos(a) * d, Math.sin(a) * d); }); c.closePath();
          c.fillStyle = 'rgba(60,70,150,0.28)'; c.fill(); c.shadowColor = '#7a8cff'; c.shadowBlur = 16; c.strokeStyle = '#a9bbff'; c.lineWidth = 3; c.stroke(); c.restore();
        }
        for (const b of bullets) {
          c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = b.s.color; c.shadowColor = b.s.color; c.shadowBlur = 18; c.lineWidth = 6; c.lineCap = 'round';
          c.beginPath(); c.moveTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); c.lineTo(b.x, b.y); c.stroke(); c.restore();
        }
        for (const s of ships) {
          if (!s.alive) continue;
          if (s.inv > 0 && Math.floor(t * 12) % 2) continue;
          drawShip(c, s.x, s.y, s.a, s.color, s.thr, t);
          if (s.shield > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#22d3ee'; c.shadowColor = '#22d3ee'; c.shadowBlur = 24; c.lineWidth = 4; c.globalAlpha = 0.5 + 0.4 * Math.sin(t * 20); c.beginPath(); c.arc(s.x, s.y, 40, 0, TAU); c.stroke(); c.restore(); }
          text(c, s.name, s.x, s.y + 44, 20, '#fff', 'center', 700);
        }
        ships.forEach((s, i) => {
          const x = 40 + i * 235;
          text(c, s.name, x, 32, 22, s.lives > 0 ? s.color : '#555', 'left', 800, 150); text(c, String(s.score), x, 62, 28, '#fff', 'left', 900);
          for (let l = 0; l < 3; l++) { c.globalAlpha = l < s.lives ? 1 : 0.18; drawShip(c, x + 118 + l * 28, 48, -Math.PI / 2, s.color, 0, 0, 0.55); } c.globalAlpha = 1;
          if (s.shCd > 0 && s.lives > 0) { c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x, 80, 200, 4); c.fillStyle = '#22d3ee'; c.fillRect(x, 80, 200 * (1 - s.shCd / 7), 4); }
        });
        if (banner > 0 && !over) { c.save(); c.globalAlpha = Math.min(1, banner); c.shadowColor = '#c264ff'; c.shadowBlur = 30; text(c, `WAVE ${wave}`, W / 2, 300, 120, '#fff', 'center', 900); c.restore(); }
      }
    };
  }
});
})();
