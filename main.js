import { startLoop }                                         from './scene.js';
import { autoLoadModel, meshColorMap, onModelLoad,
         adoptGeneratedGroup }                               from './model.js';
import { initExport, setExportRefs }                         from './export.js';
import { initPaintEvents, onEyedropperPick }                 from './paint.js';
import { buildUI, showToast, setBottomButtonsVisible,
         onCloseAll }                                        from './ui.js';
import { buildGeneratorPanel, loadModuleBuffer,
         onGeneratorApply }                                  from './generator.js';

// ── Construir UI ──
const { brushCircle, onColorPicked } = buildUI({});

// ── Generador — botón superior derecho ──
const { genBtn, panel: genPanel, closePanel: closeGen } = buildGeneratorPanel();

// Cuando closeAll dispara (clic en escena): cerrar panel generador y restaurar botones
onCloseAll(() => {
  closeGen();
  setBottomButtonsVisible(true);
});

// Ocultar/mostrar botones inferiores al abrir/cerrar el panel generador
genBtn.addEventListener('click', () => {
  requestAnimationFrame(() => {
    setBottomButtonsVisible(!genPanel.classList.contains('open'));
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
  import('./model.js').then(m => setExportRefs(m.glbModel, m.originalGLBBuffer));
});

// ── Aplicar estructura generada → modo paint ──
onGeneratorApply(group => {
  adoptGeneratedGroup(group);
  import('./model.js').then(m => setExportRefs(m.glbModel, m.originalGLBBuffer));
  setBottomButtonsVisible(true);
});

// ── Cargar módulo base para el generador ──
loadModuleBuffer('ModeloGLB.glb').catch(() =>
  console.warn('ModeloGLB.glb no encontrado para generador')
);

// ── Arrancar ──
autoLoadModel();
startLoop();
