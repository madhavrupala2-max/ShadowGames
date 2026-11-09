'use strict';
// Shadow Arcade server: static files + WebSocket room relay + auto game list + Gemini quiz API
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// tiny .env loader (no extra dependency)
try {
  for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch (e) { /* no .env file - fine */ }

const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const quiz = require('./quiz');

const PORT = +process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const GAMES_DIR = path.join(PUB, 'js', 'games');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webp': 'image/webp', '.jpg': 'image/jpeg'
};
const rooms = new Map();

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; } while (rooms.has(c));
  return c;
}
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
function readBody(req, max = 40000) {
  return new Promise((ok, bad) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > max) { bad(new Error('too big')); req.destroy(); } });
    req.on('end', () => ok(s));
    req.on('error', bad);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/info') return json(res, 200, { lan: lanIPs()[0] || null, port: PORT, gemini: quiz.hasKey() });
    if (u.pathname === '/games.json') {
      // every .js in public/js/games (not starting with "_") is a game - drop a file in, it shows up.
      let list = [];
      try { list = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.js') && !f.startsWith('_')).sort(); } catch (e) {}
      return json(res, 200, list);
    }
    if (u.pathname === '/api/quiz' && req.method === 'POST') {
      let b = {}; try { b = JSON.parse(await readBody(req)); } catch (e) {}
      return json(res, 200, await quiz.getQuestions(b.count, b.avoid));
    }
    if (u.pathname === '/qr') {
      const png = await QRCode.toBuffer((u.searchParams.get('data') || '').slice(0, 300), { width: 400, margin: 1 });
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(png);
    }
    const p = u.pathname === '/' ? '/host.html' : u.pathname === '/c' ? '/controller.html' : decodeURIComponent(u.pathname);
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
  console.log('\n  SHADOW ARCADE is running!\n');
  console.log('  Big screen (laptop / TV browser):  http://localhost:' + PORT);
  const ips = lanIPs();
  if (ips.length) console.log('  Phones (same Wi-Fi) will auto-open:  http://' + ips[0] + ':' + PORT + '/c');
  console.log(quiz.hasKey() ? '  Quiz questions: Gemini AI (key found)' : '  Quiz questions: OFFLINE bank only - add GEMINI_API_KEY in .env for unlimited AI questions');
  console.log('');
});
