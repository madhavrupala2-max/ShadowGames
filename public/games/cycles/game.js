// LIGHT CYCLES - leave a wall of light, trap your rivals.
(() => {
const { W, H, TAU, rand, text, fx, sfx, vib } = AX;
const CW = 96, CH = 54, C = 20;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const SP = [
  { x: 12, y: 12, d: 0 }, { x: 83, y: 41, d: 2 }, { x: 83, y: 12, d: 1 }, { x: 12, y: 41, d: 3 },
  { x: 48, y: 5, d: 1 }, { x: 48, y: 48, d: 3 }, { x: 5, y: 27, d: 0 }, { x: 90, y: 27, d: 2 }
];
const px = v => v * C + C / 2;

AX.register({
  id: 'cycles', name: 'LIGHT CYCLES', tag: 'Turn left / right, never touch|a wall of light', color: '#22d3ee', min: 2, max: 8,
  layout: { stick: false, buttons: [{ id: 'l', label: '◀', color: '#22d3ee' }, { id: 'r', label: '▶', color: '#ff3d71' }], hint: 'Tap ◀ ▶ to turn' },
  art(c, w, h, t) {
    c.fillStyle = '#04030c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(34,211,238,0.10)'; for (let x = 0; x < w; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    const k = (t * 80) % 120;
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [col, pts] of [['#22d3ee', [[20, 200], [20, 90], [150 + k * 0.2, 90]]], ['#ff3d71', [[310, 60], [200, 60], [200, 170 + k * 0.1]]]]) {
      c.save(); c.shadowColor = col; c.shadowBlur = 20; c.strokeStyle = col; c.lineWidth = 8; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.restore();
    }
  },
  create(env) {
    const ps = env.players, n = ps.length;
    const occ = new Int8Array(CW * CH).fill(-1);
    const cy = ps.map((p, i) => {
      const s = SP[i % 8];
      return { p, i, x: s.x, y: s.y, d: s.d, q: [], alive: true, pts: [{ x: s.x, y: s.y }], color: p.color, name: p.name, nx: 0, ny: 0 };
    });
    cy.forEach(c => { occ[c.y * CW + c.x] = c.i; });
    let acc = 0, t = 0, over = false, endT = 0;
    const order = [];

    function kill(c) {
      c.alive = false; order.push(c);
      const x = px(Math.max(0, Math.min(CW - 1, c.x))), y = px(Math.max(0, Math.min(CH - 1, c.y)));
      fx.burst(x, y, c.color, 70, 560, 1.1, 7); fx.burst(x, y, '#fff', 20, 420, 0.5, 4); fx.ring(x, y, c.color, 220, 0.7); fx.shake(18); sfx.boom(); vib(c.p, 250);
    }
    function stepAll() {
      for (const c of cy) {
        if (!c.alive) continue;
        if (c.q.length) {
          c.d = (c.d + c.q.shift()) % 4;
          const lp = c.pts[c.pts.length - 1]; if (lp.x !== c.x || lp.y !== c.y) c.pts.push({ x: c.x, y: c.y });
        }
        c.nx = c.x + DX[c.d]; c.ny = c.y + DY[c.d];
      }
      const dead = new Set();
      for (const c of cy) if (c.alive && (c.nx < 0 || c.nx >= CW || c.ny < 0 || c.ny >= CH || occ[c.ny * CW + c.nx] >= 0)) dead.add(c.i);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = cy[i], b = cy[j];
        if (a.alive && b.alive && a.nx === b.nx && a.ny === b.ny) { dead.add(a.i); dead.add(b.i); }
      }
      for (const c of cy) {
        if (!c.alive) continue;
        if (dead.has(c.i)) kill(c); else { c.x = c.nx; c.y = c.ny; occ[c.y * CW + c.x] = c.i; }
      }
    }
    function finish() {
      const alive = cy.filter(c => c.alive), win = alive.length === 1 ? alive[0] : null;
      const rank = [...alive, ...order.slice().reverse()];
      const lines = rank.map((c, i) => ({ name: c.name, color: c.color, text: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][i] }));
      env.end({ title: win ? `${win.name} WINS!` : 'DRAW', color: win ? win.color : '#ffd400', sub: 'Last rider alive', lines });
    }

    return {
      update(dt, pl) {
        t += dt;
        if (over) { endT -= dt; if (endT <= 0) finish(); return; }
        for (const c of cy) {
          if (!c.alive) continue;
          const p = pl[c.i];
          if (p.hit.l) c.q.push(3);
          if (p.hit.r) c.q.push(1);
          if (c.q.length > 2) c.q.splice(0, c.q.length - 2);
        }
        acc += dt;
        const step = Math.max(0.042, 0.078 - t * 0.0004);
        let guard = 0;
        while (acc >= step && guard++ < 4) { acc -= step; stepAll(); }
        if (n >= 2 && cy.filter(c => c.alive).length <= 1) { over = true; endT = 1.5; }
      },
      draw(c) {
        c.fillStyle = '#04030c'; c.fillRect(0, 0, W, H);
        const bg = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100); bg.addColorStop(0, 'rgba(40,20,90,0.55)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = bg; c.fillRect(0, 0, W, H);
        c.strokeStyle = 'rgba(34,211,238,0.07)'; c.lineWidth = 1; c.beginPath();
        for (let x = 0; x <= W; x += C) { c.moveTo(x, 0); c.lineTo(x, H); }
        for (let y = 0; y <= H; y += C) { c.moveTo(0, y); c.lineTo(W, y); }
        c.stroke();
        c.save(); c.shadowColor = '#22d3ee'; c.shadowBlur = 24; c.strokeStyle = '#22d3ee'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6); c.restore();
        c.lineCap = 'round'; c.lineJoin = 'round';
        for (const cc of cy) {
          c.beginPath(); cc.pts.forEach((p, i) => i ? c.lineTo(px(p.x), px(p.y)) : c.moveTo(px(p.x), px(p.y))); c.lineTo(px(cc.x), px(cc.y));
          if (cc.alive) {
            c.save(); c.shadowColor = cc.color; c.shadowBlur = 26; c.strokeStyle = cc.color; c.lineWidth = 11; c.stroke();
            c.shadowBlur = 0; c.strokeStyle = '#fff'; c.globalAlpha = 0.85; c.lineWidth = 3; c.stroke(); c.restore();
          } else {
            c.save(); c.globalAlpha = 0.28; c.strokeStyle = cc.color; c.lineWidth = 8; c.stroke(); c.restore();
          }
        }
        for (const cc of cy) {
          if (!cc.alive) continue;
          const x = px(cc.x), y = px(cc.y);
          c.save(); c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(x, y, 2, x, y, 40); g.addColorStop(0, '#fff'); g.addColorStop(0.3, cc.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, 40, 0, TAU); c.fill(); c.restore();
          c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fill();
          text(c, cc.name, x, y - 34, 22, '#fff', 'center', 700);
        }
        cy.forEach((cc, i) => { c.fillStyle = cc.alive ? cc.color : '#444'; c.beginPath(); c.arc(40 + i * 200, 34, 9, 0, TAU); c.fill(); text(c, cc.name, 58 + i * 200, 35, 20, cc.alive ? '#fff' : '#666', 'left', 700); });
      }
    };
  }
});
})();
