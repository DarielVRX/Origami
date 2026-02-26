// ─────────────────────────────────────────────────────────────
// generator.js — Generador procedural de estructuras en anillo
// ─────────────────────────────────────────────────────────────

import * as THREE        from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }    from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { scene, resizeGuidePlanes } from './scene.js';
import { activateExclusive } from './ui.js';
import { setRingLocked } from './paint.js';

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
const maxOriginAt360 = (modules, arc) => Math.max(1, Math.round((modules * 2 * arc) / 360));

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
  _autoKey: 'modules',
  modules:  20,
  arc:      360,
  scale:    1.0,
  radius:   1.0,
  layers:   10,
  yOffset:  0,
  originModule: 1,
});

let rings = [defaultRing()];

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
  ring.originModule = clampNumber(ring.originModule, 1, maxOriginAt360(ring.modules, ring.arc));
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
  disposeGeneratedGroup();
  generatedGroup = new THREE.Group();
  const geometry = await getModuleGeometry();

    computeFree(ring);
    const { modules, arc, scale, radius, layers, yOffset, originModule } = ring;
    const effectiveRadius = BASE_RADIUS * scale * radius;
    const angleStep       = arc / modules;
    const originOffset    = -((originModule - 1) * angleStep);
    const vStep           = V_STEP_BASE * scale;
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8, metalness: 0 });

    for (let layer = 0; layer < layers; layer++) {
      const stagger = (layer % 2 === 1) ? angleStep / 2 : 0;
      const y       = yOffset + layer * vStep;

      for (let m = 0; m < modules; m++) {
        const angleDeg = m * angleStep + stagger + originOffset;
        const angleRad = THREE.MathUtils.degToRad(angleDeg);

        const pivot = new THREE.Object3D();
        pivot.rotation.y = -angleRad;
        pivot.position.y = y;

        const mesh = new THREE.Mesh(geometry, mat.clone());
        mesh.userData.ringId = `ring:${idx}`;
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
  position:fixed; top:0; right:0; width:360px; height:100vh;
  background:rgba(18,18,18,0.97); backdrop-filter:blur(14px);
  border-left:1px solid rgba(255,255,255,0.08);
  z-index:1900; display:flex; flex-direction:column;
  transform:translateX(100%); transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
}
#gen-panel.open { transform:translateX(0); }
#gen-scroll { flex:1; overflow-y:auto; padding-bottom:24px; }
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
.num-ctrl input.computed { border-color:rgba(80,180,255,0.4); color:rgba(80,200,255,0.9); background:rgba(80,180,255,0.06); }
.num-ctrl button {
  width:26px; height:26px; border-radius:5px; border:1px solid rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.05); color:#ccc; font-size:15px; cursor:pointer;
  display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.15s;
}
.num-ctrl button:hover { background:rgba(255,255,255,0.15); }
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
  margin:12px 16px; padding:12px;
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
`;
  width:34px; height:34px; border-radius:8px; cursor:pointer;
  font-family:'Courier New',monospace; font-size:16px;
  border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.08);
  color:rgba(255,255,255,0.75); display:flex; align-items:center; justify-content:center;
}
.gen-close:hover { background:rgba(255,255,255,0.18); }
#gen-preview-toggle {
  position:fixed; top:24px; right:24px; z-index:2001;
  padding:9px 16px; border-radius:8px; display:none;
  font-family:'Courier New',monospace; font-size:12px; letter-spacing:1px; text-transform:uppercase;
  border:1px solid rgba(80,180,255,0.45); background:rgba(80,180,255,0.2); color:#6ab0ff; cursor:pointer;
}
`;

// ── Helper: control numérico +/- ──
function numCtrl(value, min, max, step, onChange, readonly = false) {
  const wrap = document.createElement('div'); wrap.className = 'num-ctrl';
  const btnM = document.createElement('button'); btnM.textContent = '−';
  const inp  = document.createElement('input');
  inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
  if (readonly) { inp.readOnly = true; inp.classList.add('computed'); }
  const btnP = document.createElement('button'); btnP.textContent = '+';

  const apply = v => {
    const c = clampNumber(roundStep(parseFloat(v) || min, step), min, max);
    inp.value = parseFloat(c.toFixed(10)); // evitar drift
    if (!readonly) onChange(c);
  };
  inp.addEventListener('change', () => apply(inp.value));
  btnM.addEventListener('click', () => apply(parseFloat(inp.value) - step));
  btnP.addEventListener('click', () => apply(parseFloat(inp.value) + step));

  // Para refresh externo sin disparar onChange
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

  let previewMode = false;

  function exitPreview({ showGenerator = true } = {}) {
    if (!previewMode) return;
    previewMode = false;
    previewToggleBtn.style.display = 'none';
    setModelVisibility(true);
    if (!showGenerator) {
      activateExclusive(null);
      return;
    }
    panel.classList.add('open');
    genBtn.style.display = 'none';
    activateExclusive('gen');
  }

  async function enterPreview() {
    await generateStructure();
    previewMode = true;
    setModelVisibility(false);
    panel.classList.remove('open');
    genBtn.style.display = 'none';
    previewToggleBtn.style.display = 'block';
    activateExclusive(null); // muestra cámara
    const fg = document.getElementById('fab-group');
    const gr = document.getElementById('grid-btn');
    if (fg) fg.style.visibility = 'hidden';
    if (gr) gr.style.visibility = 'hidden';
  }

  function renderPanel() {
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
    closeX.className = 'gen-close'; closeX.textContent = '✕';
    closeX.addEventListener('click', closePanel);
    prevBtn.addEventListener('click',  () => enterPreview().catch(e => alert(e.message)));
    applyBtn.addEventListener('click', () => applyGenerated(closePanel));
    hBtns.append(prevBtn, applyBtn, closeX);
    hdr.append(hTitle, hBtns);
    panel.appendChild(hdr);

    const scroll = document.createElement('div'); scroll.id = 'gen-scroll';
    panel.appendChild(scroll);

    rings.forEach((ring, idx) => {
      computeFree(ring);
      const sec = document.createElement('div'); sec.className = 'gen-section';

      const rh = document.createElement('div'); rh.className = 'ring-header';
      const rt = document.createElement('div'); rt.className = 'gen-title'; rt.style.marginBottom = '0';
      rt.textContent = `Anillo ${idx + 1}`;
      const lockBtn = document.createElement('button');
      lockBtn.className = 'fix-btn' + (ring.locked ? ' active' : '');
      lockBtn.textContent = ring.locked ? 'bloqueado' : 'pintable';
      lockBtn.addEventListener('click', () => {
        ring.locked = !ring.locked;
        setRingLocked(idx, ring.locked);
        renderPanel();
      });
      rh.append(rt, lockBtn);
      if (rings.length > 1) {
        const del = document.createElement('button'); del.className = 'ring-del'; del.textContent = '✕';
        del.addEventListener('click', () => { rings.splice(idx, 1); renderPanel(); });
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
          v => { ring[key] = v; computeFree(ring); renderPanel(); },
          isAuto
        );
        const tog = document.createElement('button');
        tog.className = 'fix-btn' + (ring.fixed[key] ? ' active' : '');
        tog.textContent = ring.fixed[key] ? 'activo' : 'auto';
        tog.addEventListener('click', () => {
          const next = !ring.fixed[key];
          const fixedCount = Object.values(ring.fixed).filter(Boolean).length;
          if (!next && fixedCount <= 1) return;
          if (next && fixedCount >= 3) return;
          ring.fixed[key] = next;
          computeFree(ring);
          renderPanel();
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
      lr.append(numCtrl(ring.layers, 1, 200, 1, v => { ring.layers = v; renderPanel(); }));
      sec.appendChild(lr);

      const or_ = document.createElement('div'); or_.className = 'gen-row';
      or_.append(Object.assign(document.createElement('span'), { className:'gen-label', textContent:'Offset Y' }));
      or_.append(numCtrl(ring.yOffset, -500, 500, 0.1, v => { ring.yOffset = v; }));
      sec.appendChild(or_);

      if (idx > 0) {
        const prev = rings[idx - 1];
        const sug  = parseFloat((prev.yOffset + prev.layers * V_STEP_BASE * prev.scale).toFixed(2));
        const hint = document.createElement('div'); hint.className = 'gen-hint';
        hint.textContent = `sugerido: ${sug} u  ↵`;
        hint.addEventListener('click', () => { ring.yOffset = sug; renderPanel(); });
        sec.appendChild(hint);
      }

      const maxO = maxOriginAt360(ring.modules, ring.arc);
      const mr = document.createElement('div'); mr.className = 'gen-row';
      mr.append(Object.assign(document.createElement('span'), { className:'gen-label', textContent:'Módulo origen' }));
      mr.append(numCtrl(ring.originModule, 1, maxO, 1, v => { ring.originModule = v; }));
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
      rings.push(nr); renderPanel();
    });
    scroll.appendChild(addRing);
  }

  const openPanel  = ()  => {
    exitPreview();
    panel.classList.add('open');
    genBtn.style.display = 'none';
    activateExclusive('gen');
  };
  const closePanel = ()  => {
    exitPreview({ showGenerator: false });
    panel.classList.remove('open');
    disposeGeneratedGroup();
    setModelVisibility(true);
    genBtn.style.display = 'flex';
    previewToggleBtn.style.display = 'none';
    activateExclusive(null);
  };

  previewToggleBtn.addEventListener('click', () => {
    if (!previewMode) return;
    setModelVisibility(true);
    previewToggleBtn.style.display = 'none';
    panel.classList.add('open');
    activateExclusive('gen');
    const fg = document.getElementById('fab-group');
    const gr = document.getElementById('grid-btn');
    if (fg) fg.style.visibility = 'hidden';
    if (gr) gr.style.visibility = 'hidden';
    previewMode = false;
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

function applyGenerated(closeFn) {
  if (!generatedGroup || !generatedGroup.children.length) {
    alert('Genera una vista previa primero.'); return;
  }
  if (_onApply) _onApply(generatedGroup);
  rings.forEach((ring, idx) => setRingLocked(idx, !!ring.locked));
  generatedGroup = null;
  closeFn();
}
