// COMPUTER JI QUIZ - KBC-style kids quiz, Hindi + English, questions made fresh by AI (/api/questions).
// Flow: host (first player) picks 10/20/30 + age -> everyone answers on phones (no time limit) ->
// screen shows WHO has answered (not what) -> host presses "Computer Ji" -> suspense -> answer + everyone's picks -> next.
(() => {
const { W, H, TAU, clamp, rand, rr, text, fx, sfx, vib } = AX;
const LET = ['A', 'B', 'C', 'D'], HLET = ['ए', 'बी', 'सी', 'डी'], COL = ['#ff8a00', '#22d3ee', '#7cff4d', '#c264ff'];
const F = (w, s) => `${w} ${s}px Mukta,"Noto Sans Devanagari","Nirmala UI","Segoe UI",sans-serif`;
const HIST_KEY = 'ax_quiz_hist';

function hex(c, x, y, w, h, pt) {
  c.beginPath(); c.moveTo(x, y + h / 2); c.lineTo(x + pt, y); c.lineTo(x + w - pt, y); c.lineTo(x + w, y + h / 2); c.lineTo(x + w - pt, y + h); c.lineTo(x + pt, y + h); c.closePath();
}
function wrap(c, str, maxW, weight, size) {
  c.font = F(weight, size);
  const lines = []; let cur = '';
  for (const w of String(str).split(/\s+/)) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function fit(c, str, maxW, weight, size, min) {
  let s = size; c.font = F(weight, s);
  while (s > min && c.measureText(str).width > maxW) { s -= 2; c.font = F(weight, s); }
  return s;
}
// the little retro-monitor mascot "Computer Ji" (original drawing)
function drawBot(c, x, y, s, mood, t) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.shadowColor = '#22d3ee'; c.shadowBlur = 24;
  c.fillStyle = '#2b2f6b'; rr(c, -90, -70, 180, 140, 26); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = '#9aa7ff'; c.lineWidth = 5; rr(c, -90, -70, 180, 140, 26); c.stroke();
  const g = c.createLinearGradient(0, -58, 0, 58); g.addColorStop(0, '#0c3b4d'); g.addColorStop(1, '#06202d');
  c.fillStyle = g; rr(c, -74, -54, 148, 108, 16); c.fill();
  c.fillStyle = '#2b2f6b'; c.fillRect(-14, 70, 28, 18); rr(c, -50, 86, 100, 14, 7); c.fill();
  c.strokeStyle = '#9aa7ff'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, -70); c.lineTo(0, -92); c.stroke();
  c.fillStyle = mood === 'think' ? (Math.floor(t * 6) % 2 ? '#ffd400' : '#ff8a00') : '#7cff4d'; c.shadowColor = c.fillStyle; c.shadowBlur = 14;
  c.beginPath(); c.arc(0, -98, 8, 0, TAU); c.fill(); c.shadowBlur = 0;
  c.fillStyle = '#7cf6ff'; c.shadowColor = '#7cf6ff'; c.shadowBlur = 12;
  const blink = (t % 3.6) > 3.45 ? 0.12 : 1;
  if (mood === 'think') {
    for (const sx of [-26, 26]) { c.beginPath(); c.arc(sx + Math.cos(t * 5) * 6, -12 + Math.sin(t * 5) * 6, 9, 0, TAU); c.fill(); }
  } else if (mood === 'happy') {
    c.lineWidth = 7; c.strokeStyle = '#7cf6ff'; c.lineCap = 'round';
    for (const sx of [-26, 26]) { c.beginPath(); c.arc(sx, -6, 12, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
  } else {
    for (const sx of [-26, 26]) { rr(c, sx - 9, -24 + (1 - blink) * 10, 18, 26 * blink, 8); c.fill(); }
  }
  c.shadowBlur = 0; c.strokeStyle = '#7cf6ff'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
  if (mood === 'happy') c.arc(0, 8, 24, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mood === 'sad') c.arc(0, 42, 20, 1.15 * Math.PI, 1.85 * Math.PI);
  else if (mood === 'think') { c.moveTo(-14, 30); c.lineTo(14, 30); }
  else c.arc(0, 14, 16, 0.2 * Math.PI, 0.8 * Math.PI);
  c.stroke();
  c.restore();
}

AX.register({
  id: 'quiz',
  art(c, w, h, t) {
    const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 260); g.addColorStop(0, '#2a1a8a'); g.addColorStop(1, '#060a2e');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h / 2); c.rotate(t * 0.15); c.fillStyle = 'rgba(255,200,80,0.07)';
    for (let k = 0; k < 8; k++) { c.rotate(TAU / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(260, -34); c.lineTo(260, 34); c.fill(); } c.restore();
    drawBot(c, w / 2, 92, 0.78, Math.floor(t / 2.5) % 2 ? 'happy' : 'idle', t);
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) {
      c.fillStyle = '#0b1659'; c.strokeStyle = '#9aa7ff'; c.lineWidth = 2; hex(c, 22 + j * 148, 188 + k * 36, 138, 28, 14); c.fill(); c.stroke();
      c.fillStyle = '#ffb300'; c.beginPath(); c.arc(44 + j * 148, 202 + k * 36, 8, 0, TAU); c.fill();
    }
  },
  create(env) {
    const P = env.players, n = P.length, base = env.base;
    const cfg = { count: 10, age: 'young' };
    let phase = 'cfg0', t = 0, phT = 0, qi = 0, Q = [], fetching = false, fails = 0, warn = null, source = '', nextTry = 0;
    let answers = new Array(n).fill(-1), scores = new Array(n).fill(0), lastCorrect = [], hostIdx = 0, musicT = 0, mi = 0, done = false, endT = 0, revealPulse = 0;
    let hist = []; try { hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); if (!Array.isArray(hist)) hist = []; } catch (e) { hist = []; }
    const stars = Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, H), z: rand(0.3, 1), p: rand(0, 6) }));

    const alive = () => P.map((p, i) => i).filter(i => !P[i].left);
    const curHost = () => { const a = alive(); return a.length ? a[0] : 0; };
    const q = () => Q[qi];

    // ---------- phone layouts ----------
    const WAIT = h => ({ stick: false, buttons: [], hint: h });
    function layoutFor(p) {
      const i = P.indexOf(p), isHost = i === hostIdx;
      if (phase === 'cfg0') return isHost ? { stick: false, buttons: [{ id: 'a', label: '10', color: '#ff8a00' }, { id: 'b', label: '20', color: '#22d3ee' }, { id: 'c', label: '30', color: '#7cff4d' }], hint: 'कितने सवाल? · How many questions?' } : WAIT('होस्ट सवालों की संख्या चुन रहा है…\nHost is choosing…');
      if (phase === 'cfg1') return isHost ? { stick: false, buttons: [{ id: 'a', label: 'छोटे\n6-8 साल', color: '#ff8a00' }, { id: 'b', label: 'बड़े\n9-12 साल', color: '#22d3ee' }], hint: 'बच्चों की उम्र? · Kids age?' } : WAIT('होस्ट उम्र चुन रहा है…\nHost is choosing…');
      if (phase === 'load') return WAIT('कंप्यूटर जी सवाल तैयार कर रहे हैं…\nComputer Ji is thinking…');
      if (phase === 'ask') {
        const b = LET.map((l, k) => ({ id: 'abcd'[k], label: l, color: COL[k] }));
        if (isHost) b.push({ id: 'e', label: 'कंप्यूटर जी\nजवाब बताइए', color: '#ffd400' });
        const mine = answers[i];
        const hint = mine >= 0 ? `आपका जवाब: ${LET[mine]} ✓ (बदल सकते हैं)` : 'सही जवाब चुनो · Pick your answer';
        return { stick: false, buttons: b, hint: isHost ? hint + ' · पीला बटन = कंप्यूटर जी' : hint };
      }
      if (phase === 'suspense') return WAIT('कंप्यूटर जी जवाब बता रहे हैं…\nComputer Ji is answering…');
      if (phase === 'reveal') {
        const k = q().a, mine = answers[i];
        const msg = mine < 0 ? 'आपने जवाब नहीं दिया' : lastCorrect.includes(i) ? 'सही जवाब! ✓  +1' : `गलत जवाब ✗\nसही जवाब: ${LET[k]}`;
        const last = qi + 1 >= cfg.count;
        return isHost ? { stick: false, buttons: [{ id: 'e', label: last ? 'नतीजा\nRESULT' : 'अगला सवाल ▶\nNEXT', color: '#7cff4d' }], hint: msg } : WAIT(msg);
      }
      return WAIT('');
    }
    const relayout = () => env.relayout();

    // ---------- direct screen-touch zones (phone playing on this screen) ----------
    const hostTouch = () => !!(P[hostIdx] && P[hostIdx].touch);
    const cfgZones = bs => {
      const cw = 360, gap = 50, tot = bs.length * cw + (bs.length - 1) * gap, x0 = (W - tot) / 2;
      return bs.map((b, i) => ({ x: x0 + i * (cw + gap), y: 710, w: cw, h: 220, b }));
    };
    const HOST_BAR = { x: W / 2 - 330, y: 1024, w: 660, h: 52, b: 'e' };
    function touchZones() {
      if (!hostTouch()) return [];
      if (phase === 'cfg0') return cfgZones(['a', 'b', 'c']);
      if (phase === 'cfg1') return cfgZones(['a', 'b']);
      if (phase === 'ask') {
        const z = [];
        for (let i = 0; i < 4; i++) z.push({ x: 130 + (i % 2) * 860, y: 505 + (i >> 1) * 165, w: 800, h: 130, b: 'abcd'[i] });
        z.push(HOST_BAR);
        return z;
      }
      if (phase === 'reveal') return [HOST_BAR];
      return [];
    }

    // ---------- question supply (AI) ----------
    function saveHist(en) { hist.push(en); if (hist.length > 200) hist = hist.slice(-200); try { localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch (e) {} }
    function fetchBatch() {
      if (fetching || Q.length >= cfg.count) return;
      fetching = true;
      const want = Q.length === 0 ? Math.min(5, cfg.count) : Math.min(10, cfg.count - Q.length);
      fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: want, age: cfg.age, avoid: hist.concat(Q.map(x => x.en.q)) }) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(d => {
          if (!d || !Array.isArray(d.questions) || !d.questions.length) throw new Error('empty');
          for (const x of d.questions) { if (Q.length < cfg.count) Q.push(x); }
          source = d.source || ''; if (d.warn) warn = d.warn; fails = 0; fetching = false;
        })
        .catch(e => { fetching = false; fails++; nextTry = t + 1.5; if (fails >= 4) { done = true; env.end({ title: 'QUESTIONS NOT LOADED', color: '#ff6b6b', sub: 'Server / internet check karein · Check the server', lines: [] }); } });
    }

    // ---------- flow ----------
    function startAsk() {
      phase = 'ask'; phT = 0; answers = new Array(n).fill(-1); lastCorrect = [];
      saveHist(q().en.q); relayout(); env.stopSpeak();
      env.speak(q().hi.q);
      q().hi.o.forEach((o, k) => env.speak(`${HLET[k]}: ${o}`));
      sfx.select();
    }
    function startConfigDone() { phase = 'load'; phT = 0; relayout(); fetchBatch(); }
    function toSuspense() { phase = 'suspense'; phT = 0; env.stopSpeak(); env.speak('कंप्यूटर जी, सही जवाब बताइए'); relayout(); }
    function reveal() {
      phase = 'reveal'; phT = 0; revealPulse = 0;
      const k = q().a; lastCorrect = [];
      P.forEach((p, i) => { if (!p.left && answers[i] === k) { scores[i]++; lastCorrect.push(i); vib(p, 150); } else if (!p.left) vib(p, 60); });
      if (lastCorrect.length) {
        [523, 659, 784, 1047].forEach((f, j) => setTimeout(() => env.audio.tone(f, 0.28, 'triangle', 0.07), j * 110));
        fx.shake(8);
      } else env.audio.tone(150, 0.6, 'sawtooth', 0.07, -70);
      const ox = 130 + (k % 2) * 860 + 400, oy = 505 + (k >> 1) * 165 + 65;
      fx.ring(ox, oy, '#7cff4d', 360, 0.9); fx.burst(ox, oy, '#7cff4d', 50, 520, 1, 7);
      lastCorrect.forEach(i => { const c = chipPos(i); fx.burst(c.x + c.w / 2, c.y + 30, P[i].color, 24, 420, 0.9, 6); });
      env.stopSpeak(); env.speak(`सही जवाब है ${HLET[k]}, ${q().hi.o[k]}`);
      relayout();
    }
    function next() {
      qi++;
      if (qi >= cfg.count) return finish();
      if (qi >= Q.length) { phase = 'load'; phT = 0; relayout(); fetchBatch(); } else startAsk();
    }
    function finish() {
      done = true; env.stopSpeak();
      const order = P.map((p, i) => i).sort((a, b) => scores[b] - scores[a]), top = scores[order[0]], win = order.filter(i => scores[i] === top);
      env.end({
        title: win.length === 1 ? `${P[win[0]].name} WINS!` : 'बराबरी! IT\'S A TIE', color: win.length === 1 ? P[win[0]].color : '#ffd400',
        sub: `${cfg.count} सवाल · Questions   ·   कुल सही जवाब · Total correct: ${scores.reduce((a, b) => a + b, 0)}`,
        lines: order.map(i => ({ name: P[i].name, color: P[i].color, text: `${scores[i]} / ${cfg.count}` }))
      });
    }

    // ---------- chips (players strip) ----------
    function chipPos(i) {
      const cw = Math.min(214, (W - 260 - (n - 1) * 14) / n), tot = n * cw + (n - 1) * 14, x0 = (W - tot) / 2;
      return { x: x0 + i * (cw + 14), y: 872, w: cw, h: 150 };
    }

    if (AX.debug) AX.debug.quizState = () => ({ phase, qi, count: cfg.count, answers: answers.slice(), correct: Q[qi] ? Q[qi].a : -1, loaded: Q.length, source, warn });
    return {
      layoutFor,
      destroy() { env.stopSpeak(); },
      touchStart(p, x, y) {
        const me = P.indexOf(p);
        for (const z of touchZones()) {
          if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) continue;
          if (z.b === 'e' && me !== hostIdx) return;
          p.hit[z.b] = 1; sfx.select();
          return;
        }
      },
      update(dt, pl) {
        t += dt; phT += dt; musicT += dt;
        if (done) return;
        const h = curHost();
        if (h !== hostIdx) { hostIdx = h; relayout(); }
        // background music (only while kids think)
        if (phase === 'ask' && env.settings.music && musicT > 0.46) { musicT = 0; const sc = [196, 247, 294, 392, 294, 247, 220, 262]; env.audio.tone(sc[mi++ % sc.length], 0.4, 'sine', 0.022); if (mi % 4 === 1) env.audio.tone(98, 0.8, 'triangle', 0.03); }
        if (phase === 'suspense' && musicT > 0.5) { musicT = 0; env.audio.tone(62, 0.35, 'sine', 0.16, -20); env.audio.tone(310 + phT * 90, 0.2, 'triangle', 0.025); }

        const hp = pl[hostIdx];
        if (phase === 'cfg0' && hp) {
          for (const [b, v] of [['a', 10], ['b', 20], ['c', 30]]) if (hp.hit[b]) { cfg.count = v; sfx.select(); phase = 'cfg1'; relayout(); }
        } else if (phase === 'cfg1' && hp) {
          if (hp.hit.a) { cfg.age = 'young'; sfx.select(); startConfigDone(); } else if (hp.hit.b) { cfg.age = 'old'; sfx.select(); startConfigDone(); }
        } else if (phase === 'load') {
          if (Q.length > qi) startAsk(); else if (!fetching && t >= nextTry) fetchBatch();
        } else if (phase === 'ask') {
          P.forEach((p, i) => {
            if (p.left) return; const x = pl[i];
            for (let k = 0; k < 4; k++) if (x.hit['abcd'[k]]) { answers[i] = k; sfx.select(); env.relayoutOne(p); }
          });
          if (hp && hp.hit.e) {
            if (alive().some(i => answers[i] >= 0)) toSuspense(); else env.toast('पहले किसी को जवाब देने दो · Wait for answers');
          }
          if (Q.length - qi <= 3 && Q.length < cfg.count) fetchBatch();
        } else if (phase === 'suspense') {
          if (phT > 4.4) reveal();
        } else if (phase === 'reveal') {
          revealPulse += dt;
          if (phT > 0.9 && hp && hp.hit.e) next();
          if (Q.length - qi <= 3 && Q.length < cfg.count) fetchBatch();
        }
      },
      draw(c) {
        // ----- background -----
        const bg = c.createRadialGradient(W / 2, 380, 80, W / 2, 540, 1250); bg.addColorStop(0, '#2b1a9c'); bg.addColorStop(0.55, '#10124f'); bg.addColorStop(1, '#03051c');
        c.fillStyle = bg; c.fillRect(0, 0, W, H);
        c.save(); c.translate(W / 2, 340); c.rotate(t * 0.05); c.fillStyle = 'rgba(255,200,90,0.045)';
        for (let k = 0; k < 14; k++) { c.rotate(TAU / 14); c.beginPath(); c.moveTo(0, 0); c.lineTo(1500, -70); c.lineTo(1500, 70); c.fill(); } c.restore();
        for (const s of stars) { c.globalAlpha = (0.2 + 0.8 * Math.abs(Math.sin(t * 1.3 + s.p))) * s.z; c.fillStyle = '#fff'; c.fillRect(s.x, s.y, 2.5 * s.z, 2.5 * s.z); } c.globalAlpha = 1;

        const names = P.map(p => p.name);
        if (phase === 'cfg0' || phase === 'cfg1') return drawCfg(c);
        if (phase === 'load') return drawLoad(c);

        // ----- header -----
        drawBot(c, 150, 118, 0.62, phase === 'suspense' ? 'think' : phase === 'reveal' ? (lastCorrect.length ? 'happy' : 'sad') : 'idle', t);
        c.save(); c.shadowColor = '#ffb300'; c.shadowBlur = 24; text(c, 'कंप्यूटर जी क्विज़', 280, 70, 56, '#ffd36b', 'left', 800); c.restore();
        text(c, 'COMPUTER JI QUIZ', 282, 124, 28, '#9aa7ff', 'left', 700);
        c.fillStyle = 'rgba(255,255,255,0.1)'; rr(c, W - 470, 50, 400, 78, 39); c.fill();
        text(c, `सवाल ${Math.min(qi + 1, cfg.count)} / ${cfg.count}`, W - 270, 78, 38, '#fff', 'center', 800); text(c, `Question ${Math.min(qi + 1, cfg.count)} of ${cfg.count}`, W - 270, 112, 22, '#9aa7ff', 'center', 600);
        if (warn) text(c, warn === 'no_key' ? 'AI key नहीं मिली — demo सवाल चल रहे हैं (.env में ROUTER_API_KEY डालें)' : 'AI धीमा है — कुछ demo सवाल हैं', W / 2 + 120, 28, 22, '#ff8a00', 'center', 700);

        const Qx = Q[Math.min(qi, Q.length - 1)];   // after the last question the result overlay is drawn on top of this
        if (!Qx) return;
        // ----- question -----
        const qx = 130, qy = 190, qw = 1660, qh = 270;
        c.save(); c.shadowColor = '#9aa7ff'; c.shadowBlur = 30;
        const qg = c.createLinearGradient(0, qy, 0, qy + qh); qg.addColorStop(0, '#16277f'); qg.addColorStop(1, '#0a1149');
        c.fillStyle = qg; hex(c, qx, qy, qw, qh, 70); c.fill(); c.lineWidth = 5; c.strokeStyle = '#d9ccff'; c.stroke(); c.restore();
        let hs = 58, hl, es = 34, el;
        for (hs of [58, 52, 46, 40, 36]) { hl = wrap(c, Qx.hi.q, 1400, 800, hs); if (hl.length <= 2) break; }
        for (es of [34, 30, 26]) { el = wrap(c, Qx.en.q, 1400, 500, es); if (el.length <= 2) break; }
        const lh = hs * 1.28, eh = es * 1.28, tot = hl.length * lh + 16 + el.length * eh;
        let yy = qy + (qh - tot) / 2;
        hl.forEach((ln, k) => text(c, ln, qx + qw / 2, yy + lh * (k + 0.5), hs, '#ffffff', 'center', 800)); yy += hl.length * lh + 16;
        el.forEach((ln, k) => text(c, ln, qx + qw / 2, yy + eh * (k + 0.5), es, '#bcc8ff', 'center', 500));

        // ----- options -----
        const showAns = phase === 'reveal', pulse = 0.5 + 0.5 * Math.sin(t * 8);
        for (let i = 0; i < 4; i++) {
          const ox = 130 + (i % 2) * 860, oy = 505 + (i >> 1) * 165, ow = 800, oh = 130, right = i === Qx.a;
          c.save();
          if (showAns && right) { c.shadowColor = '#7cff4d'; c.shadowBlur = 30 + pulse * 30; c.fillStyle = '#0e7a3b'; c.strokeStyle = '#b6ffa0'; }
          else if (showAns) { c.globalAlpha = 0.45; c.fillStyle = '#0b1659'; c.strokeStyle = '#6d7bd6'; }
          else if (phase === 'suspense') { c.shadowColor = '#ffb300'; c.shadowBlur = 12 + pulse * 18; c.fillStyle = '#2a1d0a'; c.strokeStyle = '#ffb300'; }
          else { c.shadowColor = '#5566ff'; c.shadowBlur = 16; c.fillStyle = '#0b1659'; c.strokeStyle = '#9aa7ff'; }
          hex(c, ox, oy, ow, oh, 44); c.fill(); c.lineWidth = 4; c.stroke(); c.restore();
          c.save(); if (showAns && !right) c.globalAlpha = 0.5;
          c.fillStyle = COL[i]; c.beginPath(); c.arc(ox + 78, oy + oh / 2, 34, 0, TAU); c.fill();
          text(c, LET[i], ox + 78, oy + oh / 2 + 2, 42, '#101040', 'center', 800);
          const hsz = fit(c, Qx.hi.o[i], 520, 700, 40, 24), esz = fit(c, Qx.en.o[i], 520, 500, 28, 20);
          text(c, Qx.hi.o[i], ox + 135, oy + oh / 2 - 17, hsz, '#fff', 'left', 700);
          text(c, Qx.en.o[i], ox + 135, oy + oh / 2 + 25, esz, '#bcc8ff', 'left', 500);
          // who picked it (revealed only after Computer Ji answers)
          if (showAns) { let k = 0; P.forEach((p, pi) => { if (answers[pi] === i && !p.left) { const px = ox + ow - 90 - k * 46, py = oy + oh / 2; c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 12; c.beginPath(); c.arc(px, py, 19, 0, TAU); c.fill(); c.shadowBlur = 0; text(c, (p.name || '?')[0].toUpperCase(), px, py + 1, 22, '#101040', 'center', 800); k++; } }); }
          c.restore();
        }

        // ----- status line -----
        const al = alive(), got = al.filter(i => answers[i] >= 0).length;
        if (phase === 'ask') {
          const all = got === al.length;
          text(c, all ? 'सबने जवाब दे दिया! होस्ट: "कंप्यूटर जी, जवाब बताइए" दबाओ' : `जवाब दिया: ${got} / ${al.length}   ·   Answered: ${got} / ${al.length}`, W / 2, 828, 30, all ? '#7cff4d' : '#ffd36b', 'center', 700);
        } else if (phase === 'suspense') {
          c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 7); text(c, 'कंप्यूटर जी, सही जवाब बताइए…', W / 2, 828, 40, '#ffd36b', 'center', 800); c.globalAlpha = 1;
        } else if (phase === 'reveal') {
          text(c, `सही जवाब: ${LET[Qx.a]}  —  ${Qx.hi.o[Qx.a]}   (${Qx.en.o[Qx.a]})`, W / 2, 828, 34, '#b6ffa0', 'center', 800);
        }

        // ----- players strip -----
        P.forEach((p, i) => {
          const r = chipPos(i), ans = answers[i], left = p.left;
          c.save(); c.globalAlpha = left ? 0.35 : 1;
          c.fillStyle = 'rgba(255,255,255,0.08)'; rr(c, r.x, r.y, r.w, r.h, 22); c.fill();
          c.lineWidth = 3; c.strokeStyle = (phase === 'ask' && ans >= 0) ? '#7cff4d' : 'rgba(255,255,255,0.2)';
          if (phase === 'reveal') c.strokeStyle = lastCorrect.includes(i) ? '#7cff4d' : ans >= 0 ? '#ff6b6b' : 'rgba(255,255,255,0.2)';
          rr(c, r.x, r.y, r.w, r.h, 22); c.stroke();
          c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 14; c.beginPath(); c.arc(r.x + 30, r.y + 32, 16, 0, TAU); c.fill(); c.shadowBlur = 0;
          const nsz = fit(c, p.name + (i === hostIdx ? ' ★' : ''), r.w - 80, 800, 28, 18);
          text(c, p.name + (i === hostIdx ? ' ★' : ''), r.x + 56, r.y + 33, nsz, '#fff', 'left', 800);
          text(c, `स्कोर ${scores[i]}`, r.x + r.w / 2, r.y + 78, 32, '#ffd36b', 'center', 800);
          let st, col;
          if (phase === 'reveal') {
            if (ans < 0) { st = 'जवाब नहीं'; col = '#9aa7ff'; } else if (lastCorrect.includes(i)) { st = `${LET[ans]}  ✓ सही`; col = '#7cff4d'; } else { st = `${LET[ans]}  ✗ गलत`; col = '#ff6b6b'; }
          } else if (phase === 'ask') { if (ans >= 0) { st = '✓ जवाब दिया'; col = '#7cff4d'; } else { st = 'सोच रहा है…'; col = '#9aa7ff'; } }
          else { st = ans >= 0 ? '🔒 लॉक' : '—'; col = '#ffd36b'; if (ans >= 0) st = 'लॉक ✓'; }
          text(c, st, r.x + r.w / 2, r.y + 120, 28, col, 'center', 700);
          c.restore();
        });
        if (hostTouch() && (phase === 'ask' || phase === 'reveal')) {
          c.save();
          c.fillStyle = 'rgba(255,212,0,0.16)'; hex(c, HOST_BAR.x, HOST_BAR.y, HOST_BAR.w, HOST_BAR.h, 26); c.fill();
          c.strokeStyle = '#ffd400'; c.lineWidth = 3; c.shadowColor = '#ffd400'; c.shadowBlur = 14; hex(c, HOST_BAR.x, HOST_BAR.y, HOST_BAR.w, HOST_BAR.h, 26); c.stroke(); c.shadowBlur = 0;
          text(c, phase === 'ask' ? 'कंप्यूटर जी, सही जवाब बताइए ▶' : (qi + 1 >= cfg.count ? 'नतीजा · RESULT' : 'अगला सवाल ▶ NEXT'), W / 2, HOST_BAR.y + HOST_BAR.h / 2 + 1, 26, '#ffd400', 'center', 800);
          c.restore();
        } else if (phase === 'reveal') text(c, hostIdx >= 0 ? `${P[hostIdx].name} (होस्ट): "अगला सवाल" दबाओ` : '', W / 2, 1056, 22, '#8d9bc4', 'center', 600);
        else text(c, 'V = आवाज़ · M = संगीत · F = फुलस्क्रीन', W / 2, 1056, 20, '#6f7cb0', 'center', 600);
      }
    };

    function drawCfg(c) {
      c.save(); c.shadowColor = '#ffb300'; c.shadowBlur = 40; text(c, 'कंप्यूटर जी क्विज़', W / 2, 150, 120, '#ffd36b', 'center', 800); c.restore();
      text(c, 'COMPUTER JI QUIZ  ·  KBC style', W / 2, 240, 40, '#9aa7ff', 'center', 700);
      drawBot(c, W / 2, 420, 1.1, 'idle', t);
      const host = P[hostIdx];
      text(c, `होस्ट · Host: ${host ? host.name : ''} ★  — अपने फोन से चुनो · choose on your phone`, W / 2, 575, 32, '#ffd36b', 'center', 700);
      const items = phase === 'cfg0' ? [['10', 'सवाल · Questions'], ['20', 'सवाल · Questions'], ['30', 'सवाल · Questions']] : [['छोटे', '6-8 साल · years'], ['बड़े', '9-12 साल · years']];
      const cw = 360, gap = 50, tot = items.length * cw + (items.length - 1) * gap, x0 = (W - tot) / 2;
      text(c, phase === 'cfg0' ? 'कितने सवाल खेलोगे? · How many questions?' : 'बच्चों की उम्र? · Kids age?', W / 2, 660, 40, '#fff', 'center', 800);
      items.forEach((it, i) => {
        const x = x0 + i * (cw + gap), y = 710, sel = phase === 'cfg0' ? cfg.count === +it[0] : cfg.age === (i ? 'old' : 'young');
        c.save(); c.shadowColor = COL[i]; c.shadowBlur = sel ? 40 : 14; c.fillStyle = '#0b1659'; c.strokeStyle = COL[i]; c.lineWidth = sel ? 7 : 3; hex(c, x, y, cw, 220, 60); c.fill(); c.stroke(); c.restore();
        text(c, it[0], x + cw / 2, y + 100, it[0].length > 3 ? 74 : 110, '#fff', 'center', 800); text(c, it[1], x + cw / 2, y + 178, 28, '#bcc8ff', 'center', 600);
      });
      text(c, `खिलाड़ी · Players: ${alive().length}`, W / 2, 1020, 26, '#8d9bc4', 'center', 600);
    }
    function drawLoad(c) {
      drawBot(c, W / 2, 400, 1.6, 'think', t);
      const d = '.'.repeat(1 + Math.floor(t * 2.5) % 3);
      text(c, 'कंप्यूटर जी सवाल तैयार कर रहे हैं' + d, W / 2, 700, 62, '#ffd36b', 'center', 800);
      text(c, 'Computer Ji is preparing fresh questions' + d, W / 2, 780, 36, '#bcc8ff', 'center', 600);
      if (fails > 0) text(c, `फिर कोशिश कर रहे हैं… (${fails})`, W / 2, 860, 28, '#ff8a00', 'center', 700);
    }
  }
});
})();
