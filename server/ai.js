'use strict';
// Question generator: asks an OpenAI-compatible endpoint for bilingual (Hindi + English) kids questions.
const fs = require('fs');
const path = require('path');
const FALLBACK = require('./fallback');

(function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) { /* no .env is fine */ }
})();

const cfg = () => ({
  url: process.env.AI_URL || 'https://apishadow.zerodeal.in/v1/chat/completions',
  model: process.env.AI_MODEL || 'auto:free',
  key: (process.env.ROUTER_API_KEY || '').trim()
});
const hasKey = () => { const k = cfg().key; return !!k && k !== 'YOUR_ROUTER_API_KEY'; };

const TOPICS = ['animals', 'birds', 'fruits & vegetables', 'colours & shapes', 'our body', 'space & planets', 'India & its states', 'Indian festivals', 'famous Indian places', 'nature & weather', 'easy maths', 'sports', 'transport', 'food of India', 'cartoon-free general knowledge', 'seasons', 'water & earth', 'insects', 'professions', 'days, months & time'];
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();
const DEV = /[ऀ-ॿ]/, LAT = /[A-Za-z0-9]/;

function buildPrompt(n, age, avoid) {
  const ageText = age === 'old' ? '9 to 12 years (still easy, a bit more thinking)' : '6 to 8 years (very easy)';
  const topics = shuffle(TOPICS.slice()).slice(0, 7).join(', ');
  const used = avoid.slice(-60).map(s => String(s).slice(0, 90)).join(' | ');
  return [
    { role: 'system', content: 'You are a friendly quiz master writing safe, simple, fun questions for Indian children in the style of a KBC (Kaun Banega Crorepati) game. Reply with ONLY a JSON array. No markdown, no commentary.' },
    { role: 'user', content: `Write ${n} multiple-choice questions for children aged ${ageText}.
Mix these topics: ${topics}.
Rules:
- Easy, factual, exactly ONE clearly correct answer, 4 short options each. No trick questions. Nothing scary, political or controversial.
- Every question must be given in BOTH Hindi (Devanagari script) and English. Options must be in the SAME order in both languages.
- Do not repeat or closely resemble these already used questions: ${used || '(none)'}
- Variety seed: ${Math.random().toString(36).slice(2, 8)}
JSON format: [{"hi":{"q":"...","o":["...","...","...","..."]},"en":{"q":"...","o":["...","...","...","..."]},"a":0}]
"a" is the index (0-3) of the correct option.` }
  ];
}

function parseJsonArray(text) {
  let s = String(text || '').replace(/```(?:json)?/gi, '');
  const a = s.indexOf('['), b = s.lastIndexOf(']');
  if (a >= 0 && b > a) { try { const v = JSON.parse(s.slice(a, b + 1)); if (Array.isArray(v)) return v; } catch (e) {} }
  const o1 = s.indexOf('{'), o2 = s.lastIndexOf('}');
  if (o1 >= 0 && o2 > o1) { try { const v = JSON.parse(s.slice(o1, o2 + 1)); const arr = v.questions || v.data; if (Array.isArray(arr)) return arr; } catch (e) {} }
  return [];
}

function cleanLang(x) {
  if (!x || typeof x !== 'object') return null;
  const q = String(x.q ?? x.question ?? '').trim(), o = x.o ?? x.options;
  if (!q || q.length > 220 || !Array.isArray(o) || o.length !== 4) return null;
  const opts = o.map(v => String(v ?? '').trim());
  if (opts.some(v => !v || v.length > 70) || new Set(opts.map(norm)).size !== 4) return null;
  return { q, o: opts };
}
function cleanQuestion(it) {
  if (!it || typeof it !== 'object') return null;
  const hi = cleanLang(it.hi ?? it.hindi), en = cleanLang(it.en ?? it.english);
  if (!hi || !en || !DEV.test(hi.q) || !LAT.test(en.q)) return null;
  let a = it.a ?? it.answer ?? it.correct;
  if (typeof a === 'string' && /^[A-Da-d]$/.test(a.trim())) a = a.trim().toUpperCase().charCodeAt(0) - 65;
  a = Number(a);
  if (!Number.isInteger(a) || a < 0 || a > 3) return null;
  const perm = shuffle([0, 1, 2, 3]);       // shuffle so the right answer isn't always the same letter
  return { hi: { q: hi.q, o: perm.map(i => hi.o[i]) }, en: { q: en.q, o: perm.map(i => en.o[i]) }, a: perm.indexOf(a) };
}

async function callAI(messages) {
  const c = cfg(), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 75000);
  try {
    const r = await fetch(c.url, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Authorization': 'Bearer ' + c.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: c.model, messages, temperature: 1 })
    });
    if (!r.ok) throw new Error('AI HTTP ' + r.status);
    const j = await r.json();
    const content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!content) throw new Error('AI empty reply');
    return content;
  } finally { clearTimeout(t); }
}

async function getQuestions({ count = 5, age = 'young', avoid = [] }) {
  count = Math.max(1, Math.min(10, Math.floor(+count) || 5));
  age = age === 'old' ? 'old' : 'young';
  avoid = (Array.isArray(avoid) ? avoid : []).slice(-150).map(String);
  const seen = new Set(avoid.map(norm));
  const out = [];
  let warn = null, source = 'ai';

  const take = q => { const k = norm(q.en.q); if (seen.has(k) || seen.has(norm(q.hi.q))) return; seen.add(k); seen.add(norm(q.hi.q)); out.push(q); };

  if (!hasKey()) { warn = 'no_key'; source = 'fallback'; }
  else {
    for (let attempt = 0; attempt < 3 && out.length < count; attempt++) {
      try {
        const need = Math.min(12, count - out.length + 2);
        const text = await callAI(buildPrompt(need, age, avoid.concat(out.map(q => q.en.q))));
        for (const it of parseJsonArray(text)) { const q = cleanQuestion(it); if (q) take(q); if (out.length >= count) break; }
      } catch (e) { warn = 'ai_error: ' + (e.name === 'AbortError' ? 'timeout' : e.message); }
    }
    if (out.length < count) source = out.length ? 'mixed' : 'fallback';
  }
  if (out.length < count) {
    for (const f of shuffle(FALLBACK.slice())) { if (out.length >= count) break; const q = cleanQuestion({ hi: f.hi, en: f.en, a: f.a }); if (q) take(q); }
    if (!warn) warn = 'ai_short';
  }
  return { questions: out.slice(0, count), source, warn };
}

module.exports = { getQuestions, hasKey, _test: { cleanQuestion, parseJsonArray } };
