// SHADOW Arcade direct-touch input (phones/tablets playing ON the big screen page).
// Separate from the remote controller (/c): here the game screen itself is touched.
// Only games that opt in (manifest "touch": true) receive events, through hooks on the
// object create() returns:  touchStart / touchMove / touchEnd (player, x, y, pointerId, downCount)
// in logical 1920x1080 coords. Menu taps and result-screen taps are handled by core.js.
(() => {
'use strict';
if (!window.AX || !AX.isTouch) return;

const canvas = document.getElementById('c');
const down = new Map();   // pointerId -> true
let gestured = false;

function lockLandscape() {
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}
function gesture() {
  if (gestured) return; gestured = true;
  // Android only allows orientation lock inside fullscreen, so enter fullscreen first
  try {
    const p = document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen() : Promise.resolve();
    Promise.resolve(p).then(lockLandscape, lockLandscape);
  } catch (e) { lockLandscape(); }
}
function logical(e) {
  const v = AX.view();
  return { x: (e.clientX * v.cssScale - v.ox) / v.scale, y: (e.clientY * v.cssScale - v.oy) / v.scale };
}
function target() {
  if (AX.state() !== 'play') return null;
  const g = AX.game(), p = AX.touchPlayer();
  return g && p ? { g, p } : null;
}

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  AX.ensureAudio(); gesture();
  const t = target(); if (!t || down.has(e.pointerId)) return;
  down.set(e.pointerId, true);
  const c = logical(e);
  if (t.g.touchStart) t.g.touchStart(t.p, c.x, c.y, e.pointerId, down.size);
});
canvas.addEventListener('pointermove', e => {
  if (!down.has(e.pointerId)) return;
  const t = target(); if (!t) return;
  const c = logical(e);
  if (t.g.touchMove) t.g.touchMove(t.p, c.x, c.y, e.pointerId, down.size);
});
function lift(e) {
  if (!down.delete(e.pointerId)) return;
  const t = target(); if (!t) return;
  const c = logical(e);
  if (t.g.touchEnd) t.g.touchEnd(t.p, c.x, c.y, e.pointerId, down.size);
}
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);
window.addEventListener('blur', () => down.clear());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  down.clear();
  const p = AX.touchPlayer();
  if (p) { p.stick.x = p.stick.y = 0; for (const b of ['a', 'b', 'l', 'r', 'c', 'd', 'e']) p.btn[b] = 0; }
});
document.addEventListener('contextmenu', e => e.preventDefault());

// landscape nudge (games are 16:9)
const st = document.createElement('style');
st.textContent = '#axRot{position:fixed;inset:0;z-index:30;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(10,6,32,.96);color:#fff;font:800 20px Mukta,"Noto Sans Devanagari",system-ui,sans-serif;text-align:center;padding:24px}' +
  '#axRot b{font-size:56px}@media (orientation:portrait){#axRot{display:flex}}';
document.head.appendChild(st);
const rot = document.createElement('div');
rot.id = 'axRot';
rot.innerHTML = '<b>&#10227;</b>Tap here to open in landscape · या phone sideways घुमाएँ';
rot.addEventListener('pointerdown', e => { e.preventDefault(); AX.ensureAudio(); gesture(); });
document.body.appendChild(rot);
lockLandscape();
})();
