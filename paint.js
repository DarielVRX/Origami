// ─────────────────────────────────────────────────────────────
// paint.js — Raycaster, hover, pintura con pincel
// Dependencias: three, scene.js, model.js
// ─────────────────────────────────────────────────────────────

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { camera, renderer, controls } from './scene.js';
import { glbModel, meshColorMap }     from './model.js';
import { closeAll }                   from './ui.js';

// Estado de pintura (leído/escrito desde ui.js también)
export let currentColor     = '#ff0000';
export let brushSize        = 1;
export let eyedropperActive = false;
export let isDrawing        = false;

const lockedMeshIds = new Set();

export function setCurrentColor(c)     { currentColor     = c; }
export function setBrushSize(s)        { brushSize        = s; }
export function setEyedropperActive(v) { eyedropperActive = v; }
export function setPaintInteractionsEnabled(v) { paintInteractionsEnabled = !!v; }

export function setRingLocked(ringIndex, locked) {
  if (!glbModel) return;
  const target = `ring:${ringIndex}`;
  glbModel.traverse(child => {
    if (!child.isMesh) return;
    if (child.userData?.ringId !== target) return;
    if (locked) lockedMeshIds.add(child.uuid);
    else lockedMeshIds.delete(child.uuid);
  });
}

export function setRingVisible(ringIndex, visible) {
  if (!glbModel) return;
  const target = `ring:${ringIndex}`;
  glbModel.traverse(child => {
    if (!child.isMesh) return;
    if (child.userData?.ringId !== target) return;
    child.visible = visible;
    if (visible) hiddenMeshIds.delete(child.uuid);
    else hiddenMeshIds.add(child.uuid);
  });
}

export function setRingLocked(ringIndex, locked) {
  if (!glbModel) return;
  const target = `ring:${ringIndex}`;
  glbModel.traverse(child => {
    if (!child.isMesh) return;
    if (child.userData?.ringId !== target) return;
    if (locked) lockedMeshIds.add(child.uuid);
    else lockedMeshIds.delete(child.uuid);
  });
}

let lastHovered = null;
let lastClicked = null;
let touchPainting = false;

const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

// Callback para cuando el gotero recoge un color
let onColorPicked = null;
export function onEyedropperPick(cb) { onColorPicked = cb; }

// ── Radio del pincel proyectado a píxeles ──
export function brushRadiusPx() {
  const dist = camera.position.distanceTo(controls.target);
  const fovRad = camera.fov * Math.PI / 180;
  const unitsPerPx = (2 * dist * Math.tan(fovRad / 2)) / window.innerHeight;
  return brushSize / unitsPerPx;
}

// ── Intersecciones limitadas por distancia de cámara ──
function getIntersects(clientX, clientY) {
  mouse.x =  (clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.far = camera.position.distanceTo(controls.target) * 1.05;
  return glbModel ? raycaster.intersectObjects(glbModel.children, true) : [];
}

// ── Pintar en un punto 3D ──
function paintAt(hitPoint) {
  const maxDist = camera.position.distanceTo(controls.target);
  if (hitPoint.distanceTo(camera.position) > maxDist) return;

  glbModel.traverse(child => {
    if (!child.isMesh) return;
    if (lockedMeshIds.has(child.uuid)) return;

    if (brushSize <= 1) {
      if (child !== lastHovered) return;
      child.material.color.set(currentColor);
      meshColorMap.set(child.uuid, currentColor);
      return;
    }

    const pos = child.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3()
        .fromBufferAttribute(pos, i)
        .applyMatrix4(child.matrixWorld);
      if (v.distanceTo(hitPoint) <= brushSize) {
        child.material.color.set(currentColor);
        meshColorMap.set(child.uuid, currentColor);
        break;
      }
    }
  });
}

// ── Actualizar hover / highlight ──
function updateHover(intersects) {
  if (lastHovered && lastHovered !== lastClicked)
    lastHovered.material.emissiveIntensity = 0;
  if (!intersects.length) { lastHovered = null; return; }

  const unlocked = intersects.find(i => !lockedMeshIds.has(i.object.uuid));
  if (!unlocked) { lastHovered = null; return; }

  const hitPoint = unlocked.point;
  lastHovered = unlocked.object;

  glbModel.traverse(child => {
    if (!child.isMesh || child === lastClicked) return;
    let near = child === lastHovered;
    if (!near && brushSize > 1) {
      const pos = child.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3()
          .fromBufferAttribute(pos, i)
          .applyMatrix4(child.matrixWorld);
        if (v.distanceTo(hitPoint) <= brushSize) { near = true; break; }
      }
    }
    child.material.emissiveIntensity = near ? 0.08 : 0;
  });

  if (isDrawing && !eyedropperActive) paintAt(hitPoint);
}

// ── Registrar todos los eventos del canvas ──
export function initPaintEvents(brushCircleEl) {
  // Mouse move → actualizar cursor y hover
  renderer.domElement.addEventListener('mousemove', e => {
    if (!paintInteractionsEnabled) return;
    const rpx = brushRadiusPx();
    const d   = Math.max(10, rpx * 2);
    brushCircleEl.style.width   = d + 'px';
    brushCircleEl.style.height  = d + 'px';
    brushCircleEl.style.left    = (e.clientX - d / 2) + 'px';
    brushCircleEl.style.top     = (e.clientY - d / 2) + 'px';
    brushCircleEl.style.opacity = '1';
    if (glbModel) updateHover(getIntersects(e.clientX, e.clientY));
  });

  renderer.domElement.addEventListener('mouseleave', () => {
    brushCircleEl.style.opacity = '0';
  });

  renderer.domElement.addEventListener('mousedown', e => {
    if (!paintInteractionsEnabled) return;
    closeAll();
    if (e.button !== 0 || !glbModel) return;
    const its = getIntersects(e.clientX, e.clientY);

    const unlockedHit = its.find(i => !lockedMeshIds.has(i.object.uuid));
    if (unlockedHit) {
      const obj = unlockedHit.object;
      if (eyedropperActive) {
        const picked = '#' + obj.material.color.getHexString();
        if (onColorPicked) onColorPicked(picked);
        return;
      }
      if (lastClicked && lastClicked !== obj) lastClicked.material.emissiveIntensity = 0;
      lastClicked = obj;
      obj.material.emissiveIntensity = 0.1;
    }

    isDrawing = true;
    if (unlockedHit && !eyedropperActive) paintAt(unlockedHit.point);
  });

  renderer.domElement.addEventListener('mouseup', () => { isDrawing = false; });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  // Touch
  renderer.domElement.addEventListener('touchstart', e => {
    if (!paintInteractionsEnabled) return;
    closeAll();
    if (e.touches.length !== 1 || !glbModel) return;
    touchPainting = true; isDrawing = true;
    const t   = e.touches[0];
    const its = getIntersects(t.clientX, t.clientY);
    const unlockedHit = its.find(i => !lockedMeshIds.has(i.object.uuid));
    if (unlockedHit && !eyedropperActive) paintAt(unlockedHit.point);
  }, { passive: true });

  renderer.domElement.addEventListener('touchmove', e => {
    if (!paintInteractionsEnabled || !touchPainting || e.touches.length !== 1 || !glbModel) return;
    const t = e.touches[0];
    updateHover(getIntersects(t.clientX, t.clientY));
  }, { passive: true });

  renderer.domElement.addEventListener('touchend', () => {
    touchPainting = false;
    isDrawing     = false;
  });
}
