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

/* ================================
   ESTILOS (SIN CAMBIOS)
================================ */
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
</style>`);

/* ================================
   TOAST
================================ */
export function showToast(msg, duration = 3000) {
  const t = document.createElement('div');
  t.className  = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/* ================================
   buildUI
================================ */
export function buildUI({ onCameraLockChange }) {

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

  const fabMenu  = makeFabChild('☰',  'Menú');
  const fabBrush = makeFabChild('✏️', 'Tamaño de pincel');

  // 🔴 CAMBIO: reemplazamos 🎨 por preview dinámico
  const fabPalette = makeFabChild('', 'Paleta de colores');
  fabPalette.style.background = '#ff0000';
  fabPalette.style.fontSize = '0';
  fabPalette.style.border = '2px solid rgba(255,255,255,0.35)';

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

  /* ================================
     PALETA
  ================================= */
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

  const colors = ['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff'];

  colors.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch';
    sw.style.background = color;

    sw.addEventListener('click', () => {
      setCurrentColor(color);
      currentColorPreview.style.background = color;
      fabPalette.style.background = color; // sincroniza FAB
      paletteDiv.classList.remove('visible');
    });

    paletteDiv.appendChild(sw);
  });

  fabPalette.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = palettePopup.classList.contains('visible');
    closeAll();
    if (!isOpen) {
      palettePopup.classList.add('visible');
      fabOpen = true;
      fabMain.classList.add('open');
      fabChildren.classList.add('open');
    }
  });

  return {
    brushCircle: null,
    currentColorBtn: currentColorPreview,
    onColorPicked: (color) => {
      setCurrentColor(color);
      currentColorPreview.style.background = color;
      fabPalette.style.background = color; // sincroniza FAB
    }
  };
}
