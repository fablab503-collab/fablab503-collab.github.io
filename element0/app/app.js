import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================================
// 1. PROTOCOL CONSTANTS & STATE
// ============================================================================
const SERVICE_UUID = 'e1e70001-5a1d-4c6e-9d1e-0e1e3e7e0001';
const STATE_UUID   = 'e1e70002-5a1d-4c6e-9d1e-0e1e3e7e0001';
const COMMAND_UUID = 'e1e70003-5a1d-4c6e-9d1e-0e1e3e7e0001';
const TEXT_UUID    = 'e1e70004-5a1d-4c6e-9d1e-0e1e3e7e0001';

const APP_URL_IOS     = 'theelements://pair';
const APP_URL_ANDROID = 'https://dcreations.fr/';

let facesList = [
  { id: 'neutral', en: 'Neutral', fr: 'Neutre' }
];
const faceImageCache = new Map();

let lang = 'en'; // 'en' | 'fr'
let isSimulationMode = true;
let isConnected = false;

let bleDevice = null;
let bleServer = null;
let stateChar = null;
let cmdChar = null;

const state = {
  v: 1,
  screen: 'select',
  sel: 0,
  face: 0,
  faceId: 'neutral',
  faceName: 'Neutral',
  faceCount: 138,
  qrTitle: '',
  qrUrl: '',
  sd: 'SD 29.5 GB, 29.5 free'
};

// ============================================================================
// 2. DOM ELEMENTS
// ============================================================================
const stageEl         = document.getElementById('stage');
const settingsBtn     = document.getElementById('settings-btn');
const settingsPanel   = document.getElementById('settings-panel');
const statusPill      = document.getElementById('status-pill');
const statusText      = document.getElementById('status-text');
const btnConnect      = document.getElementById('btn-connect');
const btnReconnect    = document.getElementById('btn-reconnect');
const btnDisconnect   = document.getElementById('btn-disconnect');
const bleErrorEl      = document.getElementById('ble-error');
const sdLineEl        = document.getElementById('sd-line');
const langEnBtn       = document.getElementById('lang-en');
const langFrBtn       = document.getElementById('lang-fr');
const simToggle       = document.getElementById('sim-toggle');
const btnResetView    = document.getElementById('btn-reset-view');
const displayControls = document.getElementById('display-controls');
const btnBoot         = document.getElementById('btn-boot');
const btnPwr          = document.getElementById('btn-pwr');
const btnBack3d       = document.getElementById('btn-back-3d');

// ============================================================================
// 3. 200x200 E-PAPER CANVAS TEXTURE RENDERER
// ============================================================================
const LOGICAL_SIZE = 200;
const TEX_SCALE = 4; // Crisp supersampled 200x200 coordinate space
const epdCanvas = document.createElement('canvas');
epdCanvas.width = LOGICAL_SIZE * TEX_SCALE;
epdCanvas.height = LOGICAL_SIZE * TEX_SCALE;
const epdCtx = epdCanvas.getContext('2d');

const screenTexture = new THREE.CanvasTexture(epdCanvas);
screenTexture.colorSpace = THREE.SRGBColorSpace;
screenTexture.flipY = false;
screenTexture.minFilter = THREE.LinearMipmapLinearFilter;
screenTexture.magFilter = THREE.LinearFilter;

// Apple / Android logos (Simple Icons SVGs in assets/logos), cached per colour; redraw once loaded.
const logoCache = {};
function logoImage(name, color) {
  const key = `${name}:${color}`;
  if (!logoCache[key]) {
    const img = new Image();
    logoCache[key] = img;
    fetch(`assets/logos/${name}.svg`).then((r) => r.text()).then((svg) => {
      img.onload = () => renderScreen();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', `<svg fill="${color}" `));
    });
  }
  return logoCache[key];
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getFaceEntry(index, faceId) {
  if (faceId) {
    const byId = facesList.find((f) => f.id === faceId);
    if (byId) return byId;
  }
  const safeIdx = ((index % facesList.length) + facesList.length) % facesList.length;
  return facesList[safeIdx] || { id: 'neutral', en: 'Neutral', fr: 'Neutre' };
}

function loadFaceImage(faceId) {
  if (!faceId) return Promise.resolve(null);
  if (faceImageCache.has(faceId)) {
    return faceImageCache.get(faceId);
  }
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `assets/faces/${encodeURIComponent(faceId)}.svg`;
  });
  faceImageCache.set(faceId, promise);
  return promise;
}

function preloadAdjacentFaces(index) {
  if (!facesList.length) return;
  const total = facesList.length;
  const prevIdx = (index - 1 + total) % total;
  const nextIdx = (index + 1) % total;
  loadFaceImage(facesList[index]?.id);
  loadFaceImage(facesList[prevIdx]?.id);
  loadFaceImage(facesList[nextIdx]?.id);
}

// Claude's latest answer (Text characteristic, or {"text":...} from the bridge).
let puckText = '';

// Small top row shared by the Element and the menu: "ELEMENT <id>" left, battery right (Montserrat 10, top 6).
function drawTopRow(ctx) {
  ctx.fillStyle = '#000';
  ctx.font = '600 10px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`ELEMENT ${state.id || '0'}`, 6, 6);
  if (Number.isFinite(Number(state.bat)) && Number(state.bat) >= 0) {
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Number(state.bat))}%`, 194, 6);
  }
  ctx.textAlign = 'center';
}

// Keep the REC dot blinking while recording.
setInterval(() => { if (state.screen === 'element' && Number(state.rec) === 1) renderScreen(); }, 333);

function renderScreen() {
  const ctx = epdCtx;
  ctx.save();
  ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Pure white e-paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.textAlign = 'center';

  const scr = state.screen || 'select';

  if (scr === 'select') {
    // Top row, small (Montserrat 10, top 6): Element name left, battery right
    ctx.font = '600 10px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`ELEMENT ${state.id || '0'}`, 6, 6);
    if (Number.isFinite(Number(state.bat)) && Number(state.bat) >= 0) {
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Number(state.bat))}%`, 194, 6);
    }
    ctx.textAlign = 'center';

    // Two option boxes 168x46 at top 50 and 102: logo (28 px) + name (Montserrat 20); selected = white on black
    const options = [['Apple iOS', 'apple'], ['Android', 'android']];
    for (let i = 0; i < 2; i++) {
      const [name, logo] = options[i];
      const boxW = 168, boxH = 46, boxX = 16, yTop = 50 + i * 52;
      const isSelected = Number(state.sel) === i;
      if (isSelected) {
        ctx.fillStyle = '#000000';
        drawRoundedRect(ctx, boxX, yTop, boxW, boxH, 10);
        ctx.fill();
      }
      ctx.fillStyle = isSelected ? '#ffffff' : '#000000';
      ctx.font = '600 20px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
      const textW = ctx.measureText(name).width;
      const groupW = 28 + 10 + textW;
      const x0 = 100 - groupW / 2;
      const img = logoImage(logo, isSelected ? '#ffffff' : '#000000');
      if (img.complete && img.naturalWidth) ctx.drawImage(img, x0, yTop + 9, 28, 28);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x0 + 38, yTop + boxH / 2 + 1);
      ctx.textAlign = 'center';
    }

    // Bottom, small (Montserrat 10): SD line (bottom -20) and button hints (bottom -6)
    ctx.fillStyle = '#000000';
    ctx.font = '500 10px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(state.sd || 'No SD card', 100, 200 - 20, 190);
    ctx.fillText('BOOT: move   PWR: choose', 100, 200 - 6, 190);

  } else if (scr === 'qr') {
    // qrTitle (top 6)
    const title = state.qrTitle || (Number(state.sel) === 0 ? 'Scan for the iOS app' : 'Scan for the Android app');
    const url = state.qrUrl || (Number(state.sel) === 0 ? APP_URL_IOS : APP_URL_ANDROID);

    ctx.fillStyle = '#000000';
    ctx.font = '600 14px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(title, 100, 6, 190);

    // QR code 140x140 centred (+4 -> center at (100, 104))
    if (typeof window.qrcode === 'function' && url) {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const count = qr.getModuleCount();
      const qrSize = 140;
      const startX = 100 - qrSize / 2;
      const startY = 104 - qrSize / 2;
      const cell = qrSize / count;

      ctx.fillStyle = '#000000';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            const x0 = Math.floor((startX + c * cell) * TEX_SCALE) / TEX_SCALE;
            const y0 = Math.floor((startY + r * cell) * TEX_SCALE) / TEX_SCALE;
            const x1 = Math.floor((startX + (c + 1) * cell) * TEX_SCALE) / TEX_SCALE;
            const y1 = Math.floor((startY + (r + 1) * cell) * TEX_SCALE) / TEX_SCALE;
            ctx.fillRect(x0, y0, Math.max(0.25, x1 - x0), Math.max(0.25, y1 - y0));
          }
        }
      }
    }

    // "PWR: back" (bottom -4)
    ctx.fillStyle = '#000000';
    ctx.font = '500 14px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('PWR: back', 100, 200 - 4, 190);

  } else if (scr === 'faces') {
    const entry = getFaceEntry(state.face || 0, state.faceId);
    const faceId = entry.id;
    const displayFaceName = lang === 'fr'
      ? (entry.fr || state.faceName || entry.en)
      : (entry.en || state.faceName || entry.id);
    const count = state.faceCount || facesList.length || 138;
    const num = ((state.face ?? 0) % count) + 1;

    // Face caption: "n/count  faceName" (bottom -6)
    ctx.fillStyle = '#000000';
    ctx.font = '600 14px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${num}/${count}  ${displayFaceName}`, 100, 200 - 6, 192);

    // Face SVG image 168x168 (top 2, centered horizontally -> x=16, y=2)
    loadFaceImage(faceId).then((img) => {
      if (!img || state.screen !== 'faces') return;
      const currentEntry = getFaceEntry(state.face || 0, state.faceId);
      if (currentEntry.id !== faceId) return;

      epdCtx.save();
      epdCtx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
      epdCtx.fillStyle = '#ffffff';
      epdCtx.fillRect(16, 2, 168, 168);
      epdCtx.drawImage(img, 16, 2, 168, 168);
      epdCtx.restore();
      screenTexture.needsUpdate = true;
    });

    preloadAdjacentFaces(state.face || 0);

  } else if (scr === 'element') {
    // Living Element: small top row, one face 168 px (top 18), "REC" while recording
    drawTopRow(ctx);
    if (Number(state.rec) === 1 && Math.floor(Date.now() / 333) % 3 !== 0) {   // blinking dot, top centre
      ctx.beginPath(); ctx.arc(100, 10.5, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    // Minimal waves under the face while it speaks or listens: 11 bars, 3 px wide, 7 px apart, height from "lvl"
    const level = Number(state.lvl || 0);
    if (level > 0 && (Number(state.rec) === 1 || Number(state.play) === 1)) {
      ctx.fillStyle = '#000';
      for (let i = 0; i < 11; i++) {
        const h = level - Math.floor(Math.abs(i - 5) / 2);
        if (h > 0) ctx.fillRect(100 - 38 + i * 7, 197 - h, 3, 1 + h);
      }
    }
    const faceId = state.faceId || 'soft';
    loadFaceImage(faceId).then((img) => {
      if (!img || state.screen !== 'element' || (state.faceId || 'soft') !== faceId) return;
      epdCtx.save();
      epdCtx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
      epdCtx.fillStyle = '#ffffff';
      epdCtx.fillRect(16, 18, 168, 168);
      epdCtx.drawImage(img, 16, 18, 168, 168);
      epdCtx.restore();
      screenTexture.needsUpdate = true;
    });

  } else if (scr === 'text' || scr === 'guide') {
    // Claude's answer (or the button guide), wrapped and centred (Montserrat 20 when short, 14 otherwise)
    const text = scr === 'guide' ? (state.guide || '') : (puckText || '…');
    const size = text.length < 70 ? 20 : 14;
    ctx.font = `600 ${size}px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > 184 && line) { lines.push(line); line = word; } else { line = test; }
    }
    if (line) lines.push(line);
    const lh = size + 4;
    const y0 = Math.max(4, (200 - lines.length * lh) / 2);
    lines.forEach((l, i) => ctx.fillText(l, 100, y0 + i * lh, 190));

  } else if (scr === 'menu') {
    drawTopRow(ctx);
    const items = ['Element', 'Pair a phone', 'Info'];
    for (let i = 0; i < 3; i++) {
      const y = 34 + i * 46, on = Number(state.menuSel || 0) === i;
      if (on) { ctx.fillStyle = '#000'; drawRoundedRect(ctx, 16, y, 168, 40, 10); ctx.fill(); }
      ctx.fillStyle = on ? '#fff' : '#000';
      ctx.font = '600 20px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(items[i], 100, y + 21);
    }
    ctx.fillStyle = '#000';
    ctx.font = '500 10px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('BOOT: move   PWR: open', 100, 194);

  } else if (scr === 'info') {
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '700 26px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`ELEMENT ${state.id || '0'}`, 100, 34, 190);
    ctx.font = '500 14px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    const bat = Number(state.bat);
    ctx.fillText(bat >= 0 ? `Battery ${bat}%  ${(Number(state.mv) / 1000).toFixed(2)} V` : 'Battery --', 100, 92, 190);
    ctx.fillText(state.sd || 'No SD card', 100, 116, 190);
    ctx.fillText(`Firmware ${state.fw || '?'}`, 100, 140, 190);
    ctx.font = '500 10px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('PWR: back', 100, 194);

  } else if (scr === 'off') {
    // "Sleeping" (Montserrat 28, centred)
    ctx.fillStyle = '#000000';
    ctx.font = '600 28px "Montserrat", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Sleeping', 100, 100, 188);
  }

  ctx.restore();
  screenTexture.needsUpdate = true;
  updateSettingsUI();
}

// ============================================================================
// 4. FIRMWARE-EQUIVALENT STATE MACHINE & BLE COMMAND DISPATCH
// ============================================================================
function syncFaceMetadata() {
  const count = facesList.length || 138;
  state.faceCount = count;
  state.face = ((state.face % count) + count) % count;
  const entry = facesList[state.face] || { id: 'neutral', en: 'Neutral', fr: 'Neutre' };
  state.faceId = entry.id;
  state.faceName = entry.en;
}

function syncQrMetadata() {
  if (state.screen === 'qr') {
    state.qrTitle = state.sel === 0 ? 'Scan for the iOS app' : 'Scan for the Android app';
    state.qrUrl   = state.sel === 0 ? APP_URL_IOS : APP_URL_ANDROID;
  } else {
    state.qrTitle = '';
    state.qrUrl   = '';
  }
}

function applyCommandLocally(rawCmd) {
  const cmd = String(rawCmd || '').trim();
  if (!cmd) return;

  const onSelect = state.screen === 'select';
  const onFaces  = state.screen === 'faces';

  if (cmd === 'off') {
    state.screen = 'off';
  } else if (cmd === 'back') {
    state.screen = 'select';
  } else if (cmd.startsWith('select:')) {
    const val = parseInt(cmd.slice(7), 10);
    state.sel = val ? 1 : 0;
    state.screen = 'select';
  } else if (cmd.startsWith('face:')) {
    const val = parseInt(cmd.slice(5), 10);
    if (!Number.isNaN(val)) {
      state.face = val;
      syncFaceMetadata();
      state.screen = 'faces';
    }
  } else if (cmd === 'faces') {
    if (!onFaces) {
      syncFaceMetadata();
      state.screen = 'faces';
    }
  } else if (onFaces && (cmd === 'next' || cmd === 'prev')) {
    state.face += (cmd === 'next' ? 1 : -1);
    syncFaceMetadata();
  } else if (onFaces && cmd === 'confirm') {
    state.screen = 'select';
  } else if (onSelect && (cmd === 'next' || cmd === 'prev')) {
    state.sel = 1 - state.sel;
  } else if (cmd === 'confirm') {
    if (onSelect) {
      state.screen = 'qr';
    } else {
      state.screen = 'select';
    }
  }

  syncQrMetadata();
  renderScreen();
}

let writeChain = Promise.resolve();

function sendCommand(cmd) {
  // Safari (no Web Bluetooth): commands go through the Elements Puck Bridge on this Mac.
  if (bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN && bridgeStatus === 'connected' && !isSimulationMode) {
    bridgeSocket.send(cmd);
    return Promise.resolve();
  }
  // Connected to real puck & not in simulation mode: write to BLE; redraw ONLY from notifications
  if (isConnected && !isSimulationMode && cmdChar) {
    const encoded = new TextEncoder().encode(cmd);
    writeChain = writeChain
      .then(async () => {
        if (typeof cmdChar.writeValueWithoutResponse === 'function') {
          await cmdChar.writeValueWithoutResponse(encoded);
        } else {
          await cmdChar.writeValue(encoded);
        }
      })
      .catch((err) => {
        showBleError(`Write failed: ${err.message || err}`);
      });
    return writeChain;
  }

  // Simulation mode (or not connected): apply locally with exact firmware rules
  applyCommandLocally(cmd);
  return Promise.resolve();
}

// ============================================================================
// 5. WEB BLUETOOTH CONNECTION & NOTIFICATIONS
// ============================================================================
function showBleError(msg) {
  if (!msg) {
    bleErrorEl.hidden = true;
    bleErrorEl.textContent = '';
    return;
  }
  bleErrorEl.textContent = msg;
  bleErrorEl.hidden = false;
}

function updateBattery() {
  const el = document.getElementById('battery');
  if (!el) return;
  const pct = Number(state.bat);
  // Only real puck data: hidden in simulation or before the first measurement.
  if (!isConnected || isSimulationMode || !Number.isFinite(pct) || pct < 0) { el.hidden = true; return; }
  el.hidden = false;
  el.classList.toggle('low', pct <= 15);
  document.getElementById('battery-fill').style.width = `${Math.max(4, Math.min(100, pct))}%`;
  document.getElementById('battery-text').textContent = `${Math.round(pct)}%`;
  el.title = state.mv ? `Puck battery ${Math.round(pct)}% (${(state.mv / 1000).toFixed(2)} V)` : 'Puck battery';
}

function updateSettingsUI() {
  updateBattery();
  if (sdLineEl) {
    sdLineEl.textContent = state.sd || 'No SD card';
  }

  if (isConnected && !isSimulationMode) {
    statusPill.className = 'status-pill connected';
    const elementName = state.id && state.id !== '0' ? `Element ${state.id}` : 'Element Zero';
    statusText.textContent = `${elementName} · Connected`;
  } else if (isSimulationMode) {
    statusPill.className = 'status-pill sim';
    statusText.textContent = isConnected ? 'Connected (Sim)' : 'Simulation';
  } else {
    statusPill.className = 'status-pill';
    statusText.textContent = 'Disconnected';
  }

  btnConnect.hidden    = isConnected;
  btnDisconnect.hidden = !isConnected;
  btnReconnect.hidden  = isConnected || !bleDevice;
  simToggle.checked    = isSimulationMode;
}

function handleStatePayload(dataView) {
  try {
    const jsonStr = new TextDecoder('utf-8').decode(dataView);
    const incoming = JSON.parse(jsonStr);
    if (incoming && typeof incoming === 'object') {
      Object.assign(state, incoming);
      updateBattery();
      if (!isSimulationMode) {
        renderScreen();
      } else {
        updateSettingsUI();
      }
    }
  } catch (err) {
    console.warn('Invalid state JSON from puck:', err);
  }
}

function onStateNotification(event) {
  const val = event.target?.value;
  if (val) {
    handleStatePayload(val);
  }
}

function onGattDisconnected() {
  isConnected = false;
  stateChar = null;
  cmdChar = null;
  updateSettingsUI();
}

async function connectGattSession(device) {
  showBleError('');
  bleServer = await device.gatt.connect();
  const service = await bleServer.getPrimaryService(SERVICE_UUID);
  stateChar = await service.getCharacteristic(STATE_UUID);
  cmdChar   = await service.getCharacteristic(COMMAND_UUID);

  await stateChar.startNotifications();
  try {
    const textChar = await service.getCharacteristic(TEXT_UUID);
    await textChar.startNotifications();
    textChar.addEventListener('characteristicvaluechanged', (e) => { puckText = new TextDecoder().decode(e.target.value); renderScreen(); });
    puckText = new TextDecoder().decode(await textChar.readValue());
  } catch (_) { /* older firmware: no Text characteristic */ }
  stateChar.addEventListener('characteristicvaluechanged', onStateNotification);

  isConnected = true;
  isSimulationMode = false;
  updateSettingsUI();

  // Read initial state so screen immediately matches puck
  try {
    const initialVal = await stateChar.readValue();
    if (initialVal) {
      handleStatePayload(initialVal);
    }
  } catch (_) {
    // Notification will update state on next event
  }
}

// ---- Elements Puck Bridge (Safari and any browser without Web Bluetooth) ----
// The bridge is a small Mac helper that talks Bluetooth to the puck and relays it on ws://127.0.0.1:8795.
const BRIDGE_URL = 'ws://127.0.0.1:8795';
let bridgeSocket = null;
let bridgeStatus = 'off';

function connectBridge() {
  if (bridgeSocket && bridgeSocket.readyState <= WebSocket.OPEN) return;
  showBleError('');
  bridgeSocket = new WebSocket(BRIDGE_URL);
  bridgeSocket.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }
    if (msg && typeof msg.text === 'string') { puckText = msg.text; renderScreen(); return; }
    if (msg && msg.bridge) {
      bridgeStatus = msg.bridge;
      isConnected = bridgeStatus === 'connected';
      if (isConnected) isSimulationMode = false;
      if (bridgeStatus === 'scanning') showBleError('Bridge is looking for the puck… press PWR on the puck if its screen is blank.');
      else showBleError('');
      updateSettingsUI();
      return;
    }
    handleStatePayload(new TextEncoder().encode(ev.data));
  };
  bridgeSocket.onclose = () => {
    const wasOpen = bridgeStatus !== 'off' || isConnected;
    bridgeSocket = null; bridgeStatus = 'off'; isConnected = false;
    updateSettingsUI();
    if (!wasOpen) showBleError('Elements Puck Bridge is not running on this Mac. Double-click "Turn On-Off Elements Puck Bridge.command" in ~/Library/Application Support/Elements Puck Bridge.');
  };
  bridgeSocket.onopen = () => bridgeSocket.send('scan');
}

async function requestAndConnectPuck() {
  showBleError('');
  if (!window.isSecureContext || !navigator.bluetooth) {
    connectBridge();
    return;
  }

  try {
    // Match by service or by name: on macOS the 128-bit service UUID can sit in the scan response.
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }, { namePrefix: 'The Elements' }],
      optionalServices: [SERVICE_UUID]
    });
    if (bleDevice) {
      bleDevice.removeEventListener('gattserverdisconnected', onGattDisconnected);
    }
    bleDevice = device;
    bleDevice.addEventListener('gattserverdisconnected', onGattDisconnected);
    await connectGattSession(bleDevice);
  } catch (err) {
    if (err && err.name === 'NotFoundError') {
      // Chooser closed without a device: say so, it is the most common failure.
      showBleError('No puck chosen. If "The Elements" was not in the list: wake the puck (press PWR), keep it near the Mac, and try again.');
      console.warn('[ble] requestDevice:', err.name, err.message);
      updateSettingsUI();
      return;
    }
    console.warn('[ble] connect failed:', err?.name, err?.message);
    showBleError(err?.message || 'Could not connect to Element 0.');
    updateSettingsUI();
  }
}

async function reconnectPuck() {
  if (!bleDevice) {
    return requestAndConnectPuck();
  }
  try {
    await connectGattSession(bleDevice);
  } catch (err) {
    showBleError(err?.message || 'Reconnect failed. Wake the puck and try again.');
    updateSettingsUI();
  }
}

function disconnectPuck() {
  showBleError('');
  if (bridgeSocket) { bridgeStatus = 'off'; bridgeSocket.close(); bridgeSocket = null; }
  if (bleDevice && bleDevice.gatt?.connected) {
    bleDevice.gatt.disconnect();
  }
  isConnected = false;
  isSimulationMode = true;
  updateSettingsUI();
  renderScreen();
}

// ============================================================================
// 6. THREE.JS 3D SCENE, LIGHTING & SUBTLE CONTACT SHADOW
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(
  32,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const DEFAULT_ORBIT_POS    = new THREE.Vector3(-36, 18, -94);
const DEFAULT_ORBIT_TARGET = new THREE.Vector3(0, 0, 0);

camera.position.copy(DEFAULT_ORBIT_POS);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
stageEl.appendChild(renderer.domElement);

screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(DEFAULT_ORBIT_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxDistance = 240;
controls.minDistance = 28;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.75;
controls.update();

// Stop idle rotation as soon as user interacts
controls.addEventListener('start', () => {
  controls.autoRotate = false;
});

// Soft neutral studio lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(45, 85, -80);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xf1f5f9, 0.9);
fillLight.position.set(-60, 35, -55);
scene.add(fillLight);

const backLight = new THREE.DirectionalLight(0xe2e8f0, 0.8);
backLight.position.set(0, 40, 85);
scene.add(backLight);

// Subtle contact shadow only (no grid, no floor, no fog)
function createContactShadow() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.09)');
  grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  const geo = new THREE.PlaneGeometry(54, 26);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -29.5, 0);
  return mesh;
}
scene.add(createContactShadow());

// Load 3D Model
let modelRoot = null;
let screenMesh = null;
let bootButtonMesh = null;
let pwrButtonMesh = null;

const gltfLoader = new GLTFLoader();
gltfLoader.load(
  'assets/waveshare_esp32c6_master.glb',
  (gltf) => {
    modelRoot = gltf.scene;

    const box = new THREE.Box3().setFromObject(modelRoot);
    const center = box.getCenter(new THREE.Vector3());
    modelRoot.position.sub(center);

    modelRoot.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();

      if (
        (name.includes('screen') || name.includes('epaper') || name.includes('display')) &&
        !name.includes('glass') &&
        !name.includes('ribbon') &&
        !name.includes('carrier')
      ) {
        screenMesh = child;
      }

      if (name.includes('boot') && (name.includes('key') || name.includes('button'))) {
        bootButtonMesh = child;
      }
      if (name.includes('pwr') && (name.includes('key') || name.includes('button'))) {
        pwrButtonMesh = child;
      }
    });

    // Fallback plane on front face if no screen mesh was found
    if (!screenMesh) {
      const planeGeo = new THREE.PlaneGeometry(27.8, 27.8);
      screenMesh = new THREE.Mesh(planeGeo);
      screenMesh.position.set(0, 1.7, -6.9);
      screenMesh.rotation.y = Math.PI;
      modelRoot.add(screenMesh);
    }

    // Apply crisp un-tonemapped e-paper material to the screen mesh
    screenMesh.material = new THREE.MeshBasicMaterial({
      map: screenTexture,
      side: THREE.DoubleSide,
      toneMapped: false
    });

    scene.add(modelRoot);
    renderScreen();
  },
  undefined,
  (err) => {
    console.error('Failed to load GLB model:', err);
  }
);

// ============================================================================
// 7. CAMERA FLY-TO CHOREOGRAPHY & DISPLAY MODE INTERACTION
// ============================================================================
let isDisplayMode = false;
const savedOrbitPos    = DEFAULT_ORBIT_POS.clone();
const savedOrbitTarget = DEFAULT_ORBIT_TARGET.clone();

let camAnim = null; // { startPos, startTarget, endPos, endTarget, startTime, duration, onComplete }

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function computeDisplayCameraPose() {
  const screenCenter = new THREE.Vector3(0, 1.7, -6.87);
  if (screenMesh) {
    screenMesh.getWorldPosition(screenCenter);
  }

  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const screenSize = 27.8;
  const fillH = 0.56;
  const fillW = 0.78;
  const distH = (screenSize / fillH) / (2 * Math.tan(fovRad / 2));
  const distW = (screenSize / fillW) / (2 * Math.tan(fovRad / 2) * camera.aspect);
  const dist  = Math.max(distH, distW);

  // Slight vertical offset so the screen sits nicely above the BOOT/PWR buttons
  const yCenterOffset = -1.6;
  const target = new THREE.Vector3(
    screenCenter.x,
    screenCenter.y + yCenterOffset,
    screenCenter.z
  );
  // Front of EPaper_Screen faces -Z
  const pos = new THREE.Vector3(
    screenCenter.x,
    screenCenter.y + yCenterOffset,
    screenCenter.z - dist
  );
  return { pos, target };
}

function flyCameraTo(endPos, endTarget, duration = 700, onComplete = null) {
  camAnim = {
    startPos: camera.position.clone(),
    startTarget: controls.target.clone(),
    endPos: endPos.clone(),
    endTarget: endTarget.clone(),
    startTime: performance.now(),
    duration,
    onComplete
  };
}

function enterDisplayMode() {
  if (isDisplayMode) return;
  savedOrbitPos.copy(camera.position);
  savedOrbitTarget.copy(controls.target);

  isDisplayMode = true;
  controls.autoRotate = false;
  controls.enabled = false;
  displayControls.hidden = false;

  const { pos, target } = computeDisplayCameraPose();
  flyCameraTo(pos, target, 700);
}

function exitDisplayMode(resetToDefault = false) {
  if (!isDisplayMode && !resetToDefault) return;
  isDisplayMode = false;
  displayControls.hidden = true;

  const destPos    = resetToDefault ? DEFAULT_ORBIT_POS : savedOrbitPos;
  const destTarget = resetToDefault ? DEFAULT_ORBIT_TARGET : savedOrbitTarget;

  flyCameraTo(destPos, destTarget, 700, () => {
    controls.enabled = true;
    if (resetToDefault) {
      controls.autoRotate = true;
    }
  });
}

function resetView() {
  savedOrbitPos.copy(DEFAULT_ORBIT_POS);
  savedOrbitTarget.copy(DEFAULT_ORBIT_TARGET);
  isDisplayMode = false;
  displayControls.hidden = true;
  controls.enabled = false;

  flyCameraTo(DEFAULT_ORBIT_POS, DEFAULT_ORBIT_TARGET, 700, () => {
    controls.enabled = true;
    controls.autoRotate = true;
  });
}

// Handle clicks on the 200x200 screen according to PROTOCOL.md click regions
function handleScreenCoordinateClick(px, py) {
  const scr = state.screen || 'select';

  if (scr === 'select') {
    // select -> tap an option = select:n then confirm
    if (py >= 48 && py < 99) {
      sendCommand('select:0').then(() => sendCommand('confirm'));
    } else if (py >= 99 && py <= 150) {
      sendCommand('select:1').then(() => sendCommand('confirm'));
    }
  } else if (scr === 'element') {
    sendCommand('confirm');                       // tap the Element = menu (BOOT button = record)
  } else if (scr === 'text' || scr === 'info') {
    sendCommand('back');
  } else if (scr === 'menu') {
    for (let i = 0; i < 3; i++) if (py >= 32 + i * 46 && py < 78 + i * 46) sendCommand(`menu:${i}`);
  } else if (scr === 'qr') {
    // qr -> tap = confirm
    sendCommand('confirm');
  } else if (scr === 'faces') {
    // faces -> left half = prev, right half = next, bottom strip = back
    if (py >= 168) {
      sendCommand('back');
    } else if (px < 100) {
      sendCommand('prev');
    } else {
      sendCommand('next');
    }
  } else if (scr === 'off') {
    sendCommand('confirm');
  }
}

// Raycasting on the 3D canvas
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();
let pointerDownXY = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownXY = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!screenMesh) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObject(screenMesh, true);
  renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : (isDisplayMode ? 'default' : 'grab');
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const moveDist = Math.hypot(e.clientX - pointerDownXY.x, e.clientY - pointerDownXY.y);
  if (moveDist > 6) return;

  // Close settings panel if open and user clicked the stage
  if (!settingsPanel.hidden) {
    closeSettingsPanel();
  }

  if (!screenMesh) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObject(screenMesh, true);
  if (hits.length > 0) {
    if (!isDisplayMode) {
      enterDisplayMode();
    } else if (!camAnim) {
      const uv = hits[0].uv;
      if (uv) {
        const px = uv.x * LOGICAL_SIZE;
        const py = uv.y * LOGICAL_SIZE;
        handleScreenCoordinateClick(px, py);
      }
    }
  }
});

// ============================================================================
// 8. DISPLAY HARDWARE BUTTONS (BOOT & PWR: click / double-click / long-press)
// ============================================================================
function depresseMeshBriefly(mesh) {
  if (!mesh) return;
  const origX = mesh.position.x;
  mesh.position.x = origX + 0.6;
  setTimeout(() => {
    mesh.position.x = origX;
  }, 120);
}

// BOOT button: click = next, double-click = prev, long-press = faces
let bootLongTimer = null;
let bootClickTimer = null;
let bootLongFired = false;
let bootClickCount = 0;

btnBoot.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  btnBoot.classList.add('pressed');
  bootLongFired = false;
  clearTimeout(bootLongTimer);
  bootLongTimer = setTimeout(() => {
    bootLongFired = true;
    bootClickCount = 0;
    clearTimeout(bootClickTimer);
    depresseMeshBriefly(bootButtonMesh);
    sendCommand('faces');
  }, 500);
});

function endBootPress() {
  btnBoot.classList.remove('pressed');
  clearTimeout(bootLongTimer);
  if (bootLongFired) return;

  bootClickCount++;
  if (bootClickCount === 1) {
    bootClickTimer = setTimeout(() => {
      bootClickCount = 0;
      depresseMeshBriefly(bootButtonMesh);
      sendCommand('next');
    }, 230);
  } else if (bootClickCount >= 2) {
    clearTimeout(bootClickTimer);
    bootClickCount = 0;
    depresseMeshBriefly(bootButtonMesh);
    sendCommand('prev');
  }
}

btnBoot.addEventListener('pointerup', endBootPress);
btnBoot.addEventListener('pointercancel', () => {
  btnBoot.classList.remove('pressed');
  clearTimeout(bootLongTimer);
});

// PWR button: click = confirm, long-press = off
let pwrLongTimer = null;
let pwrLongFired = false;

btnPwr.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  btnPwr.classList.add('pressed');
  pwrLongFired = false;
  clearTimeout(pwrLongTimer);
  pwrLongTimer = setTimeout(() => {
    pwrLongFired = true;
    depresseMeshBriefly(pwrButtonMesh);
    sendCommand('off');
  }, 550);
});

btnPwr.addEventListener('pointerup', () => {
  btnPwr.classList.remove('pressed');
  clearTimeout(pwrLongTimer);
  if (pwrLongFired) return;
  depresseMeshBriefly(pwrButtonMesh);
  sendCommand('confirm');
});

btnPwr.addEventListener('pointercancel', () => {
  btnPwr.classList.remove('pressed');
  clearTimeout(pwrLongTimer);
});

btnBack3d.addEventListener('click', () => {
  exitDisplayMode(false);
});

// ============================================================================
// 9. SETTINGS PANEL & KEYBOARD CONTROLS
// ============================================================================
function closeSettingsPanel() {
  settingsPanel.hidden = true;
  settingsBtn.setAttribute('aria-expanded', 'false');
}

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = settingsPanel.hidden;
  settingsPanel.hidden = !willOpen;
  settingsBtn.setAttribute('aria-expanded', String(willOpen));
});

btnConnect.addEventListener('click', requestAndConnectPuck);
btnReconnect.addEventListener('click', reconnectPuck);
btnDisconnect.addEventListener('click', disconnectPuck);

langEnBtn.addEventListener('click', () => {
  lang = 'en';
  langEnBtn.classList.add('active');
  langFrBtn.classList.remove('active');
  renderScreen();
});

langFrBtn.addEventListener('click', () => {
  lang = 'fr';
  langFrBtn.classList.add('active');
  langEnBtn.classList.remove('active');
  renderScreen();
});

simToggle.addEventListener('change', () => {
  isSimulationMode = simToggle.checked;
  updateSettingsUI();
  renderScreen();
});

btnResetView.addEventListener('click', () => {
  closeSettingsPanel();
  resetView();
});

// Keyboard shortcuts: arrows = next/prev, Enter = confirm, F = faces, Esc = back to 3D
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    sendCommand('next');
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    sendCommand(state.screen === 'select' ? 'next' : 'prev');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    sendCommand('confirm');
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    sendCommand('faces');
  } else if (e.key === 'Escape') {
    if (!settingsPanel.hidden) {
      closeSettingsPanel();
    }
    if (isDisplayMode) {
      exitDisplayMode(false);
    }
  }
});

// Responsive resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (isDisplayMode && !camAnim) {
    const { pos, target } = computeDisplayCameraPose();
    camera.position.copy(pos);
    controls.target.copy(target);
    camera.lookAt(target);
  }
});

// ============================================================================
// 10. ANIMATION LOOP & INITIALIZATION
// ============================================================================
function animate(now) {
  requestAnimationFrame(animate);

  if (camAnim) {
    const elapsed = now - camAnim.startTime;
    const rawT = Math.min(1, elapsed / camAnim.duration);
    const t = easeInOutCubic(rawT);

    camera.position.lerpVectors(camAnim.startPos, camAnim.endPos, t);
    controls.target.lerpVectors(camAnim.startTarget, camAnim.endTarget, t);
    camera.lookAt(controls.target);

    if (rawT >= 1) {
      const doneCb = camAnim.onComplete;
      camAnim = null;
      if (doneCb) doneCb();
    }
  } else if (controls.enabled) {
    controls.update();
  }

  renderer.render(scene, camera);
}

async function init() {
  renderScreen();
  requestAnimationFrame(animate);

  // Re-render once web fonts finish loading so Montserrat metrics are crisp
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => renderScreen());
  }

  // Load the 138 faces manifest
  try {
    const res = await fetch('assets/faces.json');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        facesList = data;
        state.faceCount = facesList.length;
        syncFaceMetadata();
        preloadAdjacentFaces(state.face);
        renderScreen();
      }
    }
  } catch (err) {
    console.warn('Could not load faces.json:', err);
  }
}

init();
