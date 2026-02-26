// ─────────────────────────────────────────────────────────────
// export.js — Export de GLB con colores y export de imagen 2×2
// Dependencias: three, scene.js, github.js
// ─────────────────────────────────────────────────────────────

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFExporter } from 'https://unpkg.com/three@0.163.0/examples/jsm/exporters/GLTFExporter.js?module';
import { scene, camera, renderer, controls } from './scene.js';
import { uploadToGitHub } from './github.js';
import { getGeneratorRingsSnapshot } from './generator.js';

// Referencias al estado global inyectadas desde main.js
let _glbModel        = null;
let _originalGLBBuf  = null;
let _meshColorMap    = null;
let _showToast       = null;

export function initExport({ glbModel, originalGLBBuffer, meshColorMap, showToast }) {
  _glbModel       = glbModel;
  _originalGLBBuf = originalGLBBuffer;
  _meshColorMap   = meshColorMap;
  _showToast      = showToast;
}

// Permite que model.js actualice las referencias después de cargar un GLB
export function setExportRefs(glbModel, originalGLBBuffer) {
  _glbModel      = glbModel;
  _originalGLBBuf = originalGLBBuffer;
}

// ── Exportar modelo actual como GLB y anexar metadata del generador ──
function injectGeneratorMetadata(glbBuffer) {
  const view = new DataView(glbBuffer);
  if (view.getUint32(0, true) !== 0x46546C67) throw new Error('GLB inválido');

  const jsonChunkLen  = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  if (jsonChunkType !== 0x4E4F534A) throw new Error('Chunk JSON inválido');

  const jsonDataStart = 20;
  const jsonDataEnd   = jsonDataStart + jsonChunkLen;
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(glbBuffer, jsonDataStart, jsonChunkLen)));

  const ringSnapshot = getGeneratorRingsSnapshot();
  gltf.asset = gltf.asset || { version: '2.0' };
  gltf.asset.extras = gltf.asset.extras || {};
  gltf.asset.extras.origamiGenerator = { rings: ringSnapshot };

  let binLength = 0;
  let binData = new Uint8Array(0);
  if (jsonDataEnd + 8 <= glbBuffer.byteLength) {
    binLength = view.getUint32(jsonDataEnd, true);
    const binDataStart = jsonDataEnd + 8;
    const safeLen = Math.min(binLength, glbBuffer.byteLength - binDataStart);
    binData = new Uint8Array(glbBuffer, binDataStart, safeLen);
    binLength = safeLen;
  }

  const newJson = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPadded = Math.ceil(newJson.length / 4) * 4;
  const binPadded = Math.ceil(binLength / 4) * 4;
  const hasBin = binLength > 0;
  const total = 12 + 8 + jsonPadded + (hasBin ? 8 + binPadded : 0);

  const out = new ArrayBuffer(total);
  const outView = new DataView(out);
  const outBytes = new Uint8Array(out);
  let off = 0;

  outView.setUint32(off, 0x46546C67, true); off += 4;
  outView.setUint32(off, 2, true); off += 4;
  outView.setUint32(off, total, true); off += 4;

  outView.setUint32(off, jsonPadded, true); off += 4;
  outView.setUint32(off, 0x4E4F534A, true); off += 4;
  outBytes.set(newJson, off); off += newJson.length;
  outBytes.fill(0x20, off, off + (jsonPadded - newJson.length)); off += jsonPadded - newJson.length;

  if (hasBin) {
    outView.setUint32(off, binPadded, true); off += 4;
    outView.setUint32(off, 0x004E4942, true); off += 4;
    outBytes.set(binData, off); off += binLength;
    outBytes.fill(0x00, off, off + (binPadded - binLength));
  }

  return out;
}

async function buildPatchedGLB() {
  if (!_glbModel) {
    _showToast('⚠️ No hay modelo para exportar.');
    return null;
  }

  const exporter = new GLTFExporter();
  const raw = await new Promise((resolve, reject) => {
    exporter.parse(
      _glbModel,
      glb => {
        if (glb instanceof ArrayBuffer) resolve(glb);
        else reject(new Error('La exportación no devolvió GLB binario'));
      },
      err => reject(err),
      { binary: true, trs: false, onlyVisible: true }
    );
  });

  return injectGeneratorMetadata(raw);
}

// ── Exportar GLB solo local ──
export async function doExportGLBLocal(filename) {
  if (!_glbModel) { alert('No hay modelo cargado.'); return; }
  const buf = await buildPatchedGLB();
  if (!buf) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
  a.download = filename.endsWith('.glb') ? filename : filename + '.glb';
  a.click();
  _showToast('✅ GLB descargado localmente');
}

// ── Exportar GLB → GitHub + descarga local ──
export async function doExportGLB(filename) {
  if (!_glbModel) { alert('No hay modelo cargado.'); return; }

  const buf = await buildPatchedGLB();
  if (!buf) return;

  _showToast('Subiendo a GitHub…');
  try {
    await uploadToGitHub(buf, filename);
    _showToast(`✅ Guardado en GitHub: ${filename}.glb`);
  } catch (e) {
    _showToast(`⚠️ GitHub falló: ${e.message}`, 5000);
  }
}

// ── Exportar imagen 2×2 ──
export function doExportImage(filename) {
  if (!_glbModel) { alert('No hay modelo cargado.'); return; }

  const views = [
    new THREE.Vector3( 0, 22,  70),
    new THREE.Vector3( 0, 22, -70),
    new THREE.Vector3( 70, 22,   0),
    new THREE.Vector3(-70, 22,   0)
  ];
  const SIZE = 4096, GAP = 10, TOTAL = SIZE * 2 + GAP;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TOTAL;
  const ctx = canvas.getContext('2d');

  const savedPos    = camera.position.clone();
  const savedTarget = controls.target.clone();

  const snapshots = views.map((pos, i) => {
    camera.position.copy(pos);
    controls.target.set(0, 22, 0);
    controls.update();
    renderer.render(scene, camera);
    return { src: renderer.domElement.toDataURL(), x: (i % 2) * (SIZE + GAP), y: Math.floor(i / 2) * (SIZE + GAP) };
  });

  camera.position.copy(savedPos);
  controls.target.copy(savedTarget);
  controls.update();

  let loaded = 0;
  snapshots.forEach(({ src, x, y }) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, x, y, SIZE, SIZE);
      if (++loaded === snapshots.length) {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = filename.endsWith('.png') ? filename : filename + '.png';
        a.click();
      }
    };
    img.src = src;
  });
}
