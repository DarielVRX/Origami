// ─────────────────────────────────────────────────────────────
// model.js — Carga de GLB, setup de materiales, buffer para export
// Dependencias: three, GLTFLoader, scene.js, github.js
// ─────────────────────────────────────────────────────────────

import * as THREE      from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }  from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { scene, camera, controls } from './scene.js';
import { downloadFromGitHub }      from './github.js';

export let glbModel        = null;
export let originalGLBBuffer = null;
export const meshColorMap  = new Map(); // uuid → '#rrggbb'
export const uuidToMesh    = new Map(); // uuid → THREE.Mesh

// Callbacks que otros módulos suscriben para reaccionar a carga/descarga
const onLoadCallbacks = [];
export function onModelLoad(cb) { onLoadCallbacks.push(cb); }

const loader = new GLTFLoader();

// Material base compartido — cada mesh recibe un clone()
export const baseMaterial = new THREE.MeshStandardMaterial({
  color:             0xaaaaaa,
  roughness:         0.8,
  metalness:         0.0,
  emissive:          new THREE.Color(0xffffff),
  emissiveIntensity: 0
});

// ── Configurar modelo recién parseado ──
function setupModel(model) {
  model.scale.set(0.5, 0.5, 0.5);
  model.position.set(0, 0, 0);
  uuidToMesh.clear();
  meshColorMap.clear();

  model.traverse(child => {
    if (!child.isMesh) return;

    // Preservar colores exportados; descartar el blanco/gris por defecto de Three.js
    const ec = child.material?.color;
    const isDefault = !ec
      || (Math.abs(ec.r - 1)     < 0.01 && Math.abs(ec.g - 1)     < 0.01 && Math.abs(ec.b - 1)     < 0.01)
      || (Math.abs(ec.r - 0.8)   < 0.05 && Math.abs(ec.g - 0.8)   < 0.05 && Math.abs(ec.b - 0.8)   < 0.05)
      || (Math.abs(ec.r - 0.667) < 0.05 && Math.abs(ec.g - 0.667) < 0.05 && Math.abs(ec.b - 0.667) < 0.05);

    child.material = baseMaterial.clone();

    if (!isDefault && ec) {
      child.material.color.copy(ec);
      meshColorMap.set(child.uuid, '#' + ec.getHexString());
    }

    child.geometry.computeBoundingSphere();
    if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
    uuidToMesh.set(child.uuid, child);
  });

  scene.add(model);
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  controls.target.copy(center);
  controls.update();

  onLoadCallbacks.forEach(cb => cb(model));
}

// ── Cargar desde ArrayBuffer (carga manual o desde GitHub) ──
export function loadGLBFromBuffer(buffer) {
  if (buffer.byteLength < 12) {
    console.error(`GLB demasiado pequeño: ${buffer.byteLength} bytes`);
    return false;
  }
  const magic = new DataView(buffer).getUint32(0, true);
  if (magic !== 0x46546C67) {
    console.error(`Magic inválido: 0x${magic.toString(16)}. Tamaño: ${buffer.byteLength} bytes`);
    return false;
  }

  originalGLBBuffer = buffer.slice(0);

  loader.parse(originalGLBBuffer.slice(0), '', gltf => {
    if (glbModel) scene.remove(glbModel);
    glbModel = gltf.scene;
    setupModel(glbModel);
    console.log(`GLB cargado: ${buffer.byteLength.toLocaleString()} bytes`);
  }, err => console.error('Error parseando GLB:', err));

  return true;
}

// ── Cargar desde File (input local) ──
export function loadGLBFromFile(file) {
  const reader = new FileReader();
  reader.onload  = e => loadGLBFromBuffer(e.target.result);
  reader.onerror = () => console.error('Error leyendo archivo');
  reader.readAsArrayBuffer(file);
}

// ── Cargar desde GitHub por nombre ──
export async function loadGLBFromGitHub(filename) {
  const buffer = await downloadFromGitHub(filename);
  if (!loadGLBFromBuffer(buffer)) {
    throw new Error('El archivo descargado no es un GLB válido');
  }
}

// ── Carga automática al iniciar — modelo base oculto, solo para buffer ──
export function autoLoadModel() {
  const url = 'ModeloGLB.glb?v=' + Date.now();

  loader.load(
    url,
    gltf => {
      // Guardar referencia pero NO añadir a escena — el módulo base nunca se muestra
      glbModel = gltf.scene;
      setupModel(glbModel);
      scene.remove(glbModel);  // setupModel lo añade, lo quitamos inmediatamente

      fetch(url, { cache: 'no-store' })
        .then(r => r.arrayBuffer())
        .then(buf => {
          if (new DataView(buf).getUint32(0, true) !== 0x46546C67)
            throw new Error('Magic inválido en buffer de export');
          originalGLBBuffer = buf;
          console.log(`Buffer listo para export: ${buf.byteLength.toLocaleString()} bytes`);
        })
        .catch(err => console.warn('Buffer de export no disponible:', err.message));
    },
    undefined,
    err => console.warn('ModeloGLB.glb no encontrado, carga manual requerida.', err)
  );
}

// ── Adoptar estructura generada como modelo paintable ──
export function adoptGeneratedGroup(group) {
  if (glbModel) scene.remove(glbModel);
  glbModel = group;

  // Registrar todos los meshes en el mapa de colores
  meshColorMap.clear();
  uuidToMesh.clear();
  group.traverse(child => {
    if (!child.isMesh) return;
    child.geometry.computeBoundingSphere();
    if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
    uuidToMesh.set(child.uuid, child);
  });

  const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
  controls.target.copy(center);
  controls.update();

  onLoadCallbacks.forEach(cb => cb(group));
}
