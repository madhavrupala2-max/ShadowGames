'use strict';
// Quiz question generator: Gemini (REST, same as curl) -> falls back to a tiny offline bank.
// Nothing is stored on disk. Repeats are avoided by the client sending the list of already-asked questions.
const { fallbackBank } = require('./questions-fallback');

const TOPICS = [
  'जानवर / Animals', 'फल और सब्ज़ियाँ / Fruits & vegetables', 'भारत / India', 'अंतरिक्ष / Space',
  'आसान विज्ञान / Easy science', 'खेल / Sports', 'त्योहार / Festivals', 'रंग और आकार / Colours & shapes',
  'आसान गणित / Easy maths', 'प्रकृति / Nature', 'हमारा शरीर / Human body', 'पक्षी / Birds',
  'कहानियाँ और कार्टून / Stories & cartoons', 'दुनिया / World geography', 'गाड़ियाँ / Vehicles', 'खाना / Food'
];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();

// validate + shuffle options (keeps the correct index in sync)
function clean(raw) {
  const out = [];
  for (const q of Array.isArray(raw) ? raw : []) {
    if (!q || typeof q.qh !== 'string' || typeof q.qe !== 'string') continue;
    if (!Array.isArray(q.oh) || !Array.isArray(q.oe) || q.oh.length !== 4 || q.oe.length !== 4) continue;
    const a = Number(q.a);
    if (!Number.isInteger(a) || a < 0 || a > 3) continue;
    if (new Set(q.oe.map(norm)).size < 4) continue;
    const idx = shuffle([0, 1, 2, 3]);
    out.push({
      qh: q.qh.trim().slice(0, 220), qe: q.qe.trim().slice(0, 220),
      oh: idx.map(i => String(q.oh[i]).trim().slice(0, 60)), oe: idx.map(i => String(q.oe[i]).trim().slice(0, 60)),
      a: idx.indexOf(a)
    });
  }
  return out;
}

async function fromGemini(count, avoid) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const topics = shuffle(TOPICS.slice()).slice(0, 6).join(', ');
  const avoidTxt = avoid.length ? `\nDo NOT repeat or rephrase any of these earlier questions:\n${avoid.slice(-100).join(' | ')}\n` : '';
  const prompt =
`You are the quiz master of a fun KBC-style family quiz for children aged 6 to 12 in India.
Create exactly ${count} NEW multiple-choice general-knowledge questions.
Rules:
- Easy and kid-friendly, simple words, one clearly correct answer, 4 short options each.
- Every question and every option must be given in Hindi (Devanagari script) AND in English.
- Mix these topics: ${topics}.
- Put the correct answer at a random position (not always the same).
- Facts must be true and not opinion based.${avoidTxt}
Return ONLY a JSON array, no markdown, in this exact shape:
[{"qh":"Hindi question","qe":"English question","oh":["h1","h2","h3","h4"],"oe":["e1","e2","e3","e4"],"a":0}]
where "a" is the index (0-3) of the correct option.`;

  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 1, responseMimeType: 'application/json' } })
    });
    if (!r.ok) throw new Error('Gemini HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || [];
    const txt = parts.map(p => p.text || '').join('').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    return clean(JSON.parse(txt));
  } finally { clearTimeout(to); }
}

let warned = false;
async function getQuestions(count, avoidList) {
  count = Math.max(1, Math.min(10, Math.floor(+count || 10)));
  const avoid = (Array.isArray(avoidList) ? avoidList : []).map(x => String(x).slice(0, 200));
  const seen = new Set(avoid.map(norm));
  const out = []; let source = 'gemini';
  const take = list => { for (const q of list) { const k = norm(q.qe); if (!seen.has(k) && out.length < count) { seen.add(k); out.push(q); } } };
  try { take(await fromGemini(count, avoid)); }
  catch (e) { if (!warned || process.env.QUIZ_DEBUG) { console.log('  [quiz] Gemini not used:', e.message); warned = true; } source = 'offline'; }
  if (out.length < count) { if (out.length) source = 'mixed'; else source = 'offline'; take(shuffle(clean(fallbackBank()))); }
  return { questions: out, source };
}

module.exports = { getQuestions, hasKey: () => !!process.env.GEMINI_API_KEY };
