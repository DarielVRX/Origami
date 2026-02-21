// main.js
// =====================================================
// ORQUESTADOR PRINCIPAL
// Aquí NO se crean scene, camera, renderer ni controls.
// Todo eso vive en core.js.
// =====================================================

import { scene, camera, renderer, controls } from './core.js';
import { state } from './state.js';
import { loadModel } from './modelLoader.js';
import { initInteractions } from './interactions.js';

init();
animate();

function init() {

  // =====================================================
  // Sincronizar state con core
  // Si algo no responde → revisar core.js
  // =====================================================
  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;
  state.controls = controls;

  // =====================================================
  // CARGA DE MODELO
  // Si el GLB no aparece → revisar modelLoader.js
  // =====================================================
  loadModel();

  // =====================================================
  // INTERACCIONES (hover, raycasting, pincel)
  // Si hover falla → revisar interactions.js
  // =====================================================
  initInteractions();
}

function animate() {

  requestAnimationFrame(animate);

  // Si agregas animaciones futuras → aquí
  renderer.render(scene, camera);
}
