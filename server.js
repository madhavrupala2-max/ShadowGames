'use strict';
// Arcade server: static files + WebSocket room relay (host screen <-> phone controllers)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const ai = require('./server/ai');

const PORT = +process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'
};
const rooms = new Map();

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}
function newCode() {
  let c;
  do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(c));
  return c;
}
// ---- plugin games: every folder in public/games/<id>/ with a manifest.json (folders starting with _ are ignored)
function listGames() {
  const dir = path.join(PUB, 'games'), out = [];
  let names = []; try { names = fs.readdirSync(dir); } catch (e) {}
  for (const id of names) {
    if (id.startsWith('_') || id.startsWith('.') || !/^[A-Za-z0-9_-]+$/.test(id)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, id, 'manifest.json'), 'utf8'));
      const type = m.type === 'html' ? 'html' : 'canvas';
      const entry = String(m.entry || (type === 'html' ? 'index.html' : 'game.js'));
      if (entry.includes('..') || !fs.existsSync(path.join(dir, id, entry))) { console.warn('  [games] skipped ' + id + ': entry not found'); continue; }
      out.push(Object.assign({ name: id.toUpperCase(), tag: '', color: '#22d3ee', min: 1, max: 8, order: 100 }, m, { id, type, entry, base: '/games/' + id + '/' }));
    } catch (e) { console.warn('  [games] skipped ' + id + ': ' + e.message); }
  }
  return out.sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name)));
}
const rl = []; // global rate limit for the AI endpoint (protects your key): 40 calls / minute
function rateOk() { const n = Date.now(); while (rl.length && n - rl[0] > 60000) rl.shift(); if (rl.length >= 40) return false; rl.push(n); return true; }
function readBody(req, max = 30000) {
  return new Promise((ok, no) => { let b = '', n = 0; req.on('data', d => { n += d.length; if (n > max) { no(new Error('too big')); req.destroy(); } else b += d; }); req.on('end', () => ok(b)); req.on('error', no); });
}
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };

const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/games.json') return json(res, 200, listGames());
    if (u.pathname === '/api/health') return json(res, 200, { ai: ai.hasKey() });
    if (u.pathname === '/api/questions') {
      if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
      if (!rateOk()) return json(res, 429, { error: 'slow down' });
      let body = {}; try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) { return json(res, 400, { error: 'bad json' }); }
      return json(res, 200, await ai.getQuestions(body));
    }
    if (u.pathname === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ lan: lanIPs()[0] || null, port: PORT }));
    }
    if (u.pathname === '/qr') {
      const png = await QRCode.toBuffer((u.searchParams.get('data') || '').slice(0, 300), { width: 400, margin: 1 });
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(png);
    }
    const p = u.pathname === '/' ? '/host.html' : u.pathname === '/c' ? '/controller.html' : u.pathname;
    const f = path.normalize(path.join(PUB, p));
    if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(d);
    });
  } catch (e) { res.writeHead(500); res.end('error'); }
});

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'host') {
      let room = m.code && rooms.get(m.code);
      if (room && !room.host) { clearTimeout(room.killT); }
      else { room = { code: newCode(), host: null, players: new Map(), killT: null }; rooms.set(room.code, room); }
      room.host = ws; ws.room = room; ws.role = 'host';
      send(ws, { t: 'room', code: room.code });
      for (const p of room.players.values()) send(ws, { t: 'join', id: p.id, name: p.name, re: true });
      return;
    }

    if (m.t === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room || !room.host) return send(ws, { t: 'err', msg: 'Room not found. Check the code on the big screen.' });
      let p = m.token && [...room.players.values()].find(x => x.token === m.token);
      if (p) {
        if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch {} }
        clearTimeout(p.dropT); p.ws = ws;
        send(room.host, { t: 'rejoin', id: p.id });
      } else {
        if (room.players.size >= 8) return send(ws, { t: 'err', msg: 'Room is full (8 players max).' });
        let id = 0; while (room.players.has(id)) id++;
        p = { id, name: String(m.name || 'Player').slice(0, 10) || 'Player', token: crypto.randomUUID(), ws, dropT: null };
        room.players.set(id, p);
        send(room.host, { t: 'join', id, name: p.name });
      }
      ws.room = room; ws.role = 'ctl'; ws.pid = p.id;
      send(ws, { t: 'joined', id: p.id, name: p.name, token: p.token });
      return;
    }

    const room = ws.room;
    if (!room) return;
    if (m.t === 'in' && ws.role === 'ctl') {
      send(room.host, { t: 'in', id: ws.pid, k: m.k, x: m.x, y: m.y, b: m.b, v: m.v });
    } else if (m.t === 'to' && ws.role === 'host') {
      if (m.id == null) { for (const p of room.players.values()) send(p.ws, m.msg); }
      else { const p = room.players.get(m.id); if (p) send(p.ws, m.msg); }
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (!room) return;
    if (ws.role === 'host' && room.host === ws) {
      room.host = null;
      for (const p of room.players.values()) send(p.ws, { t: 'hostgone' });
      room.killT = setTimeout(() => {
        rooms.delete(room.code);
        for (const p of room.players.values()) { try { p.ws && p.ws.close(); } catch {} }
      }, 60000);
    }
    if (ws.role === 'ctl') {
      const p = room.players.get(ws.pid);
      if (p && p.ws === ws) {
        p.ws = null;
        p.dropT = setTimeout(() => { room.players.delete(p.id); send(room.host, { t: 'leave', id: p.id }); }, 12000);
      }
    }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; try { ws.ping(); } catch {}
  }
}, 15000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ARCADE is running!\n');
  console.log('  Big screen (laptop / TV browser):  http://localhost:' + PORT);
  const ips = lanIPs();
  if (ips.length) console.log('  Phones (same Wi-Fi) will auto-open:  http://' + ips[0] + ':' + PORT + '/c');
  console.log(ai.hasKey() ? '  AI questions: ON  (key found)' : '  AI questions: OFF - add ROUTER_API_KEY in .env (see .env.example); demo questions will be used');
  console.log('  Games loaded: ' + listGames().map(g => g.id).join(', '));
  console.log('');
});
