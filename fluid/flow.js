/* D-CREATIONS flow: a light "fluid smoke" background in one WebGL shader (no simulation passes).
   Draws into canvas[data-fluid] inside [data-fluid-host], colours from the page's --bg / --text,
   so light, dark and night modes follow automatically. Low resolution, capped frame rate, pauses when
   hidden or off-screen. Without WebGL, with reduced motion or Save-Data, it does nothing and the CSS
   fallback (a static soft gradient) stays visible. */
(function () {
  'use strict';
  var cv = document.querySelector('canvas[data-fluid]');
  if (!cv) return;
  var host = cv.closest('[data-fluid-host]') || cv.parentElement;
  var nav = navigator, mm = window.matchMedia;
  if ((mm && mm('(prefers-reduced-motion: reduce)').matches) || (nav.connection && nav.connection.saveData)) return;
  var gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;

  // Weak devices: fewer pixels and frames.
  var weak = (nav.hardwareConcurrency || 4) <= 4 || (nav.deviceMemory || 4) <= 4 || /Mobi|Android/i.test(nav.userAgent);
  var SCALE = weak ? 0.22 : 0.35, FPS = weak ? 24 : 40, MAXW = weak ? 360 : 640;

  var fs = 'precision mediump float;uniform vec2 R;uniform float T;uniform vec3 B,F;uniform vec3 P[4];' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}' +
    'float b(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}' +
    'void main(){vec2 u=gl_FragCoord.xy/R,q=u*vec2(R.x/R.y,1.)*2.4;float s=0.;' +
    'for(int i=0;i<4;i++){vec2 d=u-P[i].xy;d.x*=R.x/R.y;float k=P[i].z*exp(-dot(d,d)*22.);q+=k*vec2(-d.y,d.x)*7.;s+=k;}' +
    'vec2 w=vec2(b(q+T*.06),b(q+vec2(5.2,1.3)-T*.05));float f=b(q+3.2*w+T*.035);' +
    'float m=smoothstep(.5,.98,f)*.9+s*.18;m*=.45+.55*smoothstep(1.1,.15,length(u-vec2(.5,.55)));' +
    'gl_FragColor=vec4(mix(B,F,clamp(m,0.,1.)*.55),1.);}';
  var vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['R', 'T', 'B', 'F', 'P'].forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });

  // Colours from the CSS variables of the host (updated when the theme or night mode changes).
  function rgb(v) {
    var d = document.createElement('i'); d.style.color = v; d.style.display = 'none'; host.appendChild(d);
    var m = getComputedStyle(d).color.match(/[\d.]+/g) || [0, 0, 0]; host.removeChild(d);
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }
  function colours() {
    var st = getComputedStyle(host);
    gl.uniform3fv(U.B, rgb(st.getPropertyValue('--bg').trim() || '#000'));
    gl.uniform3fv(U.F, rgb(st.getPropertyValue('--text').trim() || '#fff'));
  }
  new MutationObserver(colours).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-night'] });
  if (mm) { var q = mm('(prefers-color-scheme: dark)'); q.addEventListener ? q.addEventListener('change', colours) : q.addListener(colours); }

  function size() {
    var r = host.getBoundingClientRect(), w = Math.min(MAXW, Math.max(1, Math.round(r.width * SCALE)));
    cv.width = w; cv.height = Math.max(1, Math.round(w * r.height / Math.max(1, r.width)));
    gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(U.R, cv.width, cv.height);
  }

  // Four swirl points: the pointer leaves them, idle time adds them.
  var P = new Float32Array(12), pi = 0, last = 0, idle = 0;
  function splat(x, y, k) { P[pi * 3] = x; P[pi * 3 + 1] = y; P[pi * 3 + 2] = k; pi = (pi + 1) % 4; }
  host.addEventListener('pointermove', function (e) {
    var r = host.getBoundingClientRect(), now = performance.now();
    if (now - last < 60) return; last = idle = now;
    splat((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, 1);
  }, { passive: true });

  var on = true, vis = true, prev = 0, t0 = performance.now();
  function frame(now) {
    if (!on || !vis) return;
    requestAnimationFrame(frame);
    if (now - prev < 1000 / FPS) return;
    prev = now;
    if (now - idle > 2600) { idle = now; splat(0.2 + Math.random() * 0.6, 0.25 + Math.random() * 0.5, 0.7); }
    for (var i = 0; i < 4; i++) P[i * 3 + 2] *= 0.965;
    gl.uniform3fv(U.P, P); gl.uniform1f(U.T, (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function go() { if (on && vis) { prev = 0; requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', function () { on = !document.hidden; go(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; go(); }).observe(host);
  window.addEventListener('resize', size, { passive: true });
  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); on = false; cv.classList.remove('is-ready'); });

  size(); colours();
  for (var j = 0; j < 3; j++) splat(0.25 + j * 0.25, 0.4 + Math.random() * 0.3, 0.9);
  gl.uniform3fv(U.P, P); gl.uniform1f(U.T, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
  cv.classList.add('is-ready');
  go();
})();
