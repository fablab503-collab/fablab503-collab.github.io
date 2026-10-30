// levels.js - Deterministic 404 Levels Generator for javascript-tiny-platformer
// Dual-environment API: window.D404Levels in browser, module.exports in Node.js.
(function() {
  'use strict';

  //---------------------------------------------------------------------------
  // LEVEL 1 ORIGINAL EMBEDDED DATA (Tiled 64x48 map)
  //---------------------------------------------------------------------------

  // Run-Length Encoded tile data for Level 1 (background layer 64x48)
  var L1_RLE = '5x65,0x62,5x2,0x62,5x2,0x62,5x2,0x62,5x2,0x62,5x2,0x62,5x2,4x36,0x11,4x15,5x2,3x36,0x11,3x15,5x2,0x62,5x2,0x62,5x2,0x40,4x5,0x17,5x2,0x62,5x2,0x52,4x6,0x4,5x2,0x17,4x18,0x17,3x6,0x4,5x2,0x17,3x18,0x7,4x5,0x15,5x2,0x62,5x2,0x62,5x2,0x62,5x2,0x44,4x5,0x13,5x2,0x62,5x2,0x62,5x2,0x62,5x2,0x8,4x14,0x24,4x5,0x11,5x2,0x8,3x14,0x11,4x9,0x20,5x2,0x33,3x9,0x20,5x2,0x62,5x2,0x26,4x4,0x18,4x5,0x9,5x8,0x20,3x4,0x32,5,2x6,5,0x56,5,2x6,5,0x56,5,2x6,5,0x44,4x5,0x7,5,2x2,5x5,0x7,5x20,0x29,5,2x2,5,0x11,5,2x18,5,0x29,5,2x2,5,0x11,5,2x3,5x16,0x29,5,2x2,5,0x11,5,2x3,5,0x34,4x5,0x5,5,2x2,5,0x11,5,2x3,5,0x44,5,2x2,5,0x7,5x5,2x3,5x8,0x37,5,2x2,5,0x7,5,2x14,5,0x37,5,2x2,5,0x7,5,2x14,5,0x13,5x4,0x12,4x5,0x3,5,2x2,5,0x7,5,2x14,5,0x13,5,2x2,5x4,0x17,5,2x2,5,0x7,5,2x14,5,0x13,5,2x5,5x5,0x13,5,2x2,5x9,2x14,5x15,2x9,5x7,0x7,5,2x55,5x9,2x256';

  // Original objects in Level 1 from level.json
  var L1_OBJECTS = [
    { height: 32, name: 'player', properties: {}, type: 'player', visible: true, width: 32, x: 96, y: 480 },
    { height: 32, name: 'monster', properties: { maxdx: '10', right: 'true' }, type: 'monster', visible: true, width: 32, x: 64, y: 192 },
    { height: 32, name: 'monster', properties: { left: 'true', maxdx: '4' }, type: 'monster', visible: true, width: 32, x: 1120, y: 416 },
    { height: 32, name: 'monster', properties: { left: 'true', maxdx: '4' }, type: 'monster', visible: true, width: 32, x: 1632, y: 832 },
    { height: 32, name: 'monster', properties: { maxdx: '6', right: 'true' }, type: 'monster', visible: true, width: 32, x: 1056, y: 1312 },
    { height: 32, name: 'monster', properties: { left: 'true', maxdx: '4' }, type: 'monster', visible: true, width: 32, x: 640, y: 992 },
    { height: 32, name: 'treasure', properties: {}, type: 'treasure', visible: true, width: 32, x: 192, y: 864 },
    { height: 32, name: 'treasure', properties: {}, type: 'treasure', visible: true, width: 32, x: 96, y: 1312 },
    { height: 32, name: 'treasure', properties: {}, type: 'treasure', visible: true, width: 32, x: 1856, y: 384 },
    { height: 32, name: 'treasure', properties: {}, type: 'treasure', visible: true, width: 32, x: 704, y: 416 },
    { height: 32, name: 'treasure', properties: {}, type: 'treasure', visible: true, width: 32, x: 1984, y: 192 },
    { height: 32, name: 'treasure', properties: {}, type: 'treasure', visible: true, width: 32, x: 608, y: 1152 },
    { height: 32, name: 'monster', properties: { maxdx: '10', right: 'true' }, type: 'monster', visible: true, width: 32, x: 1216, y: 736 },
    { height: 32, name: 'monster', properties: { maxdx: '10', right: 'true' }, type: 'monster', visible: true, width: 32, x: 1856, y: 1344 },
    { height: 32, name: 'monster', properties: { left: 'true', maxdx: '4' }, type: 'monster', visible: true, width: 32, x: 1024, y: 192 },
    { height: 32, name: 'treasure', properties: {}, type: 'treasure', visible: true, width: 32, x: 32, y: 192 },
    { height: 32, name: 'treasure', properties: {}, type: 'treasure', visible: true, width: 32, x: 1984, y: 1344 }
  ];

  function decodeRLE(str) {
    var out = [];
    var parts = str.split(',');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].split('x');
      var val = parseInt(p[0], 10);
      var cnt = p.length > 1 ? parseInt(p[1], 10) : 1;
      for (var j = 0; j < cnt; j++) out.push(val);
    }
    return out;
  }

  //---------------------------------------------------------------------------
  // SEEDED PRNG (Mulberry32)
  //---------------------------------------------------------------------------

  function mulberry32(a) {
    return function() {
      var t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  //---------------------------------------------------------------------------
  // API: progress(level) -> (level - 1) / 403
  //---------------------------------------------------------------------------

  function progress(level) {
    var l = Math.max(1, Math.min(404, level | 0));
    return (l - 1) / 403;
  }

  //---------------------------------------------------------------------------
  // PHYSICS & JUMP LIMITS
  // Player jumps at most 5 tiles high and about 10 tiles horizontally.
  // Maximum required gap is at most 6 tiles; maximum required step is at most 4 tiles.
  //---------------------------------------------------------------------------

  function canJump(isSolid, x1, y1, x2, y2) {
    var dx = Math.abs(x2 - x1);
    var dy = y1 - y2; // > 0 means jumping up
    if (dx === 0 && dy === 0) return true;
    if (dy > 5) return false; // physics max jump height is 5 tiles

    // Max horizontal reach based on jump height
    var maxDx = 10;
    if (dy === 5) maxDx = 4;
    else if (dy === 4) maxDx = 6;
    else if (dy === 3) maxDx = 8;
    else if (dy <= -5) maxDx = Math.min(12, 10 + Math.floor((-dy - 4) / 2));
    if (dx > maxDx) return false;

    // Headroom check at takeoff if jumping up
    if (dy > 0 && isSolid(x1, y1 - 1)) return false;

    // Headroom clearance along jump arc
    var peakY = Math.min(y1, y2) - (dy >= 4 ? 1 : 2);
    if (peakY < 1) peakY = 1;

    var step = x2 > x1 ? 1 : -1;
    for (var x = x1 + step; x !== x2; x += step) {
      var open = false;
      var bottom = Math.max(y1, y2);
      for (var y = peakY; y <= bottom; y++) {
        if (!isSolid(x, y)) {
          open = true;
          break;
        }
      }
      if (!open) return false;
    }
    return true;
  }

  //---------------------------------------------------------------------------
  // API: validate(map) -> { ok, problems: [...] }
  //---------------------------------------------------------------------------

  function validate(map) {
    var problems = [];
    if (!map || typeof map !== 'object') {
      return { ok: false, problems: ['Map is not an object'] };
    }

    var W = map.width, H = map.height;
    if (!W || !H || W <= 0 || H <= 0) {
      problems.push('Invalid dimensions: ' + W + 'x' + H);
      return { ok: false, problems: problems };
    }

    var data = map.layers && map.layers[0] && map.layers[0].data;
    if (!data || data.length !== W * H) {
      problems.push('Missing or invalid layer data (expected ' + (W * H) + ' cells)');
      return { ok: false, problems: problems };
    }

    var objects = map.layers && map.layers[1] && map.layers[1].objects;
    if (!Array.isArray(objects)) {
      problems.push('Missing object layer');
      return { ok: false, problems: problems };
    }

    function isSolid(x, y) {
      if (x < 0 || x >= W || y < 0 || y >= H) return true;
      return data[x + y * W] > 0;
    }
    function isStandable(x, y) {
      return !isSolid(x, y) && isSolid(x, y + 1);
    }

    // Border checks: left, right, top solid
    for (var y = 0; y < H; y++) {
      if (!isSolid(0, y)) problems.push('Left border open at y=' + y);
      if (!isSolid(W - 1, y)) problems.push('Right border open at y=' + y);
    }
    for (var x = 0; x < W; x++) {
      if (!isSolid(x, 0)) problems.push('Top border open at x=' + x);
    }
    // Bottom row: solid except at pit holes
    for (var x = 0; x < W; x++) {
      if (x === 0 || x === W - 1) {
        if (!isSolid(x, H - 1)) problems.push('Bottom corner open at x=' + x);
      }
    }

    // Player check
    var player = null;
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].type === 'player') { player = objects[i]; break; }
    }
    if (!player) {
      problems.push('No player found');
      return { ok: false, problems: problems };
    }

    // Exit check
    var exit = null;
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].type === 'exit') { exit = objects[i]; break; }
    }
    if (!exit) {
      problems.push('No exit found');
      return { ok: false, problems: problems };
    }

    // Safe zone check around player start (6-tile flat safe zone with no monsters)
    var ptx = Math.floor(player.x / 32), pty = Math.floor(player.y / 32);
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.type === 'monster') {
        var dist = Math.hypot(o.x - player.x, o.y - player.y) / 32;
        if (dist < 6) {
          problems.push('Monster inside 6-tile safe zone at (' + (o.x / 32) + ',' + (o.y / 32) + ')');
        }
      }
    }

    // Find player landing tile
    var landY = pty;
    while (landY < H - 1 && !isSolid(ptx, landY + 1)) landY++;
    if (!isStandable(ptx, landY)) {
      problems.push('Player start does not land on standable surface');
      return { ok: false, problems: problems };
    }

    // Spatially-indexed BFS over standable cells
    var standByCol = Array.from({ length: W }, function() { return []; });
    for (var sy = 0; sy < H; sy++) {
      for (var sx = 0; sx < W; sx++) {
        if (isStandable(sx, sy)) standByCol[sx].push(sy);
      }
    }

    var visited = new Uint8Array(W * H);
    var queue = [ptx + landY * W];
    visited[ptx + landY * W] = 1;
    var head = 0;

    while (head < queue.length) {
      var idx = queue[head++];
      var cx = idx % W, cy = Math.floor(idx / W);

      // 1. Walk left / right (and fall off ledges)
      for (var d = 0; d < 2; d++) {
        var dx = d === 0 ? -1 : 1;
        var nx = cx + dx;
        if (nx >= 0 && nx < W && !isSolid(nx, cy)) {
          var ny = cy;
          while (ny < H - 1 && !isSolid(nx, ny + 1)) ny++;
          if (ny < H - 1 && isStandable(nx, ny)) {
            var nIdx = nx + ny * W;
            if (!visited[nIdx]) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
      }

      // 2. Jumps within physics limits
      var minX = Math.max(0, cx - 10);
      var maxX = Math.min(W - 1, cx + 10);
      for (var x = minX; x <= maxX; x++) {
        var col = standByCol[x];
        for (var j = 0; j < col.length; j++) {
          var ty = col[j];
          var tIdx = x + ty * W;
          if (!visited[tIdx]) {
            if (canJump(isSolid, cx, cy, x, ty)) {
              visited[tIdx] = 1;
              queue.push(tIdx);
            }
          }
        }
      }
    }

    // Check exit reachability
    var ex = Math.floor(exit.x / 32), ey = Math.floor(exit.y / 32);
    var exitOk = visited[ex + ey * W] ||
                 (ey > 0 && visited[ex + (ey - 1) * W]) ||
                 (ey < H - 1 && visited[ex + (ey + 1) * W]);
    if (!exitOk) {
      problems.push('Exit unreachable at (' + ex + ',' + ey + ')');
    }

    // Check all treasure reachability
    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i];
      if (obj.type === 'treasure') {
        var tx = Math.floor(obj.x / 32), ty = Math.floor(obj.y / 32);
        var reached = visited[tx + ty * W] ||
                      (ty < H - 1 && visited[tx + (ty + 1) * W]) ||
                      (ty > 0 && visited[tx + (ty - 1) * W]);
        if (!reached) {
          problems.push('Treasure unreachable at (' + tx + ',' + ty + ')');
        }
      }
    }

    return { ok: problems.length === 0, problems: problems };
  }

  //---------------------------------------------------------------------------
  // API: generate(level) -> Tiled map object
  //---------------------------------------------------------------------------

  function generate(level) {
    var l = Math.max(1, Math.min(404, level | 0));

    // Level 1: Return original level.json layout with an exit door added
    if (l === 1) {
      var l1Objects = JSON.parse(JSON.stringify(L1_OBJECTS));
      l1Objects.push({
        height: 32,
        name: 'exit',
        properties: {},
        type: 'exit',
        visible: true,
        width: 32,
        x: 60 * 32,
        y: 42 * 32
      });

      return {
        height: 48,
        width: 64,
        tileheight: 32,
        tilewidth: 32,
        version: 1,
        orientation: 'orthogonal',
        properties: {},
        tilesets: [{
          firstgid: 1,
          image: 'tiles.png',
          imageheight: 32,
          imagewidth: 160,
          margin: 0,
          name: 'tiles',
          properties: {},
          spacing: 0,
          tileheight: 32,
          tilewidth: 32
        }],
        layers: [
          {
            data: decodeRLE(L1_RLE),
            height: 48,
            name: 'background',
            opacity: 1,
            type: 'tilelayer',
            visible: true,
            width: 64,
            x: 0,
            y: 0
          },
          {
            height: 48,
            name: 'Object Layer 1',
            objects: l1Objects,
            opacity: 1,
            type: 'objectgroup',
            visible: true,
            width: 64,
            x: 0,
            y: 0
          }
        ]
      };
    }

    // Levels 2..404: Seeded procedural generation
    var t = progress(l);
    var W = Math.round(64 + (600 - 64) * t);
    var H = Math.round(48 + (64 - 48) * t);

    // Deterministic generation with retry on new sub-seed if validation ever fails
    for (var attempt = 0; attempt < 50; attempt++) {
      var seed = (l + attempt * 100003) >>> 0;
      var rng = mulberry32(seed);

      var map = generateCandidate(l, t, W, H, rng);
      var check = validate(map);
      if (check.ok) {
        return map;
      }
    }

    throw new Error('Failed to generate valid map for level ' + l);
  }

  function generateCandidate(level, t, W, H, rng) {
    var data = new Int32Array(W * H);

    function setTile(x, y, v) {
      if (x >= 0 && x < W && y >= 0 && y < H) data[x + y * W] = v;
    }
    function getTile(x, y) {
      if (x < 0 || x >= W || y < 0 || y >= H) return 5;
      return data[x + y * W];
    }

    // 1. Solid Outer Borders
    for (var y = 0; y < H; y++) {
      setTile(0, y, 5);
      setTile(W - 1, y, 5);
    }
    for (var x = 0; x < W; x++) {
      setTile(x, 0, 5);
      setTile(x, H - 1, 5); // bottom border by default
    }

    // 2. Base Floor Setup (grass top = 4, dirt fill = 2)
    for (var x = 1; x < W - 1; x++) {
      setTile(x, H - 2, 4);
      setTile(x, H - 1, 2);
    }

    // 3. Carve Pit Gaps in Floor (t > 0.08)
    // Safe start zone x=1..10 and exit zone x=W-10..W-2 never have pits
    if (t > 0.08) {
      var pitChance = Math.min(0.42, 0.08 + t * 0.34);
      var curX = 12;
      while (curX < W - 12) {
        if (rng() < pitChance) {
          var pitW = Math.floor(2 + rng() * 3); // 2, 3, or 4 tiles wide (gap <= 4)
          if (curX + pitW >= W - 10) break;
          for (var px = curX; px < curX + pitW; px++) {
            setTile(px, H - 2, 0);
            setTile(px, H - 1, 0); // bottom row pit gap: engine resets player
          }
          // Floating stepping stone or platform bridging above pit
          if (rng() < 0.65) {
            var bridgeY = H - 5 - Math.floor(rng() * 2);
            for (var px = curX - 1; px <= curX + pitW; px++) {
              if (px > 0 && px < W - 1) {
                setTile(px, bridgeY, 4);
                setTile(px, bridgeY + 1, 3);
              }
            }
          }
          curX += pitW + Math.floor(8 + rng() * 8); // at least 8 solid tiles between pits
        } else {
          curX += Math.floor(6 + rng() * 6);
        }
      }
    }

    // 4. Procedural Platforms, Stairs, Towers, Chains & Vertical Sections
    var fx = 8;
    while (fx < W - 10) {
      var featType = Math.floor(rng() * 5);
      var featLen = 0;

      if (featType === 0) {
        // Stairs (ascending or descending)
        var steps = 3 + Math.floor(rng() * 4); // 3 to 6 steps
        var stepW = 2 + Math.floor(rng() * 2); // 2 or 3 tiles per step
        var dir = rng() < 0.5 ? 1 : -1;
        var baseY = H - 3;
        var curY = dir > 0 ? baseY : baseY - (steps - 1) * 2;
        for (var s = 0; s < steps; s++) {
          var sx = fx + s * stepW;
          if (sx + stepW >= W - 5) break;
          var sy = dir > 0 ? curY - s * 2 : curY + s * 2;
          sy = Math.max(10, Math.min(H - 4, sy));
          for (var px = sx; px < sx + stepW; px++) {
            setTile(px, sy, 4);
            for (var fillY = sy + 1; fillY < H - 2; fillY++) {
              if (getTile(px, fillY) === 0) setTile(px, fillY, 3);
            }
          }
        }
        featLen = steps * stepW + 2;
      } else if (featType === 1) {
        // Tower with climbable ledges
        var towerW = 3 + Math.floor(rng() * 3); // 3 to 5 tiles wide
        var towerH = Math.min(H - 12, Math.floor(8 + t * 14 + rng() * 6));
        var topY = H - 2 - towerH;
        if (fx + towerW + 4 < W - 6 && topY >= 4) {
          // Tower solid core
          for (var px = fx + 2; px < fx + 2 + towerW; px++) {
            setTile(px, topY, 4);
            for (var py = topY + 1; py < H - 2; py++) {
              setTile(px, py, 3);
            }
          }
          // Left climbing ledges (step height = 3)
          for (var ly = H - 6; ly >= topY + 3; ly -= 3) {
            setTile(fx, ly, 4);
            setTile(fx + 1, ly, 4);
          }
          // Right climbing ledges (step height = 3)
          var rx = fx + 2 + towerW;
          for (var ly = H - 5; ly >= topY + 2; ly -= 3) {
            if (rx + 1 < W - 1) {
              setTile(rx, ly, 4);
              setTile(rx + 1, ly, 4);
            }
          }
          featLen = towerW + 6;
        } else {
          featLen = 4;
        }
      } else if (featType === 2) {
        // Floating platform chain
        var numPlats = 3 + Math.floor(rng() * 4); // 3 to 6 platforms
        var curY = H - 6 - Math.floor(rng() * (t * 12 + 4));
        var cx = fx;
        for (var p = 0; p < numPlats; p++) {
          var platW = 3 + Math.floor(rng() * 3); // 3 to 5
          var gap = 2 + Math.floor(rng() * 3); // 2 to 4
          if (cx + platW >= W - 6) break;
          for (var px = cx; px < cx + platW; px++) {
            setTile(px, curY, 4);
            setTile(px, curY + 1, 3);
          }
          cx += platW + gap;
          curY += Math.floor(rng() * 5) - 2; // -2 to +2
          curY = Math.max(8, Math.min(H - 5, curY));
        }
        featLen = (cx - fx) + 2;
      } else if (featType === 3) {
        // Elevated walkway / terrace with pillars
        var walkW = 8 + Math.floor(rng() * 8); // 8 to 15
        var walkY = H - 8 - Math.floor(rng() * 6);
        if (fx + walkW < W - 6) {
          for (var px = fx; px < fx + walkW; px++) {
            setTile(px, walkY, 4);
            setTile(px, walkY + 1, 3);
            if ((px - fx) % 5 === 0) {
              for (var py = walkY + 2; py < H - 2; py++) {
                if (getTile(px, py) === 0) setTile(px, py, 3);
              }
            }
          }
          // Stepping stones for access
          setTile(fx - 2, walkY + 3, 4);
          setTile(fx - 1, walkY + 3, 4);
          featLen = walkW + 3;
        } else {
          featLen = 4;
        }
      } else {
        // High-altitude sky platforms
        if (t > 0.15 && H > 50) {
          var skyY = 6 + Math.floor(rng() * 10);
          var skyW = 4 + Math.floor(rng() * 5);
          if (fx + skyW < W - 6) {
            for (var px = fx; px < fx + skyW; px++) {
              setTile(px, skyY, 4);
              setTile(px, skyY + 1, 3);
            }
          }
        }
        featLen = 6 + Math.floor(rng() * 6);
      }

      fx += Math.max(4, featLen);
    }

    // 5. Enforce Safe Zones
    // Flat safe start zone x=1..8
    for (var x = 1; x <= 8; x++) {
      setTile(x, H - 2, 4);
      setTile(x, H - 1, 2);
      setTile(x, H - 3, 0);
      setTile(x, H - 4, 0);
    }
    // Flat exit zone x=W-8..W-2
    for (var x = W - 8; x < W - 1; x++) {
      setTile(x, H - 2, 4);
      setTile(x, H - 1, 2);
      setTile(x, H - 3, 0);
      setTile(x, H - 4, 0);
    }

    // 6. Player Object
    var objects = [];
    objects.push({
      height: 32,
      name: 'player',
      properties: {},
      type: 'player',
      visible: true,
      width: 32,
      x: 3 * 32,
      y: (H - 3) * 32
    });

    // 7. Exit Door Object
    var exitX = W - 4;
    var exitY = H - 3;
    setTile(exitX, exitY + 1, 4);
    setTile(exitX, exitY, 0);
    setTile(exitX, exitY - 1, 0);
    objects.push({
      height: 32,
      name: 'exit',
      properties: {},
      type: 'exit',
      visible: true,
      width: 32,
      x: exitX * 32,
      y: exitY * 32
    });

    // 8. BFS to Discover Reachable Standable Cells
    function isSolid(x, y) {
      if (x < 0 || x >= W || y < 0 || y >= H) return true;
      return data[x + y * W] > 0;
    }
    function isStandable(x, y) {
      return !isSolid(x, y) && isSolid(x, y + 1);
    }

    var standByCol = Array.from({ length: W }, function() { return []; });
    for (var sy = 0; sy < H; sy++) {
      for (var sx = 0; sx < W; sx++) {
        if (isStandable(sx, sy)) standByCol[sx].push(sy);
      }
    }

    var visited = new Uint8Array(W * H);
    var queue = [3 + (H - 3) * W];
    visited[3 + (H - 3) * W] = 1;
    var head = 0;

    while (head < queue.length) {
      var idx = queue[head++];
      var cx = idx % W, cy = Math.floor(idx / W);

      // Walk left / right
      for (var d = 0; d < 2; d++) {
        var dx = d === 0 ? -1 : 1;
        var nx = cx + dx;
        if (nx >= 0 && nx < W && !isSolid(nx, cy)) {
          var ny = cy;
          while (ny < H - 1 && !isSolid(nx, ny + 1)) ny++;
          if (ny < H - 1 && isStandable(nx, ny)) {
            var nIdx = nx + ny * W;
            if (!visited[nIdx]) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
      }

      // Jumps
      var minX = Math.max(0, cx - 10);
      var maxX = Math.min(W - 1, cx + 10);
      for (var x = minX; x <= maxX; x++) {
        var col = standByCol[x];
        for (var j = 0; j < col.length; j++) {
          var ty = col[j];
          var tIdx = x + ty * W;
          if (!visited[tIdx]) {
            if (canJump(isSolid, cx, cy, x, ty)) {
              visited[tIdx] = 1;
              queue.push(tIdx);
            }
          }
        }
      }
    }

    var reachableList = [];
    for (var idx = 0; idx < visited.length; idx++) {
      if (visited[idx]) {
        var rx = idx % W, ry = Math.floor(idx / W);
        reachableList.push({ x: rx, y: ry });
      }
    }

    // 9. Monsters: ~8 at t=0 up to ~120 at t=1
    var numMonsters = Math.round(8 + (120 - 8) * t);
    var monsterCandidates = [];
    for (var i = 0; i < reachableList.length; i++) {
      var pt = reachableList[i];
      // Outside safe zone: strictly x > 10 and not on exit door
      if (pt.x > 10 && pt.x < W - 5) {
        if (isStandable(pt.x - 1, pt.y) || isStandable(pt.x + 1, pt.y)) {
          monsterCandidates.push(pt);
        }
      }
    }

    // Shuffle candidate locations
    for (var i = monsterCandidates.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = monsterCandidates[i];
      monsterCandidates[i] = monsterCandidates[j];
      monsterCandidates[j] = tmp;
    }

    var placedMonsters = Math.min(numMonsters, monsterCandidates.length);
    var maxdxOptions = ['4', '6', '10'];
    if (t > 0.3) maxdxOptions.push('12', '15');
    if (t > 0.6) maxdxOptions.push('18', '20', '24'); // up to 1.6x default 15

    for (var m = 0; m < placedMonsters; m++) {
      var mpt = monsterCandidates[m];
      var speed = maxdxOptions[Math.floor(rng() * maxdxOptions.length)];
      var goLeft = rng() < 0.5;
      var props = { maxdx: speed };
      if (goLeft) props.left = 'true'; else props.right = 'true';

      objects.push({
        height: 32,
        name: 'monster',
        properties: props,
        type: 'monster',
        visible: true,
        width: 32,
        x: mpt.x * 32,
        y: mpt.y * 32
      });
    }

    // 10. Coins (Treasure): ~8 at t=0 up to ~150 at t=1
    var numCoins = Math.round(8 + (150 - 8) * t);
    var coinCandidates = [];
    var occupied = {};
    occupied['3,' + (H - 3)] = true;
    occupied[exitX + ',' + exitY] = true;

    for (var i = 0; i < reachableList.length; i++) {
      var pt = reachableList[i];
      var k = pt.x + ',' + pt.y;
      if (!occupied[k]) {
        coinCandidates.push(pt);
      }
    }

    // Shuffle coin candidates
    for (var i = coinCandidates.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = coinCandidates[i];
      coinCandidates[i] = coinCandidates[j];
      coinCandidates[j] = tmp;
    }

    var placedCoins = Math.min(numCoins, coinCandidates.length);
    for (var c = 0; c < placedCoins; c++) {
      var cpt = coinCandidates[c];
      objects.push({
        height: 32,
        name: 'treasure',
        properties: {},
        type: 'treasure',
        visible: true,
        width: 32,
        x: cpt.x * 32,
        y: cpt.y * 32
      });
    }

    return {
      height: H,
      width: W,
      tileheight: 32,
      tilewidth: 32,
      version: 1,
      orientation: 'orthogonal',
      properties: {},
      tilesets: [{
        firstgid: 1,
        image: 'tiles.png',
        imageheight: 32,
        imagewidth: 160,
        margin: 0,
        name: 'tiles',
        properties: {},
        spacing: 0,
        tileheight: 32,
        tilewidth: 32
      }],
      layers: [
        {
          data: Array.prototype.slice.call(data),
          height: H,
          name: 'background',
          opacity: 1,
          type: 'tilelayer',
          visible: true,
          width: W,
          x: 0,
          y: 0
        },
        {
          height: H,
          name: 'Object Layer 1',
          objects: objects,
          opacity: 1,
          type: 'objectgroup',
          visible: true,
          width: W,
          x: 0,
          y: 0
        }
      ]
    };
  }

  // Exposed API
  var API = {
    generate: generate,
    progress: progress,
    validate: validate
  };

  // Browser global
  if (typeof window !== 'undefined') {
    window.D404Levels = API;
  }
  // Global scope fallback
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  if (root) {
    root.D404Levels = API;
  }
  // Node CommonJS export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof exports !== 'undefined') {
    exports.generate = generate;
    exports.progress = progress;
    exports.validate = validate;
    exports.default = API;
  }

  // Node CLI runner
  if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].replace(/\\/g, '/').indexOf('levels.js') !== -1) {
    var startTime = Date.now();
    var passed = 0;
    var sampleLevels = [1, 50, 100, 200, 300, 404];
    var samples = {};

    for (var l = 1; l <= 404; l++) {
      var map = generate(l);
      var res = validate(map);
      if (!res.ok) {
        console.error('Level ' + l + ' failed validation:', res.problems);
        process.exit(1);
      }
      passed++;
      if (sampleLevels.indexOf(l) !== -1) {
        var monsters = 0, coins = 0;
        var objs = map.layers[1].objects;
        for (var i = 0; i < objs.length; i++) {
          if (objs[i].type === 'monster') monsters++;
          else if (objs[i].type === 'treasure') coins++;
        }
        samples[l] = { width: map.width, height: map.height, monsters: monsters, coins: coins };
      }
    }
    var duration = ((Date.now() - startTime) / 1000).toFixed(3);
    console.log('Passed: ' + passed + ' / 404 levels (all passed)');
    console.log('Total time: ' + duration + 's');
    console.log('Sample levels summary:');
    sampleLevels.forEach(function(lvl) {
      var s = samples[lvl];
      console.log('  Level ' + String(lvl).padStart(3) + ': width=' + s.width + ', height=' + s.height + ', monsters=' + s.monsters + ', coins=' + s.coins);
    });
  }

})();
