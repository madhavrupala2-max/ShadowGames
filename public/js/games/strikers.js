// SHADOW STRIKERS - 2-team arcade football. Even players = RED, odd players = CYAN.
(() => {
const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;
const FL = 140, FR = 1780, FT = 170, FB = 930, GT = 440, GB = 660, BRAD = 22, PR = 40, POST = 12;
const TEAM = [{ name: 'RED', color: '#ff4d6d' }, { name: 'CYAN', color: '#22d3ee' }];
const MATCH = 100, WIN_GOALS = 7;

AX.register({
  id: 'strikers', name: 'SHADOW STRIKERS', tag: 'Team football: red vs cyan|score before time runs out', color: '#7cff4d', min: 2, max: 8, order: 24,
  layout: { stick: true, buttons: [{ id: 'a', label: 'KICK', color: '#7cff4d' }], hint: 'Stick = daudo · KICK = ball ke paas' },
  art(c, w, h, t) {
    c.fillStyle = '#0b3a2c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)'; c.fillRect(i * w / 8, 0, w / 8, h); }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.strokeRect(14, 24, w - 28, h - 48); c.beginPath(); c.moveTo(w / 2, 24); c.lineTo(w / 2, h - 24); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, 40, 0, TAU); c.stroke();
    const bx = w / 2 + Math.sin(t * 1.5) * 50, by = h / 2 + Math.cos(t * 2) * 30;
    for (const [x, y, col] of [[bx - 60, by + 10, '#ff4d6d'], [bx + 70, by - 20, '#22d3ee']]) { c.save(); c.shadowColor = col; c.shadowBlur = 18; c.fillStyle = col; c.beginPath(); c.arc(x, y, 22, 0, TAU); c.fill(); c.restore(); }
    c.save(); c.shadowColor = '#fff'; c.shadowBlur = 16; c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 11, 0, TAU); c.fill(); c.restore();
  },
  create(env) {
    const ps = env.players;
    const pl = ps.map((p, i) => ({ p, i, team: i % 2, x: 0, y: 0, vx: 0, vy: 0, cd: 0, kick: 0, color: p.color, name: p.name }));
    const ball = { x: 960, y: 550, vx: 0, vy: 0, trail: [] };
    const score = [0, 0];
    let timeLeft = MATCH, goalT = 0, over = false, endT = 0, goalTeam = -1, t = 0;

    function reset() {
      for (let tm = 0; tm < 2; tm++) {
        const mem = pl.filter(m => m.team === tm);
        mem.forEach((m, k) => { m.x = tm === 0 ? 520 : 1400; m.y = 550 + (k - (mem.length - 1) / 2) * 220; m.vx = m.vy = 0; });
      }
      ball.x = 960; ball.y = 550; ball.vx = ball.vy = 0; ball.trail.length = 0;
    }
    reset();

    function hitCircle(o, cx, cy, r) {
      const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy), m = r + BRAD;
      if (d < m && d > 0.01) { const nx = dx / d, ny = dy / d; o.x = cx + nx * m; o.y = cy + ny * m; const vn = o.vx * nx + o.vy * ny; if (vn < 0) { o.vx -= 1.7 * vn * nx; o.vy -= 1.7 * vn * ny; sfx.hit(); } }
    }
    function finish() {
      const win = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
      env.end({
        title: win < 0 ? 'DRAW!' : `${TEAM[win].name} TEAM WINS!`, color: win < 0 ? '#ffd400' : TEAM[win].color, sub: `Final score  ${score[0]} : ${score[1]}`,
        lines: pl.slice().sort((a, b) => a.team - b.team).map(m => ({ name: `${m.name}  (${TEAM[m.team].name})`, color: TEAM[m.team].color, text: m.team === win ? 'WIN' : win < 0 ? 'DRAW' : '' }))
      });
    }
    function scored(tm) {
      score[tm]++; goalT = 2.4; goalTeam = tm; sfx.goal(); fx.shake(26);
      const gx = tm === 0 ? FR : FL;
      fx.burst(gx, 550, TEAM[tm].color, 90, 800, 1.3, 8); fx.burst(gx, 550, '#fff', 40, 600, 0.8, 5); fx.ring(gx, 550, TEAM[tm].color, 400, 1);
      pl.forEach(m => { if (m.team === tm) vib(m.p, 200); });
      if (score[tm] >= WIN_GOALS) { over = true; endT = 2.4; }
    }

    return {
      update(dt, ps2) {
        t += dt;
        if (over && goalT <= 0) { endT -= dt; if (endT <= 0) finish(); return; }
        if (goalT > 0) { goalT -= dt; if (goalT <= 0) { if (over) { endT = 0.2; } else reset(); } return; }
        timeLeft -= dt;
        if (timeLeft <= 0) { timeLeft = 0; if (!over) { over = true; endT = 1.2; sfx.go(); } return; }
        for (const m of pl) {
          const p = ps2[m.i]; m.cd -= dt; m.kick -= dt;
          const mag = Math.min(1, Math.hypot(p.stick.x, p.stick.y));
          if (mag > 0.12) { const a = Math.atan2(p.stick.y, p.stick.x); m.vx += Math.cos(a) * mag * 2800 * dt; m.vy += Math.sin(a) * mag * 2800 * dt; }
          const f = Math.exp(-5 * dt); m.vx *= f; m.vy *= f;
          m.x = clamp(m.x + m.vx * dt, FL + PR, FR - PR); m.y = clamp(m.y + m.vy * dt, FT + PR, FB - PR);
          if (p.btn.a && m.cd <= 0) {
            const dx = ball.x - m.x, dy = ball.y - m.y, d = Math.hypot(dx, dy);
            m.kick = 0.18;
            if (d < PR + BRAD + 28 && d > 0.01) {
              ball.vx = dx / d * 1150 + m.vx * 0.4; ball.vy = dy / d * 1150 + m.vy * 0.4; m.cd = 0.4;
              fx.burst(ball.x, ball.y, '#fff', 14, 420, 0.4, 5); fx.ring(ball.x, ball.y, TEAM[m.team].color, 100, 0.35); sfx.kick(); vib(m.p, 40); fx.shake(5);
            } else m.cd = 0.15;
          }
        }
        for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) {
          const a = pl[i], b = pl[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d < PR * 2 && d > 0.01) { const o = (PR * 2 - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { a.vx += nx * rv * 0.6; a.vy += ny * rv * 0.6; b.vx -= nx * rv * 0.6; b.vy -= ny * rv * 0.6; } }
        }
        for (const m of pl) {
          const dx = ball.x - m.x, dy = ball.y - m.y, d = Math.hypot(dx, dy), md = PR + BRAD;
          if (d < md && d > 0.01) {
            const nx = dx / d, ny = dy / d; ball.x = m.x + nx * md; ball.y = m.y + ny * md;
            const rv = (ball.vx - m.vx) * nx + (ball.vy - m.vy) * ny;
            if (rv < 0) { ball.vx -= 1.5 * rv * nx; ball.vy -= 1.5 * rv * ny; if (-rv > 150) sfx.kick(); }
          }
        }
        const f = Math.exp(-0.75 * dt); ball.vx *= f; ball.vy *= f;
        const bs = Math.hypot(ball.vx, ball.vy); if (bs > 1500) { ball.vx *= 1500 / bs; ball.vy *= 1500 / bs; }
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.y < FT + BRAD) { ball.y = FT + BRAD; ball.vy = -ball.vy * 0.85; }
        if (ball.y > FB - BRAD) { ball.y = FB - BRAD; ball.vy = -ball.vy * 0.85; }
        const mouth = ball.y > GT + 6 && ball.y < GB - 6;
        if (!mouth) {
          if (ball.x < FL + BRAD) { ball.x = FL + BRAD; ball.vx = -ball.vx * 0.85; }
          if (ball.x > FR - BRAD) { ball.x = FR - BRAD; ball.vx = -ball.vx * 0.85; }
        }
        for (const [px, py] of [[FL, GT], [FL, GB], [FR, GT], [FR, GB]]) hitCircle(ball, px, py, POST);
        if (ball.x < FL - BRAD) scored(1); else if (ball.x > FR + BRAD) scored(0);
        ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 14) ball.trail.shift();
        if (bs > 400 && Math.random() < 0.5) fx.burst(ball.x, ball.y, 'rgba(255,255,255,0.6)', 1, 30, 0.3, 4);
      },
      draw(c) {
        c.fillStyle = '#04120d'; c.fillRect(0, 0, W, H);
        const fw = FR - FL, fh = FB - FT;
        for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#0e4a37' : '#0c4130'; c.fillRect(FL + i * fw / 12, FT, fw / 12 + 1, fh); }
        const vg = c.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1100); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
        c.save(); c.shadowColor = '#fff'; c.shadowBlur = 12; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 5;
        c.strokeRect(FL, FT, fw, fh); c.beginPath(); c.moveTo(W / 2, FT); c.lineTo(W / 2, FB); c.stroke();
        c.beginPath(); c.arc(W / 2, 550, 110, 0, TAU); c.stroke();
        c.strokeRect(FL, 330, 190, 440); c.strokeRect(FR - 190, 330, 190, 440); c.restore();
        for (const [gx, dir, tm] of [[FL, -1, 0], [FR, 1, 1]]) {
          c.save(); c.shadowColor = TEAM[tm].color; c.shadowBlur = 30; c.fillStyle = 'rgba(255,255,255,0.06)'; c.strokeStyle = TEAM[tm].color; c.lineWidth = 6;
          c.beginPath(); c.rect(dir < 0 ? gx - 80 : gx, GT, 80, GB - GT); c.fill(); c.stroke(); c.restore();
          c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; for (let k = 1; k < 6; k++) { const nx = dir < 0 ? gx - k * 13 : gx + k * 13; c.beginPath(); c.moveTo(nx, GT); c.lineTo(nx, GB); c.stroke(); }
          for (let y = GT + 22; y < GB; y += 22) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx + dir * 80, y); c.stroke(); }
          for (const py of [GT, GB]) { c.fillStyle = '#fff'; c.shadowColor = TEAM[tm].color; c.shadowBlur = 16; c.beginPath(); c.arc(gx, py, POST, 0, TAU); c.fill(); c.shadowBlur = 0; }
        }
        for (const m of pl) {
          c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(m.x + 5, m.y + 14, PR, PR * 0.6, 0, 0, TAU); c.fill();
          c.save(); c.shadowColor = TEAM[m.team].color; c.shadowBlur = 24;
          const g = c.createRadialGradient(m.x - 12, m.y - 14, 4, m.x, m.y, PR); g.addColorStop(0, '#fff'); g.addColorStop(0.3, m.color); g.addColorStop(1, '#14102e');
          c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, PR, 0, TAU); c.fill(); c.shadowBlur = 0;
          c.lineWidth = 7; c.strokeStyle = TEAM[m.team].color; c.stroke(); c.restore();
          if (m.kick > 0) { c.strokeStyle = '#fff'; c.lineWidth = 4; c.globalAlpha = m.kick / 0.18; c.beginPath(); c.arc(m.x, m.y, PR + 14 + (0.18 - m.kick) * 120, 0, TAU); c.stroke(); c.globalAlpha = 1; }
          text(c, m.name, m.x, m.y - PR - 18, 22, '#fff', 'center', 700);
        }
        c.save(); c.globalCompositeOperation = 'lighter';
        ball.trail.forEach((p, i) => { c.globalAlpha = i / ball.trail.length * 0.35; c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x, p.y, BRAD * (i / ball.trail.length), 0, TAU); c.fill(); }); c.restore();
        c.save(); c.shadowColor = '#fff'; c.shadowBlur = 22; const bg = c.createRadialGradient(ball.x - 6, ball.y - 6, 2, ball.x, ball.y, BRAD); bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#bcc7e8');
        c.fillStyle = bg; c.beginPath(); c.arc(ball.x, ball.y, BRAD, 0, TAU); c.fill(); c.restore();
        const mm = Math.floor(timeLeft / 60), ss = String(Math.floor(timeLeft % 60)).padStart(2, '0');
        c.fillStyle = 'rgba(0,0,0,0.5)'; rr(c, W / 2 - 260, 24, 520, 112, 26); c.fill();
        text(c, String(score[0]), W / 2 - 150, 80, 84, TEAM[0].color, 'center', 900); text(c, String(score[1]), W / 2 + 150, 80, 84, TEAM[1].color, 'center', 900);
        text(c, `${mm}:${ss}`, W / 2, 62, 46, timeLeft < 10 ? '#ff6b6b' : '#fff', 'center', 900); text(c, `pehle ${WIN_GOALS} goal`, W / 2, 106, 20, '#9fb0d6', 'center', 600);
        text(c, TEAM[0].name, 150, 80, 36, TEAM[0].color, 'left', 900); text(c, TEAM[1].name, W - 150, 80, 36, TEAM[1].color, 'right', 900);
        if (goalT > 0) { c.save(); const k = Math.min(1, (2.4 - goalT) * 4); c.translate(W / 2, 540); c.scale(0.6 + 0.5 * k, 0.6 + 0.5 * k); c.shadowColor = TEAM[goalTeam].color; c.shadowBlur = 60; text(c, 'GOAL!', 0, 0, 220, '#fff', 'center', 900); c.restore(); }
      }
    };
  }
});
})();
