import { startLoop }                                         from './scene.js';
import { autoLoadModel, meshColorMap, onModelLoad,
         adoptGeneratedGroup }                               from './model.js';
import { initExport, setExportRefs }                         from './export.js';
import { initPaintEvents, onEyedropperPick }                 from './paint.js';
import { buildUI, showToast, activateExclusive,
         onCloseAll }                                        from './ui.js';
import { buildGeneratorPanel, loadModuleBuffer,
         onGeneratorApply, setGeneratorRingsSnapshot }       from './generator.js';

// ── Construir UI ──
const { brushCircle, onColorPicked } = buildUI({});

// ── Generador ──
const { genBtn, panel: genPanel, closePanel: closeGen } = buildGeneratorPanel();

// Cuando closeAll dispara: cerrar panel generador y restaurar todos los botones
onCloseAll(() => {
  closeGen();
  activateExclusive(null);
});

// Al cerrar generador con su botón propio, restaurar todos
genBtn.addEventListener('click', () => {
  requestAnimationFrame(() => {
    if (!genPanel.classList.contains('open')) activateExclusive(null);
  });
});

// ── Inicializar export ──
initExport({ glbModel: null, originalGLBBuffer: null, meshColorMap, showToast });

// ── Inicializar eventos de pintura ──
initPaintEvents(brushCircle);

// ── Gotero → actualizar color en UI ──
onEyedropperPick(onColorPicked);

// ── Cuando carga un modelo nuevo → actualizar refs en export ──
onModelLoad(() => {
  import('./model.js').then(m => {
    setExportRefs(m.glbModel, m.originalGLBBuffer);
    if (Array.isArray(m.generatorRingsFromFile) && m.generatorRingsFromFile.length) {
      setGeneratorRingsSnapshot(m.generatorRingsFromFile);
    }
  });
});

// ── Aplicar estructura generada → modo paint ──
onGeneratorApply(group => {
  adoptGeneratedGroup(group);
  import('./model.js').then(m => setExportRefs(m.glbModel, m.originalGLBBuffer));
  const panelOpen = genPanel.classList.contains('open');
  const inPreview = document.body.classList.contains('gen-preview-active');
  if (!panelOpen && !inPreview) activateExclusive(null);
});

// ── Cargar módulo base para el generador ──
loadModuleBuffer('ModeloGLB.glb').catch(() =>
  console.warn('ModeloGLB.glb no encontrado para generador')
);

// ── Arrancar ──
autoLoadModel();
startLoop();
