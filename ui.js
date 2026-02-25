// ─────────────────────────────────────────────────────────────
// ui.js — FAB group, drawer lateral, paleta, modales, toast
// Dependencias: github.js, model.js, export.js, paint.js
// ─────────────────────────────────────────────────────────────

import { checkFileExists } from './github.js';
import { loadGLBFromFile, loadGLBFromGitHub }  from './model.js';
import { doExportGLB, doExportImage }           from './export.js';
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
// closeAll — cierra todos los paneles abiertos
// ─────────────────────────────────────────────────────────────
export function closeAll() {
  document.getElementById('side-menu')?.classList.remove('open');
  document.getElementById('brush-panel')?.classList.remove('visible');
  document.getElementById('palette-popup')?.classList.remove('visible');
  document.getElementById('palette-div')?.classList.remove('visible');
  document.getElementById('fab-main')?.classList.remove('open');
  document.getElementById('fab-children')?.classList.remove('open');
}

const fg = document.getElementById('fab-group');
if (fg) fg.style.visibility = 'visible';

// ─────────────────────────────────────────────────────────────
// buildUI — construye toda la UI (llamar desde main.js)
// Retorna { brushCircle, currentColorBtn } para usarlos en otros módulos
// ─────────────────────────────────────────────────────────────
export function buildUI({ cameraLockedRef, onCameraLockChange }) {
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
  addMenuBtn('📦', 'Exportar GLB → GitHub', () => { closeAll(); askFilename('ModeloGLB', name => doExportGLB(name)); });

  // ── FAB group ──
  const fabGroup = document.createElement('div');
  fabGroup.id = 'fab-group';
  document.body.appendChild(fabGroup);

  // Candado
  const fabLock = document.createElement('div');
  fabLock.id = 'fab-lock'; fabLock.className = 'fab';
  fabLock.setAttribute('data-tip', 'Bloquear cámara');
  fabLock.innerHTML = '<span class="lock-icon">🔓</span>';
  fabGroup.appendChild(fabLock);

  fabLock.addEventListener('click', e => {
    e.stopPropagation();
    const locked = onCameraLockChange();
    const icon   = fabLock.querySelector('.lock-icon');
    icon.textContent = locked ? '🔒' : '🔓';
    fabLock.setAttribute('data-tip', locked ? 'Desbloquear cámara' : 'Bloquear cámara');
    fabLock.classList.toggle('locked',   locked);
    fabLock.classList.toggle('unlocked', !locked);
    icon.style.animation = 'none';
    requestAnimationFrame(() => {
      icon.style.animation = locked ? 'lockShake 0.4s ease' : 'lockBounce 0.4s ease';
    });
  });

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
  const toggleFab = () => {
    fabOpen = !fabOpen;
    fabMain.classList.toggle('open', fabOpen);
    fabChildren.classList.toggle('open', fabOpen);
  };
  fabMain.addEventListener('click', e => { e.stopPropagation(); toggleFab(); });

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
  brushSlider.addEventListener('change', () => brushPanel.classList.remove('visible'));

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
      paletteDiv.classList.remove('visible');
    });
    paletteDiv.appendChild(sw);
  });

  // ── Acciones hijos FAB ──
  fabMenu.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = sideMenu.classList.contains('open');
    closeAll();
    if (!isOpen) sideMenu.classList.add('open');
    else { fabOpen = true; fabMain.classList.add('open'); fabChildren.classList.add('open'); }
  });

  fabBrush.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = brushPanel.classList.contains('visible');
    closeAll();
    if (!isOpen) {
      brushPanel.classList.add('visible');
      fabOpen = true; fabMain.classList.add('open'); fabChildren.classList.add('open');
    }
  });

  fabPalette.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = paletteDiv.classList.contains('visible');
    closeAll();
    if (!isOpen) {
      fabGroup.style.visibility = 'hidden';
      palettePopup.classList.add('visible');
      paletteDiv.classList.add('visible');
      fabOpen = true; fabMain.classList.add('open'); fabChildren.classList.add('open');
    }
  });

  // ── Callback para gotero (desde paint.js) ──
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
    }
  };
}
