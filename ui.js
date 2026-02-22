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

#brush-circle {
  position:fixed; border:2px solid rgba(255,60,60,0.85); border-radius:50%;
  pointer-events:none; opacity:0; transition:opacity 0.2s;
}

#palette-popup {
  position:fixed; bottom:130px; right:130px; z-index:1800;
  display:none; flex-direction:column; align-items:flex-end; gap:10px;
}
#palette-popup.visible { display:flex; }

#current-color-preview {
  width:56px; height:56px; border-radius:12px;
  border:2px solid rgba(255,255,255,0.35); cursor:pointer;
  box-shadow:0 2px 12px rgba(0,0,0,0.5); transition:transform 0.15s;
}
#current-color-preview:hover { transform:scale(1.08); }

.fab-color-preview {
  width:42px;
  height:42px;
  border-radius:10px;
  border:2px solid rgba(255,255,255,0.4);
  box-shadow:0 2px 10px rgba(0,0,0,0.5);
}

#palette-div {
  background:rgba(18,18,18,0.97);
  border:1px solid rgba(255,255,255,0.1); border-radius:12px;
  padding:12px; grid-template-columns:repeat(6,1fr); gap:7px;
  max-height:55vh; overflow-y:auto; backdrop-filter:blur(12px);
  display:none;
}
#palette-div.visible { display:grid; }

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
// buildUI
// ─────────────────────────────────────────────────────────────
export function buildUI({ cameraLockedRef, onCameraLockChange }) {

  const fabGroup = document.createElement('div');
  fabGroup.id = 'fab-group';
  document.body.appendChild(fabGroup);

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

  const fabMenu  = makeFabChild('☰', 'Menú');
  const fabBrush = makeFabChild('✏️', 'Tamaño de pincel');

  // ───── MODIFICACIÓN QUIRÚRGICA AQUÍ ─────
  const fabPalette = makeFabChild('', 'Paleta de colores');

  const fabColorPreview = document.createElement('div');
  fabColorPreview.className = 'fab-color-preview';
  fabColorPreview.style.background = '#ff0000';
  fabPalette.appendChild(fabColorPreview);
  // ─────────────────────────────────────────

  const fabMain = document.createElement('div');
  fabMain.id = 'fab-main';
  fabMain.className = 'fab';
  fabMain.textContent = '+';
  fabGroup.appendChild(fabMain);

  let fabOpen = false;
  const toggleFab = () => {
    fabOpen = !fabOpen;
    fabMain.classList.toggle('open', fabOpen);
    fabChildren.classList.toggle('open', fabOpen);
  };
  fabMain.addEventListener('click', e => { e.stopPropagation(); toggleFab(); });

  // Paleta
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

  ['#000000','#ffffff','#ff0000','#00ff00','#0000ff'].forEach(color=>{
    const sw=document.createElement('div');
    sw.className='color-swatch';
    sw.style.background=color;
    sw.addEventListener('click',()=>{
      setCurrentColor(color);
      currentColorPreview.style.background=color;
      fabColorPreview.style.background=color; // sincronización
      paletteDiv.classList.remove('visible');
    });
    paletteDiv.appendChild(sw);
  });

  fabPalette.addEventListener('click', e => {
    e.stopPropagation();
    palettePopup.classList.toggle('visible');
  });

  return {
    currentColorBtn: currentColorPreview,
    onColorPicked: (color)=>{
      setCurrentColor(color);
      currentColorPreview.style.background=color;
      fabColorPreview.style.background=color; // sincronización con gotero
    }
  };
}
