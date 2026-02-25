// ─────────────────────────────────────────────────────────────
// main.js — Punto de entrada, conecta todos los módulos
// ─────────────────────────────────────────────────────────────

import { startLoop, controls }                          from './scene.js';
import { autoLoadModel, meshColorMap, onModelLoad }     from './model.js';
import { initExport, setExportRefs }                    from './export.js';
import { initPaintEvents, onEyedropperPick }            from './paint.js';
import { buildUI, showToast }                           from './ui.js';


// ── Construir UI ──
const { brushCircle, onColorPicked } = buildUI({});

// ── Inicializar export (las refs de modelo se actualizan en onModelLoad) ──
initExport({ glbModel: null, originalGLBBuffer: null, meshColorMap, showToast });

// ── Inicializar eventos de pintura ──
initPaintEvents(brushCircle);

// ── Gotero → actualizar color en UI ──
onEyedropperPick(onColorPicked);

// ── Cuando carga un modelo nuevo → actualizar refs en export ──
onModelLoad(() => {
  import('./model.js').then(m => setExportRefs(m.glbModel, m.originalGLBBuffer));
});

// ── Arrancar ──
autoLoadModel();
startLoop();
