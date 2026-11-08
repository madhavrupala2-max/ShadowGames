// Canvas game template (logical screen is 1920x1080). Copy folder, drop the "_" prefix, edit.
// AX gives helpers: AX.text, AX.rr, AX.fx (particles), AX.sfx, AX.vib(player, ms) ...
AX.register({
  // name/tag/color/min/max/layout come from manifest.json
  art(c, w, h, t) { c.fillStyle = '#10243a'; c.fillRect(0, 0, w, h); AX.text(c, 'PREVIEW', w / 2, h / 2, 50, '#fff'); },   // menu card picture (optional)
  create(env) {                                   // env: { W, H, players, end, fx, sfx, base, speak, relayout, ... }
    const dots = env.players.map((p, i) => ({ x: 300 + i * 200, y: 540, score: 0, color: p.color, name: p.name }));
    return {
      update(dt, players) {                       // players[i].stick.x/y (-1..1), .btn.a held, .hit.a pressed this frame
        dots.forEach((d, i) => {
          const p = players[i]; d.x += p.stick.x * 500 * dt; d.y += p.stick.y * 500 * dt;
          if (p.hit.a) { d.score++; env.fx.burst(d.x, d.y, d.color, 20); env.sfx.hit(); }
          if (d.score >= 10) env.end({ title: d.name + ' WINS!', color: d.color, lines: dots.map(q => ({ name: q.name, color: q.color, text: String(q.score) })) });
        });
      },
      draw(c) {
        c.fillStyle = '#0a0620'; c.fillRect(0, 0, env.W, env.H);
        dots.forEach(d => { c.fillStyle = d.color; c.beginPath(); c.arc(d.x, d.y, 30, 0, 7); c.fill(); AX.text(c, d.name + ' ' + d.score, d.x, d.y - 50, 26); });
      }
      // optional: layoutFor(player) -> per-player phone layout, destroy() -> cleanup
    };
  }
});
