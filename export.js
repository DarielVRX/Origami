// ─────────────────────────────────────────────────────────────
// export.js — Export de GLB con colores y export de imagen 2×2
// Dependencias: three, scene.js, github.js
// ─────────────────────────────────────────────────────────────

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
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

// ── Parchear GLB binario con los colores pintados ──
export function buildPatchedGLB() {
  if (!_originalGLBBuf) {
    _showToast('⚠️ Buffer no disponible. Recarga la página.');
    return null;
  }

  const buf  = _originalGLBBuf.slice(0);
  const view = new DataView(buf);

  // Validar magic 'glTF'
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546C67) {
    _showToast(`⚠️ Buffer inválido (magic: 0x${magic.toString(16)})`);
    return null;
  }

  const glbVersion = view.getUint32(4, true);
  const glbLength  = view.getUint32(8, true);
  console.log(`GLB: v${glbVersion}, ${glbLength} bytes declarados, ${buf.byteLength} bytes reales`);

  // Chunk JSON
  const jsonChunkLen  = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  if (jsonChunkType !== 0x4E4F534A) {
    _showToast('⚠️ El primer chunk no es JSON.');
    return null;
  }
  const jsonDataStart = 20;
  const jsonDataEnd   = jsonDataStart + jsonChunkLen;
  if (jsonDataEnd > buf.byteLength) {
    _showToast(`⚠️ JSON chunk desborda el buffer (${jsonDataEnd} > ${buf.byteLength})`);
    return null;
  }

  const gltf = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buf, jsonDataStart, jsonChunkLen))
  );

  const ringSnapshot = getGeneratorRingsSnapshot();
  gltf.asset = gltf.asset || { version: '2.0' };
  gltf.asset.extras = gltf.asset.extras || {};
  gltf.asset.extras.origamiGenerator = { rings: ringSnapshot };

  // Chunk BIN
  let binLength = 0;
  let binData   = new Uint8Array(0);
  if (jsonDataEnd + 8 <= buf.byteLength) {
    binLength = view.getUint32(jsonDataEnd, true);
    const binDataStart = jsonDataEnd + 8;
    const safeLen = Math.min(binLength, buf.byteLength - binDataStart);
    binData = new Uint8Array(buf, binDataStart, safeLen);
    if (safeLen < binLength) {
      console.warn(`BIN chunk truncado: ${binDataStart + binLength} > ${buf.byteLength}`);
      binLength = safeLen;
    }
  }

  // Mapa nombre normalizado → color pintado
  // GLTFLoader elimina los puntos de los nombres (ej: "Modelo.559" → "Modelo559")
  const nameToColor = new Map();
  if (_glbModel) {
    _glbModel.traverse(child => {
      if (!child.isMesh) return;
      const hex = _meshColorMap.get(child.uuid);
      if (hex) nameToColor.set(child.name.replace(/\./g, ''), hex);
    });
  }

  // Crear materiales desde cero (el GLB original no tiene materiales)
  gltf.materials = [];
  const DEFAULT  = [0.667, 0.667, 0.667, 1.0];
  let patchedCount = 0;

  gltf.meshes.forEach(gltfMesh => {
    const hex = nameToColor.get(gltfMesh.name.replace(/\./g, ''));
    let baseColorFactor;
    if (hex) {
      const c = new THREE.Color(hex);
      baseColorFactor = [
        Math.pow(c.r, 2.2),
        Math.pow(c.g, 2.2),
        Math.pow(c.b, 2.2),
        1.0
      ];
      patchedCount++;
    } else {
      baseColorFactor = DEFAULT;
    }
    gltfMesh.primitives.forEach(prim => {
      prim.material = gltf.materials.push({
        pbrMetallicRoughness: { baseColorFactor, metallicFactor: 0.0, roughnessFactor: 0.8 },
        doubleSided: true
      }) - 1;
    });
  });

  // Reensamblar binario GLB
  const newJson    = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPadded = Math.ceil(newJson.length / 4) * 4;
  const binPadded  = Math.ceil(binLength / 4) * 4;
  const hasBin     = binLength > 0;
  const total      = 12 + 8 + jsonPadded + (hasBin ? 8 + binPadded : 0);

  const out      = new ArrayBuffer(total);
  const outView  = new DataView(out);
  const outBytes = new Uint8Array(out);
  let off = 0;

  outView.setUint32(off, 0x46546C67, true); off += 4;
  outView.setUint32(off, 2,           true); off += 4;
  outView.setUint32(off, total,       true); off += 4;

  outView.setUint32(off, jsonPadded,  true); off += 4;
  outView.setUint32(off, 0x4E4F534A, true); off += 4;
  outBytes.set(newJson, off); off += newJson.length;
  outBytes.fill(0x20, off, off + (jsonPadded - newJson.length)); off += jsonPadded - newJson.length;

  if (hasBin) {
    outView.setUint32(off, binPadded,  true); off += 4;
    outView.setUint32(off, 0x004E4942,true); off += 4;
    outBytes.set(binData, off); off += binLength;
    outBytes.fill(0x00, off, off + (binPadded - binLength));
  }

  console.log(`GLB parcheado: ${total.toLocaleString()} bytes, ${patchedCount} materiales con color personalizado`);
  return out;
}

// ── Exportar GLB solo local ──
export async function doExportGLBLocal(filename) {
  if (!_glbModel)       { alert('No hay modelo cargado.');              return; }
  if (!_originalGLBBuf) { alert('El buffer original no está disponible.'); return; }
  const buf = buildPatchedGLB();
  if (!buf) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
  a.download = filename.endsWith('.glb') ? filename : filename + '.glb';
  a.click();
  _showToast('✅ GLB descargado localmente');
}

// ── Exportar GLB → GitHub + descarga local ──
export async function doExportGLB(filename) {
  if (!_glbModel)       { alert('No hay modelo cargado.');              return; }
  if (!_originalGLBBuf) { alert('El buffer original no está disponible.'); return; }

  const buf = buildPatchedGLB();
  if (!buf) return;

  _showToast('Subiendo a GitHub…');
  try {
    await uploadToGitHub(buf, filename);
    _showToast(`✅ Guardado en GitHub: ${filename}.glb`);
  } catch (e) {
    _showToast(`⚠️ GitHub falló: ${e.message}. Descargando localmente…`, 5000);
  }

  // Descarga local siempre
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
  a.download = filename.endsWith('.glb') ? filename : filename + '.glb';
  a.click();
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
