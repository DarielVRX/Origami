// ─────────────────────────────────────────────────────────────
// ui.js — Construcción de UI (FAB, paleta, brush circle, toast)
// ─────────────────────────────────────────────────────────────

export function buildUI({ onCameraLockChange }) {

  // ─────────────────────────────
  // Brush visual
  // ─────────────────────────────
  const brushCircle = document.createElement('div');
  brushCircle.id = 'brush-circle';
  Object.assign(brushCircle.style, {
    position: 'fixed',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '2px solid white',
    pointerEvents: 'none',
    display: 'none',
    zIndex: '9999',
    transform: 'translate(-50%, -50%)'
  });
  document.body.appendChild(brushCircle);

  // ─────────────────────────────
  // FAB Group
  // ─────────────────────────────
  const fabGroup = document.createElement('div');
  fabGroup.id = 'fab-group';
  document.body.appendChild(fabGroup);

  // ─────────────────────────────
  // Lock Cámara
  // ─────────────────────────────
  const fabLock = document.createElement('button');
  fabLock.className = 'fab-child';
  fabLock.innerText = '🔒';
  fabLock.title = 'Bloquear cámara';
  fabGroup.appendChild(fabLock);

  let locked = false;
  fabLock.addEventListener('click', () => {
    locked = onCameraLockChange();
    fabLock.innerText = locked ? '🔓' : '🔒';
  });

  // ─────────────────────────────
  // Botón Color (principal)
  // ─────────────────────────────
  const fabColor = document.createElement('button');
  fabColor.className = 'fab-child';
  fabColor.title = 'Seleccionar color';
  fabGroup.appendChild(fabColor);

  const colorPreview = document.createElement('div');
  Object.assign(colorPreview.style, {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#ff0000',
    border: '2px solid white'
  });

  fabColor.appendChild(colorPreview);

  // ─────────────────────────────
  // Paleta
  // ─────────────────────────────
  const palette = document.createElement('div');
  palette.id = 'color-palette';
  palette.style.display = 'none';
  document.body.appendChild(palette);

  const colors = [
    '#ff0000','#00ff00','#0000ff','#ffff00',
    '#ff00ff','#00ffff','#ffffff','#000000'
  ];

  colors.forEach(c => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = c;
    palette.appendChild(swatch);

    swatch.addEventListener('click', () => {
      colorPreview.style.background = c;
      brushCircle.style.borderColor = c;
      palette.style.display = 'none';
    });
  });

  fabColor.addEventListener('click', () => {
    palette.style.display =
      palette.style.display === 'none' ? 'flex' : 'none';
  });

  function onColorPicked(hex) {
    colorPreview.style.background = hex;
    brushCircle.style.borderColor = hex;
  }

  return { brushCircle, onColorPicked };
}

// ─────────────────────────────
// Toast (SE RESTAURA)
// ─────────────────────────────
export function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
