/* Lava lamp (dcreations.fr), black and white, behind the whole site. WebGL metaballs, no dependencies.
   - One fixed canvas[data-lava] under the page. Blobs drift around and move out of the way of content
     (headings, text, cards, images, buttons, the search box), so text always stays readable.
   - Grab a blob and drag it anywhere; let go and it keeps drifting from there (a quick flick throws it).
   - A quick click pops the blob: it swells, bursts into drops that fall, slide off the corners of
     content and disappear. Popped blobs do not come back until the next page load.
   Drawn white with a difference blend: black on light, white on dark, text over it inverts. Pauses when the tab is hidden;
   one still frame with reduced motion; nothing at all without WebGL. */
(() => {
  const canvas = document.querySelector('canvas[data-lava]');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) { canvas.remove(); return; }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = Math.max(16, Math.min(80, (gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 64) - 12));

  const fs = `precision mediump float;
    #define N ${N}
    uniform vec3 b[N]; uniform int n; uniform vec2 res; uniform vec3 c; uniform float dpr;
    void main(){
      vec2 q = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
      float f = 0.0;
      for (int i = 0; i < N; i++) { if (i >= n) break; vec2 d = q - b[i].xy; f += b[i].z * b[i].z / (dot(d, d) + 1.0); }
      float a = smoothstep(0.96, 1.04, f);
      gl_FragColor = vec4(c * a, a);
    }`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (k) => gl.getUniformLocation(prog, k);
  const uB = U('b'), uN = U('n'), uRes = U('res'), uC = U('c'), uDpr = U('dpr');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // White blobs drawn with mix-blend-mode: difference (see redesign.css): they look black on the
  // light theme and white on the dark one, and any text a blob passes over turns inverse, so it stays readable.
  const colour = () => { gl.uniform3f(uC, 1, 1, 1); wake(); };
  new MutationObserver(colour).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-night'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', colour);

  // ---- viewport and content boxes to stay out of ----
  let W = 0, H = 0, dpr = 1, avoid = [];
  const PAD = 14;
  const AVOID = 'main :is(h1, h2, h3, p, li, dt, dd, figure, img, video, table, label, .card, .proj-card, .btn, form, .hero-search, .marquee, .tools, [data-lava-avoid], .actions, .stats), footer :is(p, a, h2, h3, nav, .contact-strip, button), .site-header';
  const measure = () => {
    W = innerWidth; H = innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uDpr, dpr);
  };
  const collect = () => {
    const out = [];
    for (const el of document.querySelectorAll(AVOID)) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -40 || r.top > H + 40 || r.width < 4 || r.height < 4) continue;
      // Skip big wrappers whose children are already listed (keeps gaps between cards usable).
      if (r.width > W * 0.92 && r.height > H * 0.6 && !el.matches('[data-lava-avoid]')) continue;
      out.push({ l: r.left - PAD, t: r.top - PAD, r: r.right + PAD, b: r.bottom + PAD });
      if (out.length > 160) break;
    }
    avoid = out;
  };

  // ---- blobs and drops ----
  const rnd = (a, b) => a + Math.random() * (b - a);
  const blobs = [];
  const drops = [];
  const size = () => Math.max(0.5, Math.min(1.15, Math.min(W, H) / 900));
  const newTarget = (b) => { b.tx = rnd(0.04, 0.96) * W; b.ty = rnd(0.08, 0.95) * H; b.tt = rnd(5, 11); };
  const seed = () => {
    const k = W < 600 ? 4 : 7, s = size();
    for (let i = 0; i < k; i++) {
      const b = { x: i % 2 ? rnd(0.75, 0.97) * W : rnd(0.03, 0.25) * W, y: rnd(0.15, 0.9) * H, vx: 0, vy: 0, r: rnd(26, 54) * s, ph: rnd(0, 6.3), state: 'idle', t: 0 };
      b.r0 = b.r; newTarget(b); blobs.push(b);
    }
  };

  const pushOut = (o, rad, k) => {
    for (const a of avoid) {
      const cx = Math.max(a.l, Math.min(o.x, a.r)), cy = Math.max(a.t, Math.min(o.y, a.b));
      const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
      if (d2 >= rad * rad) continue;
      if (d2 > 0.01) { const d = Math.sqrt(d2), m = (rad - d) / d; o.x += dx * m * k; o.y += dy * m * k; }
      else {
        // Centre inside the box: leave by the nearest edge.
        const e = [o.x - a.l, a.r - o.x, o.y - a.t, a.b - o.y], i = e.indexOf(Math.min(...e)), s = 6;
        if (i === 0) o.x -= s; else if (i === 1) o.x += s; else if (i === 2) o.y -= s; else o.y += s;
      }
    }
  };

  const drag = { b: null, id: -1, sx: 0, sy: 0, t0: 0, moved: false, lx: 0, ly: 0, lt: 0, vx: 0, vy: 0 };

  const step = (dt, time) => {
    for (let i = blobs.length - 1; i >= 0; i--) {
      const b = blobs[i];
      if (b.state === 'drag') continue;
      if (b.state === 'pop') {
        b.t += dt;
        const k = Math.min(1, b.t / 0.45);
        b.r = b.r0 * (1 + 0.7 * k * k) + Math.sin(b.t * 44) * 2.5 * k;
        if (k >= 1) { burst(b); blobs.splice(i, 1); }
        continue;
      }
      b.tt -= dt;
      if (b.tt <= 0) newTarget(b);
      b.vx += ((b.tx - b.x) * 0.06 + Math.sin(time * 0.7 + b.ph) * 10) * dt;
      b.vy += ((b.ty - b.y) * 0.06 + Math.cos(time * 0.5 + b.ph) * 10) * dt;
      b.vx *= 0.985; b.vy *= 0.985;
      const sp = Math.hypot(b.vx, b.vy), max = 140;
      if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.r += (b.r0 * (1 + Math.sin(time * 0.9 + b.ph) * 0.06) - b.r) * 2 * dt;
      pushOut(b, b.r * 1.15, 0.45);
      // Soft walls: blobs stay on screen.
      if (b.x < b.r * 0.3) b.vx += 60 * dt;
      if (b.x > W - b.r * 0.3) b.vx -= 60 * dt;
      if (b.y < b.r * 0.3) b.vy += 60 * dt;
      if (b.y > H - b.r * 0.3) b.vy -= 60 * dt;
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life -= dt;
      if (d.life < 0.6) d.r *= 1 - 2.2 * dt;
      if (d.life <= 0 || d.r < 1.5) { drops.splice(i, 1); continue; }
      if (d.slide) {
        // Sliding along the top of a box toward its nearest corner, then dripping off it.
        const a = d.slide;
        d.vx += d.dir * 520 * dt; d.vx = Math.max(-260, Math.min(260, d.vx));
        d.x += d.vx * dt; d.y = a.t - d.r * 0.55;
        if (d.x < a.l - d.r * 0.4 || d.x > a.r + d.r * 0.4) { d.slide = null; d.vy = 40; d.vx *= 0.25; }
        continue;
      }
      d.vy += 1500 * dt;
      const px = d.x, py = d.y;
      d.x += d.vx * dt; d.y += d.vy * dt;
      for (const a of avoid) {
        if (d.x > a.l && d.x < a.r && d.y + d.r * 0.5 > a.t && d.y < a.b) {
          if (py + d.r * 0.5 <= a.t + 2 && d.vy > 0) { d.slide = a; d.dir = d.x < (a.l + a.r) / 2 ? -1 : 1; d.vy = 0; d.vx *= 0.3; d.y = a.t - d.r * 0.55; }
          else if (py >= a.b) { d.y = a.b + d.r; d.vy = Math.abs(d.vy) * 0.2; }
          else { d.x = px < (a.l + a.r) / 2 ? a.l - 1 : a.r + 1; d.vx *= -0.3; }
          break;
        }
      }
      if (d.y > H + 40) drops.splice(i, 1);
    }
  };

  const burst = (b) => {
    const n = Math.round(14 + b.r0 / 3), s = size();
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(200, 560);
      drops.push({ x: b.x + Math.cos(a) * b.r * 0.6, y: b.y + Math.sin(a) * b.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rnd(100, 320), r: rnd(7, 17) * s, life: rnd(1.6, 2.8) });
    }
  };

  // ---- pointer: hover cursor, grab and drag, click to pop ----
  const interactive = 'a, button, input, textarea, select, label, summary, [contenteditable], [role="button"], [data-lava-avoid] *';
  const hit = (x, y) => {
    let best = null, bd = Infinity;
    for (const b of blobs) { if (b.state !== 'idle') continue; const d = Math.hypot(b.x - x, b.y - y); if (d < b.r * 1.05 && d < bd) { best = b; bd = d; } }
    return best;
  };
  const free = (e) => !(e.target instanceof Element && e.target.closest(interactive));
  // Mouse: grab at once. Touch: scrolling always wins; holding a finger still on a blob for 250 ms
  // grabs it (then the page stops scrolling until you let go); a quick tap without moving pops it.
  const pending = { b: null, id: -1, x: 0, y: 0, t0: 0, timer: 0 };
  const grab = (b, e) => {
    Object.assign(drag, { b, id: e.pointerId, sx: e.clientX, sy: e.clientY, t0: performance.now(), moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 });
    b.state = 'drag'; b.vx = b.vy = 0;
    document.documentElement.classList.add('lava-dragging');
    poke();
  };
  addEventListener('pointerdown', (e) => {
    if (reduce || e.button !== 0 || !free(e)) return;
    const b = hit(e.clientX, e.clientY);
    if (!b) return;
    if (e.pointerType === 'mouse') { e.preventDefault(); grab(b, e); return; }
    Object.assign(pending, { b, id: e.pointerId, x: e.clientX, y: e.clientY, t0: performance.now() });
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => { if (pending.b && pending.b.state === 'idle') { grab(pending.b, { pointerId: pending.id, clientX: pending.x, clientY: pending.y }); pending.b = null; } }, 250);
  }, { passive: true });
  addEventListener('touchmove', (e) => { if (drag.b) e.preventDefault(); }, { passive: false });
  addEventListener('pointermove', (e) => {
    if (pending.b && e.pointerId === pending.id && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > 10) { clearTimeout(pending.timer); pending.b = null; }
    if (drag.b && e.pointerId === drag.id) {
      const now = performance.now(), dt = Math.max(1, now - drag.lt) / 1000;
      drag.vx = drag.vx * 0.6 + ((e.clientX - drag.lx) / dt) * 0.4;
      drag.vy = drag.vy * 0.6 + ((e.clientY - drag.ly) / dt) * 0.4;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      drag.b.x = e.clientX; drag.b.y = e.clientY;
      poke();
      return;
    }
    if (reduce || e.pointerType !== 'mouse') return;
    document.documentElement.classList.toggle('lava-hover', free(e) && !!hit(e.clientX, e.clientY));
  }, { passive: true });
  const release = (e) => {
    if (pending.b && e.pointerId === pending.id) {
      clearTimeout(pending.timer);
      if (e.type === 'pointerup' && performance.now() - pending.t0 < 250) { pending.b.state = 'pop'; pending.b.t = 0; pending.b.r0 = pending.b.r; poke(); }
      pending.b = null;
      return;
    }
    if (!drag.b || e.pointerId !== drag.id) return;
    const b = drag.b;
    if (!drag.moved && performance.now() - drag.t0 < 350) { b.state = 'pop'; b.t = 0; b.r0 = b.r; }
    else {
      b.state = 'idle';
      const sp = Math.hypot(drag.vx, drag.vy), max = 900;
      b.vx = drag.vx * (sp > max ? max / sp : 1); b.vy = drag.vy * (sp > max ? max / sp : 1);
      b.tx = b.x + b.vx * 0.6; b.ty = b.y + b.vy * 0.6; b.tt = rnd(4, 8);
    }
    drag.b = null;
    document.documentElement.classList.remove('lava-dragging');
    poke();
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  // ---- loop ----
  const data = new Float32Array(N * 3);
  const draw = () => {
    let k = 0;
    const put = (o) => { if (k < N) { data[k * 3] = o.x; data[k * 3 + 1] = o.y; data[k * 3 + 2] = o.r; k++; } };
    blobs.forEach(put);
    for (let i = drops.length - 1; i >= 0; i--) put(drops[i]);
    gl.uniform3fv(uB, data);
    gl.uniform1i(uN, k);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  let raf = 0, last = 0, lastCollect = 0, lastPoke = 0;
  function poke() { lastPoke = performance.now(); wake(); }
  const frame = (now) => {
    raf = 0;
    const busy = drag.b || drops.length || blobs.some((b) => b.state !== 'idle') || now - lastPoke < 2500;
    if (!busy && now - last < 41) { raf = requestAnimationFrame(frame); return; }
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (now - lastCollect > 200) { collect(); lastCollect = now; }
    step(dt, now / 1000);
    draw();
    if (!document.hidden && !reduce && (blobs.length || drops.length)) raf = requestAnimationFrame(frame);
  };
  function wake() { if (!raf && !document.hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', wake);
  addEventListener('scroll', poke, { passive: true });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); collect(); draw(); }, 120); });

  measure(); collect(); seed();
  // Let blobs settle out of the content before the first frame is shown.
  for (let i = 0; i < 40; i++) step(0.016, i * 0.016);
  colour();
  if (reduce) draw(); else wake();
  canvas.classList.add('is-ready');
})();
