// ─────────────────────────────────────────────────────────────
// generator.js — Generador procedural de estructuras en anillo
// Dependencias: three, scene.js
// ─────────────────────────────────────────────────────────────

import * as THREE          from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }      from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { scene }           from './scene.js';

// ── Constantes derivadas del modelo original ──
const K          = 20 / (360 * 17);   // k = moduleCount / (arcDeg * radius)
const BASE_RADIUS = 17;               // radio original a scale=1, 20 módulos, 360°
const OVERLAP_BASE= 1.4;             // overlap vertical a scale=1
const V_SPACING_BASE = 3.5;          // spacing vertical centro-a-centro a scale=1
const V_STEP_BASE = V_SPACING_BASE - OVERLAP_BASE; // 2.1u paso neto a scale=1

// ── Estado del generador ──
let generatedGroup = null;   // THREE.Group con la estructura generada
let moduleBuffer   = null;   // ArrayBuffer del GLB del módulo base
let moduleGltf     = null;   // geometría + material cacheados

const defaultRing = () => ({
  id: Date.now(),
  fixedA: 'modules',  // qué dos parámetros están fijos: 'modules'|'arc'|'radius'
  fixedB: 'arc',
  modules: 20,
  arc:     360,
  radius:  17,
  layers:  10,
  yOffset: 0,
  scale:   1.0,
});

let rings = [defaultRing()];

// ── Cálculo de tercer parámetro ──
function computeFree(ring) {
  const { fixedA, fixedB, modules, arc, radius, scale } = ring;
  const fixed = new Set([fixedA, fixedB]);

  if (!fixed.has('radius')) {
    ring.radius = parseFloat((modules / (K * arc)).toFixed(2));
  } else if (!fixed.has('modules')) {
    ring.modules = Math.max(1, Math.round(K * arc * radius));
  } else {
    ring.arc = parseFloat(Math.min(360, Math.max(1, modules / (K * radius))).toFixed(1));
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
  if (generatedGroup) { scene.remove(generatedGroup); generatedGroup.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } }); }
  generatedGroup = new THREE.Group();

  const geometry = await getModuleGeometry();

  for (const ring of rings) {
    computeFree(ring);
    const { modules, arc, radius, layers, yOffset, scale } = ring;
    const angleStep   = arc / modules;           // grados entre módulos
    const arcStart    = -(arc / 2);              // centrar el arco
    const vStep       = V_STEP_BASE * scale;
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8, metalness: 0 });

    for (let layer = 0; layer < layers; layer++) {
      const layerOffset = (layer % 2 === 1) ? angleStep / 2 : 0;
      const y = yOffset + layer * vStep;

      for (let m = 0; m < modules; m++) {
        const angleDeg = arcStart + m * angleStep + layerOffset;
        const angleRad = THREE.MathUtils.degToRad(angleDeg);

        const mesh = new THREE.Mesh(geometry, mat.clone());
        mesh.scale.setScalar(scale);

        // Rotar el módulo alrededor del origen Y para posicionarlo en el anillo
        mesh.rotation.y = -angleRad;
        mesh.position.set(
          Math.cos(angleRad) * (radius / BASE_RADIUS) * radius,
          y,
          Math.sin(angleRad) * (radius / BASE_RADIUS) * radius
        );

        // Corrección: el módulo base apunta a +X, necesita apuntar al centro
        // La rotación del mesh.rotation.y ya maneja esto

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

    // Escala global
    const scaleSection = document.createElement('div');
    scaleSection.className = 'gen-section';
    scaleSection.innerHTML = `<div class="gen-title">Módulo</div>`;
    const scaleRow = document.createElement('div'); scaleRow.className = 'gen-row';
    scaleRow.innerHTML = `<span class="gen-label">Escala</span>`;
    const scaleInput = makeInput(rings[0]?.scale ?? 1, 0.1, 10, 0.1);
    scaleInput.addEventListener('change', () => {
      const v = parseFloat(scaleInput.value) || 1;
      rings.forEach(r => r.scale = v);
    });
    scaleRow.appendChild(scaleInput);
    scaleSection.appendChild(scaleRow);
    panel.appendChild(scaleSection);

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

      // Tres parámetros con selector de cuáles son fijos
      const params = [
        { key: 'modules', label: 'Módulos',  min: 1,   max: 360, step: 1,   decimals: 0 },
        { key: 'arc',     label: 'Arco (°)', min: 1,   max: 360, step: 0.5, decimals: 1 },
        { key: 'radius',  label: 'Radio',    min: 0.5, max: 500, step: 0.5, decimals: 2 },
      ];

      params.forEach(({ key, label, min, max, step, decimals }) => {
        const row = document.createElement('div'); row.className = 'gen-row';
        const lbl = document.createElement('span'); lbl.className = 'gen-label'; lbl.textContent = label;

        const inp = makeInput(ring[key], min, max, step);
        const isComputed = ring.fixedA !== key && ring.fixedB !== key;
        if (isComputed) { inp.readOnly = true; inp.classList.add('computed'); }

        inp.addEventListener('change', () => {
          if (isComputed) return;
          ring[key] = parseFloat(inp.value) || ring[key];
          computeFree(ring);
          renderPanel();
        });

        // Toggle fijo/calculado
        const toggle = document.createElement('button');
        toggle.className = 'fix-btn' + (isComputed ? '' : ' active');
        toggle.textContent = isComputed ? 'auto' : 'fijo';
        toggle.addEventListener('click', () => {
          if (!isComputed) return; // ya es fijo, no hace nada — el otro fijo se libera
          // Liberar el menos reciente de los dos fijos y fijar este
          ring.fixedA = ring.fixedB;
          ring.fixedB = key;
          computeFree(ring);
          renderPanel();
        });

        row.append(lbl, toggle, inp);
        sec.appendChild(row);
      });

      // Capas y offset vertical
      [
        { key: 'layers',  label: 'Capas',          min: 1, max: 100, step: 1,   decimals: 0 },
        { key: 'yOffset', label: 'Offset vertical', min: -500, max: 500, step: 0.5, decimals: 1 },
      ].forEach(({ key, label, min, max, step }) => {
        const row = document.createElement('div'); row.className = 'gen-row';
        const lbl = document.createElement('span'); lbl.className = 'gen-label'; lbl.textContent = label;
        const inp = makeInput(ring[key], min, max, step);
        inp.addEventListener('change', () => { ring[key] = parseFloat(inp.value) ?? ring[key]; });
        row.append(lbl, inp);
        sec.appendChild(row);
      });

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
    const prevBtn = document.createElement('button'); prevBtn.className = 'gen-action gen-preview'; prevBtn.textContent = '▶ Vista previa';
    const expBtn  = document.createElement('button'); expBtn  .className = 'gen-action gen-export';  expBtn.textContent  = '↓ Exportar GLB';
    prevBtn.addEventListener('click', () => generateStructure().catch(e => alert('Error: ' + e.message)));
    expBtn.addEventListener('click',  exportGenerated);
    footer.append(prevBtn, expBtn);
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
