// ─────────────────────────────────────────────────────────────
// scene.js — Escena, cámara, renderer, luces y controles
// Dependencias: three, OrbitControls
// ─────────────────────────────────────────────────────────────

import * as THREE        from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js?module';

// ── Escena ──
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

// ── Cámara ──
export const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 22, 80);

// ── Renderer ──
export const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true   // necesario para exportar imágenes
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// ── Resize ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Controles ──
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.enableRotate  = false;
controls.enableZoom    = false;
controls.enablePan     = false;
controls.mouseButtons  = { LEFT: THREE.MOUSE.NONE, MIDDLE: THREE.MOUSE.NONE, RIGHT: THREE.MOUSE.NONE };
controls.touches       = { ONE: THREE.TOUCH.NONE, TWO: THREE.TOUCH.NONE };

// Bloquear scroll/pinch nativos del navegador
renderer.domElement.addEventListener('wheel',      e => e.preventDefault(), { passive: false });
renderer.domElement.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
renderer.domElement.addEventListener('touchmove',  e => e.preventDefault(), { passive: false });

// ── Luces ──
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404040));
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
scene.add(new THREE.AxesHelper(5));

// ── Loop de render (exportado para que main.js lo arranque) ──
export function startLoop() {
  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
}
