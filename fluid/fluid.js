/*
 * Hero fluid background for dcreations.fr.
 * Adapted from WebGL-Fluid-Simulation by Pavel Dobryakov
 * https://github.com/PavelDoGreat/WebGL-Fluid-Simulation (master, script.js)
 *
 * Changes for this site: renders only into <canvas data-fluid> inside the hero,
 * no dat.GUI, no promo/app/social links, no analytics, no screenshots, no
 * external requests (bloom, sunrays and the dithering texture are removed),
 * monochrome dye, idle splats, pointer input read from the hero (the canvas
 * itself has pointer-events: none so links and the search field keep working),
 * paused when the tab is hidden or the hero is off-screen, a single still frame
 * with prefers-reduced-motion, and a silent fallback (plain black) without WebGL.
 *
 * MIT License
 *
 * Copyright (c) 2017 Pavel Dobryakov
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function () {
  'use strict';

  var canvas = document.querySelector('canvas[data-fluid]');
  if (!canvas) return;
  var host = canvas.closest('[data-fluid-host]') || canvas.parentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try { start(); } catch (e) { canvas.hidden = true; } // plain black hero without WebGL

  function start () {
    var config = {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 1024,
      DENSITY_DISSIPATION: 0.9,
      VELOCITY_DISSIPATION: 0.35,
      PRESSURE: 0.8,
      PRESSURE_ITERATIONS: 20,
      CURL: 22,
      SPLAT_RADIUS: 0.18,
      SPLAT_FORCE: 4200,
      SHADING: true,
      COLOR_UPDATE_SPEED: 4,
      BACK_COLOR: { r: 0, g: 0, b: 0 },
      IDLE_AFTER_MS: 3500,
      IDLE_EVERY_MS: 2200,
      MAX_PIXEL_RATIO: 1.5
    };

    var isMobile = /Mobi|Android/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 600;
    if (isMobile) config.DYE_RESOLUTION = 512;

    function Pointer () {
      this.id = -1;
      this.texcoordX = 0; this.texcoordY = 0;
      this.prevTexcoordX = 0; this.prevTexcoordY = 0;
      this.deltaX = 0; this.deltaY = 0;
      this.down = false; this.moved = false;
      this.color = generateColor();
    }

    var pointers = [new Pointer()];
    var splatStack = [];

    resizeCanvas();
    var ctx = getWebGLContext(canvas);
    if (!ctx) throw new Error('no webgl');
    var gl = ctx.gl, ext = ctx.ext;
    if (!ext.supportLinearFiltering) { config.DYE_RESOLUTION = 512; config.SHADING = false; }

    function getWebGLContext (canvas) {
      var params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
      var gl = canvas.getContext('webgl2', params);
      var isWebGL2 = !!gl;
      if (!isWebGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
      if (!gl) return null;

      var halfFloat, supportLinearFiltering;
      if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float');
        supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
      } else {
        halfFloat = gl.getExtension('OES_texture_half_float');
        supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
        if (!halfFloat) return null;
      }
      gl.clearColor(0.0, 0.0, 0.0, 1.0);

      var halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
      var formatRGBA, formatRG, formatR;
      if (isWebGL2) {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
      } else {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      }
      if (!formatRGBA || !formatRG || !formatR) return null;

      return { gl: gl, ext: { formatRGBA: formatRGBA, formatRG: formatRG, formatR: formatR, halfFloatTexType: halfFloatTexType, supportLinearFiltering: supportLinearFiltering } };
    }

    function getSupportedFormat (gl, internalFormat, format, type) {
      if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        switch (internalFormat) {
          case gl.R16F: return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
          case gl.RG16F: return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
          default: return null;
        }
      }
      return { internalFormat: internalFormat, format: format };
    }

    function supportRenderTextureFormat (gl, internalFormat, format, type) {
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE;
    }

    function Material (vertexShader, fragmentShaderSource) {
      this.vertexShader = vertexShader;
      this.fragmentShaderSource = fragmentShaderSource;
      this.programs = [];
      this.activeProgram = null;
      this.uniforms = [];
    }
    Material.prototype.setKeywords = function (keywords) {
      var hash = 0;
      for (var i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);
      var program = this.programs[hash];
      if (program == null) {
        var fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
        program = createProgram(this.vertexShader, fragmentShader);
        this.programs[hash] = program;
      }
      if (program == this.activeProgram) return;
      this.uniforms = getUniforms(program);
      this.activeProgram = program;
    };
    Material.prototype.bind = function () { gl.useProgram(this.activeProgram); };

    function Program (vertexShader, fragmentShader) {
      this.program = createProgram(vertexShader, fragmentShader);
      this.uniforms = getUniforms(this.program);
    }
    Program.prototype.bind = function () { gl.useProgram(this.program); };

    function createProgram (vertexShader, fragmentShader) {
      var program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
      return program;
    }

    function getUniforms (program) {
      var uniforms = [];
      var uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < uniformCount; i++) {
        var uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
      }
      return uniforms;
    }

    function compileShader (type, source, keywords) {
      source = addKeywords(source, keywords);
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('shader');
      return shader;
    }

    function addKeywords (source, keywords) {
      if (keywords == null) return source;
      var s = '';
      keywords.forEach(function (k) { s += '#define ' + k + '\n'; });
      return s + source;
    }

    var baseVertexShader = compileShader(gl.VERTEX_SHADER, [
      'precision highp float;',
      'attribute vec2 aPosition;',
      'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
      'uniform vec2 texelSize;',
      'void main () {',
      '  vUv = aPosition * 0.5 + 0.5;',
      '  vL = vUv - vec2(texelSize.x, 0.0);',
      '  vR = vUv + vec2(texelSize.x, 0.0);',
      '  vT = vUv + vec2(0.0, texelSize.y);',
      '  vB = vUv - vec2(0.0, texelSize.y);',
      '  gl_Position = vec4(aPosition, 0.0, 1.0);',
      '}'].join('\n'));

    var copyShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; uniform sampler2D uTexture;',
      'void main () { gl_FragColor = texture2D(uTexture, vUv); }'].join('\n'));

    var clearShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;',
      'void main () { gl_FragColor = value * texture2D(uTexture, vUv); }'].join('\n'));

    var colorShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; uniform vec4 color;',
      'void main () { gl_FragColor = color; }'].join('\n'));

    var displayShaderSource = [
      'precision highp float; precision highp sampler2D;',
      'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
      'uniform sampler2D uTexture; uniform vec2 texelSize;',
      'void main () {',
      '  vec3 c = texture2D(uTexture, vUv).rgb;',
      '#ifdef SHADING',
      '  vec3 lc = texture2D(uTexture, vL).rgb;',
      '  vec3 rc = texture2D(uTexture, vR).rgb;',
      '  vec3 tc = texture2D(uTexture, vT).rgb;',
      '  vec3 bc = texture2D(uTexture, vB).rgb;',
      '  float dx = length(rc) - length(lc);',
      '  float dy = length(tc) - length(bc);',
      '  vec3 n = normalize(vec3(dx, dy, length(texelSize)));',
      '  vec3 l = vec3(0.0, 0.0, 1.0);',
      '  float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);',
      '  c *= diffuse;',
      '#endif',
      '  float a = max(c.r, max(c.g, c.b));',
      '  gl_FragColor = vec4(c, a);',
      '}'].join('\n');

    var splatShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision highp float; precision highp sampler2D;',
      'varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio;',
      'uniform vec3 color; uniform vec2 point; uniform float radius;',
      'void main () {',
      '  vec2 p = vUv - point.xy;',
      '  p.x *= aspectRatio;',
      '  vec3 splat = exp(-dot(p, p) / radius) * color;',
      '  vec3 base = texture2D(uTarget, vUv).xyz;',
      '  gl_FragColor = vec4(base + splat, 1.0);',
      '}'].join('\n'));

    var advectionShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision highp float; precision highp sampler2D;',
      'varying vec2 vUv; uniform sampler2D uVelocity; uniform sampler2D uSource;',
      'uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt; uniform float dissipation;',
      'vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {',
      '  vec2 st = uv / tsize - 0.5;',
      '  vec2 iuv = floor(st); vec2 fuv = fract(st);',
      '  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);',
      '  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);',
      '  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);',
      '  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);',
      '  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);',
      '}',
      'void main () {',
      '#ifdef MANUAL_FILTERING',
      '  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;',
      '  vec4 result = bilerp(uSource, coord, dyeTexelSize);',
      '#else',
      '  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
      '  vec4 result = texture2D(uSource, coord);',
      '#endif',
      '  float decay = 1.0 + dissipation * dt;',
      '  gl_FragColor = result / decay;',
      '}'].join('\n'),
      ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']);

    var divergenceShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;',
      'uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uVelocity, vL).x;',
      '  float R = texture2D(uVelocity, vR).x;',
      '  float T = texture2D(uVelocity, vT).y;',
      '  float B = texture2D(uVelocity, vB).y;',
      '  vec2 C = texture2D(uVelocity, vUv).xy;',
      '  if (vL.x < 0.0) { L = -C.x; }',
      '  if (vR.x > 1.0) { R = -C.x; }',
      '  if (vT.y > 1.0) { T = -C.y; }',
      '  if (vB.y < 0.0) { B = -C.y; }',
      '  float div = 0.5 * (R - L + T - B);',
      '  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);',
      '}'].join('\n'));

    var curlShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;',
      'uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uVelocity, vL).y;',
      '  float R = texture2D(uVelocity, vR).y;',
      '  float T = texture2D(uVelocity, vT).x;',
      '  float B = texture2D(uVelocity, vB).x;',
      '  float vorticity = R - L - T + B;',
      '  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);',
      '}'].join('\n'));

    var vorticityShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision highp float; precision highp sampler2D;',
      'varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;',
      'uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;',
      'void main () {',
      '  float L = texture2D(uCurl, vL).x;',
      '  float R = texture2D(uCurl, vR).x;',
      '  float T = texture2D(uCurl, vT).x;',
      '  float B = texture2D(uCurl, vB).x;',
      '  float C = texture2D(uCurl, vUv).x;',
      '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
      '  force /= length(force) + 0.0001;',
      '  force *= curl * C;',
      '  force.y *= -1.0;',
      '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
      '  velocity += force * dt;',
      '  velocity = min(max(velocity, -1000.0), 1000.0);',
      '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
      '}'].join('\n'));

    var pressureShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;',
      'uniform sampler2D uPressure; uniform sampler2D uDivergence;',
      'void main () {',
      '  float L = texture2D(uPressure, vL).x;',
      '  float R = texture2D(uPressure, vR).x;',
      '  float T = texture2D(uPressure, vT).x;',
      '  float B = texture2D(uPressure, vB).x;',
      '  float divergence = texture2D(uDivergence, vUv).x;',
      '  float pressure = (L + R + B + T - divergence) * 0.25;',
      '  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);',
      '}'].join('\n'));

    var gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, [
      'precision mediump float; precision mediump sampler2D;',
      'varying highp vec2 vUv; varying highp vec2 vL; varying highp vec2 vR; varying highp vec2 vT; varying highp vec2 vB;',
      'uniform sampler2D uPressure; uniform sampler2D uVelocity;',
      'void main () {',
      '  float L = texture2D(uPressure, vL).x;',
      '  float R = texture2D(uPressure, vR).x;',
      '  float T = texture2D(uPressure, vT).x;',
      '  float B = texture2D(uPressure, vB).x;',
      '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
      '  velocity.xy -= vec2(R - L, T - B);',
      '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
      '}'].join('\n'));

    var blit = (function () {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return function (target, clear) {
        if (target == null) {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear) {
          gl.clearColor(0.0, 0.0, 0.0, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    var dye, velocity, divergence, curl, pressure;

    var copyProgram = new Program(baseVertexShader, copyShader);
    var clearProgram = new Program(baseVertexShader, clearShader);
    var colorProgram = new Program(baseVertexShader, colorShader);
    var splatProgram = new Program(baseVertexShader, splatShader);
    var advectionProgram = new Program(baseVertexShader, advectionShader);
    var divergenceProgram = new Program(baseVertexShader, divergenceShader);
    var curlProgram = new Program(baseVertexShader, curlShader);
    var vorticityProgram = new Program(baseVertexShader, vorticityShader);
    var pressureProgram = new Program(baseVertexShader, pressureShader);
    var gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);
    var displayMaterial = new Material(baseVertexShader, displayShaderSource);

    function initFramebuffers () {
      var simRes = getResolution(config.SIM_RESOLUTION);
      var dyeRes = getResolution(config.DYE_RESOLUTION);
      var texType = ext.halfFloatTexType;
      var rgba = ext.formatRGBA, rg = ext.formatRG, r = ext.formatR;
      var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);
      if (dye == null) dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
      else dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
      if (velocity == null) velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
      else velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
      divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
      pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    }

    function createFBO (w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        texture: texture, fbo: fbo, width: w, height: h,
        texelSizeX: 1.0 / w, texelSizeY: 1.0 / h,
        attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; }
      };
    }

    function createDoubleFBO (w, h, internalFormat, format, type, param) {
      var fbo1 = createFBO(w, h, internalFormat, format, type, param);
      var fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w, height: h, texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
        get read () { return fbo1; }, set read (v) { fbo1 = v; },
        get write () { return fbo2; }, set write (v) { fbo2 = v; },
        swap: function () { var t = fbo1; fbo1 = fbo2; fbo2 = t; }
      };
    }

    function resizeFBO (target, w, h, internalFormat, format, type, param) {
      var newFBO = createFBO(w, h, internalFormat, format, type, param);
      copyProgram.bind();
      gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(newFBO);
      return newFBO;
    }

    function resizeDoubleFBO (target, w, h, internalFormat, format, type, param) {
      if (target.width == w && target.height == h) return target;
      target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
      target.write = createFBO(w, h, internalFormat, format, type, param);
      target.width = w; target.height = h;
      target.texelSizeX = 1.0 / w; target.texelSizeY = 1.0 / h;
      return target;
    }

    displayMaterial.setKeywords(config.SHADING ? ['SHADING'] : []);
    initFramebuffers();

    var lastUpdateTime = Date.now();
    var colorUpdateTimer = 0.0;
    var lastInput = 0;
    var lastIdleSplat = 0;
    var raf = 0;
    var visible = true;   // hero on screen
    var pageShown = !document.hidden;

    multipleSplats(Math.floor(Math.random() * 4) + 4);

    if (reduceMotion) {
      // One still frame: let the first splats spread a little, draw once, stop.
      for (var i = 0; i < 45; i++) step(0.016);
      render();
      canvas.classList.add('is-ready');
      return;
    }

    canvas.classList.add('is-ready');
    loop();

    function loop () {
      raf = 0;
      if (!visible || !pageShown) return;
      update();
      raf = requestAnimationFrame(loop);
    }
    function resume () {
      if (!raf && visible && pageShown) { lastUpdateTime = Date.now(); raf = requestAnimationFrame(loop); }
    }
    document.addEventListener('visibilitychange', function () {
      pageShown = !document.hidden;
      if (pageShown) resume();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) resume();
      }, { threshold: 0 }).observe(host);
    }

    function update () {
      var dt = calcDeltaTime();
      if (resizeCanvas()) initFramebuffers();
      updateColors(dt);
      idleSplats();
      applyInputs();
      step(dt);
      render();
    }

    function idleSplats () {
      var now = Date.now();
      if (now - lastInput < config.IDLE_AFTER_MS || now - lastIdleSplat < config.IDLE_EVERY_MS) return;
      lastIdleSplat = now;
      multipleSplats(Math.random() < 0.5 ? 1 : 2);
    }

    function calcDeltaTime () {
      var now = Date.now();
      var dt = Math.min((now - lastUpdateTime) / 1000, 0.016666);
      lastUpdateTime = now;
      return dt;
    }

    function updateColors (dt) {
      colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
      if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        pointers.forEach(function (p) { p.color = generateColor(); });
      }
    }

    function applyInputs () {
      if (splatStack.length > 0) multipleSplats(splatStack.pop());
      pointers.forEach(function (p) {
        if (p.moved) { p.moved = false; splatPointer(p); }
      });
    }

    function step (dt) {
      gl.disable(gl.BLEND);

      curlProgram.bind();
      gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl);

      vorticityProgram.bind();
      gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      divergenceProgram.bind();
      gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence);

      clearProgram.bind();
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
      blit(pressure.write);
      pressure.swap();

      pressureProgram.bind();
      gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }

      gradienSubtractProgram.bind();
      gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      advectionProgram.bind();
      gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      var velocityId = velocity.read.attach(0);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
      blit(dye.write);
      dye.swap();
    }

    function render () {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      colorProgram.bind();
      var c = config.BACK_COLOR;
      gl.uniform4f(colorProgram.uniforms.color, c.r / 255, c.g / 255, c.b / 255, 1);
      blit(null);

      displayMaterial.bind();
      if (config.SHADING) gl.uniform2f(displayMaterial.uniforms.texelSize, 1.0 / gl.drawingBufferWidth, 1.0 / gl.drawingBufferHeight);
      gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
      blit(null);
    }

    function splatPointer (pointer) {
      splat(pointer.texcoordX, pointer.texcoordY, pointer.deltaX * config.SPLAT_FORCE, pointer.deltaY * config.SPLAT_FORCE, pointer.color);
    }

    function multipleSplats (amount) {
      for (var i = 0; i < amount; i++) {
        var color = generateColor();
        color.r *= 6.0; color.g *= 6.0; color.b *= 6.0;
        var x = 0.1 + Math.random() * 0.8;
        var y = 0.1 + Math.random() * 0.8;
        var dx = 900 * (Math.random() - 0.5);
        var dy = 900 * (Math.random() - 0.5);
        splat(x, y, dx, dy, color);
      }
    }

    function splat (x, y, dx, dy, color) {
      splatProgram.bind();
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
      gl.uniform1f(splatProgram.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100.0));
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      blit(dye.write);
      dye.swap();
    }

    function correctRadius (radius) {
      var aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) radius *= aspectRatio;
      return radius;
    }

    /* ---- input: read from the hero, never from the canvas (pointer-events: none) ---- */
    function localPos (e) {
      var r = canvas.getBoundingClientRect();
      return { x: scaleByPixelRatio(e.clientX - r.left), y: scaleByPixelRatio(e.clientY - r.top), inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
    }
    function pointerFor (e) {
      var p = null;
      for (var i = 0; i < pointers.length; i++) if (pointers[i].id === e.pointerId) p = pointers[i];
      if (!p) { p = new Pointer(); pointers.push(p); if (pointers.length > 6) pointers.splice(0, 1); }
      return p;
    }
    host.addEventListener('pointerdown', function (e) {
      var pos = localPos(e);
      if (!pos.inside) return;
      lastInput = Date.now();
      updatePointerDownData(pointerFor(e), e.pointerId, pos.x, pos.y);
    }, { passive: true });
    host.addEventListener('pointermove', function (e) {
      var pos = localPos(e);
      if (!pos.inside) return;
      lastInput = Date.now();
      var p = pointerFor(e);
      // Mouse: react to plain hover; touch/pen: only while the finger is down (never blocks scrolling).
      if (p.id !== e.pointerId) {
        updatePointerDownData(p, e.pointerId, pos.x, pos.y);
        return;
      }
      if (e.pointerType !== 'mouse' && !p.down) return;
      updatePointerMoveData(p, pos.x, pos.y);
    }, { passive: true });
    host.addEventListener('pointerleave', function (e) {
      // Re-anchor on the next hover so re-entering the hero does not create a jump.
      for (var i = 0; i < pointers.length; i++) if (pointers[i].id === e.pointerId) pointers[i].id = -2;
    }, { passive: true });
    function up (e) {
      for (var i = 0; i < pointers.length; i++) if (pointers[i].id === e.pointerId && e.pointerType !== 'mouse') pointers[i].down = false;
    }
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });

    function updatePointerDownData (pointer, id, posX, posY) {
      pointer.id = id;
      pointer.down = true;
      pointer.moved = false;
      pointer.texcoordX = posX / canvas.width;
      pointer.texcoordY = 1.0 - posY / canvas.height;
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      pointer.color = generateColor();
    }

    function updatePointerMoveData (pointer, posX, posY) {
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = posX / canvas.width;
      pointer.texcoordY = 1.0 - posY / canvas.height;
      pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
      pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
      pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    }

    function correctDeltaX (delta) {
      var aspectRatio = canvas.width / canvas.height;
      if (aspectRatio < 1) delta *= aspectRatio;
      return delta;
    }

    function correctDeltaY (delta) {
      var aspectRatio = canvas.width / canvas.height;
      if (aspectRatio > 1) delta /= aspectRatio;
      return delta;
    }

    /* Monochrome dye: soft grey with the faintest cool tint. */
    function generateColor () {
      var v = 0.05 + Math.random() * 0.07;
      return { r: v * 0.94, g: v * 0.97, b: v };
    }

    function wrap (value, min, max) {
      var range = max - min;
      if (range == 0) return min;
      return (value - min) % range + min;
    }

    function getResolution (resolution) {
      var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
      var min = Math.round(resolution);
      var max = Math.round(resolution * aspectRatio);
      if (gl.drawingBufferWidth > gl.drawingBufferHeight) return { width: max, height: min };
      return { width: min, height: max };
    }

    function scaleByPixelRatio (input) {
      var pixelRatio = Math.min(window.devicePixelRatio || 1, config.MAX_PIXEL_RATIO);
      return Math.floor(input * pixelRatio);
    }

    function resizeCanvas () {
      var width = Math.max(1, scaleByPixelRatio(canvas.clientWidth));
      var height = Math.max(1, scaleByPixelRatio(canvas.clientHeight));
      if (canvas.width != width || canvas.height != height) {
        canvas.width = width;
        canvas.height = height;
        return true;
      }
      return false;
    }

    function hashCode (s) {
      if (s.length == 0) return 0;
      var hash = 0;
      for (var i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }
  }
})();
