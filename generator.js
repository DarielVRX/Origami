// ─────────────────────────────────────────────────────────────
// generator.js — Generador procedural de estructuras en anillo
// Dependencias: three, scene.js
// ─────────────────────────────────────────────────────────────

import * as THREE          from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }      from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { scene }           from './scene.js';

// ── Constantes derivadas del modelo original ──
const K            = 20 / (360 * 17);  // módulos / (arcDeg * radius)
const BASE_RADIUS  = 17;               // radio a scale=1
const OVERLAP_BASE = 1.4;             // overlap vertical a scale=1
const V_SPACING_BASE = 3.5;           // spacing vertical a scale=1
const V_STEP_BASE  = V_SPACING_BASE - OVERLAP_BASE; // 2.1u neto a scale=1

// ── Estado del generador ──
let generatedGroup = null;
let moduleBuffer   = null;
let moduleGltf     = null;

const defaultRing = () => ({
  id: Date.now(),
  fixedA: 'modules',  // dos fijos: 'modules'|'arc'|'scale'
  fixedB: 'arc',
  modules: 20,
  arc:     360,
  scale:   1.0,       // escala del módulo (radius = BASE_RADIUS * scale)
  layers:  10,
  yOffset: 0,
});

let rings = [defaultRing()];

// ── Cálculo del tercer parámetro ──
// radius = BASE_RADIUS * scale  →  K * arc * BASE_RADIUS * scale = modules
function computeFree(ring) {
  const { fixedA, fixedB, modules, arc, scale } = ring;
  const fixed = new Set([fixedA, fixedB]);

  if (!fixed.has('scale')) {
    ring.scale = parseFloat((modules / (K * arc * BASE_RADIUS)).toFixed(3));
  } else if (!fixed.has('modules')) {
    ring.modules = Math.max(1, Math.round(K * arc * BASE_RADIUS * scale));
  } else {
    ring.arc = parseFloat(Math.min(360, Math.max(1,
      modules / (K * BASE_RADIUS * scale))).toFixed(1));
  }
}

// ── Cargar módulo base desde URL ──
export async function loadModuleBuffer(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`);
  moduleBuffer = await res.arrayBuffer();
  moduleGltf   = null;   // invalidar caché
  return moduleBuffer;
}

// ── Parsear geometría del módulo desde buffer ──
async function getModuleGeometry() {
  if (moduleGltf) return moduleGltf;
  if (!moduleBuffer) throw new Error('Buffer de módulo no cargado');

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(moduleBuffer.slice(0), '', gltf => {
      const meshes = [];
      gltf.scene.traverse(child => { if (child.isMesh) meshes.push(child); });
      if (!meshes.length) { reject(new Error('Sin geometría')); return; }
      moduleGltf = meshes[0].geometry.clone();
      resolve(moduleGltf);
    }, reject);
  });
}

// ── Generar estructura en escena ──
export async function generateStructure() {
  if (generatedGroup) {
    scene.remove(generatedGroup);
    generatedGroup.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
  }
  generatedGroup = new THREE.Group();

  const geometry = await getModuleGeometry();

  for (const ring of rings) {
    computeFree(ring);
    const { modules, arc, scale, layers, yOffset } = ring;
    const radius     = BASE_RADIUS * scale;
    const angleStep  = arc / modules;
    const arcStart   = -(arc / 2);
    const vStep      = V_STEP_BASE * scale;
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8, metalness: 0 });

    for (let layer = 0; layer < layers; layer++) {
      const layerRotOffset = (layer % 2 === 1) ? angleStep / 2 : 0;
      const y = yOffset + layer * vStep;

      for (let m = 0; m < modules; m++) {
        const angleDeg = arcStart + m * angleStep + layerRotOffset;
        const angleRad = THREE.MathUtils.degToRad(angleDeg);

        const mesh = new THREE.Mesh(geometry, mat.clone());
        mesh.scale.setScalar(scale);
        mesh.rotation.y = -angleRad;
        // Posición: módulo base está a BASE_RADIUS en +X, escalar al radio deseado
        mesh.position.set(
          Math.cos(angleRad) * radius,
          y,
          Math.sin(angleRad) * radius
        );
        generatedGroup.add(mesh);
      }
    }
  }

  scene.add(generatedGroup);
  return generatedGroup;
}

// ── Construir panel UI del generador ──
export function buildGeneratorPanel() {
  // ── CSS ──
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
#gen-btn[data-tip]::after {
  content:attr(data-tip);
  position:absolute; top:calc(100% + 8px); right:0;
  background:rgba(10,10,10,0.92); color:#eee;
  font-family:'Courier New',monospace; font-size:12px;
  padding:4px 10px; border-radius:6px; white-space:nowrap;
  pointer-events:none; opacity:0; transition:opacity 0.15s;
  border:1px solid rgba(255,255,255,0.1);
}
#gen-btn:hover::after { opacity:1; }

#gen-panel {
  position:fixed; top:0; right:0; width:360px; height:100vh;
  background:rgba(18,18,18,0.97); backdrop-filter:blur(14px);
  border-left:1px solid rgba(255,255,255,0.08);
  z-index:1900; display:flex; flex-direction:column;
  transform:translateX(100%);
  transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
  overflow-y:auto;
}
#gen-panel.open { transform:translateX(0); }

.gen-section {
  padding:16px; border-bottom:1px solid rgba(255,255,255,0.06);
}
.gen-title {
  font-family:'Courier New',monospace; font-size:11px;
  letter-spacing:2px; text-transform:uppercase;
  color:rgba(255,255,255,0.3); margin-bottom:12px;
}
.gen-row {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:10px; gap:8px;
}
.gen-label {
  font-family:'Courier New',monospace; font-size:12px;
  color:rgba(255,255,255,0.55); white-space:nowrap; flex-shrink:0;
}
.gen-input {
  background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
  border-radius:6px; color:#fff; font-family:'Courier New',monospace;
  font-size:13px; padding:6px 10px; width:90px; text-align:right;
  outline:none; transition:border-color 0.2s;
}
.gen-input:focus { border-color:rgba(255,255,255,0.4); }
.gen-input.computed {
  border-color:rgba(80,180,255,0.4); color:rgba(80,200,255,0.9);
  background:rgba(80,180,255,0.06);
}
.gen-input[readonly] { cursor:default; }

.fix-toggle {
  display:flex; gap:4px;
}
.fix-btn {
  font-family:'Courier New',monospace; font-size:10px; padding:3px 7px;
  border-radius:4px; border:1px solid rgba(255,255,255,0.15);
  background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.4);
  cursor:pointer; transition:all 0.15s; letter-spacing:1px;
  text-transform:uppercase;
}
.fix-btn.active {
  background:rgba(255,160,60,0.25); border-color:rgba(255,160,60,0.6);
  color:#ffb347;
}

.ring-header {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:12px;
}
.ring-del {
  background:rgba(255,80,80,0.12); border:1px solid rgba(255,80,80,0.3);
  border-radius:6px; color:#ff6b6b; font-size:12px; padding:4px 10px;
  cursor:pointer; font-family:'Courier New',monospace; transition:background 0.15s;
}
.ring-del:hover { background:rgba(255,80,80,0.25); }

.gen-add-ring {
  margin:12px 16px; padding:12px;
  background:rgba(255,255,255,0.04); border:1px dashed rgba(255,255,255,0.15);
  border-radius:8px; color:rgba(255,255,255,0.4);
  font-family:'Courier New',monospace; font-size:13px; cursor:pointer;
  text-align:center; transition:all 0.15s; letter-spacing:1px;
}
.gen-add-ring:hover { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); }

.gen-footer {
  padding:16px; display:flex; gap:10px; margin-top:auto;
  border-top:1px solid rgba(255,255,255,0.06);
}
.gen-action {
  flex:1; padding:12px; border-radius:8px; cursor:pointer;
  font-family:'Courier New',monospace; font-size:13px; letter-spacing:1px;
  text-transform:uppercase; border:1px solid; transition:background 0.15s;
}
.gen-preview {
  background:rgba(80,180,255,0.12); border-color:rgba(80,180,255,0.4); color:#6ab0ff;
}
.gen-preview:hover { background:rgba(80,180,255,0.25); }
.gen-apply {
  background:rgba(200,120,255,0.12); border-color:rgba(200,120,255,0.4); color:#c97fff;
}
.gen-apply:hover { background:rgba(200,120,255,0.25); }
.gen-export {
  background:rgba(80,200,120,0.12); border-color:rgba(80,200,120,0.4); color:#6fdc9a;
}
.gen-export:hover { background:rgba(80,200,120,0.25); }
</style>`);

  // ── Botón superior derecho ──
  const genBtn = document.createElement('div');
  genBtn.id = 'gen-btn'; genBtn.setAttribute('data-tip', 'Generador');
  genBtn.textContent = '⚙️';
  document.body.appendChild(genBtn);

  // ── Panel ──
  const panel = document.createElement('div');
  panel.id = 'gen-panel';
  document.body.appendChild(panel);

  // ── Render del panel (se reconstruye al cambiar rings) ──
  function renderPanel() {
    panel.innerHTML = '';

    // Cabecera
    const header = document.createElement('div');
    header.style.cssText = 'padding:40px 16px 8px; display:flex; align-items:center; justify-content:space-between;';
    header.innerHTML = `<span style="font-family:'Courier New',monospace;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.5);">Generador</span>`;
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'color:rgba(255,255,255,0.3);cursor:pointer;font-size:18px;padding:4px 8px;';
    closeBtn.addEventListener('click', closePanel);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Escala global eliminada — cada anillo tiene su propia escala

    // Rings
    rings.forEach((ring, idx) => {
      const sec = document.createElement('div');
      sec.className = 'gen-section';

      // Header del anillo
      const rh = document.createElement('div'); rh.className = 'ring-header';
      const rtitle = document.createElement('div');
      rtitle.className = 'gen-title'; rtitle.style.marginBottom = '0';
      rtitle.textContent = `Anillo ${idx + 1}`;
      rh.appendChild(rtitle);
      if (rings.length > 1) {
        const del = document.createElement('button'); del.className = 'ring-del'; del.textContent = '✕ eliminar';
        del.addEventListener('click', () => { rings.splice(idx, 1); renderPanel(); });
        rh.appendChild(del);
      }
      sec.appendChild(rh);

      // Tres parámetros: modules, arc, scale
      const params = [
        { key: 'modules', label: 'Módulos',  min: 1,    max: 500,  step: 1,   },
        { key: 'arc',     label: 'Arco (°)', min: 1,    max: 360,  step: 0.5, },
        { key: 'scale',   label: 'Escala',   min: 0.01, max: 20,   step: 0.01,},
      ];

      params.forEach(({ key, label, min, max, step }) => {
        const row = document.createElement('div'); row.className = 'gen-row';
        const lbl = document.createElement('span'); lbl.className = 'gen-label'; lbl.textContent = label;

        const isComputed = ring.fixedA !== key && ring.fixedB !== key;
        const inp = makeInput(
          key === 'scale' ? parseFloat(ring.scale.toFixed(3)) : ring[key],
          min, max, step
        );
        if (isComputed) { inp.readOnly = true; inp.classList.add('computed'); }

        inp.addEventListener('change', () => {
          if (isComputed) return;
          ring[key] = parseFloat(inp.value) || ring[key];
          computeFree(ring);
          renderPanel();
        });

        const toggle = document.createElement('button');
        toggle.className = 'fix-btn' + (isComputed ? '' : ' active');
        toggle.textContent = isComputed ? 'auto' : 'fijo';
        toggle.addEventListener('click', () => {
          if (!isComputed) return;
          ring.fixedA = ring.fixedB;
          ring.fixedB = key;
          computeFree(ring);
          renderPanel();
        });

        row.append(lbl, toggle, inp);
        sec.appendChild(row);
      });

      // Radio informativo
      const radius = parseFloat((BASE_RADIUS * ring.scale).toFixed(2));
      const radioInfo = document.createElement('div');
      radioInfo.style.cssText = `font-family:'Courier New',monospace;font-size:11px;
        color:rgba(80,180,255,0.6);text-align:right;margin:-4px 0 8px;`;
      radioInfo.textContent = `radio calculado: ${radius} u`;
      sec.appendChild(radioInfo);

      // Capas
      const layerRow = document.createElement('div'); layerRow.className = 'gen-row';
      const layerLbl = document.createElement('span'); layerLbl.className = 'gen-label'; layerLbl.textContent = 'Capas';
      const layerInp = makeInput(ring.layers, 1, 200, 1);
      layerInp.addEventListener('change', () => { ring.layers = parseInt(layerInp.value) || ring.layers; renderPanel(); });
      layerRow.append(layerLbl, layerInp);
      sec.appendChild(layerRow);

      // Offset vertical con sugerencia
      const suggested = idx === 0 ? 0 :
        (() => {
          const prev = rings[idx - 1];
          return parseFloat((prev.yOffset + prev.layers * V_STEP_BASE * prev.scale).toFixed(2));
        })();

      const offRow = document.createElement('div'); offRow.className = 'gen-row';
      const offLbl = document.createElement('span'); offLbl.className = 'gen-label'; offLbl.textContent = 'Offset vertical';
      const offInp = makeInput(ring.yOffset, -500, 500, 0.1);
      offInp.addEventListener('change', () => { ring.yOffset = parseFloat(offInp.value) ?? ring.yOffset; });
      offRow.append(offLbl, offInp);
      sec.appendChild(offRow);

      if (idx > 0) {
        const hint = document.createElement('div');
        hint.style.cssText = `font-family:'Courier New',monospace;font-size:11px;
          color:rgba(255,200,80,0.55);text-align:right;margin:-4px 0 4px;cursor:pointer;`;
        hint.textContent = `sugerido: ${suggested} u  ↵`;
        hint.title = 'Clic para aplicar';
        hint.addEventListener('click', () => { ring.yOffset = suggested; offInp.value = suggested; });
        sec.appendChild(hint);
      }

      panel.appendChild(sec);
    });

    // Botón añadir anillo
    const addRing = document.createElement('div');
    addRing.className = 'gen-add-ring'; addRing.textContent = '+ Añadir anillo';
    addRing.addEventListener('click', () => {
      const last = rings[rings.length - 1];
      const newRing = defaultRing();
      newRing.scale   = last.scale;
      newRing.yOffset = last.yOffset + last.layers * V_STEP_BASE * last.scale;
      rings.push(newRing);
      renderPanel();
    });
    panel.appendChild(addRing);

    // Footer
    const footer = document.createElement('div'); footer.className = 'gen-footer';
    const prevBtn  = document.createElement('button'); prevBtn.className  = 'gen-action gen-preview'; prevBtn.textContent  = '▶ Preview';
    const applyBtn = document.createElement('button'); applyBtn.className = 'gen-action gen-apply';   applyBtn.textContent = '✓ Aplicar';
    const expBtn   = document.createElement('button'); expBtn.className   = 'gen-action gen-export';  expBtn.textContent   = '↓ GLB';
    prevBtn.addEventListener('click',  () => generateStructure().catch(e => alert('Error: ' + e.message)));
    applyBtn.addEventListener('click', () => applyGenerated(closePanel));
    expBtn.addEventListener('click',   exportGenerated);
    footer.append(prevBtn, applyBtn, expBtn);
    panel.appendChild(footer);
  }

  // ── Abrir / cerrar ──
  function openPanel()  { panel.classList.add('open'); }
  function closePanel() { panel.classList.remove('open'); if (generatedGroup) { scene.remove(generatedGroup); generatedGroup = null; } }

  genBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = panel.classList.contains('open');
    if (isOpen) closePanel();
    else { openPanel(); renderPanel(); }
  });

  // Retornar referencias para integración con ui.js
  return { genBtn, panel, openPanel, closePanel };
}

// ── Callback registrado desde main.js para "Aplicar" ──
let _onApply = null;
export function onGeneratorApply(fn) { _onApply = fn; }

// ── Aplicar: fijar estructura como modelo paintable ──
function applyGenerated(closePanel) {
  if (!generatedGroup || generatedGroup.children.length === 0) {
    alert('Genera una vista previa primero.'); return;
  }
  if (_onApply) _onApply(generatedGroup);
  generatedGroup = null;  // ya no lo gestiona el generador
  closePanel();
}

// ── Exportar estructura generada como GLB ──
async function exportGenerated() {
  if (!generatedGroup || generatedGroup.children.length === 0) {
    alert('Genera una vista previa primero.'); return;
  }
  // Serializar usando el mismo pipeline de buildPatchedGLB adaptado para instancias
  // Por ahora: descarga placeholder — se completará en siguiente iteración
  alert('Export de estructura generada — próximamente.');
}

// ── Helper: input numérico ──
function makeInput(value, min, max, step) {
  const el = document.createElement('input');
  el.type  = 'number'; el.className = 'gen-input';
  el.min   = min; el.max = max; el.step = step;
  el.value = value;
  return el;
}
