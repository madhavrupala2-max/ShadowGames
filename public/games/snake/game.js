
// SNAKE.IO — INFINITE SURVIVAL AI ARENA
(() => {
'use strict';

const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;

const BASE_SEG = 9;
const MAX_SEG = 80;
const STEP = 9;
const HEAD_R = 13;
const BODY_R = 11;
const SPEED = 168;
const TURN = 3.3;
const M = 26;
const FRUIT_N = 55;

const FRUIT_COLORS = [
  '#ff3d71', '#ffd400', '#7cff4d',
  '#22d3ee', '#c264ff', '#ff8a00'
];

const wrapX = x =>
  ((x % (W - M * 2)) + (W - M * 2)) %
  (W - M * 2) + M;

const wrapY = y =>
  ((y % (H - M * 2 - 60)) + (H - M * 2 - 60)) %
  (H - M * 2 - 60) + M + 60;

const dxw = (a, b) => {
  let d = a - b;
  const size = W - M * 2;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return d;
};

const dyw = (a, b) => {
  let d = a - b;
  const size = H - M * 2 - 60;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return d;
};

function newSnake(p, i, total, spread) {
  const a = TAU * i / total + rand(-0.2, 0.2);
  const x = W / 2 + Math.cos(a) * spread;
  const y = (H + 60) / 2 + Math.sin(a) * spread * 0.55;

  return {
    p,
    i,
    name: p.name || `PLAYER ${i + 1}`,
    color: p.color || '#7cff4d',
    isAI: !!p.isAI,

    ax: x,
    ay: y,
    dir: a,

    len: BASE_SEG,
    pts: [{ x, y }],

    fruit: 0,
    deaths: 0,
    alive: true,
    respawn: 0,

    aiThink: rand(0, 0.2),
    aiTarget: a,
    aiBoost: 0,
    boostT: 0
  };
}

AX.register({
  id: 'snakeio',
  name: 'SNAKE.IO',
  tag: 'Eat fruits · Grow bigger · Survive!',
  color: '#7cff4d',

  min: 1,
  max: 8,

  layout: {
    stick: true,
    buttons: ['a', 'b'],
    hint: 'Stick = Move · B = Boost · Eat fruits'
  },

  art(c, w, h, t) {
    c.fillStyle = '#04120c';
    c.fillRect(0, 0, w, h);

    c.strokeStyle = 'rgba(124,255,77,0.10)';
    c.lineWidth = 1;

    for (let x = 0; x < w; x += 26) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }

    for (let y = 0; y < h; y += 26) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }

    const cx = w / 2;
    const cy = h / 2;

    c.save();
    c.shadowColor = '#7cff4d';
    c.shadowBlur = 26;

    for (let i = 9; i >= 1; i--) {
      const a = t * 0.9 + i * 0.28;

      c.fillStyle = i % 2 ? '#7cff4d' : '#42d96a';

      c.beginPath();
      c.arc(
        cx + Math.cos(a) * i * 11,
        cy + Math.sin(a) * i * 6,
        10 - i * 0.35,
        0,
        TAU
      );
      c.fill();
    }

    c.fillStyle = '#05170f';
    c.strokeStyle = '#7cff4d';
    c.lineWidth = 3;

    c.beginPath();
    c.arc(cx, cy, 19, 0, TAU);
    c.fill();
    c.stroke();

    c.fillStyle = '#fff';

    for (const ex of [-6, 6]) {
      c.beginPath();
      c.arc(cx + ex, cy - 4, 4, 0, TAU);
      c.fill();
    }

    c.restore();

    for (let i = 0; i < 6; i++) {
      const a = t * 0.7 + i * 1.1;

      c.save();
      c.shadowColor = FRUIT_COLORS[i];
      c.shadowBlur = 18;
      c.fillStyle = FRUIT_COLORS[i];

      c.beginPath();
      c.arc(
        cx + Math.cos(a) * 92,
        cy + Math.sin(a) * 58,
        8,
        0,
        TAU
      );
      c.fill();

      c.restore();
    }
  },

  create(env) {
    const humanPlayers = env.players;
    const humanCount = humanPlayers.length;

    const botCount = humanCount === 1
      ? 7
      : Math.max(0, 8 - humanCount);

    const total = humanCount + botCount;
    const spread = Math.min(430, 150 + total * 34);

    const snakes = humanPlayers.map((p, i) =>
      newSnake(p, i, total, spread)
    );

    const botNames = [
      'NINJA', 'VIPER', 'SHADOW',
      'BLAZE', 'PIXEL', 'COBRA', 'NEON'
    ];

    const botColors = [
      '#ff4d8d', '#48d9ff', '#ffd447',
      '#b66bff', '#ff873d', '#62ff9a',
      '#ff6b6b'
    ];

    for (let i = 0; i < botCount; i++) {
      snakes.push(
        newSnake({
          name: botNames[i % botNames.length],
          color: botColors[i % botColors.length],
          isAI: true
        }, humanCount + i, total, spread)
      );
    }

    const fruits = [];
    let fruitIndex = 0;

    function spawnFruit() {
      return {
        x: rand(M + 40, W - M - 40),
        y: rand(150, H - 80),
        r: rand(7, 11),
        c: FRUIT_COLORS[
          fruitIndex++ % FRUIT_COLORS.length
        ],
        ph: rand(0, TAU)
      };
    }

    for (let i = 0; i < FRUIT_N; i++) {
      fruits.push(spawnFruit());
    }

    let t = 0;
    let over = false;
    let endT = 0;
    let finished = false;

    // direct screen-touch: first finger steers toward the touch point, extra finger = boost
    const aim = new Map();
    const boostIds = new Set();

    function bodyPoint(s, k) {
      return s.pts[
        Math.min(k, s.pts.length - 1)
      ] || s.pts[0];
    }

    function kill(s) {
      if (!s.alive) return;

      s.alive = false;
      s.deaths++;
      s.respawn = 3.5;

      const hx = wrapX(s.ax);
      const hy = wrapY(s.ay);

      fx.burst(hx, hy, s.color, 34, 330, 0.9, 6);
      fx.ring(hx, hy, s.color, 160, 0.5);
      fx.shake(12);
      sfx.boom();

      if (!s.isAI) {
        vib(s.p, 220);
      }

      const drop = Math.min(
        18,
        Math.floor(s.len / 3)
      );

      for (
        let k = 2, dropped = 0;
        k < s.len && dropped < drop && fruits.length < 260;
        k += 2, dropped++
      ) {
        const b = bodyPoint(s, k);

        fruits.push({
          x: wrapX(b.x),
          y: wrapY(b.y),
          r: 7,
          c: s.color,
          ph: rand(0, TAU)
        });
      }

      s.fruit = Math.max(0, s.fruit - 3);
    }

    function finish() {
      if (finished) return;
      finished = true;

      const rank = snakes.slice().sort((a, b) =>
        (b.alive ? 1 : 0) - (a.alive ? 1 : 0) ||
        b.fruit - a.fruit ||
        a.deaths - b.deaths
      );

      const winner = rank.find(s => !s.isAI);

      env.end({
        title: winner
          ? `${winner.name} ELIMINATED`
          : 'GAME OVER',

        color: winner ? winner.color : '#ff4d8d',

        sub: 'Survival game finished',

        lines: rank.map((s, i) => ({
          name: `${i + 1}. ${s.name}`,
          color: s.color,
          text: `${s.fruit} fruits · ${s.deaths} deaths`
        }))
      });
    }

    function checkHumanGameOver() {
      // Only human players decide when the match ends.
      // AI survival or elimination does not affect game-over.
      const humansAlive = snakes.some(
        s => !s.isAI && s.alive
      );

      if (!humansAlive) {
        over = true;
        endT = 1.1;
      }
    }

    return {
      touchStart(p, x, y, id, n) {
        if (n > 1) { boostIds.add(id); p.btn.b = 1; }
        else aim.set(p, { x, y });
      },
      touchMove(p, x, y, id, n) {
        if (!boostIds.has(id)) aim.set(p, { x, y });
      },
      touchEnd(p, x, y, id, n) {
        boostIds.delete(id);
        if (!boostIds.size) p.btn.b = 0;
        if (!n) aim.delete(p);
      },

      update(dt, pl) {
        t += dt;

        if (over) {
          endT -= dt;

          if (endT <= 0) {
            finish();
          }

          return;
        }

        for (const s of snakes) {
          if (!s.alive) {
            // AI snakes can respawn.
            // Human snakes remain eliminated.
            if (s.isAI) {
              s.respawn -= dt;

              if (s.respawn <= 0) {
                const a = rand(0, TAU);

                s.ax = W / 2 + Math.cos(a) * 320;
                s.ay = (H + 60) / 2 + Math.sin(a) * 200;

                s.dir = a;
                s.len = BASE_SEG;
                s.pts = [{ x: s.ax, y: s.ay }];
                s.alive = true;
              }
            }

            continue;
          }

          const p = s.isAI
            ? null
            : (pl[s.i] || s.p);

          if (s.isAI) {
            s.aiThink -= dt;

            if (s.aiThink <= 0) {
              s.aiThink = rand(0.12, 0.24);

              let target = null;
              let best = Infinity;

              // Find nearest fruit.
              for (const f of fruits) {
                const d = Math.hypot(
                  dxw(s.ax, f.x),
                  dyw(s.ay, f.y)
                );

                if (d < best) {
                  best = d;
                  target = f;
                }
              }

              let want = target
                ? Math.atan2(
                    dyw(target.y, s.ay),
                    dxw(target.x, s.ax)
                  )
                : s.dir + rand(-0.8, 0.8);

              // Avoid other snakes.
              let dangerX = 0;
              let dangerY = 0;
              let danger = false;

              for (const o of snakes) {
                if (!o.alive || o === s) continue;

                for (let k = 2; k < o.len; k += 3) {
                  const b = bodyPoint(o, k);

                  const dx = dxw(s.ax, wrapX(b.x));
                  const dy = dyw(s.ay, wrapY(b.y));
                  const d = Math.hypot(dx, dy);

                  if (d < 105 && d > 0.1) {
                    dangerX += dx / (d * d);
                    dangerY += dy / (d * d);
                    danger = true;
                  }
                }
              }

              if (danger) {
                want = Math.atan2(dangerY, dangerX);
              }

              let d = want - s.dir;

              while (d > Math.PI) d -= TAU;
              while (d < -Math.PI) d += TAU;

              s.aiTarget =
                s.dir + clamp(d, -1.25, 1.25);

              s.aiBoost =
                !danger &&
                best > 100 &&
                s.len > BASE_SEG + 8 &&
                Math.random() < 0.12;
            }

            let d = s.aiTarget - s.dir;

            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;

            s.dir += clamp(d, -TURN * dt, TURN * dt);

          } else {
            const tp = p && p.touch ? aim.get(p) : null;

            if (tp) {
              const want = Math.atan2(
                dyw(tp.y, s.ay),
                dxw(tp.x, s.ax)
              );

              let d = want - s.dir;

              while (d > Math.PI) d -= TAU;
              while (d < -Math.PI) d += TAU;

              s.dir += clamp(d, -TURN * dt, TURN * dt);
            } else {
              const mx = p?.stick?.x || 0;
              const my = p?.stick?.y || 0;

              if (Math.hypot(mx, my) > 0.2) {
                const want = Math.atan2(my, mx);

                let d = want - s.dir;

                while (d > Math.PI) d -= TAU;
                while (d < -Math.PI) d += TAU;

                s.dir += clamp(d, -TURN * dt, TURN * dt);
              }
            }
          }

          const boosting = s.isAI
            ? !!s.aiBoost
            : !!p?.btn?.b;

          const speed =
            SPEED *
            (boosting && s.len > BASE_SEG + 3
              ? 1.55
              : 1);

          s.ax += Math.cos(s.dir) * speed * dt;
          s.ay += Math.sin(s.dir) * speed * dt;

          // Boost consumes length and drops fruit.
          if (boosting && s.len > BASE_SEG + 3) {
            s.boostT += dt;

            if (s.boostT >= 0.16) {
              s.boostT = 0;
              s.len = Math.max(BASE_SEG, s.len - 1);

              const tail = bodyPoint(s, s.len);

              if (fruits.length < 260) {
                fruits.push({
                  x: wrapX(tail.x),
                  y: wrapY(tail.y),
                  r: 7,
                  c: s.color,
                  ph: rand(0, TAU)
                });
              }
            }
          }

          // Update body.
          const head = s.pts[0];

          const dist = Math.hypot(
            s.ax - head.x,
            s.ay - head.y
          );

          if (dist >= STEP) {
            s.pts.unshift({
              x: head.x + (s.ax - head.x) * (STEP / dist),
              y: head.y + (s.ay - head.y) * (STEP / dist)
            });

            if (s.pts.length > MAX_SEG + 6) {
              s.pts.length = MAX_SEG + 6;
            }
          }

          while (s.pts.length < s.len + 2) {
            const last = s.pts[s.pts.length - 1] ||
              { x: s.ax, y: s.ay };

            s.pts.push({
              x: last.x - Math.cos(s.dir) * STEP,
              y: last.y - Math.sin(s.dir) * STEP
            });
          }

          const hx = wrapX(s.ax);
          const hy = wrapY(s.ay);

          // Eat fruit.
          for (const f of fruits) {
            if (
              Math.hypot(
                dxw(hx, f.x),
                dyw(hy, f.y)
              ) < HEAD_R + f.r + 3
            ) {
              f.eaten = true;

              s.fruit++;
              s.len = Math.min(MAX_SEG, s.len + 2);

              fx.burst(f.x, f.y, f.c, 8, 150, 0.5, 4);
              sfx.select();

              if (!s.isAI) vib(s.p, 12);
              break;
            }
          }

          // Collision with OTHER snakes only.
          // Own body collision is completely disabled.
          for (const o of snakes) {
            if (!o.alive || o === s) continue;

            for (let k = 3; k < o.len; k++) {
              const b = bodyPoint(o, k);

              if (
                Math.hypot(
                  dxw(hx, wrapX(b.x)),
                  dyw(hy, wrapY(b.y))
                ) < HEAD_R + BODY_R * 0.85
              ) {
                kill(s);
                break;
              }
            }

            if (!s.alive) break;
          }
        }

        // Remove eaten fruit.
        for (let i = fruits.length - 1; i >= 0; i--) {
          if (fruits[i].eaten) {
            fruits.splice(i, 1);
          }
        }

        while (fruits.length < FRUIT_N) {
          fruits.push(spawnFruit());
        }

        // Multiplayer: game ends only when ALL human players die.
        // Single-player: game ends when the one human player dies.
        checkHumanGameOver();
      },

      draw(c) {
        c.fillStyle = '#04100b';
        c.fillRect(0, 0, W, H);

        const g = c.createRadialGradient(
          W / 2, H / 2, 100,
          W / 2, H / 2, 1100
        );

        g.addColorStop(0, 'rgba(20,90,55,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');

        c.fillStyle = g;
        c.fillRect(0, 0, W, H);

        // Arena grid.
        c.strokeStyle = 'rgba(124,255,77,0.07)';
        c.lineWidth = 1;

        for (let x = M; x <= W - M; x += 48) {
          c.beginPath();
          c.moveTo(x, 96);
          c.lineTo(x, H - M);
          c.stroke();
        }

        for (let y = 96; y <= H - M; y += 48) {
          c.beginPath();
          c.moveTo(M, y);
          c.lineTo(W - M, y);
          c.stroke();
        }

        c.strokeStyle = 'rgba(124,255,77,0.22)';
        c.lineWidth = 2;
        c.strokeRect(M, 96, W - M * 2, H - M - 96);

        // Fruits.
        for (const f of fruits) {
          const pulse = 1 + Math.sin(t * 4 + f.ph) * 0.12;

          c.save();
          c.shadowColor = f.c;
          c.shadowBlur = 20;
          c.fillStyle = f.c;

          c.beginPath();
          c.arc(f.x, f.y, f.r * pulse, 0, TAU);
          c.fill();

          c.strokeStyle = 'rgba(255,255,255,0.45)';
          c.lineWidth = 1.5;

          c.beginPath();
          c.arc(f.x, f.y, f.r * pulse + 2, 0, TAU);
          c.stroke();

          c.fillStyle = 'rgba(255,255,255,0.75)';

          c.beginPath();
          c.arc(
            f.x - f.r * 0.28,
            f.y - f.r * 0.32,
            f.r * 0.28,
            0,
            TAU
          );
          c.fill();

          c.restore();
        }

        // Snakes.
        for (const s of snakes) {
          if (!s.alive) continue;

          for (let k = s.len; k >= 1; k--) {
            const b = bodyPoint(s, k);
            const x = wrapX(b.x);
            const y = wrapY(b.y);

            const r = BODY_R * (1 - (k / s.len) * 0.25);

            c.save();
            c.shadowColor = s.color;
            c.shadowBlur = k < 8 ? 20 : 10;
            c.globalAlpha = 0.9;
            c.fillStyle = s.color;

            c.beginPath();
            c.arc(x, y, r, 0, TAU);
            c.fill();

            c.restore();
          }

          const hx = wrapX(s.ax);
          const hy = wrapY(s.ay);

          c.save();
          c.shadowColor = s.color;
          c.shadowBlur = 30;
          c.fillStyle = '#fff';

          c.beginPath();
          c.arc(hx, hy, HEAD_R + 2, 0, TAU);
          c.fill();

          c.restore();

          c.fillStyle = s.color;

          c.beginPath();
          c.arc(hx, hy, HEAD_R, 0, TAU);
          c.fill();

          const ex = Math.cos(s.dir);
          const ey = Math.sin(s.dir);

          for (const side of [-1, 1]) {
            const px = hx + ex * 5 - ey * 6 * side;
            const py = hy + ey * 5 + ex * 6 * side;

            c.fillStyle = '#04100b';

            c.beginPath();
            c.arc(px, py, 4.2, 0, TAU);
            c.fill();

            c.fillStyle = '#fff';

            c.beginPath();
            c.arc(px + ex * 1.2, py + ey * 1.2, 1.7, 0, TAU);
            c.fill();
          }

          text(
            c,
            `${s.name} · ${s.fruit}`,
            hx,
            hy - HEAD_R - 16,
            19,
            '#fff',
            'center',
            800
          );
        }

        // Alive counter.
        const humanAlive = snakes.filter(
          s => !s.isAI && s.alive
        ).length;

        const humanTotal = snakes.filter(
          s => !s.isAI
        ).length;

        const aiAlive = snakes.filter(
          s => s.isAI && s.alive
        ).length;

        c.fillStyle = 'rgba(4,16,11,0.78)';
        rr(c, W / 2 - 165, 18, 330, 54, 18);
        c.fill();

        c.strokeStyle = 'rgba(124,255,77,0.5)';
        c.lineWidth = 2;
        rr(c, W / 2 - 165, 18, 330, 54, 18);
        c.stroke();

        text(
          c,
          `PLAYERS ${humanAlive}/${humanTotal}`,
          W / 2,
          43,
          24,
          '#7cff4d',
          'center',
          900
        );

        text(
          c,
          `AI ${aiAlive}`,
          W / 2,
          63,
          13,
          '#cdd7f5',
          'center',
          700
        );

        // Leaderboard.
        const leaders = snakes.slice()
          .sort((a, b) => b.fruit - a.fruit)
          .slice(0, 6);

        c.fillStyle = 'rgba(4,16,11,0.72)';
        rr(c, M + 8, 82, 245, 177, 12);
        c.fill();

        text(
          c,
          'TOP SNAKES',
          M + 20,
          105,
          17,
          '#7cff4d',
          'left',
          900
        );

        leaders.forEach((s, i) => {
          c.fillStyle = s.alive ? s.color : '#555';

          c.beginPath();
          c.arc(M + 22, 128 + i * 23, 5, 0, TAU);
          c.fill();

          text(
            c,
            `${i + 1}. ${s.name}`,
            M + 34,
            133 + i * 23,
            15,
            s.alive ? '#fff' : '#778',
            'left',
            700
          );

          text(
            c,
            String(s.fruit),
            M + 235,
            133 + i * 23,
            15,
            '#ffd400',
            'right',
            800
          );
        });

        text(
          c,
          'HOLD B TO BOOST',
          W / 2,
          H - 22,
          18,
          '#ffd400',
          'center',
          800
        );

        if (over) {
          c.fillStyle = 'rgba(4,10,8,0.55)';
          c.fillRect(0, 0, W, H);

          text(
            c,
            'GAME OVER',
            W / 2,
            H / 2,
            82,
            '#ff4d8d',
            'center',
            900
          );
        }
      }
    };
  }
});
})();
