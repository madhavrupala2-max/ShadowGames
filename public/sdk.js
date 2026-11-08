/* SHADOW Arcade SDK - include in an HTML game:  <script src="/sdk.js"></script>
 *
 *   Arcade.onStart(players => { ... })        players = [{i, name, color, touch}]   (called once)
 *        touch:true = that player plays by touching the big screen directly (no phone layout).
 *   Arcade.onFrame((players, dt) => { ... })  every frame. players[i] = { x, y, btn:{a,b,c,d,e,l,r}, hit:{...} }
 *        x,y = joystick (-1..1). btn.a = held right now. hit.a = pressed since last frame.
 *   Arcade.tap(i)                             count a direct screen tap as player i's A press
 *   Arcade.end({ title, sub, color, lines:[{name, text, color}] })   finish the round -> shows results
 *   Arcade.vibrate(playerIndex, ms)           buzz that player's phone
 *   Arcade.sfx('hit'|'boom'|'goal'|'win'|'tick'|'go'|'select'|'kick'|'dash'|'shoot')
 */
(function () {
  var startCb = null, frameCb = null, players = [], started = false;
  function post(o) { o.arc = 1; try { parent.postMessage(o, '*'); } catch (e) {} }
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || d.arc !== 1) return;
    if (d.t === 'init') { players = d.players || []; started = true; if (startCb) startCb(players); }
    else if (d.t === 'frame' && frameCb) frameCb(d.players || [], d.dt || 0.016);
  });
  window.Arcade = {
    get players() { return players; },
    onStart: function (f) { startCb = f; if (started) f(players); },
    onFrame: function (f) { frameCb = f; },
    end: function (r) { post({ t: 'end', result: r || {} }); },
    tap: function (i) { post({ t: 'tap', i: i || 0 }); },
    vibrate: function (i, ms) { post({ t: 'vib', i: i, ms: ms || 40 }); },
    sfx: function (n) { post({ t: 'sfx', n: n }); }
  };
  post({ t: 'ready' });
})();
