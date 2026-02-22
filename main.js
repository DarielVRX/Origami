import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }    from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js?module';

// ─────────────────────────────────────────────────────────────
// GITHUB CONFIG  ← reemplaza si regeneras el token
// ─────────────────────────────────────────────────────────────
const GH_TOKEN  = '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';
const GH_REPO   = 'darielvrx/Origami';
const GH_BRANCH = 'main';

// ─────────────────────────────────────────────────────────────
// ESCENA / CÁMARA / RENDERER
// ─────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 22, 80);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─────────────────────────────────────────────────────────────
// CONTROLES
// ─────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.NONE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.NONE };
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

// ─────────────────────────────────────────────────────────────
// LUCES
// ─────────────────────────────────────────────────────────────
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404040));
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
scene.add(new THREE.AxesHelper(5));

// ─────────────────────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────────────────────
const baseMaterial = new THREE.MeshStandardMaterial({
  color: 0xaaaaaa,
  roughness: 0.8,
  metalness: 0.0,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 0
});

let glbModel         = null;
let originalGLBBuffer = null;  // ArrayBuffer crudo del GLB original — clave para el export
let meshColorMap      = new Map(); // mesh.uuid → color hex string pintado por el usuario
let lastHovered      = null;
let lastClicked      = null;
let isDrawing        = false;
let currentColor     = '#ff0000';
let brushSize        = 1;
let cameraLocked     = false;
let eyedropperActive = false;

const loader    = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

// ─────────────────────────────────────────────────────────────
// RADIO DE PINCEL EN PÍXELES (proyección perspectiva correcta)
// ─────────────────────────────────────────────────────────────
function brushRadiusPx() {
  const dist = camera.position.distanceTo(controls.target);
  const fovRad = camera.fov * Math.PI / 180;
  const unitsPerPx = (2 * dist * Math.tan(fovRad / 2)) / window.innerHeight;
  return brushSize / unitsPerPx;
}

// ─────────────────────────────────────────────────────────────
// SETUP DE MODELO
// Asigna materiales independientes a cada mesh y registra uuid→mesh
// para poder rastrear colores sin perder la geometría original
// ─────────────────────────────────────────────────────────────
const uuidToMesh = new Map(); // uuid → THREE.Mesh (para exportar colores)

function setupModel(model) {
  model.scale.set(0.5, 0.5, 0.5);
  model.position.set(0, 0, 0);
  uuidToMesh.clear();
  meshColorMap.clear();

  model.traverse(child => {
    if (!child.isMesh) return;
    child.material = baseMaterial.clone();
    child.geometry.computeBoundingSphere();
    if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
    uuidToMesh.set(child.uuid, child);
  });

  scene.add(model);
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  controls.target.copy(center);
  controls.update();
}

// ─────────────────────────────────────────────────────────────
// CARGA DE GLB
// Guarda el ArrayBuffer original para el export posterior
// ─────────────────────────────────────────────────────────────
function loadGLBFromBuffer(buffer, isFile = false) {
  // Validar magic bytes ANTES de cualquier operación
  if (buffer.byteLength < 12) {
    console.error(`GLB demasiado pequeño: ${buffer.byteLength} bytes`);
    return;
  }
  const magic = new DataView(buffer).getUint32(0, true);
  if (magic !== 0x46546C67) {
    console.error(`Magic inválido: 0x${magic.toString(16)} (esperado 0x46546c67). Tamaño: ${buffer.byteLength} bytes`);
    showToast('⚠️ El archivo no es un GLB válido.');
    return;
  }

  // Guardar copia ANTES de pasarlo al loader (parse() puede transferir/consumir el buffer)
  originalGLBBuffer = buffer.slice(0);

  loader.parse(originalGLBBuffer.slice(0), '', gltf => {
    if (glbModel) scene.remove(glbModel);
    glbModel = gltf.scene;
    lastHovered = lastClicked = null;
    setupModel(glbModel);
    console.log(`GLB cargado: ${buffer.byteLength.toLocaleString()} bytes`);
  }, err => {
    console.error('Error parseando GLB:', err);
    showToast('⚠️ Error al parsear el GLB.');
  });
}

function loadGLBFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => loadGLBFromBuffer(e.target.result, true);
  reader.onerror = () => showToast('⚠️ Error leyendo el archivo.');
  reader.readAsArrayBuffer(file);
}

// Carga automática — usa GLTFLoader.load() en vez de fetch+parse
// para que Three.js maneje correctamente la decodificación y el path base
loader.load(
  'ModeloGLB.glb',
  gltf => {
    if (glbModel) scene.remove(glbModel);
    glbModel = gltf.scene;
    lastHovered = lastClicked = null;
    setupModel(glbModel);
    // Re-fetch para obtener el ArrayBuffer crudo (necesario para el export)
    fetch('ModeloGLB.glb')
      .then(r => r.arrayBuffer())
      .then(buf => {
        const magic = new DataView(buf).getUint32(0, true);
        if (magic !== 0x46546C67) throw new Error(`Magic inválido: 0x${magic.toString(16)}`);
        originalGLBBuffer = buf;
        console.log(`Buffer listo para export: ${buf.byteLength.toLocaleString()} bytes`);
      })
      .catch(err => {
        console.warn('No se pudo guardar buffer para export:', err.message);
        showToast('Modelo cargado, pero export deshabilitado (buffer no disponible).');
      });
  },
  undefined,
  err => {
    console.warn('ModeloGLB.glb no encontrado, carga manual requerida.', err);
  }
);

// ─────────────────────────────────────────────────────────────
// EXPORTAR GLB  — ESTRATEGIA CORRECTA
//
// El GLTFExporter de Three.js omite geometrías cuando los materiales
// son clones sin texturas (produce archivos ~1KB vacíos).
//
// Solución: tomar el GLB original (que tiene toda la geometría intacta),
// parsearlo como JSON/binario GLTF, y parchear directamente los colores
// de los materiales en el buffer antes de descargarlo/subirlo.
//
// El formato GLB es:
//   [12B header][8B JSON chunk header][JSON bytes][8B BIN chunk header][BIN bytes]
// El JSON contiene los materiales con pbrMetallicRoughness.baseColorFactor.
// ─────────────────────────────────────────────────────────────
function buildPatchedGLB() {
  if (!originalGLBBuffer) { showToast('⚠️ Buffer no disponible. Recarga la página.'); return null; }

  const buf  = originalGLBBuffer.slice(0);
  const view = new DataView(buf);

  // ── Leer y validar cabecera GLB (12 bytes) ──
  // Offset 0: magic 'glTF' = 0x46546C67
  // Offset 4: version (debe ser 2)
  // Offset 8: total file length
  const magic      = view.getUint32(0, true);
  const glbVersion = view.getUint32(4, true);
  const glbLength  = view.getUint32(8, true);

  if (magic !== 0x46546C67) {
    showToast(`⚠️ Buffer inválido (magic: 0x${magic.toString(16)})`);
    return null;
  }
  console.log(`GLB: v${glbVersion}, ${glbLength} bytes declarados, ${buf.byteLength} bytes reales`);

  // ── Leer chunk 0: JSON ──
  // Offset 12: chunk 0 length
  // Offset 16: chunk 0 type (0x4E4F534A = 'JSON')
  // Offset 20: chunk 0 data
  const jsonChunkLen  = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  if (jsonChunkType !== 0x4E4F534A) {
    showToast('⚠️ El primer chunk no es JSON.');
    return null;
  }
  const jsonDataStart = 20;
  const jsonDataEnd   = jsonDataStart + jsonChunkLen;
  if (jsonDataEnd > buf.byteLength) {
    showToast(`⚠️ JSON chunk desborda el buffer (${jsonDataEnd} > ${buf.byteLength})`);
    return null;
  }

  const jsonBytes = new Uint8Array(buf, jsonDataStart, jsonChunkLen);
  const gltf      = JSON.parse(new TextDecoder().decode(jsonBytes));

  // ── Leer chunk 1: BIN (opcional) ──
  const binChunkOffset = jsonDataEnd; // inmediatamente después del chunk JSON
  let binLength = 0;
  let binData   = new Uint8Array(0);
  if (binChunkOffset + 8 <= buf.byteLength) {
    binLength = view.getUint32(binChunkOffset, true);
    // type = 0x004E4942 ('BIN')
    const binDataStart = binChunkOffset + 8;
    if (binDataStart + binLength <= buf.byteLength) {
      binData = new Uint8Array(buf, binDataStart, binLength);
    } else {
      console.warn(`BIN chunk truncado: ${binDataStart + binLength} > ${buf.byteLength}`);
      binLength = buf.byteLength - binDataStart;
      binData   = new Uint8Array(buf, binDataStart, binLength);
    }
  }

  // ── Construir materiales desde cero ──
  // El GLB original no tiene materiales (solo geometría pura).
  // Creamos un material por mesh: color pintado si existe, gris base si no.
  // Cada primitiva recibe su propio índice de material para independencia total.

  // Recopilar meshes GLTF en orden DFS (igual que Three.js traverse)
  const meshNodes = [];
  if (gltf.nodes && gltf.scenes) {
    const visitNode = idx => {
      const node = gltf.nodes[idx];
      if (!node) return;
      if (node.mesh !== undefined) meshNodes.push(node.mesh);
      if (node.children) node.children.forEach(visitNode);
    };
    const rootScene = gltf.scenes[gltf.scene ?? 0];
    (rootScene?.nodes ?? []).forEach(visitNode);
  }

  const threeMeshes = [];
  if (glbModel) glbModel.traverse(c => { if (c.isMesh) threeMeshes.push(c); });

  // Inicializar array de materiales vacío
  gltf.materials = [];

  const DEFAULT = [0.6, 0.6, 0.6, 1.0]; // gris base en linear space

  let patchedCount = 0;

  meshNodes.forEach((meshIdx, i) => {
    const gltfMesh = gltf.meshes?.[meshIdx];
    if (!gltfMesh) return;

    const threeMesh = threeMeshes[i];
    const hex = threeMesh ? meshColorMap.get(threeMesh.uuid) : undefined;

    let baseColorFactor;
    if (hex) {
      const c = new THREE.Color(hex);
      // sRGB → linear (gamma 2.2)
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

    // Crear un material nuevo por cada primitiva de este mesh
    gltfMesh.primitives.forEach(prim => {
      const matIdx = gltf.materials.push({
        pbrMetallicRoughness: {
          baseColorFactor,
          metallicFactor:  0.0,
          roughnessFactor: 0.8
        },
        doubleSided: true
      }) - 1;
      prim.material = matIdx;
    });
  });

  // ── Reensamblar GLB ──
  const newJsonEncoded = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPadded     = Math.ceil(newJsonEncoded.length / 4) * 4;
  const jsonPad        = jsonPadded - newJsonEncoded.length;
  const binPadded      = Math.ceil(binLength / 4) * 4;
  const binPad         = binPadded - binLength;
  const hasBin         = binLength > 0;

  const totalLength = 12 + 8 + jsonPadded + (hasBin ? 8 + binPadded : 0);
  const out      = new ArrayBuffer(totalLength);
  const outView  = new DataView(out);
  const outBytes = new Uint8Array(out);
  let off = 0;

  // Header
  outView.setUint32(off, 0x46546C67, true); off += 4; // 'glTF'
  outView.setUint32(off, 2,           true); off += 4; // version
  outView.setUint32(off, totalLength, true); off += 4;

  // Chunk JSON
  outView.setUint32(off, jsonPadded,   true); off += 4;
  outView.setUint32(off, 0x4E4F534A,  true); off += 4; // 'JSON'
  outBytes.set(newJsonEncoded, off);          off += newJsonEncoded.length;
  outBytes.fill(0x20, off, off + jsonPad);    off += jsonPad; // pad con espacios

  // Chunk BIN
  if (hasBin) {
    outView.setUint32(off, binPadded,   true); off += 4;
    outView.setUint32(off, 0x004E4942, true); off += 4; // 'BIN'
    outBytes.set(binData, off);                off += binLength;
    outBytes.fill(0x00, off, off + binPad);    off += binPad;
  }

  console.log(`GLB parcheado: ${totalLength.toLocaleString()} bytes, ${patchedMats.size} materiales modificados`);
  return out;
}

// ─────────────────────────────────────────────────────────────
// SUBIR A GITHUB
// ─────────────────────────────────────────────────────────────
async function uploadToGitHub(arrayBuffer, filename) {
  const path = filename.endsWith('.glb') ? filename : filename + '.glb';
  const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/${path}`;

  // Convertir ArrayBuffer → base64
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64Content = btoa(binary);

  // Verificar si el archivo ya existe (para obtener su sha y poder sobreescribir)
  let sha = undefined;
  try {
    const check = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (check.ok) {
      const data = await check.json();
      sha = data.sha;
    }
  } catch (_) {}

  const body = {
    message: `Actualizar ${path}`,
    content: base64Content,
    branch: GH_BRANCH,
    ...(sha ? { sha } : {})
  };

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return await res.json();
}

// ─────────────────────────────────────────────────────────────
// EXPORTAR GLB: parchear + subir a GitHub + descarga local
// ─────────────────────────────────────────────────────────────
async function doExportGLB(filename) {
  if (!glbModel)          return alert('No hay modelo cargado.');
  if (!originalGLBBuffer) return alert('El buffer original no está disponible.');

  const patchedBuffer = buildPatchedGLB();
  if (!patchedBuffer) return;

  showToast('Subiendo a GitHub…');

  try {
    await uploadToGitHub(patchedBuffer, filename);
    showToast(`✅ Guardado en GitHub: ${filename}.glb`);
  } catch (e) {
    showToast(`⚠️ GitHub falló: ${e.message}. Descargando localmente…`, 5000);
  }

  // Descarga local siempre (independiente del resultado de GitHub)
  const blob = new Blob([patchedBuffer], { type: 'model/gltf-binary' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.glb') ? filename : filename + '.glb';
  a.click();
}

// ─────────────────────────────────────────────────────────────
// EXPORTAR IMAGEN 2×2
// ─────────────────────────────────────────────────────────────
function doExportImage(filename) {
  if (!glbModel) return alert('No hay modelo cargado.');

  const views = [
    new THREE.Vector3(0, 22,  70),
    new THREE.Vector3(0, 22, -70),
    new THREE.Vector3( 70, 22, 0),
    new THREE.Vector3(-70, 22, 0)
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
    return {
      src: renderer.domElement.toDataURL(),
      x: (i % 2) * (SIZE + GAP),
      y: Math.floor(i / 2) * (SIZE + GAP)
    };
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

// ─────────────────────────────────────────────────────────────
// TOAST DE NOTIFICACIÓN
// ─────────────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:rgba(20,20,20,0.95);color:#fff;padding:12px 20px;
    border-radius:8px;font-family:'Courier New',monospace;font-size:13px;
    z-index:9999;border:1px solid rgba(255,255,255,0.15);
    backdrop-filter:blur(8px);max-width:90vw;text-align:center;
    animation:fadeInUp 0.2s ease;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ─────────────────────────────────────────────────────────────
// MODAL DE NOMBRE DE ARCHIVO
// ─────────────────────────────────────────────────────────────
function askFilename(defaultName, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9000;
    display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);
  `;
  const box = document.createElement('div');
  box.style.cssText = `
    background:#1a1a1a;border:1px solid rgba(255,255,255,0.15);border-radius:12px;
    padding:28px 24px;min-width:300px;font-family:'Courier New',monospace;color:#eee;
    display:flex;flex-direction:column;gap:14px;
  `;
  const title = document.createElement('div');
  title.textContent = 'Nombre del archivo';
  title.style.cssText = 'font-size:13px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.45);';

  const input = document.createElement('input');
  input.type = 'text'; input.value = defaultName;
  input.style.cssText = `
    background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.2);
    border-radius:6px;padding:10px 12px;color:#fff;font-size:15px;
    font-family:'Courier New',monospace;outline:none;width:100%;
  `;
  input.addEventListener('focus', () => input.select());

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;';

  const cancel  = makeDialogBtn('Cancelar', 'rgba(255,255,255,0.06)', '#aaa', 'rgba(255,255,255,0.12)');
  const confirm = makeDialogBtn('Guardar',  'rgba(80,200,120,0.18)', '#6fdc9a', 'rgba(80,200,120,0.35)');

  const close = () => document.body.removeChild(overlay);
  cancel.addEventListener('click', close);
  confirm.addEventListener('click', () => { close(); onConfirm(input.value.trim() || defaultName); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirm.click();
    if (e.key === 'Escape') cancel.click();
  });

  row.append(cancel, confirm);
  box.append(title, input, row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
}

function makeDialogBtn(text, bg, color, hoverBg) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
    flex:1;padding:10px;background:${bg};border:1px solid ${color}44;
    border-radius:6px;color:${color};cursor:pointer;
    font-family:'Courier New',monospace;font-size:13px;transition:background 0.15s;
  `;
  btn.addEventListener('mouseenter', () => btn.style.background = hoverBg);
  btn.addEventListener('mouseleave', () => btn.style.background = bg);
  return btn;
}

// ─────────────────────────────────────────────────────────────
// PINTURA
// ─────────────────────────────────────────────────────────────
function paintAt(hitPoint) {
  const maxDist = camera.position.distanceTo(controls.target);
  if (hitPoint.distanceTo(camera.position) > maxDist) return;

  glbModel.traverse(child => {
    if (!child.isMesh) return;

    if (brushSize <= 1) {
      if (child !== lastHovered) return;
      child.material.color.set(currentColor);
      meshColorMap.set(child.uuid, currentColor);
      return;
    }

    const pos = child.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      if (v.distanceTo(hitPoint) <= brushSize) {
        child.material.color.set(currentColor);
        meshColorMap.set(child.uuid, currentColor);
        break;
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// HOVER
// ─────────────────────────────────────────────────────────────
function updateHover(intersects) {
  if (lastHovered && lastHovered !== lastClicked)
    lastHovered.material.emissiveIntensity = 0;
  if (!intersects.length) { lastHovered = null; return; }

  const hitPoint = intersects[0].point;
  lastHovered = intersects[0].object;

  glbModel.traverse(child => {
    if (!child.isMesh || child === lastClicked) return;
    let near = child === lastHovered;
    if (!near && brushSize > 1) {
      const pos = child.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
        if (v.distanceTo(hitPoint) <= brushSize) { near = true; break; }
      }
    }
    child.material.emissiveIntensity = near ? 0.08 : 0;
  });

  if (isDrawing && !eyedropperActive) paintAt(hitPoint);
}

// ─────────────────────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────────────────────
function getIntersects(clientX, clientY) {
  mouse.x =  (clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  raycaster.far = camera.position.distanceTo(controls.target) * 1.05;
  return glbModel ? raycaster.intersectObjects(glbModel.children, true) : [];
}

renderer.domElement.addEventListener('mousemove', e => {
  const rpx = brushRadiusPx();
  const d = Math.max(10, rpx * 2);
  brushCircle.style.width  = d + 'px';
  brushCircle.style.height = d + 'px';
  brushCircle.style.left   = (e.clientX - d / 2) + 'px';
  brushCircle.style.top    = (e.clientY - d / 2) + 'px';
  brushCircle.style.opacity = '1';
  if (glbModel) updateHover(getIntersects(e.clientX, e.clientY));
});

renderer.domElement.addEventListener('mouseleave', () => {
  brushCircle.style.opacity = '0';
});

renderer.domElement.addEventListener('mousedown', e => {
  if (e.button !== 0 || !glbModel) return;
  const its = getIntersects(e.clientX, e.clientY);

  if (its.length) {
    const obj = its[0].object;
    if (eyedropperActive) {
      currentColor = '#' + obj.material.color.getHexString();
      currentColorBtn.style.background = currentColor;
      setEyedropper(false);
      return;
    }
    if (lastClicked && lastClicked !== obj) lastClicked.material.emissiveIntensity = 0;
    lastClicked = obj;
    obj.material.emissiveIntensity = 0.1;
  }

  isDrawing = true;
  if (its.length && !eyedropperActive) paintAt(its[0].point);
});

renderer.domElement.addEventListener('mouseup',     () => { isDrawing = false; });
renderer.domElement.addEventListener('contextmenu', e  => e.preventDefault());

// Touch
let touchPainting = false;
renderer.domElement.addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || !glbModel) return;
  touchPainting = true; isDrawing = true;
  const t = e.touches[0];
  const its = getIntersects(t.clientX, t.clientY);
  if (its.length && !eyedropperActive) paintAt(its[0].point);
}, { passive: true });

renderer.domElement.addEventListener('touchmove', e => {
  if (!touchPainting || e.touches.length !== 1 || !glbModel) return;
  const t = e.touches[0];
  updateHover(getIntersects(t.clientX, t.clientY));
}, { passive: true });

renderer.domElement.addEventListener('touchend', () => { touchPainting = false; isDrawing = false; });

// ─────────────────────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
@keyframes fadeInUp {
  from { opacity:0; transform:translateX(-50%) translateY(10px); }
  to   { opacity:1; transform:translateX(-50%) translateY(0); }
}
* { box-sizing:border-box; margin:0; padding:0; }

.top-btn {
  position:fixed; top:12px; z-index:2000;
  width:44px; height:44px;
  background:rgba(20,20,20,0.85); border:1px solid rgba(255,255,255,0.15);
  border-radius:8px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  backdrop-filter:blur(6px); transition:background 0.2s;
  color:#fff; font-size:18px; user-select:none;
}
.top-btn:hover { background:rgba(40,40,40,0.95); }

#hamburger-btn { left:12px; flex-direction:column; gap:5px; }
#hamburger-btn span {
  display:block; width:20px; height:2px;
  background:#fff; border-radius:2px;
  transition:transform 0.25s, opacity 0.25s;
}
#hamburger-btn.open span:nth-child(1) { transform:translateY(7px) rotate(45deg); }
#hamburger-btn.open span:nth-child(2) { opacity:0; }
#hamburger-btn.open span:nth-child(3) { transform:translateY(-7px) rotate(-45deg); }

#brush-toggle-btn { left:66px; }

#side-menu {
  position:fixed; top:0; left:0; width:240px; height:100vh;
  background:rgba(18,18,18,0.96); backdrop-filter:blur(12px);
  z-index:1900; display:flex; flex-direction:column;
  padding:70px 16px 24px; gap:10px;
  transform:translateX(-100%);
  transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
  border-right:1px solid rgba(255,255,255,0.08);
  overflow-y:auto;
}
#side-menu.open { transform:translateX(0); }

.menu-label {
  font-family:'Courier New',monospace; font-size:10px;
  letter-spacing:2px; text-transform:uppercase;
  color:rgba(255,255,255,0.35); margin:8px 0 2px; padding-left:4px;
}
.menu-btn {
  width:100%; padding:10px 14px;
  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
  border-radius:6px; color:#e8e8e8;
  font-family:'Courier New',monospace; font-size:13px;
  cursor:pointer; text-align:left;
  transition:background 0.15s, border-color 0.15s;
  display:flex; align-items:center; gap:10px;
}
.menu-btn:hover  { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.25); }
.menu-btn.active { background:rgba(255,80,80,0.2); border-color:rgba(255,80,80,0.5); color:#ff6b6b; }
#load-glb-input { display:none; }
label.menu-btn  { user-select:none; }

#brush-panel {
  position:fixed; top:66px; left:12px; z-index:1800;
  background:rgba(18,18,18,0.92); border:1px solid rgba(255,255,255,0.1);
  border-radius:10px; padding:14px 18px;
  display:none; flex-direction:column; gap:10px;
  backdrop-filter:blur(8px); min-width:220px;
}
#brush-panel.visible { display:flex; }
#brush-panel label {
  font-family:'Courier New',monospace; font-size:11px;
  letter-spacing:1px; color:rgba(255,255,255,0.5); text-transform:uppercase;
}
#brush-panel input[type=range] { width:100%; accent-color:#ff4444; }
#brush-size-display {
  font-family:'Courier New',monospace; font-size:12px;
  color:rgba(255,255,255,0.55); text-align:right;
}

#brush-circle {
  position:fixed; border:2px solid rgba(255,60,60,0.85); border-radius:50%;
  pointer-events:none; opacity:0; transition:opacity 0.2s;
}

#palette-wrapper {
  position:fixed; bottom:14px; right:14px; z-index:1000;
  display:flex; flex-direction:column; align-items:flex-end; gap:6px;
}
#current-color-btn {
  width:44px; height:44px; border-radius:8px;
  border:2px solid rgba(255,255,255,0.3); cursor:pointer;
  box-shadow:0 2px 12px rgba(0,0,0,0.4); transition:transform 0.15s;
}
#current-color-btn:hover { transform:scale(1.08); }

#palette-div {
  display:none; background:rgba(18,18,18,0.95);
  border:1px solid rgba(255,255,255,0.1); border-radius:10px;
  padding:10px; grid-template-columns:repeat(6,1fr); gap:5px;
  max-height:60vh; overflow-y:auto; backdrop-filter:blur(10px);
}
#palette-div.visible { display:grid; }

#eyedropper-btn {
  grid-column:span 6; padding:8px;
  background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
  border-radius:6px; color:#ccc;
  font-family:'Courier New',monospace; font-size:12px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  gap:6px; letter-spacing:1px; text-transform:uppercase;
  transition:background 0.15s, border-color 0.15s, color 0.15s;
}
#eyedropper-btn:hover  { background:rgba(255,220,80,0.15); border-color:rgba(255,220,80,0.4); color:#ffd84f; }
#eyedropper-btn.active { background:rgba(255,220,80,0.25); border-color:#ffd84f; color:#ffd84f; }

.color-swatch {
  width:26px; height:26px; border-radius:5px; cursor:pointer;
  border:1px solid rgba(255,255,255,0.05);
  transition:transform 0.1s, outline 0.1s;
}
.color-swatch:hover { transform:scale(1.2); outline:2px solid #ffd84f; }

body.eyedropper-cursor * { cursor:crosshair !important; }

/* Movil — clases aplicadas via JS con deteccion de touch */
body.is-touch .top-btn {
  width:80px !important; height:80px !important; font-size:32px !important;
  top:16px !important; border-radius:14px !important;
}
body.is-touch #hamburger-btn { left:16px !important; }
body.is-touch #hamburger-btn span { width:34px !important; height:3px !important; }
body.is-touch #brush-toggle-btn { left:112px !important; }
body.is-touch #side-menu { width:300px !important; padding:110px 20px 30px !important; }
body.is-touch .menu-btn { padding:20px 18px !important; font-size:18px !important; min-height:64px !important; }
body.is-touch .menu-label { font-size:13px !important; margin-top:12px !important; }
body.is-touch #brush-panel { top:112px !important; left:16px !important; min-width:280px !important; padding:20px 24px !important; }
body.is-touch #brush-panel label { font-size:14px !important; }
body.is-touch #brush-panel input[type=range] { height:32px !important; }
body.is-touch #brush-size-display { font-size:15px !important; }
body.is-touch #current-color-btn { width:80px !important; height:80px !important; border-radius:14px !important; }
body.is-touch .color-swatch { width:42px !important; height:42px !important; border-radius:8px !important; }
body.is-touch #palette-div { gap:8px !important; padding:14px !important; }
body.is-touch #eyedropper-btn { padding:14px !important; font-size:15px !important; }
</style>`);

// ─────────────────────────────────────────────────────────────
// UI CONSTRUCTION
// ─────────────────────────────────────────────────────────────

// Hamburger
const hamburgerBtn = document.createElement('div');
hamburgerBtn.id = 'hamburger-btn'; hamburgerBtn.className = 'top-btn';
hamburgerBtn.innerHTML = '<span></span><span></span><span></span>';
document.body.appendChild(hamburgerBtn);

const sideMenu = document.createElement('div');
sideMenu.id = 'side-menu';
document.body.appendChild(sideMenu);

const closeMenu = () => { sideMenu.classList.remove('open'); hamburgerBtn.classList.remove('open'); };
hamburgerBtn.addEventListener('click', () => { hamburgerBtn.classList.toggle('open'); sideMenu.classList.toggle('open'); });
document.addEventListener('click', e => {
  if (sideMenu.classList.contains('open') && !sideMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) closeMenu();
});

function addLabel(text) {
  const el = document.createElement('div');
  el.className = 'menu-label'; el.textContent = text;
  sideMenu.appendChild(el);
}
function addBtn(icon, label, cb) {
  const btn = document.createElement('button');
  btn.className = 'menu-btn';
  btn.innerHTML = `<span>${icon}</span>${label}`;
  btn.addEventListener('click', () => cb(btn));
  sideMenu.appendChild(btn);
  return btn;
}

// Archivo
addLabel('Archivo');
const loadInput = document.createElement('input');
loadInput.type = 'file'; loadInput.accept = '.glb'; loadInput.id = 'load-glb-input';
sideMenu.appendChild(loadInput);
const loadLabel = document.createElement('label');
loadLabel.htmlFor = 'load-glb-input'; loadLabel.className = 'menu-btn';
loadLabel.innerHTML = '<span>📂</span>Cargar';
sideMenu.appendChild(loadLabel);
loadInput.addEventListener('change', e => { if (e.target.files.length) loadGLBFromFile(e.target.files[0]); closeMenu(); });

// Exportar
addLabel('Exportar');
addBtn('🖼', 'Exportar Imagen 2×2', () => { closeMenu(); askFilename('collage_2x2', doExportImage); });
addBtn('📦', 'Exportar GLB → GitHub', () => { closeMenu(); askFilename('ModeloGLB', name => doExportGLB(name)); });

// Cámara
addLabel('Cámara');
addBtn('🔓', 'Bloquear Cámara', btn => {
  cameraLocked = !cameraLocked;
  controls.enableRotate = !cameraLocked;
  btn.innerHTML = `<span>${cameraLocked ? '🔒' : '🔓'}</span>${cameraLocked ? 'Desbloquear Cámara' : 'Bloquear Cámara'}`;
  btn.classList.toggle('active', cameraLocked);
});

// Pincel
const brushToggleBtn = document.createElement('div');
brushToggleBtn.id = 'brush-toggle-btn'; brushToggleBtn.className = 'top-btn';
brushToggleBtn.title = 'Tamaño de pincel'; brushToggleBtn.textContent = '✏️';
document.body.appendChild(brushToggleBtn);

const brushPanel = document.createElement('div');
brushPanel.id = 'brush-panel'; document.body.appendChild(brushPanel);

const brushLabel = document.createElement('label'); brushLabel.textContent = 'Tamaño de pincel';
const brushSlider = document.createElement('input');
brushSlider.type = 'range'; brushSlider.min = '1'; brushSlider.max = '10'; brushSlider.value = '1';
const brushSizeDisplay = document.createElement('div');
brushSizeDisplay.id = 'brush-size-display'; brushSizeDisplay.textContent = 'Tamaño: 1';
brushPanel.append(brushLabel, brushSlider, brushSizeDisplay);

const brushCircle = document.createElement('div');
brushCircle.id = 'brush-circle'; document.body.appendChild(brushCircle);

brushToggleBtn.addEventListener('click', () => brushPanel.classList.toggle('visible'));
brushSlider.addEventListener('input', () => {
  brushSize = parseFloat(brushSlider.value);
  brushSizeDisplay.textContent = `Tamaño: ${brushSize}`;
});
// Cerrar panel al soltar el slider
brushSlider.addEventListener('change', () => {
  brushPanel.classList.remove('visible');
});

// Paleta
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(Math.min(k(n)-3, 9-k(n), 1), -1))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}

const paletteWrapper = document.createElement('div'); paletteWrapper.id = 'palette-wrapper';
document.body.appendChild(paletteWrapper);

const currentColorBtn = document.createElement('div');
currentColorBtn.id = 'current-color-btn'; currentColorBtn.style.background = currentColor;
currentColorBtn.title = 'Abrir paleta'; paletteWrapper.appendChild(currentColorBtn);

const paletteDiv = document.createElement('div'); paletteDiv.id = 'palette-div';
paletteWrapper.appendChild(paletteDiv);
currentColorBtn.addEventListener('click', () => paletteDiv.classList.toggle('visible'));

const eyedropperBtn = document.createElement('button');
eyedropperBtn.id = 'eyedropper-btn'; eyedropperBtn.innerHTML = '💉 Gotero';
paletteDiv.appendChild(eyedropperBtn);

function setEyedropper(active) {
  eyedropperActive = active;
  eyedropperBtn.classList.toggle('active', active);
  document.body.classList.toggle('eyedropper-cursor', active);
}
eyedropperBtn.addEventListener('click', () => {
  setEyedropper(!eyedropperActive);
  if (eyedropperActive) paletteDiv.classList.remove('visible');
});

['#000000','#888888','#ffffff',
  ...Array.from({ length: 97 }, (_, i) => hslToHex((i/97)*360, 80, 50))
].forEach(color => {
  const sw = document.createElement('div');
  sw.className = 'color-swatch'; sw.style.background = color; sw.title = color;
  sw.addEventListener('click', () => {
    currentColor = color; currentColorBtn.style.background = color;
    paletteDiv.classList.remove('visible');
  });
  paletteDiv.appendChild(sw);
});

// ─────────────────────────────────────────────────────────────
// DETECCIÓN DE TOUCH — aplica clase is-touch al body
// Se activa en el primer evento touch y permanece para toda la sesión
// ─────────────────────────────────────────────────────────────
function enableTouchMode() {
  document.body.classList.add('is-touch');
  window.removeEventListener('touchstart', enableTouchMode);
}
window.addEventListener('touchstart', enableTouchMode, { once: true });

// ─────────────────────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────────────────────
(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();
