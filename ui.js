// ─────────────────────────────────────────────────────────────

// ui.js — FAB group, drawer lateral, paleta, modales, toast

// Dependencias: github.js, model.js, export.js, paint.js

// ─────────────────────────────────────────────────────────────



import { checkFileExists } from './github.js';

import { loadGLBFromFile, loadGLBFromGitHub }  from './model.js';

import { doExportGLB, doExportGLBLocal, doExportImage }  from './export.js';

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';

import { camera as _cam, controls as _ctrl }   from './scene.js';

import {

  setCurrentColor, setBrushSize, setEyedropperActive,

  eyedropperActive

} from './paint.js';



// ─────────────────────────────────────────────────────────────

// ESTILOS

// ─────────────────────────────────────────────────────────────

document.head.insertAdjacentHTML('beforeend', `<style>

@keyframes fadeInUp {

  from { opacity:0; transform:translateX(-50%) translateY(10px); }

  to   { opacity:1; transform:translateX(-50%) translateY(0); }

}

@keyframes lockBounce {

  0%,100% { transform:translateY(0); }

  30%     { transform:translateY(-6px); }

  60%     { transform:translateY(2px); }

}

@keyframes lockShake {

  0%,100% { transform:rotate(0deg); }

  25%     { transform:rotate(-12deg); }

  75%     { transform:rotate(12deg); }

}

* { box-sizing:border-box; margin:0; padding:0; }

body { overflow:hidden; }



.fab {

  width:88px; height:88px; border-radius:50%;

  background:rgba(20,20,20,0.88);

  border:1px solid rgba(255,255,255,0.18);

  backdrop-filter:blur(10px);

  display:flex; align-items:center; justify-content:center;

  cursor:pointer; user-select:none;

  font-size:36px; color:#fff;

  transition:background 0.2s, transform 0.2s;

}

.fab:hover  { background:rgba(50,50,50,0.95); transform:scale(1.07); }

.fab:active { transform:scale(0.95); }



#fab-group {

  position:fixed; bottom:24px; right:24px; z-index:2000;

  display:flex; flex-direction:column; align-items:center; gap:14px;

}

#fab-main {

  font-size:48px; font-weight:300; line-height:1;

  transition:transform 0.3s cubic-bezier(0.4,0,0.2,1), background 0.2s;

}

#fab-main.open { transform:rotate(45deg) scale(1.07); }



#fab-children {

  display:flex; flex-direction:column; align-items:center; gap:14px;

  overflow:hidden; max-height:0; opacity:0;

  transition:max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease;

}

#fab-children.open { max-height:400px; opacity:1; }



.fab[data-tip] { position:relative; }

.fab[data-tip]::after {

  content:attr(data-tip);

  position:absolute; right:calc(100% + 12px); top:50%;

  transform:translateY(-50%);

  background:rgba(10,10,10,0.92); color:#eee;

  font-family:'Courier New',monospace; font-size:13px;

  padding:6px 12px; border-radius:6px; white-space:nowrap;

  pointer-events:none; opacity:0; transition:opacity 0.15s;

  border:1px solid rgba(255,255,255,0.1);

}

.fab[data-tip]:hover::after { opacity:1; }



#fab-lock.locked   { background:rgba(255,80,80,0.2); border-color:rgba(255,80,80,0.5); color:#ff6b6b; }

#fab-lock .lock-icon { display:inline-block; }

#fab-lock.locked   .lock-icon { animation:lockShake  0.4s ease; }

#fab-lock.unlocked .lock-icon { animation:lockBounce 0.4s ease; }



#side-menu {

  position:fixed; top:0; left:0; width:360px; height:100vh;

  background:rgba(18,18,18,0.97); backdrop-filter:blur(14px);

  z-index:1900; display:flex; flex-direction:column;

  padding:40px 16px 24px; gap:10px;

  transform:translateX(-100%);

  transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);

  border-right:1px solid rgba(255,255,255,0.08);

  overflow-y:auto;

}

#side-menu.open { transform:translateX(0); }



.menu-label {

  font-family:'Courier New',monospace; font-size:11px;

  letter-spacing:2px; text-transform:uppercase;

  color:rgba(255,255,255,0.3); margin:10px 0 2px; padding-left:4px;

}

.menu-btn {

  width:100%; padding:16px 18px;

  background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);

  border-radius:8px; color:#e8e8e8;

  font-family:'Courier New',monospace; font-size:14px;

  cursor:pointer; text-align:left;

  transition:background 0.15s, border-color 0.15s;

  display:flex; align-items:center; gap:12px;

}

.menu-btn:hover  { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.22); }

.menu-btn.active { background:rgba(255,80,80,0.18); border-color:rgba(255,80,80,0.45); color:#ff6b6b; }

#load-glb-input { display:none; }

label.menu-btn  { user-select:none; }



#brush-panel {

  position:fixed; bottom:130px; right:130px; z-index:1800;

  background:rgba(18,18,18,0.94); border:1px solid rgba(255,255,255,0.12);

  border-radius:12px; padding:18px 22px;

  display:none; flex-direction:column; gap:12px;

  backdrop-filter:blur(10px); min-width:280px;

}

#brush-panel.visible { display:flex; }

#brush-panel label {

  font-family:'Courier New',monospace; font-size:12px;

  letter-spacing:1px; color:rgba(255,255,255,0.45); text-transform:uppercase;

}

#brush-panel input[type=range] { width:100%; accent-color:#ff4444; cursor:pointer; }

#brush-size-display {

  font-family:'Courier New',monospace; font-size:14px;

  color:rgba(255,255,255,0.5); text-align:right;

}



#brush-circle {

  position:fixed; border:2px solid rgba(255,60,60,0.85); border-radius:50%;

  pointer-events:none; opacity:0; transition:opacity 0.2s;

}



#palette-popup {

  position:fixed; bottom:130px; right:24px; z-index:1800;

  display:none; flex-direction:column; align-items:flex-end; gap:0;

}

#palette-popup.visible { display:flex; }



/* El preview de color ahora ES el FAB de paleta — ver JS */

#current-color-preview { display:none; }



#palette-div {

  background:rgba(18,18,18,0.97);

  border:1px solid rgba(255,255,255,0.1); border-radius:12px;

  padding:12px; grid-template-columns:repeat(6,1fr); gap:7px;

  max-height:55vh; overflow-y:auto; backdrop-filter:blur(12px);

  display:none;

}

#palette-div.visible { display:grid; }



#eyedropper-btn {

  grid-column:span 6; padding:9px;

  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.13);

  border-radius:6px; color:#ccc;

  font-family:'Courier New',monospace; font-size:13px; cursor:pointer;

  display:flex; align-items:center; justify-content:center;

  gap:6px; letter-spacing:1px; text-transform:uppercase;

  transition:background 0.15s, border-color 0.15s, color 0.15s;

}

#eyedropper-btn:hover  { background:rgba(255,220,80,0.15); border-color:rgba(255,220,80,0.4); color:#ffd84f; }

#eyedropper-btn.active { background:rgba(255,220,80,0.25); border-color:#ffd84f; color:#ffd84f; }



.color-swatch {

  width:40px; height:40px; border-radius:6px; cursor:pointer;

  border:1px solid rgba(255,255,255,0.04);

  transition:transform 0.1s, outline 0.1s;

}

.color-swatch:hover { transform:scale(1.18); outline:2px solid #ffd84f; }



body.eyedropper-cursor * { cursor:crosshair !important; }



.toast {

  position:fixed; bottom:160px; left:50%; transform:translateX(-50%);

  background:rgba(20,20,20,0.95); color:#fff; padding:12px 20px;

  border-radius:8px; font-family:'Courier New',monospace; font-size:13px;

  z-index:9999; border:1px solid rgba(255,255,255,0.15);

  backdrop-filter:blur(8px); max-width:90vw; text-align:center;

  animation:fadeInUp 0.2s ease; pointer-events:none;

}

</style>`);



// ─────────────────────────────────────────────────────────────

// TOAST

// ─────────────────────────────────────────────────────────────

export function showToast(msg, duration = 3000) {

  const t = document.createElement('div');

  t.className  = 'toast';

  t.textContent = msg;

  document.body.appendChild(t);

  setTimeout(() => t.remove(), duration);

}



// ─────────────────────────────────────────────────────────────

// HELPERS DE MODALES

// ─────────────────────────────────────────────────────────────

function makeDialogBtn(text, bg, color, hoverBg) {

  const btn = document.createElement('button');

  btn.textContent = text;

  btn.style.cssText = `

    flex:1; padding:10px; background:${bg};

    border:1px solid ${color}44; border-radius:6px;

    color:${color}; cursor:pointer;

    font-family:'Courier New',monospace; font-size:13px;

    transition:background 0.15s;

  `;

  btn.addEventListener('mouseenter', () => btn.style.background = hoverBg);

  btn.addEventListener('mouseleave', () => btn.style.background = bg);

  return btn;

}



function makeOverlay() {

  const el = document.createElement('div');

  el.style.cssText = `

    position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:9000;

    display:flex; align-items:center; justify-content:center;

    backdrop-filter:blur(4px);

  `;

  return el;

}



function makeBox() {

  const el = document.createElement('div');

  el.style.cssText = `

    background:#1a1a1a; border:1px solid rgba(255,255,255,0.15);

    border-radius:12px; padding:28px 24px; min-width:300px;

    font-family:'Courier New',monospace; color:#eee;

    display:flex; flex-direction:column; gap:14px;

  `;

  return el;

}



function makeInput(placeholder = '', value = '') {

  const el = document.createElement('input');

  el.type        = 'text';

  el.placeholder = placeholder;

  el.value       = value;

  el.style.cssText = `

    background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.2);

    border-radius:6px; padding:10px 12px; color:#fff; font-size:15px;

    font-family:'Courier New',monospace; outline:none; width:100%;

    transition:border-color 0.2s;

  `;

  el.addEventListener('focus', () => el.select());

  return el;

}



// ─────────────────────────────────────────────────────────────

// MODAL — Nombre de archivo (export)

// ─────────────────────────────────────────────────────────────

export function askFilename(defaultName, onConfirm) {

  const overlay = makeOverlay();

  const box     = makeBox();



  const title = document.createElement('div');

  title.textContent = 'Nombre del archivo';

  title.style.cssText = 'font-size:13px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.45);';



  const input   = makeInput('', defaultName);

  const warning = document.createElement('div');

  warning.style.cssText = `

    display:none; padding:9px 12px; border-radius:6px;

    background:rgba(255,160,0,0.12); border:1px solid rgba(255,160,0,0.35);

    color:#ffb347; font-size:12px; line-height:1.5;

  `;

  warning.innerHTML = '⚠️ <strong>Este archivo ya existe en GitHub.</strong><br>Si continúas, será sobreescrito. El historial de Git conserva la versión anterior.';



  const row     = document.createElement('div');

  row.style.cssText = 'display:flex; gap:10px;';

  const cancel  = makeDialogBtn('Cancelar',    'rgba(255,255,255,0.06)', '#aaa',     'rgba(255,255,255,0.12)');

  const confirm = makeDialogBtn('Guardar',     'rgba(80,200,120,0.18)', '#6fdc9a', 'rgba(80,200,120,0.35)');



  let checkTimeout;

  const checkExists = () => {

    clearTimeout(checkTimeout);

    const name = input.value.trim();

    if (!name) { warning.style.display = 'none'; return; }

    checkTimeout = setTimeout(async () => {

      const exists = await checkFileExists(name).catch(() => false);

      warning.style.display    = exists ? 'block' : 'none';

      input.style.borderColor  = exists ? 'rgba(255,160,0,0.5)' : 'rgba(255,255,255,0.2)';

      confirm.textContent      = exists ? 'Sobreescribir' : 'Guardar';

    }, 400);

  };

  input.addEventListener('input', checkExists);



  const close = () => overlay.remove();

  cancel.addEventListener('click', close);

  confirm.addEventListener('click', () => { close(); onConfirm(input.value.trim() || defaultName); });

  input.addEventListener('keydown', e => {

    if (e.key === 'Enter')  confirm.click();

    if (e.key === 'Escape') cancel.click();

  });



  row.append(cancel, confirm);

  box.append(title, input, warning, row);

  overlay.appendChild(box);

  document.body.appendChild(overlay);

  setTimeout(() => { input.focus(); checkExists(); }, 50);

}



// ─────────────────────────────────────────────────────────────

// MODAL — Cargar desde GitHub

// ─────────────────────────────────────────────────────────────

function askGitHubFile() {

  const overlay = makeOverlay();

  const box     = makeBox();



  const title = document.createElement('div');

  title.textContent = 'Cargar desde GitHub';

  title.style.cssText = 'font-size:20px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.45);';



  const input  = makeInput('nombre del archivo (sin .glb)');

  const status = document.createElement('div');

  status.style.cssText = 'font-size:12px; min-height:18px; font-family:"Courier New",monospace; color:rgba(255,255,255,0.4);';



  const row    = document.createElement('div');

  row.style.cssText = 'display:flex; gap:10px;';

  const cancel = makeDialogBtn('Cancelar', 'rgba(255,255,255,0.06)', '#aaa',    'rgba(255,255,255,0.12)');

  const load   = makeDialogBtn('Cargar',   'rgba(60,140,255,0.18)', '#6ab0ff', 'rgba(60,140,255,0.35)');

  load.disabled     = true;

  load.style.opacity = '0.4';



  let checkTimeout;

  const checkExists = () => {

    clearTimeout(checkTimeout);

    const name = input.value.trim();

    if (!name) {

      status.textContent = '';

      load.disabled = true; load.style.opacity = '0.4';

      input.style.borderColor = 'rgba(255,255,255,0.2)';

      return;

    }

    status.textContent = 'Verificando…';

    checkTimeout = setTimeout(async () => {

      const exists = await checkFileExists(name).catch(() => false);

      if (exists) {

        status.style.color   = '#6fdc9a';

        status.textContent   = '✓ Archivo encontrado';

        input.style.borderColor = 'rgba(80,200,120,0.5)';

        load.disabled = false; load.style.opacity = '1';

      } else {

        status.style.color   = '#ff7070';

        status.textContent   = '✗ Archivo no encontrado en el repo';

        input.style.borderColor = 'rgba(255,80,80,0.4)';

        load.disabled = true; load.style.opacity = '0.4';

      }

    }, 400);

  };

  input.addEventListener('input', checkExists);



  const close = () => overlay.remove();

  cancel.addEventListener('click', close);

  load.addEventListener('click', () => {

    const name = input.value.trim();

    if (!name) return;

    close();

    loadGLBFromGitHub(name)

      .then(() => showToast(`✅ Cargado desde GitHub: ${name}.glb`))

      .catch(e  => showToast(`⚠️ Error: ${e.message}`, 5000));

  });

  input.addEventListener('keydown', e => {

    if (e.key === 'Enter' && !load.disabled) load.click();

    if (e.key === 'Escape') cancel.click();

  });



  row.append(cancel, load);

  box.append(title, input, status, row);

  overlay.appendChild(box);

  document.body.appendChild(overlay);

  setTimeout(() => input.focus(), 50);

}



// ─────────────────────────────────────────────────────────────

// ── TEMPORAL: extraer mesh[482] como GLB independiente ── ELIMINAR DESPUÉS

async function extractBaseModule() {

  const { originalGLBBuffer } = await import('./model.js');

  if (!originalGLBBuffer) { showToast('⚠️ Buffer no disponible'); return; }



  const buf  = originalGLBBuffer.slice(0);

  const view = new DataView(buf);

  const jLen = view.getUint32(12, true);

  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jLen)));

  const binBase = 20 + jLen + 8;



  const MIDX = 482;

  const prim = gltf.meshes[MIDX].primitives[0];

  const usedAcc = [...Object.values(prim.attributes), ...(prim.indices != null ? [prim.indices] : [])];

  const usedBV  = [...new Set(usedAcc.map(ai => gltf.accessors[ai].bufferView))];



  const newBin = []; let binOff = 0;

  const bvOffMap = {};

  for (const bvi of usedBV.sort((a,b)=>a-b)) {

    const bv = gltf.bufferViews[bvi];

    const chunk = new Uint8Array(buf, binBase + (bv.byteOffset||0), bv.byteLength);

    bvOffMap[bvi] = binOff;

    newBin.push(chunk);

    binOff += bv.byteLength + ((4 - bv.byteLength % 4) % 4);

  }



  const bvRemap = {}; const newBVList = [];

  usedBV.sort((a,b)=>a-b).forEach((old,ni) => {

    bvRemap[old] = ni;

    const bv = gltf.bufferViews[old];

    newBVList.push({ buffer:0, byteOffset:bvOffMap[old], byteLength:bv.byteLength, ...(bv.byteStride?{byteStride:bv.byteStride}:{}) });

  });



  const accRemap = {}; const newAccList = [];

  usedAcc.forEach((oldAi, ni) => {

    accRemap[oldAi] = ni;

    const a = gltf.accessors[oldAi];

    newAccList.push({ bufferView:bvRemap[a.bufferView], componentType:a.componentType, count:a.count, type:a.type,

      ...(a.byteOffset>0?{byteOffset:a.byteOffset}:{}), ...(a.min?{min:a.min}:{}), ...(a.max?{max:a.max}:{}) });

  });



  const newPrim = { attributes: Object.fromEntries(Object.entries(prim.attributes).map(([k,v])=>[k,accRemap[v]])),

    ...(prim.indices!=null?{indices:accRemap[prim.indices]}:{}), material:0 };



  const newGltf = { asset:{version:'2.0'}, scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0,name:'ModuloBase'}],

    meshes:[{name:'ModuloBase',primitives:[newPrim]}], accessors:newAccList, bufferViews:newBVList,

    buffers:[{byteLength:binOff}],

    materials:[{pbrMetallicRoughness:{baseColorFactor:[0.667,0.667,0.667,1.0],metallicFactor:0,roughnessFactor:0.8},doubleSided:true}] };



  const jBytes = new TextEncoder().encode(JSON.stringify(newGltf));

  const jPad = Math.ceil(jBytes.length/4)*4;

  const bPad = Math.ceil(binOff/4)*4;

  const total = 12 + 8 + jPad + 8 + bPad;

  const out = new ArrayBuffer(total); const ov = new DataView(out); const ob = new Uint8Array(out);

  let o = 0;

  ov.setUint32(o,0x46546C67,true);o+=4; ov.setUint32(o,2,true);o+=4; ov.setUint32(o,total,true);o+=4;

  ov.setUint32(o,jPad,true);o+=4; ov.setUint32(o,0x4E4F534A,true);o+=4;

  ob.set(jBytes,o); ob.fill(0x20,o+jBytes.length,o+jPad); o+=jPad;

  ov.setUint32(o,bPad,true);o+=4; ov.setUint32(o,0x004E4942,true);o+=4;

  let bOff=o; for(const chunk of newBin){ ob.set(chunk,bOff); bOff+=chunk.byteLength+((4-chunk.byteLength%4)%4); }



  const a = document.createElement('a');

  a.href = URL.createObjectURL(new Blob([out],{type:'model/gltf-binary'}));

  a.download = 'ModuloBase.glb'; a.click();

  showToast('✅ ModuloBase.glb descargado');

}

// ── FIN TEMPORAL ──





// ─────────────────────────────────────────────────────────────

export function setBottomButtonsVisible(visible) {

  const v = visible ? 'visible' : 'hidden';

  const fg = document.getElementById('fab-group');

  const gb = document.getElementById('gen-btn');

  const gr = document.getElementById('grid-btn');
  ['orbit','pan','zoom','stack-toggle'].forEach(id => {
    const p = document.getElementById(`cam-pad-${id}`);

    if (p) p.style.visibility = v;

  });

  if (fg) fg.style.visibility = v;

  if (gb) gb.style.visibility = v;

  if (gr) gr.style.visibility = v;

}



// name: 'fab' | 'gen' | null(restore)

export function activateExclusive(name) {

  const fg = document.getElementById('fab-group');

  const gb = document.getElementById('gen-btn');

  const gr = document.getElementById('grid-btn');
  ['orbit','pan','zoom','stack-toggle'].forEach(id => {
    const p = document.getElementById(`cam-pad-${id}`);

    if (p) p.style.visibility = (name === null ? 'visible' : 'hidden');

  });

  if (fg) fg.style.visibility = (name === 'fab' || name === null) ? 'visible' : 'hidden';

  if (gb) gb.style.visibility = (name === 'gen' || name === null) ? 'visible' : 'hidden';

  if (gr) gr.style.visibility = (name === null ? 'visible' : 'hidden');

}



// ─────────────────────────────────────────────────────────────

export function closeAll() {

  document.getElementById('side-menu')?.classList.remove('open');

  document.getElementById('brush-panel')?.classList.remove('visible');

  document.getElementById('palette-popup')?.classList.remove('visible');

  document.getElementById('palette-div')?.classList.remove('visible');

  document.getElementById('fab-main')?.classList.remove('open');

  document.getElementById('fab-children')?.classList.remove('open');
  const inPreview = document.body.classList.contains('gen-preview-active');
  if (inPreview) {
    ['orbit','pan','zoom','stack-toggle'].forEach(id => {
      const p = document.getElementById(`cam-pad-${id}`);
      if (p) p.style.visibility = 'visible';
    });
    const fg = document.getElementById('fab-group');
    const gr = document.getElementById('grid-btn');
    const gb = document.getElementById('gen-btn');
    if (fg) fg.style.visibility = 'hidden';
    if (gr) gr.style.visibility = 'hidden';
    if (gb) gb.style.visibility = 'visible';
  } else {
    // Restaurar todos los botones
    activateExclusive(null);
  }
  if (typeof _resetFabOpen === 'function') _resetFabOpen();

  _closeAllHooks.forEach(fn => fn());

}

let _resetFabOpen = null;

const _closeAllHooks = [];

export function registerFabReset(fn) { _resetFabOpen = fn; }

export function onCloseAll(fn) { _closeAllHooks.push(fn); }



// ─────────────────────────────────────────────────────────────

// buildUI — construye toda la UI (llamar desde main.js)

// Retorna { brushCircle, currentColorBtn } para usarlos en otros módulos

// ─────────────────────────────────────────────────────────────

export function buildUI({} = {}) {

  // ── Drawer lateral ──

  const sideMenu = document.createElement('div');

  sideMenu.id = 'side-menu';

  document.body.appendChild(sideMenu);



  const addLabel = text => {

    const el = document.createElement('div');

    el.className = 'menu-label'; el.textContent = text;

    sideMenu.appendChild(el);

  };

  const addMenuBtn = (icon, label, cb) => {

    const btn = document.createElement('button');

    btn.className = 'menu-btn';

    btn.innerHTML = `<span>${icon}</span>${label}`;

    btn.addEventListener('click', () => cb(btn));

    sideMenu.appendChild(btn);

    return btn;

  };



  addLabel('GitHub');

  addMenuBtn('☁️', 'Cargar desde GitHub',  () => { closeAll(); askGitHubFile(); });



  addLabel('Archivo');

  const loadInput = document.createElement('input');

  loadInput.type = 'file'; loadInput.accept = '.glb'; loadInput.id = 'load-glb-input';

  sideMenu.appendChild(loadInput);

  const loadLabel = document.createElement('label');

  loadLabel.htmlFor = 'load-glb-input'; loadLabel.className = 'menu-btn';

  loadLabel.innerHTML = '<span>📂</span>Cargar archivo local';

  sideMenu.appendChild(loadLabel);

  loadInput.addEventListener('change', e => {

    if (e.target.files.length) loadGLBFromFile(e.target.files[0]);

    closeAll();

  });



  addLabel('Exportar');

  addMenuBtn('🖼️', 'Exportar Imagen 2×2',   () => { closeAll(); askFilename('collage_2x2', doExportImage); });

  addMenuBtn('💾', 'Exportar GLB local',     () => { closeAll(); askFilename('ModeloGLB', name => doExportGLBLocal(name)); });

  addMenuBtn('📦', 'Exportar GLB → GitHub', () => { closeAll(); askFilename('ModeloGLB', name => doExportGLB(name)); });



  // ── FAB group ──

  const fabGroup = document.createElement('div');

  fabGroup.id = 'fab-group';

  document.body.appendChild(fabGroup);



  // Hijos expandibles

  const fabChildren = document.createElement('div');

  fabChildren.id = 'fab-children';

  fabGroup.appendChild(fabChildren);



  const makeFabChild = (icon, tip) => {

    const btn = document.createElement('div');

    btn.className = 'fab';

    btn.setAttribute('data-tip', tip);

    btn.textContent = icon;

    fabChildren.appendChild(btn);

    return btn;

  };

  const fabMenu    = makeFabChild('☰',  'Menú');

  const fabBrush   = makeFabChild('✏️', 'Tamaño de pincel');

  const fabPalette = makeFabChild('', 'Paleta de colores');

  fabPalette.style.cssText += '; background:#ff0000; border:3px solid rgba(255,255,255,0.4);';



  // Botón + principal

  const fabMain = document.createElement('div');

  fabMain.id = 'fab-main'; fabMain.className = 'fab';

  fabMain.textContent = '+';

  fabGroup.appendChild(fabMain);



  let fabOpen = false;

  registerFabReset(() => { fabOpen = false; });

  const toggleFab = () => {

    fabOpen = !fabOpen;

    fabMain.classList.toggle('open', fabOpen);

    fabChildren.classList.toggle('open', fabOpen);

    // 2.2 — al abrir +, ocultar joystick pads y gen-btn

    if (fabOpen) activateExclusive('fab');

    else         activateExclusive(null);

  };
  fabMain.addEventListener('click', e => {
    e.stopPropagation();
    if (fabOpen) closeAll();
    else { closeAll(); toggleFab(); }
  });

  // ── Panel pincel ──

  const brushPanel = document.createElement('div');

  brushPanel.id = 'brush-panel';

  document.body.appendChild(brushPanel);



  const brushLabelEl = document.createElement('label'); brushLabelEl.textContent = 'Tamaño de pincel';

  const brushSlider  = document.createElement('input');

  brushSlider.type = 'range'; brushSlider.min = '1'; brushSlider.max = '10'; brushSlider.value = '1';

  const brushSizeDisplay = document.createElement('div');

  brushSizeDisplay.id = 'brush-size-display'; brushSizeDisplay.textContent = 'Tamaño: 1';

  brushPanel.append(brushLabelEl, brushSlider, brushSizeDisplay);



  brushSlider.addEventListener('input', () => {

    const s = parseFloat(brushSlider.value);

    setBrushSize(s);

    brushSizeDisplay.textContent = `Tamaño: ${s}`;

  });

  brushSlider.addEventListener('change', () => {

    brushPanel.classList.remove('visible');

    closeAll();

  });
  brushSlider.addEventListener('change', () => {
    brushPanel.classList.remove('visible');
    closeAll();
  });

  const brushCircle = document.createElement('div');

  brushCircle.id = 'brush-circle';

  document.body.appendChild(brushCircle);



  // ── Paleta ──

  const palettePopup = document.createElement('div');

  palettePopup.id = 'palette-popup';

  document.body.appendChild(palettePopup);



  const currentColorPreview = document.createElement('div');

  currentColorPreview.id = 'current-color-preview';

  currentColorPreview.style.background = '#ff0000';

  palettePopup.appendChild(currentColorPreview);



  const paletteDiv = document.createElement('div');

  paletteDiv.id = 'palette-div';

  palettePopup.appendChild(paletteDiv);



  currentColorPreview.addEventListener('click', e => {

    e.stopPropagation();

    paletteDiv.classList.toggle('visible');

  });



  const eyedropperBtn = document.createElement('button');

  eyedropperBtn.id = 'eyedropper-btn'; eyedropperBtn.innerHTML = '💉 Gotero';

  paletteDiv.appendChild(eyedropperBtn);



  eyedropperBtn.addEventListener('click', () => {

    const next = !eyedropperActive;

    setEyedropperActive(next);

    eyedropperBtn.classList.toggle('active', next);

    document.body.classList.toggle('eyedropper-cursor', next);

    if (next) paletteDiv.classList.remove('visible');

  });



  // Función helper para generar colores HSL

  const hslToHex = (h, s, l) => {

    s /= 100; l /= 100;

    const k = n => (n + h / 30) % 12;

    const a = s * Math.min(l, 1 - l);

    const f = n => Math.round(255 * (l - a * Math.max(Math.min(k(n)-3, 9-k(n), 1), -1))).toString(16).padStart(2, '0');

    return `#${f(0)}${f(8)}${f(4)}`;

  };



  ['#000000', '#888888', '#ffffff',

    ...Array.from({ length: 97 }, (_, i) => hslToHex((i / 97) * 360, 80, 50))

  ].forEach(color => {

    const sw = document.createElement('div');

    sw.className = 'color-swatch'; sw.style.background = color; sw.title = color;

    sw.addEventListener('click', () => {

      setCurrentColor(color);

      currentColorPreview.style.background = color;

      fabPalette.style.background = color;

      closeAll();

    });

    paletteDiv.appendChild(sw);

  });



  // ── Acciones hijos FAB ──

  fabMenu.addEventListener('click', e => {

    e.stopPropagation();

    const isOpen = sideMenu.classList.contains('open');

    closeAll();

    if (!isOpen) {

      sideMenu.classList.add('open');

      // 9 — ocultar todo menos el contenido activo

      activateExclusive(null); // restaurar primero, luego ocultar
      ['orbit','pan','zoom','stack-toggle'].forEach(id => { const p = document.getElementById(`cam-pad-${id}`); if(p) p.style.visibility='hidden'; });
      document.getElementById('fab-group').style.visibility = 'hidden';

      document.getElementById('gen-btn')  && (document.getElementById('gen-btn').style.visibility='hidden');

      document.getElementById('grid-btn') && (document.getElementById('grid-btn').style.visibility='hidden');

      fabOpen = true;

    }

  });



  fabBrush.addEventListener('click', e => {

    e.stopPropagation();

    const isOpen = brushPanel.classList.contains('visible');

    closeAll();

    if (!isOpen) {

      brushPanel.classList.add('visible');

      // 9
      ['orbit','pan','zoom','stack-toggle'].forEach(id => { const p = document.getElementById(`cam-pad-${id}`); if(p) p.style.visibility='hidden'; });
      document.getElementById('fab-group').style.visibility = 'hidden';

      document.getElementById('gen-btn')  && (document.getElementById('gen-btn').style.visibility='hidden');

      document.getElementById('grid-btn') && (document.getElementById('grid-btn').style.visibility='hidden');

      fabOpen = true;

    }

  });



  fabPalette.addEventListener('click', e => {

    e.stopPropagation();

    const isOpen = paletteDiv.classList.contains('visible');

    closeAll();

    if (!isOpen) {

      palettePopup.classList.add('visible');

      paletteDiv.classList.add('visible');

      // 9
      ['orbit','pan','zoom','stack-toggle'].forEach(id => { const p = document.getElementById(`cam-pad-${id}`); if(p) p.style.visibility='hidden'; });
      document.getElementById('fab-group').style.visibility = 'hidden';

      document.getElementById('gen-btn')  && (document.getElementById('gen-btn').style.visibility='hidden');

      document.getElementById('grid-btn') && (document.getElementById('grid-btn').style.visibility='hidden');

      fabOpen = true;

    }

  });

  // ── Controles de cámara: orbitar fijo + panel desplegable pan/zoom ──
  const padEls = {};

  const createPad = ({ id, icon, tip, pos, fontSize = '26px' }) => {
    const pad = document.createElement('div');

    pad.className = 'cam-pad'; pad.id = `cam-pad-${id}`;

    pad.setAttribute('data-tip', tip);

    pad.style.cssText = `position:fixed;${pos}z-index:2000;`;
    const iconEl = document.createElement('span');
    iconEl.style.fontSize = fontSize;
    iconEl.style.fontStyle = 'normal';
    iconEl.textContent = icon;
    pad.appendChild(iconEl);
    document.body.appendChild(pad);

    padEls[id] = pad;
    return pad;
  };

  createPad({ id: 'orbit', icon: '↻', tip: 'Orbitar', pos: 'left:24px;bottom:24px;', fontSize: '34px' });
  createPad({ id: 'pan', icon: '✥', tip: 'Pan', pos: 'left:24px;bottom:112px;' });
  createPad({ id: 'zoom', icon: '🔍', tip: 'Zoom', pos: 'left:24px;bottom:112px;' });

  const camStackBtn = document.createElement('div');
  camStackBtn.className = 'cam-pad cam-stack-toggle';
  camStackBtn.id = 'cam-pad-stack-toggle';
  camStackBtn.setAttribute('data-tip', 'Pan + Zoom');
  camStackBtn.style.cssText = 'position:fixed;left:24px;bottom:112px;z-index:2000;';
  camStackBtn.innerHTML = '<span style="font-size:20px;">▲</span>';
  document.body.appendChild(camStackBtn);

  let camStackOpen = false;
  const applyCamStack = () => {
    const pan = padEls.pan;
    const zoom = padEls.zoom;
    if (!pan || !zoom) return;
    pan.classList.toggle('open', camStackOpen);
    zoom.classList.toggle('open', camStackOpen);
    camStackBtn.classList.toggle('open', camStackOpen);
    camStackBtn.querySelector('span').textContent = camStackOpen ? '▼' : '▲';
  };
  applyCamStack();
  camStackBtn.addEventListener('click', e => {
    e.stopPropagation();
    camStackOpen = !camStackOpen;
    applyCamStack();
  });

  ['orbit', 'pan', 'zoom'].forEach(id => {
    const pad = padEls[id];
    let active = false, lastX = 0, lastY = 0;



    const startInteraction = (x, y) => {

      if (active) return;

      active = true; lastX = x; lastY = y;
      const fg = document.getElementById('fab-group');

      const gb = document.getElementById('gen-btn');

      const gr = document.getElementById('grid-btn');

      if (fg) fg.style.visibility = 'hidden';

      if (gb) gb.style.visibility = 'hidden';

      if (gr) gr.style.visibility = 'hidden';

    };

    const endInteraction = () => {

      if (!active) return;

      active = false;
      const inPreview = document.body.classList.contains('gen-preview-active');
      const fg = document.getElementById('fab-group');

      const gb = document.getElementById('gen-btn');

      const gr = document.getElementById('grid-btn');
      if (inPreview) {
        if (fg) fg.style.visibility = 'hidden';
        if (gr) gr.style.visibility = 'hidden';
        return;
      }
      if (fg) fg.style.visibility = 'visible';

      if (gb) gb.style.visibility = 'visible';

      if (gr) gr.style.visibility = 'visible';

    };



    const move = (x, y) => {

      if (!active) return;

      const dx = x - lastX, dy = y - lastY;

      lastX = x; lastY = y;

      if (id === 'orbit') {

        const sph = new THREE.Spherical();

        const tgt = _ctrl.target.clone();

        const off = _cam.position.clone().sub(tgt);

        sph.setFromVector3(off);

        sph.theta -= dx * 0.03;

        sph.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi + dy * 0.03));

        off.setFromSpherical(sph);

        _cam.position.copy(tgt).add(off);

        _cam.lookAt(tgt);

      } else if (id === 'pan') {

        const fwd   = _cam.getWorldDirection(new THREE.Vector3());

        const right = new THREE.Vector3().crossVectors(fwd, _cam.up).normalize();

        const up    = new THREE.Vector3().crossVectors(right, fwd).normalize();

        const spd   = 0.08;

        _cam.position.addScaledVector(right, -dx * spd);

        _cam.position.addScaledVector(up,     dy * spd);

        _ctrl.target.addScaledVector(right,  -dx * spd);

        _ctrl.target.addScaledVector(up,      dy * spd);

      } else {

        const dir = _cam.position.clone().sub(_ctrl.target).normalize();

        const dist = _cam.position.distanceTo(_ctrl.target);
        const nd  = Math.max(1, dist + dy * 0.5);

        _cam.position.copy(_ctrl.target).addScaledVector(dir, nd);

      }

      _ctrl.update();

    };



    pad.addEventListener('mousedown',  e => { e.stopPropagation(); startInteraction(e.clientX, e.clientY); });

    window.addEventListener('mousemove', e => move(e.clientX, e.clientY));

    window.addEventListener('mouseup',   endInteraction);

    pad.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); const t = e.touches[0]; startInteraction(t.clientX, t.clientY); }, { passive: false });

    window.addEventListener('touchmove', e => { if (active) { e.preventDefault(); const t = e.touches[0]; move(t.clientX, t.clientY); } }, { passive: false });

    window.addEventListener('touchend', endInteraction);

  });



  // CSS joystick pads independientes

  document.head.insertAdjacentHTML('beforeend', `<style>

/* fab-cam removed — pads are standalone */

.cam-pad {

  width:80px; height:80px; border-radius:50%;

  background:rgba(20,20,20,0.88); border:1px solid rgba(255,255,255,0.18);

  backdrop-filter:blur(10px); display:flex; flex-direction:column;

  align-items:center; justify-content:center;

  cursor:pointer; user-select:none; touch-action:none;

  font-size:26px; color:#fff; position:fixed;

  transition:background 0.15s;

}

.cam-pad:hover  { background:rgba(60,60,60,0.95); }

.cam-pad:active { background:rgba(80,80,200,0.4); border-color:rgba(120,120,255,0.6); }

.cam-pad[data-tip]::after {

  content:attr(data-tip);

  position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);

  background:rgba(10,10,10,0.92); color:#eee;

  font-family:'Courier New',monospace; font-size:12px;

  padding:4px 10px; border-radius:6px; white-space:nowrap;

  pointer-events:none; opacity:0; transition:opacity 0.15s;

  border:1px solid rgba(255,255,255,0.1);

}

.cam-pad[data-tip]:hover::after { opacity:1; }
.cam-stack-toggle { width:54px; height:54px; font-size:18px; }
#cam-pad-pan, #cam-pad-zoom {
  width:66px; height:66px; opacity:0; pointer-events:none;
  transition:transform 0.22s ease, opacity 0.22s ease;
}
#cam-pad-pan.open  { opacity:1; pointer-events:auto; transform:translateY(-88px); }
#cam-pad-zoom.open { opacity:1; pointer-events:auto; transform:translateY(-168px); }
#fab-lock { display:none; }



#grid-btn {

  position:fixed; top:24px; left:24px; z-index:2000;

  width:56px; height:56px; border-radius:12px;

  background:rgba(20,20,20,0.75); border:1px solid rgba(255,255,255,0.15);

  backdrop-filter:blur(8px); display:flex; align-items:center;

  justify-content:center; cursor:pointer; font-size:20px; color:rgba(255,255,255,0.4);

  transition:all 0.2s; user-select:none;

}

#grid-btn:hover  { background:rgba(50,50,50,0.9); color:rgba(255,255,255,0.7); }

#grid-btn.active { background:rgba(80,180,255,0.18); border-color:rgba(80,180,255,0.5); color:#6ab0ff; }

</style>`);



  // ── Botón de malla guía (superior izquierdo) ──

  const gridBtn = document.createElement('div');

  gridBtn.id = 'grid-btn'; gridBtn.title = 'Malla guía';

  gridBtn.textContent = '⊹';

  document.body.appendChild(gridBtn);



  let gridVisible = false;

  gridBtn.addEventListener('click', e => {

    e.stopPropagation();

    gridVisible = !gridVisible;

    gridBtn.classList.toggle('active', gridVisible);

    // Notificar a scene via custom event

    window.dispatchEvent(new CustomEvent('toggleGrid', { detail: gridVisible }));

  });

  return {

    brushCircle,

    currentColorBtn: currentColorPreview,  // alias para paint.js

    onColorPicked: (color) => {

      setCurrentColor(color);

      setEyedropperActive(false);

      eyedropperBtn.classList.remove('active');

      document.body.classList.remove('eyedropper-cursor');

      currentColorPreview.style.background = color;

      fabPalette.style.background = color;

      closeAll();

    }

  };

}
