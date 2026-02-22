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

/*  TODO EL BLOQUE DE ESTILOS ORIGINAL SIN CAMBIOS  */
document.head.insertAdjacentHTML('beforeend', `<style>
/* ... ESTILOS EXACTAMENTE IGUALES A LOS ORIGINALES ... */
</style>`);

// ─────────────────────────────────────────────────────────────
// TOAST (SIN CAMBIOS)
// ─────────────────────────────────────────────────────────────
export function showToast(msg, duration = 3000) {
  const t = document.createElement('div');
  t.className  = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

/*  TODO EL BLOQUE DE HELPERS Y MODALES SIN CAMBIOS  */

// ─────────────────────────────────────────────────────────────
// closeAll — SIN CAMBIOS
// ─────────────────────────────────────────────────────────────
export function closeAll() {
  document.getElementById('side-menu')?.classList.remove('open');
  document.getElementById('brush-panel')?.classList.remove('visible');
  document.getElementById('palette-popup')?.classList.remove('visible');
  document.getElementById('palette-div')?.classList.remove('visible');
  document.getElementById('fab-main')?.classList.remove('open');
  document.getElementById('fab-children')?.classList.remove('open');
}

// ─────────────────────────────────────────────────────────────
// buildUI
// ─────────────────────────────────────────────────────────────
export function buildUI({ cameraLockedRef, onCameraLockChange }) {

  /*  TODO: TODO EL BLOQUE DRAWER + FAB LOCK SIN CAMBIOS  */

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

  // ─────────────────────────────────────────
  // CAMBIO AQUÍ ↓↓↓
  // ─────────────────────────────────────────

  const fabPalette = document.createElement('div');
  fabPalette.className = 'fab';
  fabPalette.setAttribute('data-tip', 'Paleta de colores');
  fabPalette.style.background = '#ff0000'; // color inicial
  fabChildren.appendChild(fabPalette);

  // ─────────────────────────────────────────
  // FIN CAMBIO
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

  /*  TODO BLOQUE PINCEL SIN CAMBIOS  */

  // ─────────────────────────────────────────
  // PALETA
  // ─────────────────────────────────────────

  const palettePopup = document.createElement('div');
  palettePopup.id = 'palette-popup';
  document.body.appendChild(palettePopup);

  const paletteDiv = document.createElement('div');
  paletteDiv.id = 'palette-div';
  palettePopup.appendChild(paletteDiv);

  const eyedropperBtn = document.createElement('button');
  eyedropperBtn.id = 'eyedropper-btn';
  eyedropperBtn.innerHTML = '💉 Gotero';
  paletteDiv.appendChild(eyedropperBtn);

  eyedropperBtn.addEventListener('click', () => {
    const next = !eyedropperActive;
    setEyedropperActive(next);
    eyedropperBtn.classList.toggle('active', next);
    document.body.classList.toggle('eyedropper-cursor', next);
    if (next) paletteDiv.classList.remove('visible');
  });

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
    sw.className = 'color-swatch';
    sw.style.background = color;
    sw.title = color;

    sw.addEventListener('click', () => {
      setCurrentColor(color);

      // actualizar botón FAB
      fabPalette.style.background = color;

      paletteDiv.classList.remove('visible');
    });

    paletteDiv.appendChild(sw);
  });

  // ─────────────────────────────────────────
  // FAB PALETA — ABRE DIRECTAMENTE
  // ─────────────────────────────────────────

  fabPalette.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = palettePopup.classList.contains('visible');
    closeAll();
    if (!isOpen) {
      palettePopup.classList.add('visible');
      paletteDiv.classList.add('visible'); // abre directamente
      fabOpen = true;
      fabMain.classList.add('open');
      fabChildren.classList.add('open');
    }
  });

  /*  TODO BLOQUE RESTANTE SIN CAMBIOS  */

  return {
    brushCircle,
    currentColorBtn: fabPalette,
    onColorPicked: (color) => {
      setCurrentColor(color);
      setEyedropperActive(false);
      eyedropperBtn.classList.remove('active');
      document.body.classList.remove('eyedropper-cursor');
      fabPalette.style.background = color;
    }
  };
}
