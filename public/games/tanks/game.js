// NEON TANKS - top-down arena, bouncing shells, last tank standing.
(() => {
const { W, H, TAU, clamp, rand, lerp, turnToward, rr, text, fx, sfx, vib } = AX;

function drawTank(c, x, y, ba, ta, color, s = 1, flash = 0) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.save(); c.rotate(ba);
  c.fillStyle = '#0c0f1c'; rr(c, -32, -28, 64, 13, 5); c.fill(); rr(c, -32, 15, 64, 13, 5); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2;
  for (let i = -26; i <= 26; i += 9) { c.beginPath(); c.moveTo(i, -28); c.lineTo(i, -15); c.moveTo(i, 15); c.lineTo(i, 28); c.stroke(); }
  const g = c.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, color); g.addColorStop(1, '#0b0b1a');
  c.shadowColor = color; c.shadowBlur = 20; c.fillStyle = g; rr(c, -27, -19, 54, 38, 9); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; rr(c, -27, -19, 54, 38, 9); c.stroke();
  c.restore();
  c.rotate(ta);
  c.fillStyle = '#e8ecff'; rr(c, 4, -5.5, 42, 11, 4); c.fill();
  c.fillStyle = color; rr(c, 38, -7, 10, 14, 3); c.fill();
  c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.fillStyle = '#1a1d33'; c.fill();
  c.lineWidth = 4; c.strokeStyle = color; c.stroke();
  c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fillStyle = '#fff'; c.fill();
  if (flash > 0) { c.globalAlpha = flash; c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 36, 0, TAU); c.fill(); }
  c.restore();
}

function pushOut(o, r, rc) {
  const cx = clamp(o.x, rc.x, rc.x + rc.w), cy = clamp(o.y, rc.y, rc.y + rc.h);
  const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
  if (d >= r) return false;
  if (d > 0.001) { o.x += dx / d * (r - d); o.y += dy / d * (r - d); return true; }
  const l = o.x - rc.x, rt = rc.x + rc.w - o.x, t = o.y - rc.y, b = rc.y + rc.h - o.y, m = Math.min(l, rt, t, b);
  if (m === l) o.x = rc.x - r; else if (m === rt) o.x = rc.x + rc.w + r; else if (m === t) o.y = rc.y - r; else o.y = rc.y + rc.h + r;
  return true;
}

AX.register({
  id: 'tanks', name: 'NEON TANKS', tag: 'Bouncing shells|Last tank standing', color: '#ff3d71', min: 2, max: 8,
  layout: { stick: true, buttons: [{ id: 'a', label: 'FIRE', color: '#ff3d71' }, { id: 'b', label: 'DASH', color: '#22d3ee' }], hint: 'Stick = drive & aim · FIRE · DASH' },
  art(c, w, h, t) {
    c.fillStyle = '#0b0820'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; for (let x = 0; x < w; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    c.fillStyle = '#171238'; c.strokeStyle = '#7a5cff'; c.lineWidth = 2; rr(c, 150, 120, 60, 70, 6); c.fill(); c.stroke();
    drawTank(c, 80, 150 + Math.sin(t * 2) * 6, 0, -0.25, '#ff3d71', 1.1);
    drawTank(c, 260, 70 - Math.sin(t * 2) * 6, Math.PI, Math.PI - 0.2, '#22d3ee', 1.1);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = '#ff3d71'; c.shadowColor = '#ff3d71'; c.shadowBlur = 14;
    const bx = 130 + ((t * 120) % 100); c.beginPath(); c.arc(bx, 126 - (bx - 130) * 0.18, 6, 0, TAU); c.fill(); c.restore();
  },
  create(env) {
    const ps = env.players, AR = { x: 60, y: 60, w: 1800, h: 960 };
    const walls = [], rects = [];
    for (let i = 0; i < 3; i++) { const w = rand(100, 240), h = rand(70, 180); rects.push({ x: rand(300, 900 - w), y: rand(200, 500 - h), w, h }); }
    for (const r of rects) walls.push(r, { x: W - r.x - r.w, y: r.y, w: r.w, h: r.h }, { x: r.x, y: H - r.y - r.h, w: r.w, h: r.h }, { x: W - r.x - r.w, y: H - r.y - r.h, w: r.w, h: r.h });
    walls.push({ x: 900, y: 480, w: 120, h: 120 });
    const SP = [[150, 150], [1770, 930], [1770, 150], [150, 930], [960, 125], [960, 955], [125, 540], [1795, 540]];
    const tanks = ps.map((p, i) => {
      const s = SP[i % 8], a = Math.atan2(540 - s[1], 960 - s[0]);
      return { p, i, x: s[0], y: s[1], ba: a, ta: a, vx: 0, vy: 0, hp: 3, alive: true, cd: 0.4, dashCd: 0, dashT: 0, flash: 0, kills: 0, color: p.color, name: p.name };
    });
    const bullets = [];
    let t = 0, over = false, endT = 0;

    function kill(k, by) {
      k.alive = false; fx.burst(k.x, k.y, k.color, 60, 520, 1, 7); fx.burst(k.x, k.y, '#fff', 20, 380, 0.5, 4);
      fx.ring(k.x, k.y, k.color, 200, 0.7); fx.shake(22); sfx.boom(); vib(k.p, 300);
      if (by !== undefined && by !== k.i) tanks[by].kills++;
    }
    function finish() {
      const alive = tanks.filter(k => k.alive), win = alive.length === 1 ? alive[0] : null;
      const lines = tanks.slice().sort((a, b) => (b.alive - a.alive) || (b.kills - a.kills)).map(k => ({ name: k.name, color: k.color, text: `${k.kills} kill${k.kills === 1 ? '' : 's'}${k.alive ? '  ★' : ''}` }));
      env.end({ title: win ? `${win.name} WINS!` : 'DRAW', color: win ? win.color : '#ffd400', sub: 'Last tank standing', lines });
    }

    return {
      update(dt, pl) {
        t += dt;
        if (over) { endT -= dt; if (endT <= 0) finish(); }
        for (const k of tanks) {
          if (!k.alive) continue;
          const p = pl[k.i];
          k.cd -= dt; k.dashCd -= dt; k.flash = Math.max(0, k.flash - dt * 3);
          const m = Math.min(1, Math.hypot(p.stick.x, p.stick.y));
          let tx = 0, ty = 0;
          if (m > 0.2) {
            const a = Math.atan2(p.stick.y, p.stick.x);
            k.ta = turnToward(k.ta, a, dt * 14); k.ba = turnToward(k.ba, a, dt * 8);
            tx = Math.cos(a) * 250 * m; ty = Math.sin(a) * 250 * m;
          }
          if (p.hit.b && k.dashCd <= 0) { k.dashT = 0.16; k.dashCd = 2.2; sfx.dash(); }
          if (k.dashT > 0) { k.dashT -= dt; tx = Math.cos(k.ta) * 780; ty = Math.sin(k.ta) * 780; fx.burst(k.x, k.y, k.color, 3, 90, 0.35, 6); }
          const e = Math.min(1, dt * 12);
          k.vx = lerp(k.vx, tx, e); k.vy = lerp(k.vy, ty, e);
          k.x += k.vx * dt; k.y += k.vy * dt;
          k.x = clamp(k.x, AR.x + 30, AR.x + AR.w - 30); k.y = clamp(k.y, AR.y + 30, AR.y + AR.h - 30);
          for (const w of walls) pushOut(k, 30, w);
          if (m > 0.2 && Math.random() < 0.35) fx.burst(k.x - Math.cos(k.ba) * 30, k.y - Math.sin(k.ba) * 30, 'rgba(160,170,220,0.6)', 1, 40, 0.4, 4);
          if (p.btn.a && k.cd <= 0 && !over) {
            const ca = Math.cos(k.ta), sa = Math.sin(k.ta);
            bullets.push({ x: k.x + ca * 52, y: k.y + sa * 52, vx: ca * 740, vy: sa * 740, owner: k.i, bounces: 0, age: 0, color: k.color });
            k.cd = 0.4; fx.burst(k.x + ca * 54, k.y + sa * 54, '#fff', 6, 260, 0.2, 4); sfx.shoot();
            k.x -= ca * 3; k.y -= sa * 3;
          }
        }
        for (let i = 0; i < tanks.length; i++) for (let j = i + 1; j < tanks.length; j++) {
          const a = tanks[i], b = tanks[j]; if (!a.alive || !b.alive) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d < 60 && d > 0.01) { const o = (60 - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; }
        }
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i]; b.age += dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          let dead = b.age > 3.2;
          if (b.x < AR.x + 4) { b.x = AR.x + 4; b.vx = -b.vx; b.bounces++; fx.burst(b.x, b.y, b.color, 4, 140, 0.25, 3); }
          else if (b.x > AR.x + AR.w - 4) { b.x = AR.x + AR.w - 4; b.vx = -b.vx; b.bounces++; fx.burst(b.x, b.y, b.color, 4, 140, 0.25, 3); }
          if (b.y < AR.y + 4) { b.y = AR.y + 4; b.vy = -b.vy; b.bounces++; fx.burst(b.x, b.y, b.color, 4, 140, 0.25, 3); }
          else if (b.y > AR.y + AR.h - 4) { b.y = AR.y + AR.h - 4; b.vy = -b.vy; b.bounces++; fx.burst(b.x, b.y, b.color, 4, 140, 0.25, 3); }
          for (const w of walls) {
            if (b.x > w.x - 4 && b.x < w.x + w.w + 4 && b.y > w.y - 4 && b.y < w.y + w.h + 4) {
              const px = b.x - b.vx * dt, py = b.y - b.vy * dt;
              if (px <= w.x - 4 || px >= w.x + w.w + 4) { b.vx = -b.vx; b.x = px; } else { b.vy = -b.vy; b.y = py; }
              b.bounces++; fx.burst(b.x, b.y, b.color, 5, 160, 0.25, 3); break;
            }
          }
          if (b.bounces > 3) dead = true;
          if (!dead && !over) for (const k of tanks) {
            if (!k.alive || (b.owner === k.i && b.age < 0.3)) continue;
            if (Math.hypot(b.x - k.x, b.y - k.y) < 34) {
              k.hp--; k.flash = 1; dead = true; sfx.hit(); vib(k.p, 60); fx.burst(b.x, b.y, k.color, 14, 320, 0.5, 5); fx.shake(8);
              if (k.hp <= 0) kill(k, b.owner);
              break;
            }
          }
          if (dead) { fx.burst(b.x, b.y, b.color, 5, 120, 0.3, 3); bullets.splice(i, 1); }
        }
        if (!over && ps.length >= 2 && tanks.filter(k => k.alive).length <= 1) { over = true; endT = 1.4; }
      },
      draw(c) {
        c.fillStyle = '#070516'; c.fillRect(0, 0, W, H);
        const fg = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100); fg.addColorStop(0, '#1b1445'); fg.addColorStop(1, '#0a0720');
        c.fillStyle = fg; c.fillRect(AR.x, AR.y, AR.w, AR.h);
        c.strokeStyle = 'rgba(140,120,255,0.07)'; c.lineWidth = 1; c.beginPath();
        for (let x = AR.x; x <= AR.x + AR.w; x += 60) { c.moveTo(x, AR.y); c.lineTo(x, AR.y + AR.h); }
        for (let y = AR.y; y <= AR.y + AR.h; y += 60) { c.moveTo(AR.x, y); c.lineTo(AR.x + AR.w, y); }
        c.stroke();
        c.save(); c.shadowColor = '#7a5cff'; c.shadowBlur = 26; c.strokeStyle = '#8f7bff'; c.lineWidth = 5; c.strokeRect(AR.x, AR.y, AR.w, AR.h); c.restore();
        for (const w of walls) {
          c.save(); c.shadowColor = '#7a5cff'; c.shadowBlur = 18; c.fillStyle = '#1a1442'; rr(c, w.x, w.y, w.w, w.h, 10); c.fill();
          c.strokeStyle = '#8f7bff'; c.lineWidth = 3; c.stroke(); c.restore();
          c.fillStyle = 'rgba(255,255,255,0.05)'; rr(c, w.x + 8, w.y + 8, w.w - 16, Math.min(24, w.h - 16), 6); c.fill();
        }
        for (const b of bullets) {
          c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = b.color; c.lineWidth = 6; c.lineCap = 'round'; c.shadowColor = b.color; c.shadowBlur = 20;
          c.globalAlpha = 0.6; c.beginPath(); c.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); c.lineTo(b.x, b.y); c.stroke();
          c.globalAlpha = 1; c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, 6, 0, TAU); c.fill(); c.restore();
        }
        for (const k of tanks) {
          if (!k.alive) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#000'; c.beginPath(); c.arc(k.x, k.y, 30, 0, TAU); c.fill(); c.restore(); continue; }
          drawTank(c, k.x, k.y, k.ba, k.ta, k.color, 1, k.flash * 0.7);
          for (let h = 0; h < 3; h++) { c.fillStyle = h < k.hp ? k.color : 'rgba(255,255,255,0.15)'; c.shadowColor = k.color; c.shadowBlur = h < k.hp ? 10 : 0; c.beginPath(); c.arc(k.x - 20 + h * 20, k.y - 50, 6, 0, TAU); c.fill(); }
          c.shadowBlur = 0; text(c, k.name, k.x, k.y + 54, 22, '#fff', 'center', 700);
          if (k.dashCd > 0) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.beginPath(); c.arc(k.x, k.y, 40, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k.dashCd / 2.2)); c.stroke(); }
        }
        tanks.forEach((k, i) => { c.fillStyle = k.color; c.beginPath(); c.arc(110 + i * 230, 30, 9, 0, TAU); c.fill(); text(c, `${k.name}  ${k.kills}`, 128 + i * 230, 31, 22, k.alive ? '#fff' : '#667', 'left', 700); });
      }
    };
  }
});
})();
