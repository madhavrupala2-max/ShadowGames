
// ======================================================
// FRUIT NINJA ARENA - Multiplayer + AI Computer Opponent
// Logical screen: 1920 x 1080
// ======================================================

AX.register({
  art(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#071b35");
    g.addColorStop(1, "#45115d");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    AX.text(c, "🍉 FRUIT NINJA", w / 2, h / 2 - 35, 65, "#ffffff");
    AX.text(c, "SLICE • COMBO • WIN", w / 2, h / 2 + 45, 25, "#ffd166");
  },

  create(env) {
    const W = env.W;
    const H = env.H;

    const palette = [
      "#00e5ff", "#ff4d9d", "#ffd166", "#9bff70"
    ];

    const fruits = ["🍎", "🍊", "🍉", "🍓", "🍍", "🥝", "🍌", "🍇", "🍑"];

    const humans = env.players.map((p, i) => ({
      x: W * (i + 1) / (env.players.length + 1),
      y: H * 0.55,
      name: p.name || "PLAYER " + (i + 1),
      color: p.color || palette[i % palette.length],
      score: 0,
      lives: 3,
      combo: 0,
      comboTime: 0,
      isAI: false,
      trail: [],
      id: i
    }));

    // Automatically add AI when there is only one human player.
    const bots = [];

    if (humans.length === 1) {
      bots.push({
        x: W * 0.78,
        y: H * 0.55,
        name: "CPU BOT",
        color: "#ff4d9d",
        score: 0,
        lives: 3,
        combo: 0,
        comboTime: 0,
        isAI: true,
        trail: [],
        target: null,
        id: 1,
        reaction: 0
      });
    }

    const all = [...humans, ...bots];

    let objects = [];
    let particles = [];
    let floatingTexts = [];
    let timer = 0;
    let spawnTimer = 0;
    let elapsed = 0;
    let difficulty = 1;
    let gameOver = false;
    let ended = false;
    let shake = 0;
    let backgroundTime = 0;

    const rand = (a, b) => a + Math.random() * (b - a);

    function spawn() {
      const isBomb = Math.random() < 0.13;

      objects.push({
        x: rand(180, W - 180),
        y: H + 80,
        vx: rand(-180, 180),
        vy: rand(-1050, -750) * Math.min(1.35, difficulty),
        gravity: 1250,
        radius: isBomb ? 48 : 53,
        emoji: isBomb ? "💣" : fruits[Math.floor(Math.random() * fruits.length)],
        bomb: isBomb,
        sliced: false,
        rotation: rand(-1, 1),
        rotationSpeed: rand(-3, 3),
        owner: null
      });
    }

    function burst(x, y, color, amount = 18) {
      for (let i = 0; i < amount; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(100, 600);

        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: rand(0.35, 0.9),
          maxLife: 0.9,
          size: rand(5, 15),
          color
        });
      }

      try {
        env.fx?.burst(x, y, color, amount);
      } catch (_) {}
    }

    function popup(x, y, text, color) {
      floatingTexts.push({
        x, y, text, color, life: 1
      });
    }

    function slice(obj, player) {
      if (obj.sliced) return;

      obj.sliced = true;
      obj.owner = player;

      if (obj.bomb) {
        player.lives--;
        player.combo = 0;
        shake = 18;

        burst(obj.x, obj.y, "#ff3030", 35);
        popup(obj.x, obj.y, "BOOM! -1 LIFE", "#ff4444");

        try { env.sfx?.hit(); } catch (_) {}
        return;
      }

      player.combo++;
      player.comboTime = 2.2;

      const bonus = player.combo >= 3 ? player.combo * 2 : 0;
      const points = 10 + bonus;

      player.score += points;

      burst(obj.x, obj.y, player.color, 24);

      popup(
        obj.x,
        obj.y,
        player.combo >= 3 ? "COMBO x" + player.combo + " +" + points : "+" + points,
        "#ffe66d"
      );

      try { env.sfx?.hit(); } catch (_) {}
      try { env.vib?.(player.id, 35); } catch (_) {}
    }

    function finish() {
      if (ended) return;
      ended = true;
      gameOver = true;

      const winner = [...all].sort((a, b) => b.score - a.score)[0];

      env.end({
        title: winner.name + " WINS!",
        color: winner.color,
        lines: all.map(p => ({
          name: p.name,
          color: p.color,
          text: p.score + " POINTS"
        }))
      });
    }

    function updateAI(dt) {
      for (const bot of bots) {
        if (bot.lives <= 0) continue;

        if (!bot.target || bot.target.sliced || bot.target.bomb) {
          bot.target = objects
            .filter(o => !o.sliced && !o.bomb && o.vy < 0)
            .sort((a, b) => a.y - b.y)[0] || null;
        }

        if (bot.target) {
          const target = bot.target;

          const dx = target.x - bot.x;
          const dy = target.y - bot.y;

          bot.x += Math.sign(dx) * Math.min(Math.abs(dx), 700 * dt);
          bot.y += Math.sign(dy) * Math.min(Math.abs(dy), 700 * dt);

          bot.reaction += dt;

          if (
            Math.hypot(dx, dy) < 105 &&
            bot.reaction > 0.13
          ) {
            slice(target, bot);
            bot.reaction = 0;
            bot.target = null;
          }
        } else {
          bot.x += (W * 0.76 - bot.x) * dt * 1.5;
          bot.y += (H * 0.55 - bot.y) * dt * 1.5;
        }
      }
    }

    function drawBackground(c) {
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#07182f");
      g.addColorStop(0.55, "#18264b");
      g.addColorStop(1, "#321447");

      c.fillStyle = g;
      c.fillRect(0, 0, W, H);

      // Floating ambient lights
      for (let i = 0; i < 25; i++) {
        const x = (i * 317 + backgroundTime * (15 + i % 4)) % W;
        const y = (i * 173 + Math.sin(backgroundTime + i) * 70) % H;

        c.fillStyle = "rgba(255,255,255,0.09)";
        c.beginPath();
        c.arc(x, y, 3 + i % 5, 0, Math.PI * 2);
        c.fill();
      }

      // Ground glow
      const ground = c.createLinearGradient(0, H - 120, 0, H);
      ground.addColorStop(0, "rgba(0,229,255,0)");
      ground.addColorStop(1, "rgba(0,229,255,0.14)");

      c.fillStyle = ground;
      c.fillRect(0, H - 120, W, 120);
    }

    function drawFruit(c, obj) {
      c.save();
      c.translate(obj.x, obj.y);
      c.rotate(obj.rotation);

      // Shadow
      c.shadowColor = obj.bomb ? "#ff0000" : "#ffffff";
      c.shadowBlur = 22;

      c.font = "76px Arial";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(obj.emoji, 0, 0);

      c.restore();
    }

    function drawPlayer(c, p) {
      c.save();

      // Glowing player cursor
      c.shadowColor = p.color;
      c.shadowBlur = 30;

      c.strokeStyle = p.color;
      c.lineWidth = 7;

      c.beginPath();
      c.arc(p.x, p.y, 42, 0, Math.PI * 2);
      c.stroke();

      c.fillStyle = p.color + "35";
      c.beginPath();
      c.arc(p.x, p.y, 34, 0, Math.PI * 2);
      c.fill();

      c.shadowBlur = 0;

      c.fillStyle = "#ffffff";
      c.textAlign = "center";
      c.font = "bold 24px Arial";
      c.fillText(p.isAI ? "🤖" : "⚔️", p.x, p.y + 9);

      // Name
      AX.text(c, p.name, p.x, p.y - 67, 24, p.color);

      c.restore();
    }

    function drawHUD(c) {
      all.forEach((p, i) => {
        const x = i === 0 ? 35 : W - 365;

        c.fillStyle = "rgba(0,0,0,0.48)";
        AX.rr(c, x, 28, 330, 145, 22);

        c.fillStyle = p.color;
        AX.rr(c, x, 28, 8, 145, 4);

        AX.text(c, p.name, x + 25, 62, 26, p.color);
        AX.text(c, "SCORE: " + p.score, x + 25, 103, 30, "#ffffff");
        AX.text(c, "❤️".repeat(Math.max(0, p.lives)), x + 25, 145, 27, "#ff5555");

        if (p.combo >= 3) {
          AX.text(c, "COMBO x" + p.combo, x + 210, 145, 22, "#ffd166");
        }
      });

      AX.text(c, "FRUIT NINJA ARENA", W / 2, 47, 33, "#ffffff");
      AX.text(c, "TIME " + Math.ceil(Math.max(0, 90 - elapsed)), W / 2, 90, 25, "#ffd166");
    }

    return {
      update(dt, players) {
        if (gameOver) return;

        dt = Math.min(dt, 0.04);

        elapsed += dt;
        backgroundTime += dt;
        timer += dt;
        spawnTimer += dt;

        difficulty = 1 + elapsed / 65;

        // Human controls
        humans.forEach((p, i) => {
          const input = players[i];

          if (!input) return;

          p.x += input.stick.x * 850 * dt;
          p.y += input.stick.y * 850 * dt;

          p.x = Math.max(60, Math.min(W - 60, p.x));
          p.y = Math.max(100, Math.min(H - 100, p.y));

          if (input.hit?.a || input.btn?.a) {
            objects.forEach(o => {
              if (
                !o.sliced &&
                Math.hypot(o.x - p.x, o.y - p.y) < 125
              ) {
                slice(o, p);
              }
            });
          }

          p.comboTime -= dt;
          if (p.comboTime <= 0) p.combo = 0;
        });

        updateAI(dt);

        // Spawn fruits
        const spawnRate = Math.max(0.32, 0.85 - elapsed * 0.003);

        if (spawnTimer >= spawnRate) {
          spawnTimer = 0;
          spawn();

          if (Math.random() < 0.24) spawn();
        }

        // Fruit physics
        objects.forEach(o => {
          if (o.sliced) return;

          o.x += o.vx * dt;
          o.y += o.vy * dt;
          o.vy += o.gravity * dt;
          o.rotation += o.rotationSpeed * dt;

          // Fruit escaping gives no points
          if (o.y > H + 130) o.sliced = true;
        });

        // Particle physics
        particles.forEach(p => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 500 * dt;
          p.life -= dt;
        });

        particles = particles.filter(p => p.life > 0);
        objects = objects.filter(o => !o.sliced || o.owner);

        floatingTexts.forEach(t => {
          t.y -= 75 * dt;
          t.life -= dt;
        });

        floatingTexts = floatingTexts.filter(t => t.life > 0);

        shake = Math.max(0, shake - 40 * dt);

        // End conditions
        if (humans.every(p => p.lives <= 0)) finish();
        if (bots.length && bots.every(p => p.lives <= 0)) finish();

        if (elapsed >= 90) finish();
      },

      draw(c) {
        drawBackground(c);

        c.save();

        if (shake > 0) {
          c.translate(rand(-shake, shake), rand(-shake, shake));
        }

        // Fruits
        objects.forEach(o => {
          if (!o.sliced) drawFruit(c, o);
        });

        // Particles
        particles.forEach(p => {
          c.globalAlpha = Math.max(0, p.life / p.maxLife);
          c.fillStyle = p.color;

          c.beginPath();
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          c.fill();
        });

        c.globalAlpha = 1;

        // Score popups
        floatingTexts.forEach(t => {
          c.globalAlpha = Math.max(0, t.life);
          AX.text(c, t.text, t.x, t.y, 29, t.color);
        });

        c.globalAlpha = 1;

        // Players and AI
        all.forEach(p => drawPlayer(c, p));

        c.restore();

        drawHUD(c);

        AX.text(
          c,
          "MOVE TO AIM  •  PRESS A TO SLICE",
          W / 2,
          H - 35,
          24,
          "#ffffff"
        );
      },

      destroy() {
        objects = [];
        particles = [];
        floatingTexts = [];
      }
    };
  }
});
