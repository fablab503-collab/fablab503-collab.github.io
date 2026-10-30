// javascript-tiny-platformer by Jake Gordon (MIT, see LICENSE), adapted for dcreations.fr:
// black-and-white palette that follows light/dark mode, touch buttons, coin counter, no FPS meter,
// 404 levels (levels.js), a camera that follows the player, an exit door per level, detail layers (detail.js).
(function() { // module pattern

  //-------------------------------------------------------------------------
  // POLYFILLS
  //-------------------------------------------------------------------------
  
  if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    window.requestAnimationFrame = window.webkitRequestAnimationFrame || 
                                   window.mozRequestAnimationFrame    || 
                                   window.oRequestAnimationFrame      || 
                                   window.msRequestAnimationFrame     || 
                                   function(callback, element) {
                                     window.setTimeout(callback, 1000 / 60);
                                   }
  }

  //-------------------------------------------------------------------------
  // UTILITIES
  //-------------------------------------------------------------------------
  
  function timestamp() {
    return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
  }
  
  function bound(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }

  function get(url, onsuccess) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
      if ((request.readyState == 4) && (request.status == 200))
        onsuccess(request);
    }
    request.open("GET", url, true);
    request.send();
  }

  function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(((x1 + w1 - 1) < x2) ||
             ((x2 + w2 - 1) < x1) ||
             ((y1 + h1 - 1) < y2) ||
             ((y2 + h2 - 1) < y1))
  }
  
  //-------------------------------------------------------------------------
  // GAME CONSTANTS AND VARIABLES
  //-------------------------------------------------------------------------
  
  var MAP      = { tw: 64, th: 48 },
      TILE     = 32,
      METER    = TILE,
      GRAVITY  = 9.8 * 6, // default (exagerated) gravity
      MAXDX    = 15,      // default max horizontal speed (15 tiles per second)
      MAXDY    = 60,      // default max vertical speed   (60 tiles per second)
      ACCEL    = 1/2,     // default take 1/2 second to reach maxdx (horizontal acceleration)
      FRICTION = 1/6,     // default take 1/6 second to stop from maxdx (horizontal friction)
      IMPULSE  = 1500,    // default player jump impulse
      dark     = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'),
      INK      = '#000', PAPER = '#fff',
      KEY_A    = 65, KEY_D = 68, KEY_W = 87,
      KEY      = { SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40 };
      
  var fps      = 60,
      step     = 1/fps,
      canvas   = document.getElementById('game'),
      ctx      = canvas.getContext('2d'),
      VIEW_W   = canvas.width  = 1024,  // camera size in pixels (32 x 18 tiles)
      VIEW_H   = canvas.height = 576,
      LAST     = 404,
      width    = 0, height = 0,         // world size, set per level
      camX     = 0, camY = 0,
      level    = 1,
      exit     = null,
      levelT   = 0,                     // 0 at level 1, 1 at level 404
      player   = {},
      monsters = [],
      treasure = [],
      cells    = [];
  
  var t2p      = function(t)     { return t*TILE;                  },
      p2t      = function(p)     { return Math.floor(p/TILE);      },
      cell     = function(x,y)   { return tcell(p2t(x),p2t(y));    },
      tcell    = function(tx,ty) { return cells[tx + (ty*MAP.tw)]; };
  
  
  //-------------------------------------------------------------------------
  // UPDATE LOOP
  //-------------------------------------------------------------------------

  function palette() {
    var d = dark && dark.matches;
    INK = d ? '#fff' : '#000'; PAPER = d ? '#000' : '#fff';
  }
  palette();
  if (dark && dark.addEventListener) dark.addEventListener('change', palette);

  function onkey(ev, key, down) {
    switch(key) {
      case KEY.LEFT:  case KEY_A: player.left  = down; ev.preventDefault(); return false;
      case KEY.RIGHT: case KEY_D: player.right = down; ev.preventDefault(); return false;
      case KEY.SPACE: case KEY.UP: case KEY_W: player.jump = down; ev.preventDefault(); return false;
    }
  }

  function score() {
    var el = document.getElementById('game-score');
    if (el) el.textContent = player.collected + ' / ' + treasure.length;
    var lv = document.getElementById('game-level');
    if (lv) lv.textContent = level + ' / ' + LAST;
    var pc = document.getElementById('game-pct');
    if (pc) pc.textContent = Math.round(levelT * 100) + ' %';
    var bar = document.getElementById('game-bar');
    if (bar) bar.style.width = (levelT * 100) + '%';
  }

  function store(key, value) { try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch (e) { return null; } }

  function loadLevel(n) {
    level = Math.max(1, Math.min(LAST, n | 0));
    var L = window.D404Levels, map = null;
    if (L && L.generate) { try { map = L.generate(level); } catch (e) { if (window.console) console.warn('level generator failed', e); } }
    if (map) { setup(map); started(); return; }
    level = 1;   // no generator: the original level only
    get("/platformer/level.json", function(req) { setup(JSON.parse(req.responseText)); started(); });
  }

  function started() {
    score();
    var url = new URL(location.href); url.searchParams.set('level', level);
    history.replaceState(null, '', url);
  }

  function nextLevel() {
    if (level >= LAST) {
      var win = document.getElementById('game-win');
      if (win) win.hidden = false;
      exit = null;
      return;
    }
    var best = parseInt(store('d404-best'), 10) || 1;
    if (level + 1 > best) store('d404-best', String(level + 1));
    loadLevel(level + 1);
  }
  
  function update(dt) {
    updatePlayer(dt);
    updateMonsters(dt);
    checkTreasure();
    checkExit();
  }

  function updatePlayer(dt) {
    updateEntity(player, dt);
  }

  function updateMonsters(dt) {
    var n, max;
    for(n = 0, max = monsters.length ; n < max ; n++)
      updateMonster(monsters[n], dt);
  }

  function updateMonster(monster, dt) {
    if (!monster.dead) {
      updateEntity(monster, dt);
      if (overlap(player.x, player.y, TILE, TILE, monster.x, monster.y, TILE, TILE)) {
        if ((player.dy > 0) && (monster.y - player.y > TILE/2))
          killMonster(monster);
        else
          killPlayer(player);
      }
    }
  }

  function checkTreasure() {
    var n, max, t;
    for(n = 0, max = treasure.length ; n < max ; n++) {
      t = treasure[n];
      if (!t.collected && overlap(player.x, player.y, TILE, TILE, t.x, t.y, TILE, TILE))
        collectTreasure(t);
    }
  }

  function killMonster(monster) {
    player.killed++;
    monster.dead = true;
  }

  function checkExit() {
    if (exit && overlap(player.x, player.y, TILE, TILE, exit.x, exit.y, TILE, TILE * 2)) nextLevel();
  }

  function killPlayer(player) {
    player.x = player.start.x;
    player.y = player.start.y;
    player.dx = player.dy = 0;
  }

  function collectTreasure(t) {
    player.collected++;
    t.collected = true;
    score();
  }

  function updateEntity(entity, dt) {
    var wasleft    = entity.dx  < 0,
        wasright   = entity.dx  > 0,
        falling    = entity.falling,
        friction   = entity.friction * (falling ? 0.5 : 1),
        accel      = entity.accel    * (falling ? 0.5 : 1);
  
    entity.ddx = 0;
    entity.ddy = entity.gravity;
  
    if (entity.left)
      entity.ddx = entity.ddx - accel;
    else if (wasleft)
      entity.ddx = entity.ddx + friction;
  
    if (entity.right)
      entity.ddx = entity.ddx + accel;
    else if (wasright)
      entity.ddx = entity.ddx - friction;
  
    if (entity.jump && !entity.jumping && !falling) {
      entity.ddy = entity.ddy - entity.impulse; // an instant big force impulse
      entity.jumping = true;
    }
  
    entity.x  = entity.x  + (dt * entity.dx);
    entity.y  = entity.y  + (dt * entity.dy);
    entity.dx = bound(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx);
    entity.dy = bound(entity.dy + (dt * entity.ddy), -entity.maxdy, entity.maxdy);
  
    if ((wasleft  && (entity.dx > 0)) ||
        (wasright && (entity.dx < 0))) {
      entity.dx = 0; // clamp at zero to prevent friction from making us jiggle side to side
    }
  
    var tx        = p2t(entity.x),
        ty        = p2t(entity.y),
        nx        = entity.x%TILE,
        ny        = entity.y%TILE,
        cell      = tcell(tx,     ty),
        cellright = tcell(tx + 1, ty),
        celldown  = tcell(tx,     ty + 1),
        celldiag  = tcell(tx + 1, ty + 1);
  
    if (entity.dy > 0) {
      if ((celldown && !cell) ||
          (celldiag && !cellright && nx)) {
        entity.y = t2p(ty);
        entity.dy = 0;
        entity.falling = false;
        entity.jumping = false;
        ny = 0;
      }
    }
    else if (entity.dy < 0) {
      if ((cell      && !celldown) ||
          (cellright && !celldiag && nx)) {
        entity.y = t2p(ty + 1);
        entity.dy = 0;
        cell      = celldown;
        cellright = celldiag;
        ny        = 0;
      }
    }
  
    if (entity.dx > 0) {
      if ((cellright && !cell) ||
          (celldiag  && !celldown && ny)) {
        entity.x = t2p(tx);
        entity.dx = 0;
      }
    }
    else if (entity.dx < 0) {
      if ((cell     && !cellright) ||
          (celldown && !celldiag && ny)) {
        entity.x = t2p(tx + 1);
        entity.dx = 0;
      }
    }

    if (entity.monster) {
      if (entity.left && (cell || !celldown)) {
        entity.left = false;
        entity.right = true;
      }      
      else if (entity.right && (cellright || !celldiag)) {
        entity.right = false;
        entity.left  = true;
      }
    }
  
    entity.falling = ! (celldown || (nx && celldiag));

    if (entity.y > height + TILE) {   // fell into a pit
      if (entity.player) killPlayer(entity); else entity.dead = true;
    }
  }

  //-------------------------------------------------------------------------
  // RENDERING
  //-------------------------------------------------------------------------
  
  function render(ctx, frame, dt) {
    camX = Math.round(bound(player.x + TILE/2 - VIEW_W/2, 0, Math.max(0, width - VIEW_W)));
    camY = Math.round(bound(player.y + TILE/2 - VIEW_H/2, 0, Math.max(0, height - VIEW_H)));
    var D = window.D404Detail,
        s = { t: levelT, frame: frame, camX: camX, camY: camY, viewW: VIEW_W, viewH: VIEW_H,
              worldW: width, worldH: height, ink: INK, paper: PAPER, dark: INK === '#fff' };
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (D && D.drawBackground) safe(function() { D.drawBackground(ctx, s); });
    ctx.save();
    ctx.translate(-camX, -camY);
    renderMap(ctx, D, s);
    renderExit(ctx, frame);
    renderTreasure(ctx, frame);
    renderPlayer(ctx, dt);
    renderMonsters(ctx, dt);
    ctx.restore();
    if (D && D.drawForeground) safe(function() { D.drawForeground(ctx, s); });
  }

  var detailBroken = false;
  function safe(fn) {   // a bug in the detail layer must never stop the game
    if (detailBroken) return;
    try { fn(); } catch (e) { detailBroken = true; if (window.console) console.warn('detail layer off:', e); }
  }

  function renderExit(ctx, frame) {
    if (!exit) return;
    var x = exit.x, y = exit.y - TILE;   // a door two tiles high
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, TILE, TILE * 2);
    ctx.fillStyle = PAPER;
    ctx.fillRect(x + 6, y + 6, TILE - 12, TILE * 2 - 6);
    ctx.fillStyle = INK;
    ctx.fillRect(x + TILE - 12, y + TILE, 4, 4);   // handle
    ctx.font = '800 14px "Overpass Variable", "Overpass", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(level < LAST ? String(level + 1) : 'END', x + TILE/2, y - 4 - 2 * Math.abs(Math.sin(frame / 20)));
  }

  function renderMap(ctx, D, s) {
    var x, y, cell,
        x0 = Math.max(0, p2t(camX)), x1 = Math.min(MAP.tw - 1, p2t(camX + VIEW_W)),
        y0 = Math.max(0, p2t(camY)), y1 = Math.min(MAP.th - 1, p2t(camY + VIEW_H)),
        custom = D && D.drawTile && levelT > 0 && !detailBroken;
    for(y = y0 ; y <= y1 ; y++) {
      for(x = x0 ; x <= x1 ; x++) {
        cell = tcell(x, y);
        if (cell && custom) {
          try { D.drawTile(ctx, s, x * TILE, y * TILE, x, y); continue; } catch (e) { detailBroken = true; }
        }
        if (cell) {
          ctx.fillStyle = INK;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = PAPER;
          ctx.fillRect(x * TILE + TILE - 3, y * TILE, 3, TILE);
          ctx.fillRect(x * TILE, y * TILE + TILE - 3, TILE, 3);
        }
      }
    }
  }

  function renderPlayer(ctx, dt) {
    // the player is the "0" of 404, with two eyes looking where it runs
    var x = player.x + (player.dx * dt), y = player.y + (player.dy * dt), look = player.dx < 0 ? -3 : 3;
    glyph(ctx, '0', x, y);
    ctx.fillStyle = INK;
    ctx.fillRect(x + 11 + look, y + 11, 4, 6);
    ctx.fillRect(x + 17 + look, y + 11, 4, 6);
  }

  function renderMonsters(ctx, dt) {
    // the monsters are the two "4"s of 404
    var n, max, monster;
    for(n = 0, max = monsters.length ; n < max ; n++) {
      monster = monsters[n];
      if (!monster.dead)
        glyph(ctx, '4', monster.x + (monster.dx * dt), monster.y + (monster.dy * dt));
    }
  }

  function glyph(ctx, ch, x, y) {
    ctx.fillStyle = INK;
    ctx.font = '800 ' + Math.round(TILE * 1.3) + 'px "Overpass Variable", "Overpass", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (levelT > 0) {   // paper outline keeps characters readable over the detailed city
      ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = PAPER;
      ctx.strokeText(ch, x + TILE/2, y + TILE/2 + 2);
    }
    ctx.fillText(ch, x + TILE/2, y + TILE/2 + 2);
  }

  function renderTreasure(ctx, frame) {
    var n, max, t, r = 6 + 4 * tweenTreasure(frame, 60);
    ctx.fillStyle = INK;
    for(n = 0, max = treasure.length ; n < max ; n++) {
      t = treasure[n];
      if (!t.collected) {
        ctx.beginPath(); ctx.arc(t.x + TILE/2, t.y + TILE/2, r, 0, Math.PI * 2);
        if (levelT > 0) { ctx.lineWidth = 4; ctx.strokeStyle = PAPER; ctx.stroke(); }
        ctx.fill();
      }
    }
  }

  function tweenTreasure(frame, duration) {
    var half  = duration/2,
        pulse = frame%duration;
    return pulse < half ? (pulse/half) : 1-(pulse-half)/half;
  }

  //-------------------------------------------------------------------------
  // LOAD THE MAP
  //-------------------------------------------------------------------------
  
  function setup(map) {
    var data    = map.layers[0].data,
        objects = map.layers[1].objects,
        n, obj, entity;

    MAP.tw = map.width; MAP.th = map.height;
    width = MAP.tw * TILE; height = MAP.th * TILE;
    monsters = []; treasure = []; exit = null;
    levelT = (level - 1) / (LAST - 1);

    for(n = 0 ; n < objects.length ; n++) {
      obj = objects[n];
      entity = setupEntity(obj);
      switch(obj.type) {
      case "player"   : player = entity; break;
      case "monster"  : monsters.push(entity); break;
      case "treasure" : treasure.push(entity); break;
      case "exit"     : exit = entity; break;
      }
    }

    cells = data;
  }

  function setupEntity(obj) {
    var entity = {};
    entity.x        = obj.x;
    entity.y        = obj.y;
    entity.dx       = 0;
    entity.dy       = 0;
    obj.properties  = obj.properties || {};
    entity.gravity  = METER * (obj.properties.gravity || GRAVITY);
    entity.maxdx    = METER * (obj.properties.maxdx   || MAXDX);
    entity.maxdy    = METER * (obj.properties.maxdy   || MAXDY);
    entity.impulse  = METER * (obj.properties.impulse || IMPULSE);
    entity.accel    = entity.maxdx / (obj.properties.accel    || ACCEL);
    entity.friction = entity.maxdx / (obj.properties.friction || FRICTION);
    entity.monster  = obj.type == "monster";
    entity.player   = obj.type == "player";
    entity.treasure = obj.type == "treasure";
    entity.left     = obj.properties.left;
    entity.right    = obj.properties.right;
    entity.start    = { x: obj.x, y: obj.y }
    entity.killed = entity.collected = 0;
    return entity;
  }

  //-------------------------------------------------------------------------
  // THE GAME LOOP
  //-------------------------------------------------------------------------
  
  var counter = 0, dt = 0, now,
      last = timestamp();

  function frame() {
    now = timestamp();
    dt = dt + Math.min(1, (now - last) / 1000);
    while(dt > step) {
      dt = dt - step;
      update(step);
    }
    render(ctx, counter, dt);
    last = now;
    counter++;
    requestAnimationFrame(frame, canvas);
  }

  // on-screen buttons for phones and tablets: hold to move or jump
  function hold(id, prop) {
    var b = document.getElementById(id);
    if (!b) return;
    var on = function(e) { e.preventDefault(); player[prop] = true; },
        off = function(e) { e.preventDefault(); player[prop] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  }
  
  document.addEventListener('keydown', function(ev) { return onkey(ev, ev.keyCode, true);  }, false);
  document.addEventListener('keyup',   function(ev) { return onkey(ev, ev.keyCode, false); }, false);

  // start at ?level=N, else at the furthest level this visitor reached
  var asked = parseInt(new URL(location.href).searchParams.get('level'), 10),
      best  = parseInt(store('d404-best'), 10) || 1;
  hold('btn-left', 'left'); hold('btn-right', 'right'); hold('btn-jump', 'jump');
  var restart = document.getElementById('game-restart');
  if (restart) restart.addEventListener('click', function() { store('d404-best', '1'); loadLevel(1); });
  var looping = false;
  var _setup = setup;
  setup = function(map) { _setup(map); if (!looping) { looping = true; frame(); } };
  loadLevel(asked > 0 ? Math.min(asked, LAST) : best);
  // test hook, only with ?debug=1: put the player on the exit door
  if (new URL(location.href).searchParams.get('debug') === '1')
    window.__d404 = { toExit: function() { if (exit) { player.x = exit.x; player.y = exit.y; } }, level: function() { return level; } };

})();

