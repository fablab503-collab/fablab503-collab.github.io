// detail.js - Monochrome Visual Detail Layer for 404 Levels Platformer
// Extension for javascript-tiny-platformer by Jake Gordon (MIT).
// Strictly black & white + greys derived from ink and paper (no colours).
(function (global) {
  'use strict';

  //---------------------------------------------------------------------------
  // MOTION PREFERENCE & PRNG
  //---------------------------------------------------------------------------

  var prefersReducedMotion = false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion = !!mq.matches;
      if (mq.addEventListener) {
        mq.addEventListener('change', function (e) {
          prefersReducedMotion = !!e.matches;
        });
      }
    } catch (e) {}
  }

  function Mulberry32(seed) {
    var a = seed | 0;
    return function () {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2d(x, y, seed) {
    var h = (x * 374761393 + y * 668265263 + (seed || 0) * 1274126177) ^ 0x5bf03635;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  //---------------------------------------------------------------------------
  // COLOR DERIVATION (STRICTLY BLACK, WHITE, AND DERIVED GREYS)
  //---------------------------------------------------------------------------

  function inkRgba(s, alpha) {
    var a = clamp(alpha, 0, 1);
    return s.dark ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a + ')';
  }

  function paperRgba(s, alpha) {
    var a = clamp(alpha, 0, 1);
    return s.dark ? 'rgba(0,0,0,' + a + ')' : 'rgba(255,255,255,' + a + ')';
  }

  function lerpGrey(s, fraction) {
    // fraction 0 = paper, fraction 1 = ink
    var frac = clamp(fraction, 0, 1);
    var v = s.dark ? Math.round(frac * 255) : Math.round((1 - frac) * 255);
    return 'rgb(' + v + ',' + v + ',' + v + ')';
  }

  //---------------------------------------------------------------------------
  // WEATHER PARTICLES (CAP 280, UNDER 300)
  //---------------------------------------------------------------------------

  var NUM_PARTICLES = 280;
  var PARTICLES = [];
  (function initWeatherParticles() {
    var rng = Mulberry32(404101);
    for (var i = 0; i < NUM_PARTICLES; i++) {
      PARTICLES.push({
        x: rng() * 1400,
        y: rng() * 800,
        speed: 12 + rng() * 10,
        len: 14 + rng() * 16,
        alpha: 0.2 + rng() * 0.4,
        slant: 3.2 + rng() * 1.6
      });
    }
  })();

  //---------------------------------------------------------------------------
  // OFFSCREEN CACHE FOR PARALLAX LAYERS & TEXTURES
  //---------------------------------------------------------------------------

  var cache = {
    key: '',
    layerW: 2048,
    layerH: 768,
    far: null,
    mid: null,
    near: null,
    ditherPattern: null,
    scanlinePattern: null,
    farBeacons: []
  };

  function createOffscreen(w, h) {
    var cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  }

  // 4x4 Bayer matrix pattern for halftone shading
  function buildDitherPattern(s) {
    var cv = createOffscreen(4, 4);
    var c = cv.getContext('2d');
    var id = c.createImageData(4, 4);
    var d = id.data;
    // Bayer 4x4 threshold matrix (0..15)
    var bayer = [
       0,  8,  2, 10,
      12,  4, 14,  6,
       3, 11,  1,  9,
      15,  7, 13,  5
    ];
    // In dark mode: white dots on black; In light mode: black dots on white
    var dotVal = s.dark ? 255 : 0;
    for (var i = 0; i < 16; i++) {
      var idx = i * 4;
      // Stipple pattern at ~37% density
      if (bayer[i] < 6) {
        d[idx] = dotVal;
        d[idx + 1] = dotVal;
        d[idx + 2] = dotVal;
        d[idx + 3] = 90; // subtle alpha
      } else {
        d[idx + 3] = 0;  // transparent
      }
    }
    c.putImageData(id, 0, 0);
    return cv;
  }

  // Scanline pattern for filmic texture
  function buildScanlinePattern(s) {
    var cv = createOffscreen(2, 4);
    var c = cv.getContext('2d');
    c.fillStyle = inkRgba(s, 0.04);
    c.fillRect(0, 0, 2, 1);
    return cv;
  }

  // Build Far Layer (t >= 0.15)
  // Silhouette skyline with recognizable Parisian Eiffel Tower landmark & masts
  function renderFarLayer(s, w, h) {
    var cv = createOffscreen(w, h);
    var c = cv.getContext('2d');
    var groundY = h - 60;
    var rng = Mulberry32(1900);
    var fade = clamp((s.t - 0.15) / 0.25, 0, 1);
    var beacons = [];

    c.fillStyle = inkRgba(s, 0.22 * fade);

    // Procedural distant buildings
    var bx = 0;
    while (bx < w) {
      var bw = 45 + Math.floor(rng() * 65);
      var bh = 180 + Math.floor(rng() * 260);
      var by = groundY - bh;

      // Special placement for Eiffel Tower at x = 200..360
      if (bx > 180 && bx < 380) {
        bx = 390;
        continue;
      }

      // Building mass
      c.fillRect(bx, by, bw, bh);

      // Spires, setbacks & antennas on taller buildings
      if (bh > 300) {
        var topW = Math.floor(bw * 0.5);
        var setbackH = 30 + Math.floor(rng() * 40);
        c.fillRect(bx + (bw - topW) / 2, by - setbackH, topW, setbackH);

        // Antenna with beacon
        if (rng() > 0.35) {
          var antH = 35 + Math.floor(rng() * 50);
          var antX = bx + bw / 2;
          var antTopY = by - setbackH - antH;
          c.fillRect(antX - 1, antTopY, 2, antH);
          beacons.push({ x: antX, y: antTopY });
        }
      }
      bx += bw + 8 + Math.floor(rng() * 12);
    }

    // Recognizable Landmark: The Eiffel Tower (Paris)
    var ex = 280; // Tower center X
    var ey = groundY;
    c.beginPath();
    // Base piers & arch
    c.moveTo(ex - 75, ey);
    c.lineTo(ex - 50, ey - 95);
    c.lineTo(ex - 55, ey - 100);
    c.lineTo(ex + 55, ey - 100);
    c.lineTo(ex + 50, ey - 95);
    c.lineTo(ex + 75, ey);
    // Base inner arch cutout
    c.lineTo(ex + 35, ey);
    c.quadraticCurveTo(ex, ey - 75, ex - 35, ey);
    c.closePath();
    c.fill();

    // First platform
    c.fillRect(ex - 55, ey - 106, 110, 8);

    // Second stage
    c.beginPath();
    c.moveTo(ex - 46, ey - 106);
    c.lineTo(ex - 28, ey - 210);
    c.lineTo(ex + 28, ey - 210);
    c.lineTo(ex + 46, ey - 106);
    c.closePath();
    c.fill();

    // Second platform
    c.fillRect(ex - 34, ey - 217, 68, 7);

    // Third stage / Spire tapering to summit
    c.beginPath();
    c.moveTo(ex - 24, ey - 217);
    c.lineTo(ex - 6, ey - 370);
    c.lineTo(ex + 6, ey - 370);
    c.lineTo(ex + 24, ey - 217);
    c.closePath();
    c.fill();

    // Dome lantern and summit spire
    c.fillRect(ex - 10, ey - 380, 20, 10);
    c.fillRect(ex - 2, ey - 440, 4, 60);
    beacons.push({ x: ex, y: ey - 440 });

    // Distant Neoclassical Dome / Cathedral at x = 1200
    var dx = 1200;
    c.fillRect(dx - 50, groundY - 140, 100, 140);
    c.beginPath();
    c.arc(dx, groundY - 140, 45, Math.PI, 0, false);
    c.fill();
    c.fillRect(dx - 12, groundY - 200, 24, 20);
    c.fillRect(dx - 2, groundY - 235, 4, 35);
    beacons.push({ x: dx, y: groundY - 235 });

    return { canvas: cv, beacons: beacons };
  }

  // Build Mid Layer (t >= 0.25)
  // Closer buildings with lit windows (grey), water towers, mansard roofs, cornices
  function renderMidLayer(s, w, h) {
    var cv = createOffscreen(w, h);
    var c = cv.getContext('2d');
    var groundY = h - 30;
    var rng = Mulberry32(7744);
    var fade = clamp((s.t - 0.25) / 0.25, 0, 1);
    var litDensity = 0.25 + clamp((s.t - 0.25) / 0.75, 0, 1) * 0.4;

    c.fillStyle = inkRgba(s, 0.44 * fade);

    var bx = 0;
    var bIdx = 0;
    while (bx < w) {
      bIdx++;
      var bw = 55 + Math.floor(rng() * 75);
      var bh = 140 + Math.floor(rng() * 220);
      var by = groundY - bh;

      // Building silhouette
      c.fillStyle = inkRgba(s, 0.44 * fade);
      c.fillRect(bx, by, bw, bh);

      // Mansard roof or decorative cornice
      var roofType = rng();
      if (roofType > 0.55) {
        // Mansard roof slope
        var mH = 26 + Math.floor(rng() * 24);
        c.beginPath();
        c.moveTo(bx, by);
        c.lineTo(bx + 14, by - mH);
        c.lineTo(bx + bw - 14, by - mH);
        c.lineTo(bx + bw, by);
        c.closePath();
        c.fill();
        // Dormer windows on mansard
        if (bw > 60) {
          c.fillStyle = paperRgba(s, 0.22);
          c.fillRect(bx + 18, by - mH + 8, 8, 12);
          c.fillRect(bx + bw - 26, by - mH + 8, 8, 12);
          c.fillStyle = inkRgba(s, 0.44 * fade);
        }
      } else {
        // Stepped decorative cornice
        c.fillRect(bx - 3, by, bw + 6, 6);
        c.fillRect(bx - 1, by - 4, bw + 2, 4);
      }

      // Rooftop water tower or chimney pots
      if (rng() > 0.6) {
        var tx = bx + 12 + Math.floor(rng() * (bw - 30));
        // Water tank on stilts
        c.fillRect(tx + 2, by - 36, 18, 16);
        c.fillRect(tx, by - 20, 2, 20);
        c.fillRect(tx + 20, by - 20, 2, 20);
      } else if (rng() > 0.4) {
        // Chimney stack with pots
        var cx = bx + 8 + Math.floor(rng() * (bw - 25));
        c.fillRect(cx, by - 18, 14, 18);
        c.fillRect(cx + 1, by - 24, 3, 6);
        c.fillRect(cx + 6, by - 24, 3, 6);
        c.fillRect(cx + 11, by - 24, 3, 6);
      }

      // Lit Windows Grid
      var winW = 5;
      var winH = 7;
      var padX = 7;
      var padY = 9;
      var cols = Math.floor((bw - 12) / (winW + padX));
      var rows = Math.floor((bh - 25) / (winH + padY));

      for (var r = 0; r < rows; r++) {
        for (var k = 0; k < cols; k++) {
          var wx = bx + 8 + k * (winW + padX);
          var wy = by + 16 + r * (winH + padY);
          var winRand = hash2d(bIdx * 100 + k, r, 999);
          if (winRand < litDensity) {
            // Lit window: glowing paper / light grey
            c.fillStyle = paperRgba(s, 0.45 + winRand * 0.4);
            c.fillRect(wx, wy, winW, winH);
          } else {
            // Dark window frame
            c.fillStyle = paperRgba(s, 0.08);
            c.fillRect(wx, wy, winW, winH);
          }
        }
      }

      bx += bw + 6 + Math.floor(rng() * 10);
    }

    return cv;
  }

  // Build Near Layer (t >= 0.55)
  // Closer industrial roofline, fire escapes, utility poles, hanging cables
  function renderNearLayer(s, w, h) {
    var cv = createOffscreen(w, h);
    var c = cv.getContext('2d');
    var groundY = h;
    var rng = Mulberry32(9812);
    var fade = clamp((s.t - 0.55) / 0.25, 0, 1);

    c.fillStyle = inkRgba(s, 0.72 * fade);

    var bx = 0;
    var bIdx = 0;
    while (bx < w) {
      bIdx++;
      var bw = 70 + Math.floor(rng() * 95);
      var bh = 110 + Math.floor(rng() * 190);
      var by = groundY - bh;

      c.fillStyle = inkRgba(s, 0.72 * fade);
      c.fillRect(bx, by, bw, bh);

      // Heavy parapet cap
      c.fillRect(bx - 4, by, bw + 8, 8);

      // Utility poles & wires between buildings
      if (rng() > 0.5 && bx > 40) {
        var poleX = bx - 14;
        c.fillRect(poleX - 1, by - 35, 3, bh + 35);
        c.fillRect(poleX - 8, by - 32, 16, 2);
        c.fillRect(poleX - 8, by - 24, 16, 2);

        // Hanging catenary wire
        c.strokeStyle = inkRgba(s, 0.55 * fade);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(poleX, by - 32);
        c.quadraticCurveTo(poleX + bw / 2, by - 12, bx + bw, by - 26);
        c.stroke();
      }

      // Fire escapes zig-zagging
      if (rng() > 0.45 && bw > 75) {
        var fx = bx + 6;
        var floors = Math.min(4, Math.floor(bh / 35));
        c.fillStyle = paperRgba(s, 0.25);
        for (var f = 0; f < floors; f++) {
          var fy = by + 25 + f * 34;
          // Platform & railing
          c.fillRect(fx, fy, 22, 3);
          c.fillRect(fx, fy - 10, 22, 1);
          c.fillRect(fx, fy - 10, 1, 10);
          c.fillRect(fx + 21, fy - 10, 1, 10);
          // Diagonal ladder
          c.beginPath();
          c.moveTo(fx + 4, fy);
          c.lineTo(fx + 18, fy + 34);
          c.strokeStyle = paperRgba(s, 0.25);
          c.lineWidth = 1.5;
          c.stroke();
        }
      }

      // Large multi-pane windows
      var winW = 7;
      var winH = 11;
      var cols = Math.floor((bw - 16) / 16);
      var rows = Math.floor((bh - 20) / 22);
      for (var r = 0; r < rows; r++) {
        for (var k = 0; k < cols; k++) {
          var wx = bx + 12 + k * 16;
          var wy = by + 16 + r * 22;
          var lit = hash2d(bIdx * 50 + k, r, 333) < 0.45;
          c.fillStyle = lit ? paperRgba(s, 0.6) : paperRgba(s, 0.12);
          c.fillRect(wx, wy, winW, winH);
          // Window cross divider
          c.fillStyle = inkRgba(s, 0.72 * fade);
          c.fillRect(wx + 3, wy, 1, winH);
          c.fillRect(wx, wy + 5, winW, 1);
        }
      }

      bx += bw + 8 + Math.floor(rng() * 14);
    }

    return cv;
  }

  function rebuildCache(s, currentKey) {
    cache.key = currentKey;
    var w = cache.layerW;
    var h = cache.layerH;

    cache.ditherPattern = buildDitherPattern(s);
    cache.scanlinePattern = buildScanlinePattern(s);

    if (s.t >= 0.15) {
      var farRes = renderFarLayer(s, w, h);
      cache.far = farRes.canvas;
      cache.farBeacons = farRes.beacons;
    } else {
      cache.far = null;
      cache.farBeacons = [];
    }

    if (s.t >= 0.25) {
      cache.mid = renderMidLayer(s, w, h);
    } else {
      cache.mid = null;
    }

    if (s.t >= 0.55) {
      cache.near = renderNearLayer(s, w, h);
    } else {
      cache.near = null;
    }
  }

  function checkCache(s) {
    // Invalidate when detail tier, color mode, or viewport changes
    var tier = Math.floor(s.t * 30);
    var key = [tier, s.dark ? 1 : 0, s.viewW, s.viewH].join(':');
    if (cache.key !== key) {
      rebuildCache(s, key);
    }
  }

  //---------------------------------------------------------------------------
  // PUBLIC API: drawBackground(ctx, s)
  //---------------------------------------------------------------------------

  function drawBackground(ctx, s) {
    if (!s || s.t <= 0) return;
    checkCache(s);

    var vw = s.viewW;
    var vh = s.viewH;
    var layerW = cache.layerW;
    var layerH = cache.layerH;
    var motionFrame = prefersReducedMotion ? 0 : s.frame;

    // 1. Sky depth gradient (t >= 0.15)
    if (s.t >= 0.15) {
      var skyFade = clamp((s.t - 0.15) / 0.5, 0, 1);
      var skyGrad = ctx.createLinearGradient(0, 0, 0, vh);
      skyGrad.addColorStop(0, paperRgba(s, 0));
      skyGrad.addColorStop(1, inkRgba(s, 0.08 * skyFade));
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, vw, vh);
    }

    // 2. Giant Moon (t >= 0.95 - 1.0)
    if (s.t >= 0.95) {
      var moonFade = clamp((s.t - 0.95) / 0.05, 0, 1);
      // Small astronomical parallax
      var mx = Math.round(vw * 0.74 - s.camX * 0.015);
      var my = Math.round(vh * 0.25 - s.camY * 0.015);
      var mr = 52;

      // Concentric atmospheric glow rings
      ctx.beginPath();
      ctx.arc(mx, my, mr + 24, 0, Math.PI * 2);
      ctx.fillStyle = paperRgba(s, 0.05 * moonFade);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(mx, my, mr + 12, 0, Math.PI * 2);
      ctx.fillStyle = paperRgba(s, 0.09 * moonFade);
      ctx.fill();

      // Moon body
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = lerpGrey(s, 0.22);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = paperRgba(s, 0.6 * moonFade);
      ctx.stroke();

      // Lunar craters (Mare Tranquillitatis, Tycho, etc.)
      var craters = [
        { cx: -14, cy: -12, r: 12 },
        { cx: 16, cy: -18, r: 9 },
        { cx: -18, cy: 14, r: 8 },
        { cx: 8, cy: 16, r: 15 },
        { cx: 22, cy: 6, r: 7 }
      ];
      ctx.fillStyle = lerpGrey(s, 0.35);
      for (var ci = 0; ci < craters.length; ci++) {
        var cr = craters[ci];
        ctx.beginPath();
        ctx.arc(mx + cr.cx, my + cr.cy, cr.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Moving Clouds (t >= 0.55)
    if (s.t >= 0.55) {
      var cloudFade = clamp((s.t - 0.55) / 0.3, 0, 1);
      var cloudSpeed = 0.22;
      ctx.fillStyle = inkRgba(s, 0.12 * cloudFade);

      var clouds = [
        { x: 50, y: 55, w: 160, h: 26 },
        { x: 380, y: 90, w: 220, h: 32 },
        { x: 780, y: 45, w: 190, h: 28 },
        { x: 1200, y: 110, w: 260, h: 34 },
        { x: 1650, y: 70, w: 210, h: 30 }
      ];

      for (var cIdx = 0; cIdx < clouds.length; cIdx++) {
        var cl = clouds[cIdx];
        var cx = ((cl.x + motionFrame * cloudSpeed - s.camX * 0.05) % (vw + 300)) - 150;
        var cy = cl.y - s.camY * 0.02;

        ctx.beginPath();
        ctx.arc(cx + 30, cy + cl.h - 10, 16, 0, Math.PI * 2);
        ctx.arc(cx + 70, cy + 8, 22, 0, Math.PI * 2);
        ctx.arc(cx + 115, cy + 12, 18, 0, Math.PI * 2);
        ctx.arc(cx + 145, cy + cl.h - 8, 14, 0, Math.PI * 2);
        ctx.rect(cx + 15, cy + cl.h - 16, cl.w - 30, 16);
        ctx.fill();
      }
    }

    // 4. Far Skyline Layer (t >= 0.15) with Slow Parallax
    if (cache.far && s.t >= 0.15) {
      var farShiftX = Math.floor(s.camX * 0.10) % layerW;
      var farShiftY = Math.floor(s.camY * 0.04);
      var farDrawY = vh - layerH + 50 - farShiftY;

      ctx.drawImage(cache.far, -farShiftX, farDrawY);
      if (-farShiftX + layerW < vw) {
        ctx.drawImage(cache.far, -farShiftX + layerW, farDrawY);
      }

      // Blinking Aviation Obstruction Lights (t >= 0.45)
      if (s.t >= 0.45 && cache.farBeacons && cache.farBeacons.length > 0) {
        var blinkOn = prefersReducedMotion || ((motionFrame % 44) < 22);
        if (blinkOn) {
          ctx.fillStyle = paperRgba(s, 0.9);
          for (var bi = 0; bi < cache.farBeacons.length; bi++) {
            var b = cache.farBeacons[bi];
            var sx = b.x - farShiftX;
            var sy = farDrawY + b.y;
            // Draw within visible screen area (and wrap)
            if (sx >= -4 && sx <= vw + 4) {
              ctx.fillRect(sx - 1, sy - 1, 3, 3);
            }
            var wrapSx = sx + layerW;
            if (wrapSx >= -4 && wrapSx <= vw + 4) {
              ctx.fillRect(wrapSx - 1, sy - 1, 3, 3);
            }
          }
        }
      }
    }

    // 5. Light Beams / Spotlights Sweeping the Sky (t >= 0.75)
    if (s.t >= 0.75) {
      var beamFade = clamp((s.t - 0.75) / 0.25, 0, 1);
      var beamBaseAlpha = 0.14 * beamFade;

      var spot1X = Math.round(vw * 0.28 - s.camX * 0.15);
      var spot1Y = Math.round(vh * 0.78 - s.camY * 0.08);
      var angle1 = prefersReducedMotion ? -1.18 : (-1.18 + Math.sin(motionFrame * 0.014) * 0.36);

      var spot2X = Math.round(vw * 0.82 - s.camX * 0.15);
      var spot2Y = Math.round(vh * 0.82 - s.camY * 0.08);
      var angle2 = prefersReducedMotion ? -1.95 : (-1.95 + Math.cos(motionFrame * 0.011) * 0.32);

      var beams = [
        { ox: spot1X, oy: spot1Y, angle: angle1, len: 480, spread: 0.16 },
        { ox: spot2X, oy: spot2Y, angle: angle2, len: 520, spread: 0.18 }
      ];

      for (var bi2 = 0; bi2 < beams.length; bi2++) {
        var bm = beams[bi2];
        var aL = bm.angle - bm.spread;
        var aR = bm.angle + bm.spread;
        var x1 = bm.ox + Math.cos(aL) * bm.len;
        var y1 = bm.oy + Math.sin(aL) * bm.len;
        var x2 = bm.ox + Math.cos(aR) * bm.len;
        var y2 = bm.oy + Math.sin(aR) * bm.len;

        var bGrad = ctx.createLinearGradient(bm.ox, bm.oy, (x1 + x2) / 2, (y1 + y2) / 2);
        bGrad.addColorStop(0, paperRgba(s, beamBaseAlpha));
        bGrad.addColorStop(1, paperRgba(s, 0));

        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.moveTo(bm.ox, bm.oy);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 6. Mid Skyline Layer with Lit Windows (t >= 0.25)
    if (cache.mid && s.t >= 0.25) {
      var midShiftX = Math.floor(s.camX * 0.28) % layerW;
      var midShiftY = Math.floor(s.camY * 0.09);
      var midDrawY = vh - layerH + 30 - midShiftY;

      ctx.drawImage(cache.mid, -midShiftX, midDrawY);
      if (-midShiftX + layerW < vw) {
        ctx.drawImage(cache.mid, -midShiftX + layerW, midDrawY);
      }
    }

    // 7. Atmospheric Fog Bands (t >= 0.75)
    if (s.t >= 0.75) {
      var fogFade = clamp((s.t - 0.75) / 0.25, 0, 1);
      var fogY = vh * 0.7 - s.camY * 0.12;
      var fogGrad = ctx.createLinearGradient(0, fogY, 0, fogY + 90);
      fogGrad.addColorStop(0, paperRgba(s, 0));
      fogGrad.addColorStop(0.5, inkRgba(s, 0.12 * fogFade));
      fogGrad.addColorStop(1, paperRgba(s, 0));
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, fogY, vw, 90);
    }

    // 8. Near Skyline Layer (t >= 0.55)
    if (cache.near && s.t >= 0.55) {
      var nearShiftX = Math.floor(s.camX * 0.55) % layerW;
      var nearShiftY = Math.floor(s.camY * 0.18);
      var nearDrawY = vh - layerH - nearShiftY;

      ctx.drawImage(cache.near, -nearShiftX, nearDrawY);
      if (-nearShiftX + layerW < vw) {
        ctx.drawImage(cache.near, -nearShiftX + layerW, nearDrawY);
      }
    }
  }

  //---------------------------------------------------------------------------
  // PUBLIC API: drawTile(ctx, s, x, y, tx, ty)
  //---------------------------------------------------------------------------

  function drawTile(ctx, s, x, y, tx, ty) {
    if (!s || s.t <= 0) {
      // t = 0: Plain square exactly like original
      ctx.fillStyle = s.ink;
      ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = s.paper;
      ctx.fillRect(x + 29, y, 3, 32);
      ctx.fillRect(x, y + 29, 32, 3);
      return;
    }

    checkCache(s);

    // Deterministic tile hash for subtle masonry variation
    var th = hash2d(tx, ty, 505);

    // 1. Base tile body
    ctx.fillStyle = s.ink;
    ctx.fillRect(x, y, 32, 32);

    // 2. Bevel border (fades as advanced shading replaces it)
    if (s.t < 0.45) {
      var bevelAlpha = clamp(1 - (s.t - 0.05) / 0.35, 0, 1);
      ctx.fillStyle = paperRgba(s, bevelAlpha);
      ctx.fillRect(x + 29, y, 3, 32);
      ctx.fillRect(x, y + 29, 32, 3);
    }

    // 3. Subtle Brick Lines (t >= 0.05)
    if (s.t >= 0.05) {
      var mortarFade = clamp((s.t - 0.05) / 0.25, 0, 1);
      ctx.fillStyle = paperRgba(s, 0.28 * mortarFade);

      // Horizontal mortar lines dividing into 4 courses
      ctx.fillRect(x, y + 8, 32, 1);
      ctx.fillRect(x, y + 16, 32, 1);
      ctx.fillRect(x, y + 24, 32, 1);

      // Staggered vertical mortar lines (running bond)
      ctx.fillRect(x + 16, y, 1, 8);
      ctx.fillRect(x + 8, y + 8, 1, 8);
      ctx.fillRect(x + 24, y + 8, 1, 8);
      ctx.fillRect(x + 16, y + 16, 1, 8);
      ctx.fillRect(x + 8, y + 24, 1, 8);
      ctx.fillRect(x + 24, y + 24, 1, 8);
    }

    // 4. Dithered/Halftone Shading & Ground Shadow (t >= 0.35)
    if (s.t >= 0.35) {
      var shadeFade = clamp((s.t - 0.35) / 0.3, 0, 1);

      // Crisp top rim highlight
      ctx.fillStyle = paperRgba(s, 0.55 * shadeFade);
      ctx.fillRect(x + 1, y, 30, 1);

      // Dither halftone shading at bottom & right side
      if (cache.ditherPattern) {
        ctx.fillStyle = ctx.createPattern(cache.ditherPattern, 'repeat');
        ctx.fillRect(x, y + 22, 32, 10);
        ctx.fillRect(x + 26, y, 6, 22);
      }

      // Deep ground shadow at the very bottom
      ctx.fillStyle = paperRgba(s, 0.15 * shadeFade);
      ctx.fillRect(x, y + 30, 32, 2);

      // Occasional architectural brick weathering / subtle crack
      if (th > 0.85) {
        ctx.fillStyle = paperRgba(s, 0.35 * shadeFade);
        ctx.fillRect(x + 12, y + 11, 2, 2);
        ctx.fillRect(x + 13, y + 13, 2, 2);
      }
    }
  }

  //---------------------------------------------------------------------------
  // PUBLIC API: drawForeground(ctx, s)
  //---------------------------------------------------------------------------

  function drawForeground(ctx, s) {
    if (!s || s.t <= 0) return;
    checkCache(s);

    var vw = s.viewW;
    var vh = s.viewH;
    var motionFrame = prefersReducedMotion ? 0 : s.frame;

    // 1. Rain Particles (t >= 0.65, capped at 280 <= 300)
    if (s.t >= 0.65) {
      var rainRatio = clamp((s.t - 0.65) / 0.35, 0, 1);
      var activeCount = Math.min(NUM_PARTICLES, Math.round(rainRatio * NUM_PARTICLES));

      ctx.strokeStyle = inkRgba(s, 0.36);
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (var i = 0; i < activeCount; i++) {
        var p = PARTICLES[i];
        var px = (p.x + motionFrame * p.slant) % (vw + 40) - 20;
        var py = (p.y + motionFrame * p.speed) % (vh + 40) - 20;

        ctx.moveTo(px, py);
        ctx.lineTo(px - p.slant * (p.len / p.speed), py + p.len);
      }
      ctx.stroke();
    }

    // 2. Film Grain / Scanline Texture (t >= 0.85)
    if (s.t >= 0.85 && cache.scanlinePattern) {
      var grainFade = clamp((s.t - 0.85) / 0.15, 0, 1);
      ctx.fillStyle = ctx.createPattern(cache.scanlinePattern, 'repeat');
      ctx.fillRect(0, 0, vw, vh);
    }

    // 3. Cinematic Vignette (t >= 0.85)
    if (s.t >= 0.85) {
      var vigFade = clamp((s.t - 0.85) / 0.15, 0, 1);
      var vigGrad = ctx.createRadialGradient(
        vw / 2, vh / 2, Math.round(vw * 0.32),
        vw / 2, vh / 2, Math.round(vw * 0.72)
      );
      vigGrad.addColorStop(0, inkRgba(s, 0));
      vigGrad.addColorStop(1, inkRgba(s, 0.44 * vigFade));

      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, vw, vh);
    }

    // 4. Cinematic Letterbox Bars (t >= 0.95 - 1.0)
    if (s.t >= 0.95) {
      var barFade = clamp((s.t - 0.95) / 0.05, 0, 1);
      var barH = Math.round(28 * barFade);
      if (barH > 0) {
        ctx.fillStyle = s.ink;
        ctx.fillRect(0, 0, vw, barH);
        ctx.fillRect(0, vh - barH, vw, barH);
      }
    }
  }

  //---------------------------------------------------------------------------
  // EXPORT BROWSER GLOBAL
  //---------------------------------------------------------------------------

  global.D404Detail = {
    drawBackground: drawBackground,
    drawTile: drawTile,
    drawForeground: drawForeground
  };

})(typeof window !== 'undefined' ? window : this);
