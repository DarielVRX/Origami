// ─────────────────────────────────────────────────────────────
// generator.js — Generador procedural de estructuras en anillo
// Dependencias: three, scene.js
// ─────────────────────────────────────────────────────────────

import * as THREE            from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }        from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { scene }             from './scene.js';
import { activateExclusive } from './ui.js';

// ── Constantes derivadas del modelo original ──
const K              = 20 / (360 * 17); // módulos / (arcDeg * radius)
const BASE_RADIUS    = 17;
const OVERLAP_BASE   = 1.4;
const V_SPACING_BASE = 3.5;
const V_STEP_BASE    = V_SPACING_BASE - OVERLAP_BASE;

// ── Estado del generador ──
let generatedGroup = null;
let moduleBuffer = null;
let moduleGltf = null;

const PARAM_KEYS = ['modules', 'arc', 'scale', 'radius'];

const defaultRing = () => ({
  id: Date.now(),
  fixed: {
    modules: true,
    arc: true,
    scale: true,
    radius: false, // default automático
  },
  modules: 20,
  arc: 360,
  scale: 1.0,  // escala visual del módulo
  radius: 1.0, // factor de radio relativo (1 => radio real 17)
  layers: 10,
  yOffset: 0,
  originModule: 1,
  _autoKey: 'radius',
});

let rings = [defaultRing()];

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function roundStep(value, step) {
  return Math.round(value / step) * step;
}

function maxModulesAt360(scale, radius) {
  return Math.max(1, Math.round(K * 360 * BASE_RADIUS * scale * radius));
}

function maxOriginAt360(modules, arc) {
  const safeArc = Math.max(1, Number(arc) || 360);
  return Math.max(1, Math.round((modules * 2 / safeArc) * 360));
}

function ensureFixedState(ring) {
  if (!ring.fixed || typeof ring.fixed !== 'object') {
    ring.fixed = { modules: true, arc: true, scale: true, radius: false };
  }
  for (const k of PARAM_KEYS) {
    if (typeof ring.fixed[k] !== 'boolean') ring.fixed[k] = false;
  }
}

// Formula base usada: modules = K * arc * BASE_RADIUS * scale * radius
function computeFree(ring) {
  ensureFixedState(ring);

  ring.modules = Math.max(1, Math.round(clampNumber(ring.modules, 1, 5000, 20)));
  ring.arc = clampNumber(ring.arc, 1, 360, 360);
  ring.scale = roundStep(clampNumber(ring.scale, 0.1, 20, 1), 0.1);
  ring.radius = roundStep(clampNumber(ring.radius, 0.1, 20, 1), 0.1);
  ring.layers = Math.max(1, Math.round(clampNumber(ring.layers, 1, 200, 10)));
  ring.yOffset = clampNumber(ring.yOffset, -500, 500, 0);

  // Permitir activar/desactivar libremente: escogemos 1 auto en base al primer no fijo
  let autoKey = PARAM_KEYS.find(k => !ring.fixed[k]);
  if (!autoKey) {
    // Si todos están fijos, dejamos radio automático por defecto
    ring.fixed.radius = false;
    autoKey = 'radius';
  }
  ring._autoKey = autoKey;

  const scale = ring.scale;
  const radius = ring.radius;

  if (autoKey === 'modules') {
    ring.modules = Math.max(1, Math.round(K * ring.arc * BASE_RADIUS * scale * radius));
  } else if (autoKey === 'arc') {
    const maxM = maxModulesAt360(scale, radius);
    ring.modules = Math.min(ring.modules, maxM);
    ring.arc = ring.modules / (K * BASE_RADIUS * scale * radius);
    ring.arc = clampNumber(ring.arc, 1, 360, 360);
  } else if (autoKey === 'scale') {
    ring.scale = ring.modules / (K * ring.arc * BASE_RADIUS * radius);
    ring.scale = roundStep(clampNumber(ring.scale, 0.1, 20, 1), 0.1);
  } else {
    ring.radius = ring.modules / (K * ring.arc * BASE_RADIUS * scale);
    ring.radius = roundStep(clampNumber(ring.radius, 0.1, 20, 1), 0.1);
  }

  const maxOrigin = maxOriginAt360(ring.modules, ring.arc);
  ring.originModule = Math.round(clampNumber(ring.originModule, 1, maxOrigin, 1));
}

function disposeGeneratedGroup(group) {
  if (!group) return;
  scene.remove(group);
  group.traverse(child => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    child.material?.dispose();
  });
}

export async function loadModuleBuffer(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  moduleBuffer = await res.arrayBuffer();
  moduleGltf = null;
  return moduleBuffer;
}

async function getModuleGeometry() {
  if (moduleGltf) return moduleGltf;
  if (!moduleBuffer) throw new Error('Buffer de módulo no cargado');

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(moduleBuffer.slice(0), '', gltf => {
      const meshes = [];
      gltf.scene.traverse(child => { if (child.isMesh) meshes.push(child); });
      if (!meshes.length) {
        reject(new Error('Sin geometría'));
        return;
      }
      moduleGltf = meshes[0].geometry.clone();
      resolve(moduleGltf);
    }, reject);
  });
}

export async function generateStructure() {
  if (generatedGroup) disposeGeneratedGroup(generatedGroup);
  generatedGroup = new THREE.Group();

  const geometry = await getModuleGeometry();

  for (const ring of rings) {
    computeFree(ring);
    const { modules, arc, scale, radius, layers, yOffset, originModule } = ring;
    const angleStep = arc / modules;
    const halfStep = angleStep / 2;
    const originShift = (originModule - 1) * halfStep;
    const vStep = V_STEP_BASE * scale;

    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8, metalness: 0 });

    for (let layer = 0; layer < layers; layer++) {
      const layerRotOffset = (layer % 2 === 1) ? halfStep : 0;
      const y = yOffset + layer * vStep;

      for (let m = 0; m < modules; m++) {
        const angleDeg = m * angleStep + layerRotOffset - originShift;
        const angleRad = THREE.MathUtils.degToRad(angleDeg);

        const pivot = new THREE.Object3D();
        pivot.rotation.y = -angleRad;
        pivot.position.y = y;

        const mesh = new THREE.Mesh(geometry, mat.clone());
        mesh.scale.setScalar(scale);
        // desacople de escala y radio
        mesh.position.x = BASE_RADIUS * (radius - scale);
        mesh.userData.pivot = true;

        pivot.add(mesh);
        generatedGroup.add(pivot);
      }
    }
  }

  scene.add(generatedGroup);
  return generatedGroup;
}

function createNumericControl({ value, min, max, step, readOnly = false, onCommit }) {
  const wrap = document.createElement('div');
  wrap.className = 'gen-num-wrap';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'gen-step-btn';
  minus.textContent = '−';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'gen-input';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'gen-step-btn';
  plus.textContent = '+';

  if (readOnly) {
    input.readOnly = true;
    input.classList.add('computed');
    minus.disabled = true;
    plus.disabled = true;
  }

  const commit = rawValue => {
    const n = Number(rawValue);
    if (!Number.isFinite(n)) return;
    const snapped = roundStep(clampNumber(n, min, max, value), step);
    onCommit(snapped);
  };

  input.addEventListener('change', () => commit(input.value));
  minus.addEventListener('click', () => commit(Number(input.value) - step));
  plus.addEventListener('click', () => commit(Number(input.value) + step));

  wrap.append(minus, input, plus);
  return { wrap, input };
}

export function buildGeneratorPanel() {
  document.head.insertAdjacentHTML('beforeend', `<style>
    #gen-btn {
      position:fixed; top:24px; right:24px; z-index:2000;
      width:72px; height:72px; border-radius:50%;
      background:rgba(20,20,20,0.88); border:1px solid rgba(255,255,255,0.18);
      backdrop-filter:blur(10px); display:flex; align-items:center;
      justify-content:center; cursor:pointer; font-size:28px; color:#fff;
      transition:background 0.2s, transform 0.2s; user-select:none;
    }
    #gen-btn:hover  { background:rgba(50,50,50,0.95); transform:scale(1.07); }
    #gen-btn:active { transform:scale(0.95); }

    #gen-panel {
      position:fixed; top:0; right:0; width:360px; height:100vh;
      background:rgba(18,18,18,0.97); backdrop-filter:blur(14px);
      border-left:1px solid rgba(255,255,255,0.08);
      z-index:1900; display:flex; flex-direction:column;
      transform:translateX(100%);
      transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
      overflow:hidden;
    }
    #gen-panel.open { transform:translateX(0); }
    #gen-scroll {
      flex:1;
      overflow-y:auto;
      min-height:0;
      padding-bottom:10px;
    }

    .gen-section { padding:16px; border-bottom:1px solid rgba(255,255,255,0.06); }
    .gen-title {
      font-family:'Courier New',monospace; font-size:11px;
      letter-spacing:2px; text-transform:uppercase;
      color:rgba(255,255,255,0.3); margin-bottom:12px;
    }
    .gen-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:8px; }
    .gen-label {
      font-family:'Courier New',monospace; font-size:12px;
      color:rgba(255,255,255,0.55); white-space:nowrap; flex-shrink:0;
    }
    .gen-num-wrap { display:flex; align-items:center; gap:6px; }
    .gen-step-btn {
      width:24px; height:24px; border-radius:6px; border:1px solid rgba(255,255,255,0.2);
      background:rgba(255,255,255,0.08); color:#ddd; cursor:pointer;
      font-family:'Courier New',monospace; line-height:1;
    }
    .gen-step-btn:disabled { opacity:0.4; cursor:default; }
    .gen-input {
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
      border-radius:6px; color:#fff; font-family:'Courier New',monospace;
      font-size:13px; padding:6px 8px; width:82px; text-align:right;
      outline:none; transition:border-color 0.2s;
    }
    .gen-input:focus { border-color:rgba(255,255,255,0.4); }
    .gen-input.computed {
      border-color:rgba(80,180,255,0.4); color:rgba(80,200,255,0.9);
      background:rgba(80,180,255,0.06);
    }

    .fix-btn {
      font-family:'Courier New',monospace; font-size:10px; padding:3px 7px;
      border-radius:4px; border:1px solid rgba(255,255,255,0.15);
      background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.4);
      cursor:pointer; transition:all 0.15s; letter-spacing:1px; text-transform:uppercase;
    }
    .fix-btn.active {
      background:rgba(255,160,60,0.25); border-color:rgba(255,160,60,0.6); color:#ffb347;
    }

    .ring-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .ring-del {
      background:rgba(255,80,80,0.12); border:1px solid rgba(255,80,80,0.3);
      border-radius:6px; color:#ff6b6b; font-size:12px; padding:4px 10px;
      cursor:pointer; font-family:'Courier New',monospace;
    }

    .gen-add-ring {
      margin:12px 16px; padding:12px;
      background:rgba(255,255,255,0.04); border:1px dashed rgba(255,255,255,0.15);
      border-radius:8px; color:rgba(255,255,255,0.4);
      font-family:'Courier New',monospace; font-size:13px; cursor:pointer; text-align:center;
    }

    .gen-footer {
      padding:12px 16px calc(12px + env(safe-area-inset-bottom));
      display:flex; gap:10px;
      border-top:1px solid rgba(255,255,255,0.06);
      background:rgba(18,18,18,0.98);
      position:sticky;
      bottom:0;
      z-index:1;
    }
    .gen-action {
      flex:1; padding:12px; border-radius:8px; cursor:pointer;
      font-family:'Courier New',monospace; font-size:13px; letter-spacing:1px;
      text-transform:uppercase; border:1px solid;
    }
    .gen-apply {
      background:rgba(200,120,255,0.12); border-color:rgba(200,120,255,0.4); color:#c97fff;
    }
    .gen-export {
      background:rgba(80,200,120,0.12); border-color:rgba(80,200,120,0.4); color:#6fdc9a;
    }
  </style>`);

  const genBtn = document.createElement('div');
  genBtn.id = 'gen-btn';
  genBtn.setAttribute('data-tip', 'Generador');
  genBtn.textContent = '⚙️';
  document.body.appendChild(genBtn);

  const panel = document.createElement('div');
  panel.id = 'gen-panel';
  document.body.appendChild(panel);

  function renderPanel() {
    panel.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'padding:40px 16px 8px; display:flex; align-items:center; justify-content:space-between;';
    header.innerHTML = `<span style="font-family:'Courier New',monospace;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">Generador</span>`;
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'color:rgba(255,255,255,0.3);cursor:pointer;font-size:18px;padding:4px 8px;';
    closeBtn.addEventListener('click', closePanel);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const scroll = document.createElement('div');
    scroll.id = 'gen-scroll';
    panel.appendChild(scroll);

    rings.forEach((ring, idx) => {
      computeFree(ring);
      const sec = document.createElement('div');
      sec.className = 'gen-section';

      const rh = document.createElement('div');
      rh.className = 'ring-header';
      const rtitle = document.createElement('div');
      rtitle.className = 'gen-title';
      rtitle.style.marginBottom = '0';
      rtitle.textContent = `Anillo ${idx + 1}`;
      rh.appendChild(rtitle);
      if (rings.length > 1) {
        const del = document.createElement('button');
        del.className = 'ring-del';
        del.textContent = '✕ eliminar';
        del.addEventListener('click', () => {
          rings.splice(idx, 1);
          renderPanel();
        });
        rh.appendChild(del);
      }
      sec.appendChild(rh);

      const params = [
        { key: 'modules', label: 'Módulos', min: 1, max: 500, step: 1 },
        { key: 'arc', label: 'Arco (°)', min: 1, max: 360, step: 0.5 },
        { key: 'scale', label: 'Escala', min: 0.1, max: 20, step: 0.1 },
        { key: 'radius', label: 'Radio', min: 0.1, max: 20, step: 0.1 },
      ];

      params.forEach(({ key, label, min, max, step }) => {
        const row = document.createElement('div');
        row.className = 'gen-row';
        const lbl = document.createElement('span');
        lbl.className = 'gen-label';
        lbl.textContent = label;

        const isComputed = ring._autoKey === key;
        const control = createNumericControl({
          value: ring[key],
          min,
          max,
          step,
          readOnly: isComputed,
          onCommit: value => {
            ring[key] = value;
            computeFree(ring);
            renderPanel();
          },
        });

        const toggle = document.createElement('button');
        toggle.className = `fix-btn${ring.fixed[key] ? ' active' : ''}`;
        toggle.textContent = ring.fixed[key] ? 'fijo' : 'auto';
        toggle.addEventListener('click', () => {
          ring.fixed[key] = !ring.fixed[key];
          computeFree(ring);
          renderPanel();
        });

        row.append(lbl, toggle, control.wrap);
        sec.appendChild(row);
      });

      const radiusReal = parseFloat((BASE_RADIUS * ring.radius).toFixed(2));
      const radioInfo = document.createElement('div');
      radioInfo.style.cssText = "font-family:'Courier New',monospace;font-size:11px;color:rgba(80,180,255,0.6);text-align:right;margin:-4px 0 8px;";
      radioInfo.textContent = `radio real: ${radiusReal} u`;
      sec.appendChild(radioInfo);

      const layerRow = document.createElement('div');
      layerRow.className = 'gen-row';
      const layerLbl = document.createElement('span');
      layerLbl.className = 'gen-label';
      layerLbl.textContent = 'Capas';
      const layerControl = createNumericControl({
        value: ring.layers, min: 1, max: 200, step: 1,
        onCommit: value => { ring.layers = value; renderPanel(); },
      });
      layerRow.append(layerLbl, layerControl.wrap);
      sec.appendChild(layerRow);

      const suggested = idx === 0 ? 0 : (() => {
        const prev = rings[idx - 1];
        return parseFloat((prev.yOffset + prev.layers * V_STEP_BASE * prev.scale).toFixed(2));
      })();

      const offRow = document.createElement('div');
      offRow.className = 'gen-row';
      const offLbl = document.createElement('span');
      offLbl.className = 'gen-label';
      offLbl.textContent = 'Offset vertical';
      const offControl = createNumericControl({
        value: ring.yOffset, min: -500, max: 500, step: 0.1,
        onCommit: value => { ring.yOffset = value; },
      });
      offRow.append(offLbl, offControl.wrap);
      sec.appendChild(offRow);

      if (idx > 0) {
        const hint = document.createElement('div');
        hint.style.cssText = "font-family:'Courier New',monospace;font-size:11px;color:rgba(255,200,80,0.55);text-align:right;margin:-4px 0 4px;cursor:pointer;";
        hint.textContent = `sugerido: ${suggested} u  ↵`;
        hint.title = 'Clic para aplicar';
        hint.addEventListener('click', () => {
          ring.yOffset = suggested;
          renderPanel();
        });
        sec.appendChild(hint);
      }

      const originRow = document.createElement('div');
      originRow.className = 'gen-row';
      const originLbl = document.createElement('span');
      originLbl.className = 'gen-label';
      originLbl.textContent = 'Módulo origen';
      const originMax = maxOriginAt360(ring.modules, ring.arc);
      const originControl = createNumericControl({
        value: ring.originModule, min: 1, max: originMax, step: 1,
        onCommit: value => { ring.originModule = value; computeFree(ring); renderPanel(); },
      });
      originRow.append(originLbl, originControl.wrap);
      sec.appendChild(originRow);

      scroll.appendChild(sec);
    });

    const addRing = document.createElement('div');
    addRing.className = 'gen-add-ring';
    addRing.textContent = '+ Añadir anillo';
    addRing.addEventListener('click', () => {
      const last = rings[rings.length - 1];
      const newRing = defaultRing();
      newRing.scale = last.scale;
      newRing.radius = last.radius;
      newRing.yOffset = last.yOffset + last.layers * V_STEP_BASE * last.scale;
      newRing.originModule = Math.min(maxOriginAt360(newRing.modules, newRing.arc), last.originModule);
      rings.push(newRing);
      renderPanel();
    });
    scroll.appendChild(addRing);

    const footer = document.createElement('div');
    footer.className = 'gen-footer';
    const applyBtn = document.createElement('button');
    applyBtn.className = 'gen-action gen-apply';
    applyBtn.textContent = '✓ Aplicar';
    const expBtn = document.createElement('button');
    expBtn.className = 'gen-action gen-export';
    expBtn.textContent = '↓ GLB';

    applyBtn.addEventListener('click', async () => {
      await generateStructure().catch(e => alert(`Error: ${e.message}`));
      applyGenerated(closePanel);
    });
    expBtn.addEventListener('click', exportGenerated);

    footer.append(applyBtn, expBtn);
    panel.appendChild(footer);
  }

  function openPanel() { panel.classList.add('open'); }
  function closePanel() {
    panel.classList.remove('open');
    if (generatedGroup) {
      disposeGeneratedGroup(generatedGroup);
      generatedGroup = null;
    }
  }

  genBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = panel.classList.contains('open');
    if (isOpen) closePanel();
    else {
      openPanel();
      renderPanel();
      activateExclusive('gen');
    }
  });

  return { genBtn, panel, openPanel, closePanel };
}

let _onApply = null;
export function onGeneratorApply(fn) { _onApply = fn; }

function applyGenerated(closePanel) {
  if (!generatedGroup || generatedGroup.children.length === 0) {
    alert('Genera una vista previa primero.');
    return;
  }
  if (_onApply) _onApply(generatedGroup);
  generatedGroup = null;
  closePanel();
}

async function exportGenerated() {
  if (!generatedGroup || generatedGroup.children.length === 0) {
    alert('Genera una vista previa primero.');
    return;
  }
  alert('Export de estructura generada — próximamente.');
}
