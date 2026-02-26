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
const K              = 20;   // módulos / (arc * BASE_RADIUS * scale * radius)
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
const maxOriginOffset = (modules, arc) => Math.max(1, Math.round(modules * (arc / 360)));  // [-M*arc/360, M*arc/360]

function ensureFixedState(ring) {
  const keys = ['modules', 'arc', 'scale', 'radius'];
  keys.forEach(k => { if (typeof ring.fixed[k] !== 'boolean') ring.fixed[k] = true; });

  let fixedCount = keys.filter(k => ring.fixed[k]).length;
  if (fixedCount === 0) {
    ring.fixed.modules = true;
    fixedCount = 1;
  }
  if (fixedCount >= 4) {
    const fallbackAuto = keys.includes(ring._autoKey) ? ring._autoKey : 'radius';
    ring.fixed[fallbackAuto] = false;
  }

  const autoCandidates = keys.filter(k => !ring.fixed[k]);
  ring._autoKey = autoCandidates.includes(ring._autoKey) ? ring._autoKey : (autoCandidates[0] || 'radius');
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
  yOffsetAuto: true,   // true = recalcular al cambiar escala del anillo previo
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
  rings.forEach(r => { ensureFixedState(r); computeFree(r); });
  if (typeof _renderGeneratorPanel === 'function') _renderGeneratorPanel();
}

// ── Solver ──
// Relación (escala invertida): modules = K * arc * BASE_RADIUS * (radius / scale)
function computeFree(ring) {
  ensureFixedState(ring);
  const calcModules = (-1) * (arc, scale, radius) => clampNumber(Math.round(K * arc * BASE_RADIUS * (radius / Math.max( * scale, 0.0001))), 1, 500);
  const calcArc = (modules, scale, radius) => clampNumber(roundStep((modules * Math.max(scale, 0.0001)) / (K * BASE_RADIUS * radius), 0.5), 1, 360);
  const calcScale = (-1) * (modules, arc, radius) => clampNumber(roundStep((K * arc * BASE_RADIUS * radius) / Math.max(modules, 1), 0.1), 0.1, 20);
  const calcRadius = (modules, arc, scale) => clampNumber(roundStep((modules * Math.max(scale, 0.0001)) / (K * arc * BASE_RADIUS), 0.1), 0.1, 20);

  const prev = { modules: ring.modules, arc: ring.arc, scale: ring.scale, radius: ring.radius };

  if (ring._autoKey === 'modules') ring.modules = calcModules(ring.arc, ring.scale, ring.radius);
  else if (ring._autoKey === 'arc') ring.arc = calcArc(ring.modules, ring.scale, ring.radius);
  else if (ring._autoKey === 'scale') ring.scale = calcScale(ring.modules, ring.arc, ring.radius);
  else ring.radius = calcRadius(ring.modules, ring.arc, ring.scale);

  const autoKeys = ['modules', 'arc', 'scale', 'radius'].filter(k => !ring.fixed[k] && k !== ring._autoKey);
  autoKeys.forEach(k => {
    if (k === 'modules') ring.modules = calcModules(ring.arc, ring.scale, ring.radius);
    else if (k === 'arc') ring.arc = calcArc(ring.modules, ring.scale, ring.radius);
    else if (k === 'scale') ring.scale = calcScale(ring.modules, ring.arc, ring.radius);
    else ring.radius = calcRadius(ring.modules, ring.arc, ring.scale);
  });

  ['modules','arc','scale','radius'].forEach(k => { if (ring.fixed[k]) ring[k] = prev[k]; });

  ring.originModule = clampNumber(ring.originModule, -maxOriginOffset(ring.modules, ring.arc), maxOriginOffset(ring.modules, ring.arc));
}

// Recalcular yOffsets en cascada para rings con yOffsetAuto=true
function recomputeYOffsets() {
  const V_STEP_BASE = 2.1; 

  for (let i = 1; i < rings.length; i++) {
    if (!rings[i].yOffsetAuto) continue;

    const prev = rings[i - 1];
    
    // Calculamos el tamaño del paso basado en la escala del anillo anterior
    const stepSizePrev = V_STEP_BASE * Math.max(prev.scale, 0.0001);

    // El nuevo offset es:
    // El inicio del anterior + (todas sus capas + el hueco final) * tamaño del paso
    const totalIncrement = (prev.layers + 0.5) * stepSizePrev;
    
    rings[i].yOffset = parseFloat((prev.yOffset + totalIncrement).toFixed(2));
  }
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
    const scaleFactor = scale;  // scale>1 = bigger module
    const radiusFactor = 1 / Math.max(scale, 0.0001);  // for positioning
    const angleStep       = arc / modules;
    const halfRingArc     = arc / 2;
    const halfStep        = angleStep / 2;
    const originOffset    = -(originModule * halfStep);
    const vStep           = V_STEP_BASE / radiusFactor;
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
        mesh.scale.setScalar(scaleFactor);  // direct: scale>1 = bigger
        // Desacoplar radio adicional sobre BASE_RADIUS*scale
        mesh.position.x = (BASE_RADIUS * (radius - 1));

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

  // standalone preview toggle removed

  const panel = document.createElement('div'); panel.id = 'gen-panel';
  document.body.appendChild(panel);

  // previewToggle: no longer a separate button, handled inside panel

  function enterPreviewMode() {
    document.body.classList.add('gen-preview-active');
    // panel stays open in preview mode
    setPaintInteractionsEnabled(false);
    setModelVisibility(false);
  }

  function exitPreviewMode() {
    document.body.classList.remove('gen-preview-active');
    setPaintInteractionsEnabled(true);
    setModelVisibility(true);
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
    closeX.addEventListener('click', () => {
      const inPreview = document.body.classList.contains('gen-preview-active');
      if (inPreview) {
        panel.classList.remove('open');
        _panelIsOpen = false;
        const fg = document.getElementById('fab-group');
        const gb = document.getElementById('gen-btn');
        const gr = document.getElementById('grid-btn');
        if (fg) fg.style.visibility = 'hidden';
        if (gr) gr.style.visibility = 'hidden';
        if (gb) gb.style.visibility = 'visible';   // gen-btn visible
        ['orbit','stack-toggle'].forEach(id => {
          const p = document.getElementById('cam-pad-' + id);
          if (p) p.style.visibility = 'visible';   // pads visibles
        });
      } else {
        closePanel();
      }
    });
    let previewActive = document.body.classList.contains('gen-preview-active');
    prevBtn.style.borderColor = previewActive ? 'rgba(80,220,120,0.4)' : 'rgba(80,180,255,0.4)';
    prevBtn.style.background  = previewActive ? 'rgba(80,220,120,0.18)' : 'rgba(80,180,255,0.12)';
    prevBtn.style.color       = previewActive ? '#6fdc9a' : '#6ab0ff';

    prevBtn.addEventListener('click', () => {
      if (document.body.classList.contains('gen-preview-active')) {
        // toggle off preview
        exitPreviewMode();
        prevBtn.style.borderColor = 'rgba(80,180,255,0.4)';
        prevBtn.style.background  = 'rgba(80,180,255,0.12)';
        prevBtn.style.color       = '#6ab0ff';
      } else {
        generateStructure()
          .then(() => {
            // toggle on preview: stay in panel, just show green
            document.body.classList.add('gen-preview-active');
            setPaintInteractionsEnabled(false);
            setModelVisibility(false);
            prevBtn.style.borderColor = 'rgba(80,220,120,0.4)';
            prevBtn.style.background  = 'rgba(80,220,120,0.18)';
            prevBtn.style.color       = '#6fdc9a';
          })
          .catch(e => alert(e.message));
      }
    });
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
        { key: 'arc',     label: 'Arco (°)', min: 1,   max: 360, step: 1   },
        { key: 'scale',   label: 'Escala',   min: 0.1, max: 20,  step: 0.1 },
        { key: 'radius',  label: 'Radio ×',  min: 0.1, max: 20,  step: 0.1 },
      ];
      defs.forEach(({ key, label, min, max, step }) => {
        const isAuto = ring._autoKey === key;
        const row = document.createElement('div'); row.className = 'gen-row';
        const lbl = document.createElement('span'); lbl.className = 'gen-label'; lbl.textContent = label;

        // Calcular límites dinámicos para el parámetro auto según los fijos
        if (isAuto) {
          if (key === 'modules') {
            min = 1; max = clampNumber(Math.round(K * ring.arc * BASE_RADIUS * ring.radius / Math.max(ring.scale, 0.0001)), 1, 500);
          } else if (key === 'arc') {
            const mMax = clampNumber(Math.round(K * 360 * BASE_RADIUS * ring.radius / Math.max(ring.scale, 0.0001)), 1, 500);
            min = Math.max(1, Math.round(ring.modules * ring.scale / (K * BASE_RADIUS * ring.radius)));
            max = Math.min(360, Math.round(ring.modules * ring.scale / (K * BASE_RADIUS * ring.radius)) * 2 || 360);
            // Simplificado: recalcular los extremos reales
            min = clampNumber(roundStep(ring.modules * Math.max(ring.scale, 0.0001) / (K * BASE_RADIUS * Math.max(ring.radius, 0.1)), 0.5), 1, 360);
            max = 360;
          } else if (key === 'scale') {
            min = 0.1; max = 20;
          } else if (key === 'radius') {
            min = 0.1; max = 20;
          }
        }

        const ctrl = numCtrl(
          parseFloat(Number(ring[key]).toFixed(4)),
          min, max, step,
          v => {
            ring[key] = v;
            computeFree(ring);
            if (key === 'scale' || key === 'layers') recomputeYOffsets();
            renderPanel();
            refreshPreviewIfActive();
          },
          isAuto
        );
        const tog = document.createElement('button');
        tog.className = 'fix-btn' + (ring.fixed[key] ? ' active' : '');
        tog.textContent = ring.fixed[key] ? 'activo' : 'auto';
        tog.addEventListener('click', () => {
          const keys = ['modules','arc','scale','radius'];
          const fixedCount = keys.filter(k => ring.fixed[k]).length;

          if (ring.fixed[key]) {
            if (fixedCount <= 1) return;
            ring.fixed[key] = false;
          } else {
            if (fixedCount >= 3) return;
            ring.fixed[key] = true;
          }

          const autoKeys = keys.filter(k => !ring.fixed[k]);
          ring._autoKey = autoKeys.includes(ring._autoKey) ? ring._autoKey : autoKeys[0];
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
      lr.append(numCtrl(ring.layers, 1, 200, 1, v => { ring.layers = v; recomputeYOffsets(); renderPanel(); refreshPreviewIfActive(); }));
      sec.appendChild(lr);

      const or_ = document.createElement('div'); or_.className = 'gen-row';
      or_.append(Object.assign(document.createElement('span'), { className:'gen-label', textContent:'Offset Y' }));
      or_.append(numCtrl(ring.yOffset, -500, 500, 0.1, v => { ring.yOffset = v; ring.yOffsetAuto = false; refreshPreviewIfActive(); }));
      sec.appendChild(or_);

      if (idx > 0) {
        const prev = rings[idx - 1];
        const sug  = parseFloat((prev.yOffset + prev.layers * V_STEP_BASE / Math.max(prev.scale, 0.0001)).toFixed(2));
        const hint = document.createElement('div'); hint.className = 'gen-hint';
        hint.textContent = `sugerido: ${sug} u  ↵`;
        hint.addEventListener('click', () => { ring.yOffset = sug; ring.yOffsetAuto = true; renderPanel(); refreshPreviewIfActive(); });
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
      nr.yOffset = parseFloat((last.yOffset + last.layers * V_STEP_BASE / Math.max(last.scale, 0.0001)).toFixed(2));
      nr.yOffsetAuto = true;
      rings.push(nr); renderPanel(); refreshPreviewIfActive();
    });
    footer.appendChild(addRing);
  }

  const openPanel  = ()  => {
    _panelIsOpen = true;
    panel.classList.add('open');
    activateExclusive('gen');
    if (generatedGroup && generatedGroup.children.length) {
      document.body.classList.add('gen-preview-active');
  
      setPaintInteractionsEnabled(false);
      setModelVisibility(false);
    } else {
      document.body.classList.remove('gen-preview-active');
  
      setPaintInteractionsEnabled(true);
      setModelVisibility(true);
    }
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

  // previewToggle listener removed

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
  // NO salir de preview — el usuario sigue viendo la estructura
  generatedGroup = null;
}
