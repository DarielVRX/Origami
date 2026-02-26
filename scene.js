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
camera.position.set(80, 22, 0);

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

// ── Planos guía (ocultos por defecto, toggle vía evento) ──
const GUIDE_SIZE = 400;

const planeXY = new THREE.Mesh(
  new THREE.PlaneGeometry(GUIDE_SIZE, GUIDE_SIZE),
  new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
);
planeXY.visible = false;  // normal Z — guía eje Z

const planeYZ = new THREE.Mesh(
  new THREE.PlaneGeometry(GUIDE_SIZE, GUIDE_SIZE),
  new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
);
planeYZ.rotation.y = Math.PI / 2;  // normal X — guía eje X
planeYZ.visible = false;

scene.add(planeXY);
scene.add(planeYZ);

window.addEventListener('toggleGrid', e => {
  planeXY.visible = e.detail;
  planeYZ.visible = e.detail;
});

// ── Redimensionar planos guía al tamaño del contenido ──
export function resizeGuidePlanes(group) {
  if (!group) return;
  const box  = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) * 1.1; // 10% margen

  planeXY.geometry.dispose();
  planeXY.geometry = new THREE.PlaneGeometry(maxDim, maxDim);
  planeXY.position.copy(center);

  planeYZ.geometry.dispose();
  planeYZ.geometry = new THREE.PlaneGeometry(maxDim, maxDim);
  planeYZ.position.copy(center);
}

// ── Loop de render (exportado para que main.js lo arranque) ──
export function startLoop() {
  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
}

// ── Posición de cámara estándar frente al módulo base ──
export function resetCamera() {
  camera.position.set(80, 22, 0);
  controls.target.set(0, 22, 0);
  controls.update();
}
