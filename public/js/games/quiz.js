// GYANI QUIZ - KBC-style family quiz. Everybody answers (no time limit), the screen shows WHO has answered
// (not what). The host (player 1) presses "COMPUTER JI" to reveal the right answer, then everyone's picks show.
// Questions come from Gemini via /api/quiz (nothing stored; repeats avoided). Hindi + English everywhere.
(() => {
const { W, H, TAU, rr, text, wrap, fx, sfx } = AX;
const LET = ['A', 'B', 'C', 'D'], OPT_COL = ['#ff3d71', '#22d3ee', '#ffd400', '#7cff4d'];
const GOLD = '#ffd36a', NAVY = '#0a1650';

// in-session memory only (so replays don't repeat questions)
let asked = [];
try { asked = JSON.parse(sessionStorage.getItem('gq_asked') || '[]'); } catch (e) {}
function remember(q) { asked.push(q); asked = asked.slice(-120); try { sessionStorage.setItem('gq_asked', JSON.stringify(asked)); } catch (e) {} }

function hex(c, x, y, w, h) {
  const k = h / 2;
  c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w - k, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + k); c.closePath();
}
const OPT = i => ({ x: 120 + (i % 2) * 870, y: 470 + Math.floor(i / 2) * 135, w: 810, h: 108 });

const ANS_LAYOUT = (host, hint) => ({
  stick: false, grid: true, rows: host ? 3 : 2, hint,
  buttons: [0, 1, 2, 3].map(i => ({ id: 'abcd'[i], label: LET[i], color: OPT_COL[i] })).concat(host ? [{ id: 'h', label: '💻 COMPUTER JI, JAWAB BATAYIYE', color: '#ffd400', full: true }] : [])
});

AX.register({
  id: 'quiz', name: 'GYANI QUIZ', tag: 'KBC style · Hindi + English|AI ke naye sawal, har baar', color: '#ffd36a', min: 2, max: 8, order: 1,
  layout: ANS_LAYOUT(false, 'A B C D = jawab chuno'),
  art(c, w, h, t) {
    const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 220); g.addColorStop(0, '#1c2f9a'); g.addColorStop(1, '#050a2a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h / 2 - 20);
    for (let k = 0; k < 3; k++) { c.save(); c.rotate(t * 0.15 * (k % 2 ? 1 : -1)); c.strokeStyle = `rgba(255,211,106,${0.5 - k * 0.12})`; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, r = 60 + k * 26; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.stroke(); c.restore(); }
    c.shadowColor = GOLD; c.shadowBlur = 24; text(c, '?', 0, 4, 110, GOLD, 'center', 900); c.restore();
    for (let i = 0; i < 4; i++) { c.fillStyle = OPT_COL[i]; c.globalAlpha = 0.85; hex(c, 20 + (i % 2) * 140, 190 + Math.floor(i / 2) * 36 - 20, 130, 28); c.fill(); } c.globalAlpha = 1;
  },
  create(env) {
    const ps = env.players, n = ps.length, host = ps[0];
    const score = ps.map(() => 0), ans = ps.map(() => -1);
    let phase = 'setup', phaseT = 0, t = 0, N = 0, idx = -1, qs = [], requested = 0, exhausted = false, fetching = false, beat = 0, right = false;
    const letterOf = i => LET[i];

    function setPhase(p) { phase = p; phaseT = 0; env.relayout(); }

    async function fetchMore() {
      if (fetching || exhausted || requested >= N) return;
      fetching = true;
      const cnt = Math.min(10, N - requested);
      try {
        const r = await fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: cnt, avoid: asked.concat(qs.map(q => q.qe)) }) });
        const j = await r.json();
        for (const q of j.questions || []) { qs.push(q); remember(q.qe); }
        if (!j.questions || j.questions.length < cnt) { exhausted = true; N = qs.length; } else requested += cnt;
      } catch (e) { exhausted = true; N = qs.length; }
      fetching = false;
    }

    function nextQ() {
      idx++;
      if (idx >= N) return finish();
      if (idx >= qs.length) { setPhase('loading'); return; }
      ans.fill(-1); setPhase('ask');
      const q = qs[idx]; env.speak([[q.qh, 'hi-IN'], [q.qe, 'en-IN']]);
    }
    function reveal() {
      const q = qs[idx]; right = false;
      ps.forEach((p, i) => { if (ans[i] === q.a) { score[i]++; right = true; } });
      setPhase('reveal');
      if (right) { sfx.right(); } else { sfx.wrong(); }
      const o = OPT(q.a); fx.burst(o.x + o.w / 2, o.y + o.h / 2, '#7cff4d', right ? 60 : 12, 520, 1, 6); fx.ring(o.x + o.w / 2, o.y + o.h / 2, '#7cff4d', 260, 0.8);
      env.speak([[`सही जवाब है, ऑप्शन ${letterOf(q.a)}, ${q.oh[q.a]}`, 'hi-IN'], [`The correct answer is option ${letterOf(q.a)}, ${q.oe[q.a]}`, 'en-IN']]);
    }
    function finish() {
      const order = ps.map((p, i) => ({ p, s: score[i] })).sort((a, b) => b.s - a.s);
      const total = Math.max(1, N);
      env.speak([[`खेल खत्म! विजेता है ${order[0].p.name}`, 'hi-IN'], [`Game over! The winner is ${order[0].p.name}`, 'en-IN']]);
      env.end({ title: 'QUIZ KHATAM!', color: GOLD, sub: `Kul ${total} sawal · Winner: ${order[0].p.name}`, lines: order.map(o => ({ name: o.p.name, color: o.p.color, text: `${o.s} / ${total}` })) });
    }

    return {
      layoutFor(p) {
        const isHost = p === host;
        if (phase === 'setup') return isHost
          ? { stick: false, grid: true, rows: 3, hint: 'Kitne sawal khelne hain?', buttons: [{ id: 'a', label: '10 सवाल', color: '#22d3ee' }, { id: 'b', label: '20 सवाल', color: '#ffd400' }, { id: 'c', label: '30 सवाल', color: '#ff3d71' }] }
          : { stick: false, buttons: [], hint: 'Host sawalon ki ginti chun raha hai…' };
        if (phase === 'ask') return ANS_LAYOUT(isHost, isHost ? 'Sab jawab dein, phir COMPUTER JI dabayein' : 'A B C D = jawab chuno (badal sakte ho)');
        if (phase === 'reveal') {
          const q = qs[idx], i = ps.indexOf(p);
          if (isHost) return { stick: false, buttons: [{ id: 'h', label: idx + 1 >= N ? 'RESULT ▶' : 'AGLA SAWAL ▶', color: '#7cff4d' }], hint: `Sahi jawab: ${letterOf(q.a)}` };
          return { stick: false, buttons: [], hint: ans[i] === q.a ? 'Sahi jawab! 🎉' : `Sahi jawab: ${letterOf(q.a)}` };
        }
        return { stick: false, buttons: [], hint: phase === 'suspense' ? 'Computer ji soch rahe hain…' : 'Sawal aa raha hai…' };
      },
      update(dt, pl) {
        t += dt; phaseT += dt;
        if (phase === 'setup') {
          const h = pl[0];
          const pick = h.hit.a ? 10 : h.hit.b ? 20 : h.hit.c ? 30 : 0;
          if (pick) { N = pick; sfx.coin(); setPhase('loading'); fetchMore(); nextQ(); }
          return;
        }
        if (idx + 1 + 3 >= qs.length) fetchMore();           // keep the queue topped up
        if (phase === 'loading') {
          if (idx < qs.length) { if (idx >= 0 && idx < N) { ans.fill(-1); setPhase('ask'); const q = qs[idx]; env.speak([[q.qh, 'hi-IN'], [q.qe, 'en-IN']]); } }
          else if (exhausted) finish();
          return;
        }
        if (phase === 'ask') {
          ps.forEach((p, i) => {
            if (p.left) return;
            for (let k = 0; k < 4; k++) if (p.hit['abcd'[k]]) { if (ans[i] === -1) sfx.pop(); ans[i] = k; }
          });
          if (pl[0].hit.h) { setPhase('suspense'); sfx.lock(); env.speak([[`कंप्यूटर जी, जवाब बताइए`, 'hi-IN']]); beat = 0; }
        } else if (phase === 'suspense') {
          beat -= dt; if (beat <= 0) { sfx.heartbeat(); beat = 0.8; }
          if (phaseT > 3.4) reveal();
        } else if (phase === 'reveal') {
          if (phaseT > 0.5 && pl[0].hit.h) nextQ();
        }
      },
      draw(c) {
        // KBC-like stage
        const g = c.createRadialGradient(W / 2, 400, 80, W / 2, 500, 1300); g.addColorStop(0, '#1b2f9c'); g.addColorStop(0.55, '#0a1650'); g.addColorStop(1, '#03061c');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.save(); c.globalAlpha = 0.07; c.translate(W / 2, 330);
        for (let i = 0; i < 14; i++) { c.rotate(TAU / 14); c.fillStyle = i % 2 ? '#fff' : '#6a8bff'; c.beginPath(); c.moveTo(0, 0); c.lineTo(1500, -90); c.lineTo(1500, 90); c.closePath(); c.fill(); }
        c.restore();
        // header
        text(c, 'GYANI QUIZ', 120, 56, 40, GOLD, 'left', 900);
        if (phase !== 'setup' && N) text(c, `सवाल / Question  ${Math.min(idx + 1, N)} / ${N}`, W - 120, 56, 34, '#fff', 'right', 800);
        text(c, `Host: ${host.name}`, W / 2, 56, 26, '#9fb0d6', 'center', 700);

        if (phase === 'setup') {
          text(c, 'कितने सवाल खेलना है?', W / 2, 250, 78, '#fff', 'center', 900);
          text(c, 'How many questions?', W / 2, 330, 42, GOLD, 'center', 700);
          [10, 20, 30].forEach((v, i) => {
            const x = 330 + i * 460; c.save(); c.shadowColor = OPT_COL[[1, 2, 0][i]]; c.shadowBlur = 30; c.fillStyle = 'rgba(10,22,80,0.9)'; hex(c, x, 450, 400, 150); c.fill();
            c.strokeStyle = GOLD; c.lineWidth = 5; c.stroke(); c.restore();
            text(c, String(v), x + 200, 520, 90, '#fff', 'center', 900); text(c, 'सवाल', x + 200, 580, 30, '#cdd7f5', 'center', 700);
          });
          text(c, `${host.name}  apne phone par 10 / 20 / 30 dabaye`, W / 2, 720, 36, '#cdd7f5', 'center', 700);
          text(c, 'Sabhi players jawab denge · koi time limit nahi · naye sawal AI banata hai', W / 2, 800, 28, '#8d9bc4', 'center', 600);
        } else if (phase === 'loading' || idx < 0 || !qs[idx]) {
          const k = Math.floor(t * 3) % 4;
          text(c, 'कंप्यूटर जी नया सवाल सोच रहे हैं' + '.'.repeat(k), W / 2, 480, 54, '#fff', 'center', 800, W - 200);
          text(c, 'Computer ji is thinking of a new question', W / 2, 560, 32, GOLD, 'center', 700);
        } else {
          const q = qs[idx];
          // question
          c.save(); c.shadowColor = '#5d7bff'; c.shadowBlur = 30; c.fillStyle = 'rgba(8,16,70,0.92)'; hex(c, 90, 115, 1740, 300); c.fill(); c.strokeStyle = GOLD; c.lineWidth = 5; c.stroke(); c.restore();
          const lh = wrap(c, q.qh, 50, 800, 1560).slice(0, 2), le = wrap(c, q.qe, 34, 600, 1560).slice(0, 2);
          const total = lh.length * 62 + le.length * 44, y0 = 265 - total / 2 + 31;
          lh.forEach((l, i) => text(c, l, W / 2, y0 + i * 62, 50, '#fff', 'center', 800, 1580));
          le.forEach((l, i) => text(c, l, W / 2, y0 + lh.length * 62 + 12 + i * 44, 34, '#ffe9a8', 'center', 600, 1580));
          // options
          const correct = (phase === 'reveal') ? q.a : -1;
          for (let i = 0; i < 4; i++) {
            const o = OPT(i); const isC = correct === i, dim = correct >= 0 && !isC;
            c.save(); c.globalAlpha = dim ? 0.4 : 1;
            if (isC) { c.shadowColor = '#7cff4d'; c.shadowBlur = 40 + Math.sin(t * 10) * 14; } else { c.shadowColor = '#5d7bff'; c.shadowBlur = 14; }
            c.fillStyle = isC ? '#12803a' : 'rgba(8,16,70,0.95)'; hex(c, o.x, o.y, o.w, o.h); c.fill();
            c.strokeStyle = isC ? '#b6ffb0' : GOLD; c.lineWidth = isC ? 6 : 3.5; c.stroke(); c.shadowBlur = 0;
            text(c, LET[i] + ':', o.x + 70, o.y + o.h / 2, 40, OPT_COL[i], 'center', 900);
            text(c, q.oh[i], o.x + 120, o.y + o.h / 2 - 17, 38, '#fff', 'left', 800, o.w - 330);
            text(c, q.oe[i], o.x + 120, o.y + o.h / 2 + 24, 27, '#cfd8ff', 'left', 600, o.w - 330);
            c.restore();
            if (phase === 'reveal') { // show who picked what
              let k = 0; ps.forEach((p, pi) => { if (ans[pi] === i) { const px = o.x + o.w - 54 - k * 42, py = o.y + o.h / 2; k++;
                c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 12; c.beginPath(); c.arc(px, py, 19, 0, TAU); c.fill(); c.shadowBlur = 0;
                text(c, p.name.slice(0, 1).toUpperCase(), px, py + 1, 22, '#06121a', 'center', 900); } });
            }
          }
          // suspense banner
          if (phase === 'suspense') {
            c.save(); c.globalAlpha = 0.9; c.fillStyle = 'rgba(3,6,28,0.82)'; c.fillRect(0, 380, W, 100);
            c.shadowColor = GOLD; c.shadowBlur = 25 + Math.sin(t * 8) * 10;
            text(c, 'कंप्यूटर जी, जवाब बताइए…  ·  Computer ji, please tell the answer…', W / 2, 430, 42, GOLD, 'center', 800, W - 160); c.restore();
          }
          if (phase === 'reveal') text(c, right ? 'शाबाश! सही जवाब 🎉' : 'अरे! कोई सही नहीं बता पाया', W / 2, 441, 34, right ? '#7cff4d' : '#ff8a6a', 'center', 800);
          // players strip
          ps.forEach((p, i) => {
            const x = 120 + (i % 4) * 425, y = 770 + Math.floor(i / 4) * 100;
            const done = ans[i] >= 0, ok = phase === 'reveal' && ans[i] === q.a, bad = phase === 'reveal' && done && !ok;
            c.fillStyle = 'rgba(8,16,70,0.9)'; rr(c, x, y, 400, 84, 42); c.fill();
            c.lineWidth = 3; c.strokeStyle = ok ? '#7cff4d' : bad ? '#ff5a6a' : done ? GOLD : 'rgba(255,255,255,0.2)'; rr(c, x, y, 400, 84, 42); c.stroke();
            c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 14; c.beginPath(); c.arc(x + 42, y + 42, 22, 0, TAU); c.fill(); c.shadowBlur = 0;
            text(c, p.name + (p === host ? ' ★' : ''), x + 80, y + 28, 28, '#fff', 'left', 800, 190);
            text(c, `★ ${score[i]}`, x + 80, y + 59, 24, GOLD, 'left', 800);
            const st = phase === 'reveal' ? (ok ? '✔ सही' : done ? '✘ गलत' : '— ') : done ? '✔ जवाब दिया' : 'सोच रहा…';
            text(c, st, x + 385, y + 42, 24, ok ? '#7cff4d' : bad ? '#ff8a8a' : done ? '#ffd36a' : '#7e8bb8', 'right', 800, 160);
          });
          if (phase === 'ask') {
            const cnt = ans.filter(a => a >= 0).length;
            text(c, `${cnt} / ${n} ne jawab diya  ·  ${host.name}: "COMPUTER JI" dabaye`, W / 2, 1040, 24, '#9fb0d6', 'center', 700);
          } else if (phase === 'reveal') text(c, `${host.name}: "AGLA SAWAL" dabaye`, W / 2, 1040, 24, '#9fb0d6', 'center', 700);
        }
      }
    };
  }
});
})();
