// main.js

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js?module';

import { state } from './state.js';
import { loadModel } from './modelLoader.js';
import { initInteractions } from './interactions.js';

init();
animate();

function init() {

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x222222);

  state.camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  state.camera.position.set(0, 2, 5);

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  state.scene.add(light);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  state.scene.add(dirLight);

  loadModel(state.scene);

  initInteractions();

  window.addEventListener('resize', onResize);
}

function onResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  state.renderer.render(state.scene, state.camera);
}
