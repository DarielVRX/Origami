// interactions.js

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { state } from './state.js';

export function initInteractions() {

  state.raycaster = new THREE.Raycaster();
  state.mouse = new THREE.Vector2();

  window.addEventListener('pointermove', onPointerMove);
}

function onPointerMove(event) {

  state.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (!state.glbModel) return;

  state.raycaster.setFromCamera(state.mouse, state.camera);

  const intersects = state.raycaster.intersectObjects(
    state.glbModel.children,
    true
  );

  if (intersects.length > 0) {

    const object = intersects[0].object;

    if (state.hoveredObject !== object) {

      resetPreviousHover();

      state.hoveredObject = object;
      state.originalMaterial = object.material;

      object.material = object.material.clone();
      object.material.emissive = new THREE.Color(0x00ff00);
      object.material.emissiveIntensity = 0.6;
    }

  } else {
    resetPreviousHover();
  }
}

function resetPreviousHover() {

  if (state.hoveredObject) {
    state.hoveredObject.material.dispose();
    state.hoveredObject.material = state.originalMaterial;

    state.hoveredObject = null;
    state.originalMaterial = null;
  }
}
