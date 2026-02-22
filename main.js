import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }   from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js?module';
import { GLTFExporter }  from 'https://unpkg.com/three@0.163.0/examples/jsm/exporters/GLTFExporter.js?module';

// ─────────────────────────────────────────────
// ESCENA / CÁMARA / RENDERER
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// CONTROLES
// ─────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.NONE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.NONE };

// Soporte táctil: un dedo rota
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

// ─────────────────────────────────────────────
// LUCES
// ─────────────────────────────────────────────
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404040));
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
scene.add(new THREE.AxesHelper(5));

// ─────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────
const baseMaterial = new THREE.MeshStandardMaterial({
  color: 0xaaaaaa,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 0
});

let glbModel         = null;
let lastHovered      = null;
let lastClicked      = null;
let isDrawing        = false;
let currentColor     = '#ff0000';
let brushSize        = 1;       // unidades 3D
let cameraLocked     = false;
let eyedropperActive = false;

const loader    = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

// ─────────────────────────────────────────────
// UTILIDAD: radio de pincel en píxeles de pantalla
// Proyecta brushSize (unidades 3D) al plano de pantalla
// según la distancia cámara→centro de escena.
// ─────────────────────────────────────────────
function brushRadiusPx() {
  const dist = camera.position.distanceTo(controls.target);
  // Factor: cómo de grande se ve 1 unidad 3D en píxeles a esa distancia
  const fovRad = camera.fov * Math.PI / 180;
  const unitsPerPx = (2 * dist * Math.tan(fovRad / 2)) / window.innerHeight;
  return (brushSize / unitsPerPx);
}

// ─────────────────────────────────────────────
// MODELO
// ─────────────────────────────────────────────
function setupModel(model) {
  model.scale.set(0.5, 0.5, 0.5);
  model.position.set(0, 0, 0);
  model.traverse(child => {
    if (!child.isMesh) return;
    // Cada mesh tiene su propio material independiente desde el inicio
    child.material = baseMaterial.clone();
    child.geometry.computeBoundingSphere();
  });
  scene.add(model);
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  controls.target.copy(center);
  controls.update();
}

function loadGLBFromFile(file) {
  const url = URL.createObjectURL(file);
  loader.load(url, gltf => {
    if (glbModel) scene.remove(glbModel);
    glbModel = gltf.scene;
    lastHovered = lastClicked = null;
    setupModel(glbModel);
  }, undefined, console.error);
}

loader.load('ModeloGLB.glb', gltf => {
  glbModel = gltf.scene;
  setupModel(glbModel);
  console.log('GLB cargado automáticamente.');
}, undefined, console.error);

// ─────────────────────────────────────────────
// EXPORTAR GLB
//
// Fix definitivo:
//   - r163: parse(input, onDone, options)  — SIN argumento onError separado
//   - binary:true → result es ArrayBuffer, NO JSON
//   - Apagar emissive antes, restaurar después
//   - Forzar needsUpdate en materiales para que el exporter los trate como únicos
// ─────────────────────────────────────────────
function doExportGLB(filename) {
  if (!glbModel) return alert('No hay modelo cargado.');

  // 1. Apagar emissive y marcar materiales como modificados
  const saved = [];
  glbModel.traverse(child => {
    if (!child.isMesh) return;
    saved.push({ mesh: child, ei: child.material.emissiveIntensity });
    child.material.emissiveIntensity = 0;
    child.material.needsUpdate = true;
  });

  // 2. parse(input, onDone, options) — r163 NO tiene onError como 3er arg
  new GLTFExporter().parse(
    glbModel,
    (buffer) => {
      // Restaurar emissive
      saved.forEach(({ mesh, ei }) => {
        mesh.material.emissiveIntensity = ei;
        mesh.material.needsUpdate = true;
      });
      // buffer es ArrayBuffer cuando binary:true
      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename.endsWith('.glb') ? filename : filename + '.glb';
      a.click();
    },
    { binary: true }   // ← 3er argumento = options (no onError)
  );
}

// ─────────────────────────────────────────────
// EXPORTAR IMAGEN 2×2
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// MODAL DE NOMBRE DE ARCHIVO
// ─────────────────────────────────────────────
function askFilename(defaultName, onConfirm) {
  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;
    display:flex;align-items:center;justify-content:center;
    backdrop-filter:blur(4px);
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background:#1a1a1a;border:1px solid rgba(255,255,255,0.15);
    border-radius:12px;padding:28px 24px;min-width:300px;
    font-family:'Courier New',monospace;color:#eee;
    display:flex;flex-direction:column;gap:14px;
  `;

  const title = document.createElement('div');
  title.textContent = 'Nombre del archivo';
  title.style.cssText = 'font-size:13px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.5);';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultName;
  input.style.cssText = `
    background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.2);
    border-radius:6px;padding:10px 12px;color:#fff;font-size:15px;
    font-family:'Courier New',monospace;outline:none;
  `;
  input.addEventListener('focus', () => input.select());

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;';

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancelar';
  cancel.style.cssText = `
    flex:1;padding:10px;background:rgba(255,255,255,0.06);
    border:1px solid rgba(255,255,255,0.12);border-radius:6px;
    color:#aaa;cursor:pointer;font-family:'Courier New',monospace;font-size:13px;
  `;

  const confirm = document.createElement('button');
  confirm.textContent = 'Guardar';
  confirm.style.cssText = `
    flex:1;padding:10px;background:rgba(80,200,120,0.2);
    border:1px solid rgba(80,200,120,0.4);border-radius:6px;
    color:#6fdc9a;cursor:pointer;font-family:'Courier New',monospace;font-size:13px;
  `;

  const close = () => document.body.removeChild(overlay);
  cancel.addEventListener('click', close);
  confirm.addEventListener('click', () => {
    const name = input.value.trim() || defaultName;
    close();
    onConfirm(name);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirm.click();
    if (e.key === 'Escape') cancel.click();
  });

  row.append(cancel, confirm);
  box.append(title, input, row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
}

// ─────────────────────────────────────────────
// PINTURA — distancia de pincel limitada a la
// distancia cámara→target para no atravesar huecos
// ─────────────────────────────────────────────
function paintAt(hitPoint) {
  // Distancia máxima de pintado = distancia actual cámara→centro
  const maxPaintDist = camera.position.distanceTo(controls.target);

  glbModel.traverse(child => {
    if (!child.isMesh) return;

    // Primero verificar que el mesh está dentro de la distancia permitida
    const meshCenter = new THREE.Vector3();
    child.getWorldPosition(meshCenter);
    // Usamos el punto de intersección como referencia, no el centro del mesh
    // Solo pintamos si el hitPoint es accesible (no está más lejos que la cámara)
    if (hitPoint.distanceTo(camera.position) > maxPaintDist) return;

    if (brushSize <= 1) {
      if (child === lastHovered) child.material.color.set(currentColor);
      return;
    }

    const pos = child.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      if (v.distanceTo(hitPoint) <= brushSize) {
        child.material.color.set(currentColor);
        break;
      }
    }
  });
}

// ─────────────────────────────────────────────
// HOVER
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// EVENTOS RATÓN / TOUCH
// ─────────────────────────────────────────────
function getIntersects(clientX, clientY) {
  mouse.x =  (clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Limitar raycaster a la distancia cámara→target para no atravesar el modelo
  raycaster.far = camera.position.distanceTo(controls.target) * 1.05;

  return glbModel ? raycaster.intersectObjects(glbModel.children, true) : [];
}

renderer.domElement.addEventListener('mousemove', e => {
  // Actualizar cursor visual con tamaño en píxeles correcto
  const rpx = brushRadiusPx();
  const diameter = Math.max(10, rpx * 2);
  brushCircle.style.width  = diameter + 'px';
  brushCircle.style.height = diameter + 'px';
  brushCircle.style.left   = (e.clientX - diameter / 2) + 'px';
  brushCircle.style.top    = (e.clientY - diameter / 2) + 'px';

  if (glbModel) updateHover(getIntersects(e.clientX, e.clientY));
});

renderer.domElement.addEventListener('mousedown', e => {
  if (e.button !== 0 || !glbModel) return;
  const intersects = getIntersects(e.clientX, e.clientY);

  if (intersects.length) {
    const obj = intersects[0].object;
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
  if (intersects.length && !eyedropperActive) paintAt(intersects[0].point);
});

renderer.domElement.addEventListener('mouseup',     () => { isDrawing = false; });
renderer.domElement.addEventListener('contextmenu', e  => e.preventDefault());

// Touch: pintar con un dedo (sin interferir con el rotate de dos dedos)
let touchPainting = false;
renderer.domElement.addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || !glbModel) return;
  touchPainting = true;
  isDrawing = true;
  const t = e.touches[0];
  const its = getIntersects(t.clientX, t.clientY);
  if (its.length && !eyedropperActive) paintAt(its[0].point);
}, { passive: true });

renderer.domElement.addEventListener('touchmove', e => {
  if (!touchPainting || e.touches.length !== 1 || !glbModel) return;
  const t = e.touches[0];
  updateHover(getIntersects(t.clientX, t.clientY));
}, { passive: true });

renderer.domElement.addEventListener('touchend', () => {
  touchPainting = false;
  isDrawing = false;
});

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Botones flotantes superiores ── */
.top-btn {
  position: fixed; top: 12px; z-index: 2000;
  width: 44px; height: 44px;
  background: rgba(20,20,20,0.85); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px); transition: background 0.2s;
  color: #fff; font-size: 18px; user-select: none;
}
.top-btn:hover { background: rgba(40,40,40,0.95); }

@media (max-width: 768px) {
  .top-btn { width: 64px; height: 64px; font-size: 26px; top: 16px; border-radius: 12px; }
  #hamburger-btn { left: 16px; }
  #hamburger-btn span { width: 28px; }
  #brush-toggle-btn { left: 92px; }
  #current-color-btn { width: 64px; height: 64px; border-radius: 12px; }
  .menu-btn { padding: 16px 18px; font-size: 16px; }
  .menu-label { font-size: 12px; }
  #side-menu { width: 290px; padding: 90px 20px 30px; }
  .color-swatch { width: 36px; height: 36px; }
  #palette-div { grid-template-columns: repeat(6,1fr); gap: 7px; padding: 14px; }
}

/* ── Hamburger ── */
#hamburger-btn { left: 12px; flex-direction: column; gap: 5px; }
#hamburger-btn span {
  display: block; width: 20px; height: 2px;
  background: #fff; border-radius: 2px;
  transition: transform 0.25s, opacity 0.25s;
}
#hamburger-btn.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
#hamburger-btn.open span:nth-child(2) { opacity: 0; }
#hamburger-btn.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* ── Brush toggle ── */
#brush-toggle-btn { left: 66px; }

/* ── Drawer ── */
#side-menu {
  position: fixed; top: 0; left: 0; width: 240px; height: 100vh;
  background: rgba(18,18,18,0.96); backdrop-filter: blur(12px);
  z-index: 1900; display: flex; flex-direction: column;
  padding: 70px 16px 24px; gap: 10px;
  transform: translateX(-100%);
  transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
  border-right: 1px solid rgba(255,255,255,0.08);
  overflow-y: auto;
}
#side-menu.open { transform: translateX(0); }

.menu-label {
  font-family: 'Courier New', monospace; font-size: 10px;
  letter-spacing: 2px; text-transform: uppercase;
  color: rgba(255,255,255,0.35); margin: 8px 0 2px; padding-left: 4px;
}
.menu-btn {
  width: 100%; padding: 10px 14px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; color: #e8e8e8;
  font-family: 'Courier New', monospace; font-size: 13px;
  cursor: pointer; text-align: left;
  transition: background 0.15s, border-color 0.15s;
  display: flex; align-items: center; gap: 10px;
}
.menu-btn:hover  { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.25); }
.menu-btn.active { background: rgba(255,80,80,0.2); border-color: rgba(255,80,80,0.5); color: #ff6b6b; }
#load-glb-input { display: none; }
label.menu-btn  { user-select: none; }

/* ── Panel pincel ── */
#brush-panel {
  position: fixed; top: 66px; left: 12px; z-index: 1800;
  background: rgba(18,18,18,0.92); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 14px 18px;
  display: none; flex-direction: column; gap: 10px;
  backdrop-filter: blur(8px); min-width: 220px;
}
#brush-panel.visible { display: flex; }
#brush-panel label {
  font-family: 'Courier New', monospace; font-size: 11px;
  letter-spacing: 1px; color: rgba(255,255,255,0.5); text-transform: uppercase;
}
#brush-panel input[type=range] { width: 100%; accent-color: #ff4444; }
#brush-size-display {
  font-family: 'Courier New', monospace; font-size: 12px;
  color: rgba(255,255,255,0.6); text-align: right;
}

@media (max-width: 768px) {
  #brush-panel { top: 96px; left: 16px; min-width: 260px; padding: 18px 22px; }
}

/* ── Cursor pincel (tamaño calculado dinámicamente en JS) ── */
#brush-circle {
  position: fixed; border: 2px solid rgba(255,60,60,0.8); border-radius: 50%;
  pointer-events: none; opacity: 0; transition: opacity 0.3s;
  transform: translate(0,0); /* will be set via left/top */
}

/* ── Paleta ── */
#palette-wrapper {
  position: fixed; bottom: 14px; right: 14px; z-index: 1000;
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
}
#current-color-btn {
  width: 44px; height: 44px; border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.3); cursor: pointer;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4); transition: transform 0.15s;
}
#current-color-btn:hover { transform: scale(1.08); }
#palette-div {
  display: none; background: rgba(18,18,18,0.95);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
  padding: 10px; grid-template-columns: repeat(6,1fr); gap: 5px;
  max-height: 60vh; overflow-y: auto; backdrop-filter: blur(10px);
}
#palette-div.visible { display: grid; }

#eyedropper-btn {
  grid-column: span 6; padding: 8px;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px; color: #ccc;
  font-family: 'Courier New', monospace; font-size: 12px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  gap: 6px; letter-spacing: 1px; text-transform: uppercase;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
#eyedropper-btn:hover  { background: rgba(255,220,80,0.15); border-color: rgba(255,220,80,0.4); color: #ffd84f; }
#eyedropper-btn.active { background: rgba(255,220,80,0.25); border-color: #ffd84f; color: #ffd84f; }

.color-swatch {
  width: 26px; height: 26px; border-radius: 5px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.05);
  transition: transform 0.1s, outline 0.1s;
}
.color-swatch:hover { transform: scale(1.2); outline: 2px solid #ffd84f; }

body.eyedropper-cursor * { cursor: crosshair !important; }
</style>`);

// ─────────────────────────────────────────────
// UI — HAMBURGER + DRAWER
// ─────────────────────────────────────────────
const hamburgerBtn = document.createElement('div');
hamburgerBtn.id = 'hamburger-btn';
hamburgerBtn.className = 'top-btn';
hamburgerBtn.innerHTML = '<span></span><span></span><span></span>';
document.body.appendChild(hamburgerBtn);

const sideMenu = document.createElement('div');
sideMenu.id = 'side-menu';
document.body.appendChild(sideMenu);

const closeMenu = () => {
  sideMenu.classList.remove('open');
  hamburgerBtn.classList.remove('open');
};
hamburgerBtn.addEventListener('click', () => {
  hamburgerBtn.classList.toggle('open');
  sideMenu.classList.toggle('open');
});
document.addEventListener('click', e => {
  if (sideMenu.classList.contains('open') && !sideMenu.contains(e.target) && !hamburgerBtn.contains(e.target))
    closeMenu();
});

function addLabel(text) {
  const el = document.createElement('div');
  el.className = 'menu-label';
  el.textContent = text;
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

// Cargar
addLabel('Archivo');
const loadInput = document.createElement('input');
loadInput.type = 'file'; loadInput.accept = '.glb'; loadInput.id = 'load-glb-input';
sideMenu.appendChild(loadInput);
const loadLabel = document.createElement('label');
loadLabel.htmlFor = 'load-glb-input';
loadLabel.className = 'menu-btn';
loadLabel.innerHTML = '<span>📂</span>Cargar';
sideMenu.appendChild(loadLabel);
loadInput.addEventListener('change', e => {
  if (e.target.files.length) loadGLBFromFile(e.target.files[0]);
  closeMenu();
});

// Exportar (con modal de nombre)
addLabel('Exportar');
addBtn('🖼', 'Exportar Imagen 2×2', () => {
  closeMenu();
  askFilename('collage_2x2', name => doExportImage(name));
});
addBtn('📦', 'Exportar GLB', () => {
  closeMenu();
  askFilename('modelo', name => doExportGLB(name));
});

// Cámara
addLabel('Cámara');
addBtn('🔓', 'Bloquear Cámara', btn => {
  cameraLocked = !cameraLocked;
  controls.enableRotate = !cameraLocked;
  btn.innerHTML = `<span>${cameraLocked ? '🔒' : '🔓'}</span>${cameraLocked ? 'Desbloquear Cámara' : 'Bloquear Cámara'}`;
  btn.classList.toggle('active', cameraLocked);
});

// ─────────────────────────────────────────────
// UI — PINCEL
// ─────────────────────────────────────────────
const brushToggleBtn = document.createElement('div');
brushToggleBtn.id = 'brush-toggle-btn';
brushToggleBtn.className = 'top-btn';
brushToggleBtn.title = 'Tamaño de pincel';
brushToggleBtn.textContent = '✏️';
document.body.appendChild(brushToggleBtn);

const brushPanel = document.createElement('div');
brushPanel.id = 'brush-panel';
document.body.appendChild(brushPanel);

const brushLabel = document.createElement('label');
brushLabel.textContent = 'Tamaño de pincel';
brushPanel.appendChild(brushLabel);

const brushSlider = document.createElement('input');
brushSlider.type = 'range'; brushSlider.min = '1'; brushSlider.max = '10'; brushSlider.value = '1';
brushPanel.appendChild(brushSlider);

const brushSizeDisplay = document.createElement('div');
brushSizeDisplay.id = 'brush-size-display';
brushSizeDisplay.textContent = 'Tamaño: 1';
brushPanel.appendChild(brushSizeDisplay);

const brushCircle = document.createElement('div');
brushCircle.id = 'brush-circle';
document.body.appendChild(brushCircle);

brushToggleBtn.addEventListener('click', () => brushPanel.classList.toggle('visible'));

brushSlider.addEventListener('input', () => {
  brushSize = parseFloat(brushSlider.value);
  brushSizeDisplay.textContent = `Tamaño: ${brushSize}`;
  // El círculo visual se actualiza en el mousemove con brushRadiusPx()
  // Solo mostrarlo brevemente al cambiar
  brushCircle.style.opacity = '1';
  clearTimeout(brushCircle._t);
  brushCircle._t = setTimeout(() => (brushCircle.style.opacity = '0'), 1500);
});

// ─────────────────────────────────────────────
// UI — PALETA
// ─────────────────────────────────────────────
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}

const paletteWrapper = document.createElement('div');
paletteWrapper.id = 'palette-wrapper';
document.body.appendChild(paletteWrapper);

const currentColorBtn = document.createElement('div');
currentColorBtn.id = 'current-color-btn';
currentColorBtn.style.background = currentColor;
currentColorBtn.title = 'Abrir paleta';
paletteWrapper.appendChild(currentColorBtn);

const paletteDiv = document.createElement('div');
paletteDiv.id = 'palette-div';
paletteWrapper.appendChild(paletteDiv);

currentColorBtn.addEventListener('click', () => paletteDiv.classList.toggle('visible'));

// Gotero
const eyedropperBtn = document.createElement('button');
eyedropperBtn.id = 'eyedropper-btn';
eyedropperBtn.innerHTML = '💉 Gotero';
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

// Swatches
['#000000', '#888888', '#ffffff',
  ...Array.from({ length: 97 }, (_, i) => hslToHex((i / 97) * 360, 80, 50))
].forEach(color => {
  const sw = document.createElement('div');
  sw.className = 'color-swatch';
  sw.style.background = color;
  sw.title = color;
  sw.addEventListener('click', () => {
    currentColor = color;
    currentColorBtn.style.background = color;
    paletteDiv.classList.remove('visible');
  });
  paletteDiv.appendChild(sw);
});

// ─────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────
(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();
