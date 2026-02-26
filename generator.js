// ─────────────────────────────────────────────────────────────
// generator.js — Generador procedural de estructuras en anillo
// ─────────────────────────────────────────────────────────────

import * as THREE        from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }    from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { scene, resizeGuidePlanes } from './scene.js';
import { activateExclusive } from './ui.js';
import { setRingLocked, setRingVisible, setPaintInteractionsEnabled } from './paint.js';
import { setModelVisibility, glbModel } from './model.js';

// ── Constantes del modelo original ──
const K              = 20 / (360 * 17);   // módulos / (arc * BASE_RADIUS * scale * radius)
const BASE_RADIUS    = 17;
const OVERLAP_BASE   = 1.4;
const V_SPACING_BASE = 3.5;
const V_STEP_BASE    = V_SPACING_BASE - OVERLAP_BASE; // 2.1u neto

// ── Estado ──
let generatedGroup = null;
let moduleBuffer   = null;
let moduleGeom     = null;

// ── Helpers matemáticos ──
const clampNumber = (v, mn, mx)      => Math.min(mx, Math.max(mn, v));
const roundStep   = (v, step)        => Math.round(v / step) * step;
const maxOriginOffset = (modules, arc) => Math.max(0, Math.round((modules / arc) * 360));

function ensureFixedState(ring) {
  const keys = ['modules', 'arc', 'scale', 'radius'];
  const fixed = keys.filter(k => ring.fixed[k]);

  if (fixed.length > 3) {
    const keepAuto = ring._autoKey && keys.includes(ring._autoKey) ? ring._autoKey : 'radius';
    keys.forEach(k => { ring.fixed[k] = k !== keepAuto; });
  }

  if (keys.every(k => ring.fixed[k])) {
    ring.fixed[ring._autoKey || 'radius'] = false;
  }

  const auto = keys.find(k => !ring.fixed[k]);
  ring._autoKey = auto || 'radius';
}

// ── Modelo de anillo ──
const defaultRing = () => ({
  id: Date.now(),
  fixed:    { modules: false, arc: true, scale: true, radius: true },
  locked:   false,
  visible:  true,
  _autoKey: 'modules',
  modules:  20,
  arc:      360,
  scale:    1.0,
  radius:   1.0,
  layers:   10,
  yOffset:  0,
  originModule: 0,
});

let rings = [defaultRing()];
let _renderGeneratorPanel = null;
let _exitPreviewMode = () => {};
let _panelIsOpen = false;

function buildPaintKey(mesh) {
  const r = mesh?.userData?.ringId;
  const l = mesh?.userData?.ringLayer;
  const m = mesh?.userData?.ringModule;
  if (r == null || l == null || m == null) return null;
  return `${r}|${l}|${m}`;
}

function captureCurrentColorsByKey() {
  const map = new Map();
  if (!glbModel) return map;
  glbModel.traverse(c => {
    if (!c.isMesh) return;
    const key = buildPaintKey(c);
    if (!key || !c.material?.color) return;
    map.set(key, c.material.color.clone());
  });
  return map;
}

let _previewRefreshToken = 0;
let _previewRefreshInFlight = Promise.resolve();
function refreshPreviewIfActive() {
  if (!document.body.classList.contains('gen-preview-active')) return;
  const token = ++_previewRefreshToken;
  _previewRefreshInFlight = _previewRefreshInFlight
    .then(() => generateStructure())
    .then(() => { if (token !== _previewRefreshToken) return generateStructure(); })
    .catch(err => console.warn('Preview update failed:', err?.message || err));
}


export function getGeneratorRingsSnapshot() {
  return rings.map(r => ({
    fixed: { ...r.fixed },
    locked: !!r.locked,
    visible: r.visible !== false,
    _autoKey: r._autoKey,
    modules: r.modules,
    arc: r.arc,
    scale: r.scale,
    radius: r.radius,
    layers: r.layers,
    yOffset: r.yOffset,
    originModule: r.originModule,
  }));
}

export function setGeneratorRingsSnapshot(snapshot) {
  if (!Array.isArray(snapshot) || !snapshot.length) return;
  rings = snapshot.map(src => ({
    ...defaultRing(),
    fixed: { ...defaultRing().fixed, ...(src.fixed || {}) },
    locked: !!src.locked,
    visible: src.visible !== false,
    _autoKey: src._autoKey || defaultRing()._autoKey,
    modules: Number(src.modules ?? defaultRing().modules),
    arc: Number(src.arc ?? defaultRing().arc),
    scale: Number(src.scale ?? defaultRing().scale),
    radius: Number(src.radius ?? defaultRing().radius),
    layers: Number(src.layers ?? defaultRing().layers),
    yOffset: Number(src.yOffset ?? defaultRing().yOffset),
    originModule: Number(src.originModule ?? defaultRing().originModule),
  }));
  rings.forEach(computeFree);
  if (typeof _renderGeneratorPanel === 'function') _renderGeneratorPanel();
}

// ── Solver ──
// Relación: modules = K * arc * BASE_RADIUS * scale * radius
function computeFree(ring) {
  ensureFixedState(ring);
  const { modules, arc, scale, radius, _autoKey } = ring;
  if (_autoKey === 'modules') {
    ring.modules = clampNumber(Math.round(K * arc * BASE_RADIUS * scale * radius), 1, 500);
  } else if (_autoKey === 'arc') {
    ring.arc = clampNumber(roundStep(modules / (K * BASE_RADIUS * scale * radius), 0.5), 1, 360);
  } else if (_autoKey === 'scale') {
    ring.scale = clampNumber(roundStep(modules / (K * arc * BASE_RADIUS * radius), 0.1), 0.1, 20);
  } else {
    ring.radius = clampNumber(roundStep(modules / (K * arc * BASE_RADIUS * scale), 0.1), 0.1, 20);
  }
  ring.originModule = clampNumber(ring.originModule, -maxOriginOffset(ring.modules, ring.arc), maxOriginOffset(ring.modules, ring.arc));
}

// ── Cargar módulo base ──
export async function loadModuleBuffer(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  moduleBuffer = await res.arrayBuffer();
  moduleGeom   = null;
  return moduleBuffer;
}

async function getModuleGeometry() {
  if (moduleGeom) return moduleGeom;
  if (!moduleBuffer) throw new Error('Buffer de módulo no cargado');
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(moduleBuffer.slice(0), '', gltf => {
      gltf.scene.traverse(c => { if (c.isMesh) { moduleGeom = c.geometry.clone(); resolve(moduleGeom); } });
    }, reject);
  });
}

function disposeGeneratedGroup() {
  if (!generatedGroup) return;
  scene.remove(generatedGroup);
  generatedGroup.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
  generatedGroup = null;
}

// ── Generar estructura ──
export async function generateStructure() {
  const previousColors = captureCurrentColorsByKey();
  disposeGeneratedGroup();
  generatedGroup = new THREE.Group();
  const geometry = await getModuleGeometry();

  for (const [ringIndex, ring] of rings.entries()) {
    computeFree(ring);
    const { modules, arc, scale, radius, layers, yOffset, originModule } = ring;
    const effectiveRadius = BASE_RADIUS * scale * radius;
    const angleStep       = arc / modules;
    const halfRingArc     = arc / 2;
    const halfStep        = angleStep / 2;
    const originOffset    = -(originModule * angleStep);
    const vStep           = V_STEP_BASE * scale;
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8, metalness: 0 });

    for (let layer = 0; layer < layers; layer++) {
      const stagger = (layer % 2 === 1) ? angleStep / 2 : 0;
      const y       = yOffset + layer * vStep;

      for (let m = 0; m < modules; m++) {
        const angleDeg = -halfRingArc + halfStep + m * angleStep + stagger + originOffset;
        const angleRad = THREE.MathUtils.degToRad(angleDeg);

        const pivot = new THREE.Object3D();
        pivot.rotation.y = -angleRad;
        pivot.position.y = y;

        const mesh = new THREE.Mesh(geometry, mat.clone());
        mesh.userData.ringId = `ring:${ringIndex}`;
        mesh.userData.ringLayer = layer;
        mesh.userData.ringModule = m;
        const paintKey = buildPaintKey(mesh);
        const prevColor = paintKey ? previousColors.get(paintKey) : null;
        if (prevColor) mesh.material.color.copy(prevColor);
        mesh.visible = ring.visible !== false;
        mesh.scale.setScalar(scale);
        // Desacoplar radio adicional sobre BASE_RADIUS*scale
        mesh.position.x = BASE_RADIUS * (radius - 1);

        pivot.add(mesh);
        generatedGroup.add(pivot);
      }
    }
  }

  scene.add(generatedGroup);
  resizeGuidePlanes(generatedGroup);
  return generatedGroup;
}

// ── CSS ──
const CSS = `
#gen-btn {
  position:fixed; top:24px; right:24px; z-index:2000;
  width:72px; height:72px; border-radius:50%;
  background:rgba(20,20,20,0.88); border:1px solid rgba(255,255,255,0.18);
  backdrop-filter:blur(10px); display:flex; align-items:center;
  justify-content:center; cursor:pointer; font-size:28px; color:#fff;
  transition:background 0.2s,transform 0.2s; user-select:none;
}
#gen-btn:hover  { background:rgba(50,50,50,0.95); transform:scale(1.07); }
#gen-btn:active { transform:scale(0.95); }
#gen-panel {
  position:fixed; top:0; right:0; width:360px; height:100vh; height:100dvh;
  background:rgba(18,18,18,0.97); backdrop-filter:blur(14px);
  border-left:1px solid rgba(255,255,255,0.08);
  z-index:1900; display:flex; flex-direction:column;
  transform:translateX(100%); transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
}
#gen-panel.open { transform:translateX(0); }
#gen-scroll { flex:1; overflow-y:auto; padding-bottom:12px; }
#gen-footer {
  position:sticky; bottom:0; z-index:2;
  padding:12px 16px calc(16px + env(safe-area-inset-bottom));
  border-top:1px solid rgba(255,255,255,0.06);
  background:rgba(18,18,18,0.98);
  flex-shrink:0;
}
@media (max-width: 768px) {
  #gen-panel { width:100vw; }
  #gen-scroll { padding-bottom: calc(120px + env(safe-area-inset-bottom)); }
}
.gen-section { padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.06); }
.gen-title {
  font-family:'Courier New',monospace; font-size:11px;
  letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.3); margin-bottom:10px;
}
.gen-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:6px; }
.gen-label { font-family:'Courier New',monospace; font-size:12px; color:rgba(255,255,255,0.55); white-space:nowrap; flex-shrink:0; }
.num-ctrl { display:flex; align-items:center; gap:3px; }
.num-ctrl input {
  width:68px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
  border-radius:6px; color:#fff; font-family:'Courier New',monospace; font-size:13px;
  padding:5px 8px; text-align:right; outline:none; transition:border-color 0.2s;
}
.num-ctrl input:focus { border-color:rgba(255,255,255,0.4); }
.num-ctrl input[type=number] { -moz-appearance:textfield; appearance:textfield; }
.num-ctrl input[type=number]::-webkit-outer-spin-button,
.num-ctrl input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.num-ctrl input.computed { border-color:rgba(80,180,255,0.4); color:rgba(80,200,255,0.9); background:rgba(80,180,255,0.06); }
.num-ctrl button {
  width:26px; height:26px; border-radius:5px; border:1px solid rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.05); color:#ccc; font-size:15px; cursor:pointer;
  display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.15s;
}
.num-ctrl button:hover { background:rgba(255,255,255,0.15); }
.num-ctrl button:disabled { opacity:0.35; cursor:not-allowed; background:rgba(255,255,255,0.03); }
.fix-btn {
  font-family:'Courier New',monospace; font-size:10px; padding:3px 7px;
  border-radius:4px; border:1px solid rgba(255,255,255,0.15);
  background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.4);
  cursor:pointer; transition:all 0.15s; letter-spacing:1px; text-transform:uppercase;
}
.fix-btn.active { background:rgba(255,160,60,0.25); border-color:rgba(255,160,60,0.6); color:#ffb347; }
.ring-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.ring-del {
  background:rgba(255,80,80,0.12); border:1px solid rgba(255,80,80,0.3);
  border-radius:6px; color:#ff6b6b; font-size:12px; padding:4px 10px;
  cursor:pointer; font-family:'Courier New',monospace; transition:background 0.15s;
}
.ring-del:hover { background:rgba(255,80,80,0.25); }
.gen-info { font-family:'Courier New',monospace; font-size:11px; color:rgba(80,180,255,0.6); text-align:right; margin:-2px 0 6px; }
.gen-hint { font-family:'Courier New',monospace; font-size:11px; color:rgba(255,200,80,0.55); text-align:right; margin:-2px 0 4px; cursor:pointer; }
.gen-add-ring {
  margin:0; width:100%; padding:12px;
  background:rgba(255,255,255,0.04); border:1px dashed rgba(255,255,255,0.15);
  border-radius:8px; color:rgba(255,255,255,0.4);
  font-family:'Courier New',monospace; font-size:13px; cursor:pointer;
  text-align:center; transition:all 0.15s; letter-spacing:1px;
}
.gen-add-ring:hover { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); }
.gen-apply {
  padding:9px 16px; border-radius:8px; cursor:pointer; white-space:nowrap;
  font-family:'Courier New',monospace; font-size:12px; letter-spacing:1px; text-transform:uppercase;
  border:1px solid rgba(200,120,255,0.4); background:rgba(200,120,255,0.12); color:#c97fff; transition:background 0.15s;
}
.gen-apply:hover { background:rgba(200,120,255,0.25); }
.gen-preview {
  padding:9px 16px; border-radius:8px; cursor:pointer; white-space:nowrap;
  font-family:'Courier New',monospace; font-size:12px; letter-spacing:1px; text-transform:uppercase;
  border:1px solid rgba(80,180,255,0.4); background:rgba(80,180,255,0.12); color:#6ab0ff; transition:background 0.15s;
}
.gen-preview:hover { background:rgba(80,180,255,0.25); }
#gen-preview-toggle {
  position:fixed; top:24px; right:24px; z-index:2050;
  padding:9px 16px; border-radius:8px; cursor:pointer; display:none;
  font-family:'Courier New',monospace; font-size:12px; letter-spacing:1px; text-transform:uppercase;
  border:1px solid rgba(80,180,255,0.4); background:rgba(80,180,255,0.12); color:#6ab0ff;
}
#gen-preview-toggle:hover { background:rgba(80,180,255,0.25); }
`;

// ── Helper: control numérico +/- ──
function numCtrl(value, min, max, step, onChange, readonly = false) {
  const wrap = document.createElement('div'); wrap.className = 'num-ctrl';
  const btnM = document.createElement('button'); btnM.textContent = '−';
  const inp  = document.createElement('input');
  inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
  if (readonly) { inp.readOnly = true; inp.classList.add('computed'); }
  const btnP = document.createElement('button'); btnP.textContent = '+';
  btnM.disabled = readonly;
  btnP.disabled = readonly;

  const apply = v => {
    const parsed = parseFloat(v);
    const base = Number.isFinite(parsed) ? parsed : parseFloat(inp.value);
    const c = clampNumber(roundStep(base, step), min, max);
    inp.value = parseFloat(c.toFixed(10));
    if (!readonly) onChange(c);
  };

  let holdTimer = null;
  let holdInterval = null;
  let removeGlobalHoldStop = null;
  const clearHold = () => {
    if (holdTimer) clearTimeout(holdTimer);
    if (holdInterval) clearInterval(holdInterval);
    if (typeof removeGlobalHoldStop === 'function') removeGlobalHoldStop();
    holdTimer = null;
    holdInterval = null;
    removeGlobalHoldStop = null;
  };
  const startHold = (event, dir) => {
    if (readonly) return;
    if (event.button !== undefined && event.button !== 0) return;
    clearHold();
    const tick = mult => apply((parseFloat(inp.value) || 0) + (dir * step * mult));
    tick(1);
    let mult = 1;
    holdInterval = setInterval(() => tick(mult), 120);
    holdTimer = setTimeout(() => { mult = 5; }, 3000);

    const stop = () => clearHold();
    const opts = { capture: true };
    window.addEventListener('pointerup', stop, opts);
    window.addEventListener('pointercancel', stop, opts);
    window.addEventListener('blur', stop);
    removeGlobalHoldStop = () => {
      window.removeEventListener('pointerup', stop, opts);
      window.removeEventListener('pointercancel', stop, opts);
      window.removeEventListener('blur', stop);
    };
  };

  inp.addEventListener('change', () => apply(inp.value));
  btnM.addEventListener('click', e => e.preventDefault());
  btnP.addEventListener('click', e => e.preventDefault());
  btnM.addEventListener('pointerdown', e => startHold(e, -1));
  btnP.addEventListener('pointerdown', e => startHold(e, 1));
  ['pointerup','pointerleave','pointercancel'].forEach(ev => {
    btnM.addEventListener(ev, clearHold);
    btnP.addEventListener(ev, clearHold);
  });

  inp._set = v => { inp.value = v; };

  wrap.append(btnM, inp, btnP);
  return wrap;
}

// ── Construir panel UI ──
export function buildGeneratorPanel() {
  document.head.insertAdjacentHTML('beforeend', `<style>${CSS}</style>`);

  const genBtn = document.createElement('div');
  genBtn.id = 'gen-btn'; genBtn.setAttribute('data-tip', 'Generador');
  genBtn.textContent = '⚙️';
  document.body.appendChild(genBtn);

  const previewToggleBtn = document.createElement('button');
  previewToggleBtn.id = 'gen-preview-toggle';
  previewToggleBtn.textContent = 'Preview';
  document.body.appendChild(previewToggleBtn);

  const panel = document.createElement('div'); panel.id = 'gen-panel';
  document.body.appendChild(panel);

  const previewToggle = document.createElement('button');
  previewToggle.id = 'gen-preview-toggle';
  previewToggle.textContent = 'Preview';
  document.body.appendChild(previewToggle);

  function enterPreviewMode() {
    document.body.classList.add('gen-preview-active');
    panel.classList.remove('open');
    previewToggle.style.display = 'block';
    setPaintInteractionsEnabled(false);
    setModelVisibility(false);
    activateExclusive(null);
    const fg = document.getElementById('fab-group');
    const gr = document.getElementById('grid-btn');
    const gb = document.getElementById('gen-btn');
    if (fg) fg.style.visibility = 'hidden';
    if (gr) gr.style.visibility = 'hidden';
    if (gb) gb.style.visibility = 'hidden';
  }

  function exitPreviewMode() {
    document.body.classList.remove('gen-preview-active');
    previewToggle.style.display = 'none';
    setPaintInteractionsEnabled(true);
    setModelVisibility(true);
    const gb = document.getElementById('gen-btn');
    if (gb) gb.style.visibility = _panelIsOpen ? 'hidden' : 'visible';
  }
  _exitPreviewMode = exitPreviewMode;

  function renderPanel() {
    _renderGeneratorPanel = renderPanel;
    // Point 3: preserve scroll position across re-renders
    const scrollEl = panel.querySelector('#gen-scroll');
    const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
    panel.innerHTML = '';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:36px 16px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;';
    const hTitle = document.createElement('span');
    hTitle.style.cssText = "font-family:'Courier New',monospace;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);";
    hTitle.textContent = 'Generador';
    const hBtns = document.createElement('div'); hBtns.style.cssText = 'display:flex;gap:6px;align-items:center;';
    const prevBtn  = document.createElement('button'); prevBtn.className  = 'gen-preview'; prevBtn.textContent = '▶';
    const applyBtn = document.createElement('button'); applyBtn.className = 'gen-apply';   applyBtn.textContent = '✓';
    const closeX   = document.createElement('button');
    closeX.textContent = '✕';
    closeX.style.cssText = "width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.75);cursor:pointer;font-size:16px;";
    closeX.addEventListener('click', closePanel);
    prevBtn.addEventListener('click',  () => generateStructure().then(enterPreviewMode).catch(e => alert(e.message)));
    applyBtn.addEventListener('click', () => applyGenerated().catch(e => alert(e.message)));
    hBtns.append(prevBtn, applyBtn, closeX);
    hdr.append(hTitle, hBtns);
    panel.appendChild(hdr);

    const scroll = document.createElement('div'); scroll.id = 'gen-scroll';
    panel.appendChild(scroll);
    const footer = document.createElement('div'); footer.id = 'gen-footer';
    panel.appendChild(footer);

    rings.forEach((ring, idx) => {
      computeFree(ring);
      const sec = document.createElement('div'); sec.className = 'gen-section';

      const rh = document.createElement('div'); rh.className = 'ring-header';
      const rt = document.createElement('div'); rt.className = 'gen-title'; rt.style.marginBottom = '0';
      rt.textContent = `Anillo ${idx + 1}`;
      const ringCtrls = document.createElement('div'); ringCtrls.style.cssText = 'display:flex;gap:6px;align-items:center;';
      const lockBtn = document.createElement('button');
      lockBtn.className = 'fix-btn' + (ring.locked ? ' active' : '');
      lockBtn.textContent = ring.locked ? 'bloq' : 'pintable';
      lockBtn.addEventListener('click', () => {
        ring.locked = !ring.locked;
        if (ring.visible !== false) setRingLocked(idx, ring.locked);
        renderPanel();
      });
      const visBtn = document.createElement('button');
      visBtn.className = 'fix-btn' + (ring.visible === false ? '' : ' active');
      visBtn.textContent = ring.visible === false ? 'oculto' : 'visible';
      visBtn.addEventListener('click', () => {
        ring.visible = !ring.visible;
        setRingVisible(idx, ring.visible);
        setRingLocked(idx, ring.visible ? ring.locked : true);
        refreshPreviewIfActive();
        renderPanel();
      });
      ringCtrls.append(lockBtn, visBtn);
      rh.append(rt, ringCtrls);
      if (rings.length > 1) {
        const del = document.createElement('button'); del.className = 'ring-del'; del.textContent = '✕';
        del.addEventListener('click', () => { rings.splice(idx, 1); renderPanel(); refreshPreviewIfActive(); });
        rh.appendChild(del);
      }
      sec.appendChild(rh);

      const defs = [
        { key: 'modules', label: 'Módulos',  min: 1,   max: 500, step: 1   },
        { key: 'arc',     label: 'Arco (°)', min: 1,   max: 360, step: 0.5 },
        { key: 'scale',   label: 'Escala',   min: 0.1, max: 20,  step: 0.1 },
        { key: 'radius',  label: 'Radio ×',  min: 0.1, max: 20,  step: 0.1 },
      ];
      defs.forEach(({ key, label, min, max, step }) => {
        const isAuto = ring._autoKey === key;
        const row = document.createElement('div'); row.className = 'gen-row';
        const lbl = document.createElement('span'); lbl.className = 'gen-label'; lbl.textContent = label;

        const ctrl = numCtrl(
          parseFloat(Number(ring[key]).toFixed(4)),
          min, max, step,
          v => { ring[key] = v; computeFree(ring); renderPanel(); refreshPreviewIfActive(); },
          isAuto
        );
        const tog = document.createElement('button');
        tog.className = 'fix-btn' + (ring.fixed[key] ? ' active' : '');
        tog.textContent = ring.fixed[key] ? 'activo' : 'auto';
        tog.addEventListener('click', () => {
          if (!ring.fixed[key]) return;
          ring.fixed[ring._autoKey] = false;
          ring.fixed[key] = true;
          ring._autoKey = ['modules','arc','scale','radius'].find(k => !ring.fixed[k]) || 'radius';
          computeFree(ring); renderPanel(); refreshPreviewIfActive();
        });
        row.append(lbl, tog, ctrl);
        sec.appendChild(row);
      });

      const rEff = parseFloat((BASE_RADIUS * ring.scale * ring.radius).toFixed(2));
      const info = document.createElement('div'); info.className = 'gen-info';
      info.textContent = `radio efectivo: ${rEff} u`;
      sec.appendChild(info);

      const lr = document.createElement('div'); lr.className = 'gen-row';
      lr.append(Object.assign(document.createElement('span'), { className:'gen-label', textContent:'Capas' }));
      lr.append(numCtrl(ring.layers, 1, 200, 1, v => { ring.layers = v; renderPanel(); refreshPreviewIfActive(); }));
      sec.appendChild(lr);

      const or_ = document.createElement('div'); or_.className = 'gen-row';
      or_.append(Object.assign(document.createElement('span'), { className:'gen-label', textContent:'Offset Y' }));
      or_.append(numCtrl(ring.yOffset, -500, 500, 0.1, v => { ring.yOffset = v; refreshPreviewIfActive(); }));
      sec.appendChild(or_);

      if (idx > 0) {
        const prev = rings[idx - 1];
        const sug  = parseFloat((prev.yOffset + prev.layers * V_STEP_BASE * prev.scale).toFixed(2));
        const hint = document.createElement('div'); hint.className = 'gen-hint';
        hint.textContent = `sugerido: ${sug} u  ↵`;
        hint.addEventListener('click', () => { ring.yOffset = sug; renderPanel(); refreshPreviewIfActive(); });
        sec.appendChild(hint);
      }

      // Módulo origen
      const maxO = maxOriginOffset(ring.modules, ring.arc);
      const mr = document.createElement('div'); mr.className = 'gen-row';
      mr.append(Object.assign(document.createElement('span'), { className:'gen-label', textContent:'Módulo origen' }));
      mr.append(numCtrl(ring.originModule, -maxO, maxO, 1, v => { ring.originModule = v; refreshPreviewIfActive(); }));
      sec.appendChild(mr);

      scroll.appendChild(sec);
    });

    requestAnimationFrame(() => {
      const s = panel.querySelector('#gen-scroll');
      if (s) s.scrollTop = savedScroll;
    });

    const addRing = document.createElement('div'); addRing.className = 'gen-add-ring';
    addRing.textContent = '+ Añadir anillo';
    addRing.addEventListener('click', () => {
      const last = rings[rings.length - 1];
      const nr = defaultRing(); nr.scale = last.scale;
      nr.yOffset = parseFloat((last.yOffset + last.layers * V_STEP_BASE * last.scale).toFixed(2));
      rings.push(nr); renderPanel(); refreshPreviewIfActive();
    });
    footer.appendChild(addRing);
  }

  const openPanel  = ()  => {
    _panelIsOpen = true;
    exitPreviewMode();
    panel.classList.add('open');
    activateExclusive('gen');
    const gb = document.getElementById('gen-btn');
    if (gb) gb.style.visibility = 'hidden';
  };
  const closePanel = ()  => {
    _panelIsOpen = false;
    exitPreviewMode();
    panel.classList.remove('open');
    disposeGeneratedGroup();
    activateExclusive(null);
    const gb = document.getElementById('gen-btn');
    if (gb) gb.style.visibility = _panelIsOpen ? 'hidden' : 'visible';
  };

  previewToggle.addEventListener('click', e => {
    e.stopPropagation();
    if (!document.body.classList.contains('gen-preview-active')) return;
    exitPreviewMode();
    renderPanel();
    openPanel();
  });

  genBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (panel.classList.contains('open')) closePanel();
    else {
      renderPanel();
      openPanel();
    }
  });

  return { genBtn, panel, openPanel, closePanel };
}

// ── Callback Apply ──
let _onApply = null;
export function onGeneratorApply(fn) { _onApply = fn; }

async function applyGenerated() {
  if (!generatedGroup || !generatedGroup.children.length) {
    await generateStructure();
  }
  if (_onApply) _onApply(generatedGroup);
  rings.forEach((ring, idx) => {
    setRingVisible(idx, ring.visible !== false);
    setRingLocked(idx, ring.visible === false ? true : ring.locked);
  });
  _exitPreviewMode();
  if (_panelIsOpen) {
    const gb = document.getElementById('gen-btn');
    if (gb) gb.style.visibility = 'hidden';
  }
  generatedGroup = null;
}
