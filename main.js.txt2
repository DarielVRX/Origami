// main.js

import { scene, camera, renderer, controls } from './core.js';
import { state } from './state.js';
import { loadModel } from './modelLoader.js';
import { initInteractions } from './interactions.js';

// 🔹 Importar herramientas UI
import { initPalette } from './palette.js';
import { initBrush } from './brush.js';
import { initCameraLock } from './cameraLock.js';
import { initExportImage } from './exportImage.js';


init();
animate();

function init() {

  // =====================================================
  // Sincronizar state con core
  // =====================================================
  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;
  state.controls = controls;

  // =====================================================
  // Carga del modelo
  // =====================================================
  loadModel();

  // =====================================================
  // Interacciones: hover, raycasting, pincel
  // =====================================================
  initInteractions();

  // =====================================================
  // Herramientas UI
  // =====================================================
  initPalette();       // Paleta de colores
  initBrush();         // Slider de tamaño
  initCameraLock();    // Botón Bloquear/Desbloquear cámara
  initExportImage();   // Botón Exportar imagen

}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
