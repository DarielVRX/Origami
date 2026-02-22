import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader }   from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js?module';
import { GLTFExporter }  from 'https://unpkg.com/three@0.163.0/examples/jsm/exporters/GLTFExporter.js?module';

// ─────────────────────────────────────────────
// ESCENA / CÁMARA / RENDERER
// ─────────────────────────────────────────────
const scene    = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 22, 80);

const renderer = new THREE.WebGLRenderer({ antialias: true });
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
controls.mouseButtons  = { LEFT: THREE.MOUSE.NONE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.NONE };

// ─────────────────────────────────────────────
// LUCES  (bug corregido: se añade la luz, no su Vector3)
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
// emissiveIntensity = 0 por defecto; solo se activa en hover/click
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
let brushSize        = 1;
let cameraLocked     = false;
let eyedropperActive = false;

const loader    = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

// ─────────────────────────────────────────────
// HELPERS DE MODELO
// ─────────────────────────────────────────────
function setupModel(model) {
  model.scale.set(0.5, 0.5, 0.5);
  model.position.set(0, 0, 0);
  model.traverse(child => {
    if (!child.isMesh) return;
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
    setupModel(glbModel);
  }, undefined, console.error);
}

// Carga automática
loader.load('ModeloGLB.glb', gltf => {
  glbModel = gltf.scene;
  setupModel(glbModel);
  console.log('GLB cargado automáticamente.');
}, undefined, console.error);

// ─────────────────────────────────────────────
// EXPORTAR GLB  (correcciones clave)
//
//  1. binary:true devuelve ArrayBuffer, no JSON → no llamar JSON.stringify
//  2. Se resetea emissiveIntensity antes de exportar para no incluir el brillo
//  3. Firma correcta de parse() en r163:
//     exporter.parse(input, onDone, onError, options)
// ─────────────────────────────────────────────
function exportGLB() {
  if (!glbModel) return alert('No hay modelo cargado.');

  // Guardar y apagar emissive temporalmente
  const saved = [];
  glbModel.traverse(child => {
    if (!child.isMesh) return;
    saved.push({ mesh: child, ei: child.material.emissiveIntensity });
    child.material.emissiveIntensity = 0;
  });

  new GLTFExporter().parse(
    glbModel,
    buffer => {
      saved.forEach(({ mesh, ei }) => (mesh.material.emissiveIntensity = ei));
      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: 'modelo.glb'
      }).click();
    },
    error => {
      saved.forEach(({ mesh, ei }) => (mesh.material.emissiveIntensity = ei));
      console.error('Error exportando GLB:', error);
      alert('Error al exportar el GLB.');
    },
    { binary: true }
  );
}

// ─────────────────────────────────────────────
// EXPORTAR IMAGEN 2×2
// ─────────────────────────────────────────────
function exportImage() {
  if (!glbModel) return alert('No hay modelo cargado.');

  const views = [
    new THREE.Vector3(0, 22, 70),
    new THREE.Vector3(0, 22, -70),
    new THREE.Vector3(70, 22, 0),
    new THREE.Vector3(-70, 22, 0)
  ];
  const SIZE = 4096, GAP = 10, TOTAL = SIZE * 2 + GAP;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TOTAL;
  const ctx = canvas.getContext('2d');

  const savedPos    = camera.position.clone();
  const savedTarget = controls.target.clone();

  // Renderizar las 4 vistas y capturar antes de devolver la cámara
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
      if (++loaded === snapshots.length)
        Object.assign(document.createElement('a'), {
          href: canvas.toDataURL('image/png'),
          download: 'collage_2x2.png'
        }).click();
    };
    img.src = src;
  });
}

// ─────────────────────────────────────────────
// PINTURA
// ─────────────────────────────────────────────
function paintAt(hitPoint) {
  const small = brushSize <= 1;
  glbModel.traverse(child => {
    if (!child.isMesh) return;
    let hit = small
      ? child === lastHovered
      : (() => {
          const pos = child.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
            if (v.distanceTo(hitPoint) <= brushSize) return true;
          }
          return false;
        })();
    if (hit) child.material.color.set(currentColor);
  });
}

// ─────────────────────────────────────────────
// HOVER
// ─────────────────────────────────────────────
function updateHover(intersects) {
  if (lastHovered && lastHovered !== lastClicked) lastHovered.material.emissiveIntensity = 0;
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
// EVENTOS RATÓN
// ─────────────────────────────────────────────
function getIntersects(e) {
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  return glbModel ? raycaster.intersectObjects(glbModel.children, true) : [];
}

renderer.domElement.addEventListener('mousemove', e => {
  const w = brushSize * 10;
  brushCircle.style.left = (e.clientX - w / 2) + 'px';
  brushCircle.style.top  = (e.clientY - w / 2) + 'px';
  if (glbModel) updateHover(getIntersects(e));
});

renderer.domElement.addEventListener('mousedown', e => {
  if (e.button !== 0 || !glbModel) return;
  const intersects = getIntersects(e);

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

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
* { box-sizing: border-box; }

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

#hamburger-btn { left: 12px; flex-direction: column; gap: 5px; }
#hamburger-btn span { display: block; width: 20px; height: 2px; background: #fff; border-radius: 2px; transition: transform 0.25s, opacity 0.25s; }
#hamburger-btn.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
#hamburger-btn.open span:nth-child(2) { opacity: 0; }
#hamburger-btn.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

#brush-toggle-btn { left: 66px; }

#side-menu {
  position: fixed; top: 0; left: 0; width: 240px; height: 100vh;
  background: rgba(18,18,18,0.96); backdrop-filter: blur(12px);
  z-index: 1900; display: flex; flex-direction: column;
  padding: 70px 16px 24px; gap: 10px;
  transform: translateX(-100%); transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
  border-right: 1px solid rgba(255,255,255,0.08);
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

#brush-panel {
  position: fixed; top: 66px; left: 12px; z-index: 1800;
  background: rgba(18,18,18,0.92); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 14px 18px;
  display: none; flex-direction: column; gap: 8px;
  backdrop-filter: blur(8px); min-width: 200px;
}
#brush-panel.visible { display: flex; }
#brush-panel label {
  font-family: 'Courier New', monospace; font-size: 11px;
  letter-spacing: 1px; color: rgba(255,255,255,0.5); text-transform: uppercase;
}
#brush-panel input[type=range] { width: 100%; accent-color: #ff4444; }

#brush-circle {
  position: fixed; border: 2px solid rgba(255,60,60,0.8); border-radius: 50%;
  pointer-events: none; opacity: 0; transition: opacity 0.3s;
}

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
  grid-column: span 6; padding: 7px;
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
  border: 1px solid rgba(255,255,255,0.05); transition: transform 0.1s, outline 0.1s;
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

// Cargar archivo
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
addBtn('🖼', 'Exportar Imagen 2×2', () => { exportImage(); closeMenu(); });
addBtn('📦', 'Exportar GLB',         () => { exportGLB();   closeMenu(); });

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
brushToggleBtn.id = 'brush-toggle-btn'; brushToggleBtn.className = 'top-btn';
brushToggleBtn.title = 'Tamaño de pincel'; brushToggleBtn.textContent = '✏️';
document.body.appendChild(brushToggleBtn);

const brushPanel = document.createElement('div');
brushPanel.id = 'brush-panel';
brushPanel.innerHTML = '<label>Tamaño de pincel</label>';
document.body.appendChild(brushPanel);

const brushSlider = document.createElement('input');
brushSlider.type = 'range'; brushSlider.min = '1'; brushSlider.max = '10'; brushSlider.value = '1';
brushPanel.appendChild(brushSlider);

const brushCircle = document.createElement('div');
brushCircle.id = 'brush-circle';
brushCircle.style.cssText = 'width:10px;height:10px;';
document.body.appendChild(brushCircle);

brushToggleBtn.addEventListener('click', () => brushPanel.classList.toggle('visible'));
brushSlider.addEventListener('input', () => {
  brushSize = parseFloat(brushSlider.value);
  const px = brushSize * 10 + 'px';
  brushCircle.style.width = brushCircle.style.height = px;
  brushCircle.style.opacity = '1';
  clearTimeout(brushCircle._t);
  brushCircle._t = setTimeout(() => (brushCircle.style.opacity = '0'), 1500);
});

// ─────────────────────────────────────────────
// UI — PALETA DE COLORES
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

// Swatches
['#000000', '#888888', '#ffffff', ...Array.from({ length: 97 }, (_, i) => hslToHex((i / 97) * 360, 80, 50))]
  .forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch'; sw.style.background = color; sw.title = color;
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
