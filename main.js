import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader } from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js?module';
import { GLTFExporter } from 'https://unpkg.com/three@0.163.0/examples/jsm/exporters/GLTFExporter.js?module';

// ===================== ESCENA Y CÁMARA =====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,22,80);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ===================== CONTROLES =====================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.NONE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.NONE };

// ===================== LUCES =====================
scene.add(new THREE.DirectionalLight(0xffffff,1).position.set(5,10,7.5));
scene.add(new THREE.AmbientLight(0x404040));
scene.add(new THREE.HemisphereLight(0xffffff,0x444444,1.2));
scene.add(new THREE.AxesHelper(5));

// ===================== MATERIALES =====================
const baseMaterial = new THREE.MeshStandardMaterial({color:0xaaaaaa, emissive:0xffffff, emissiveIntensity:0.05});
let lastClickedObject = null;
let hoveredObject = null;
let selectedObjects = [];
let isDrawing = false;
let currentColor = '#ff0000';
let brushSize = 1;
let cameraLocked = false;
let eyedropperActive = false;

// ===================== GLB =====================
const loader = new GLTFLoader();
let glbModel = null;

// ===================== RAYCASTER =====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ===================== CARGAR GLB AUTOMÁTICAMENTE =====================
loader.load('ModeloGLB.glb', (gltf)=>{
  if(glbModel) scene.remove(glbModel);
  glbModel = gltf.scene;
  glbModel.scale.set(0.5,0.5,0.5);
  glbModel.position.set(0,0,0);
  glbModel.traverse(child=>{
    if(child.isMesh){
      child.material = baseMaterial.clone();
      child.userData.originalMaterial = child.material.clone();
      child.geometry.computeBoundingSphere();
    }
  });
  scene.add(glbModel);
  const box = new THREE.Box3().setFromObject(glbModel);
  const center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  controls.update();
  console.log("¡GLB cargado automáticamente!");
}, undefined, console.error);

// ===================== ESTILOS GLOBALES =====================
const style = document.createElement('style');
style.textContent = `
  * { box-sizing: border-box; }

  /* ── Hamburger button ── */
  #hamburger-btn {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 2000;
    width: 44px;
    height: 44px;
    background: rgba(20,20,20,0.85);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    backdrop-filter: blur(6px);
    transition: background 0.2s;
  }
  #hamburger-btn:hover { background: rgba(40,40,40,0.95); }
  #hamburger-btn span {
    display: block;
    width: 20px;
    height: 2px;
    background: #fff;
    border-radius: 2px;
    transition: transform 0.25s, opacity 0.25s;
  }
  #hamburger-btn.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  #hamburger-btn.open span:nth-child(2) { opacity: 0; }
  #hamburger-btn.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  /* ── Side drawer menu ── */
  #side-menu {
    position: fixed;
    top: 0;
    left: 0;
    width: 240px;
    height: 100vh;
    background: rgba(18,18,18,0.96);
    backdrop-filter: blur(12px);
    z-index: 1900;
    display: flex;
    flex-direction: column;
    padding: 70px 16px 24px;
    gap: 10px;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    border-right: 1px solid rgba(255,255,255,0.08);
  }
  #side-menu.open { transform: translateX(0); }

  .menu-label {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin: 8px 0 2px;
    padding-left: 4px;
  }

  .menu-btn {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: #e8e8e8;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .menu-btn:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.25);
  }
  .menu-btn.active {
    background: rgba(255,80,80,0.2);
    border-color: rgba(255,80,80,0.5);
    color: #ff6b6b;
  }

  /* file input hidden, replaced by styled label */
  #load-glb-input { display: none; }
  label.menu-btn { user-select: none; }

  /* ── Brush slider toggle ── */
  #brush-toggle-btn {
    position: fixed;
    top: 12px;
    left: 66px;
    z-index: 2000;
    width: 44px;
    height: 44px;
    background: rgba(20,20,20,0.85);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    cursor: pointer;
    color: #fff;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(6px);
    transition: background 0.2s;
  }
  #brush-toggle-btn:hover { background: rgba(40,40,40,0.95); }

  /* ── Brush slider panel ── */
  #brush-panel {
    position: fixed;
    top: 66px;
    left: 12px;
    z-index: 1800;
    background: rgba(18,18,18,0.92);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 14px 18px;
    display: none;
    flex-direction: column;
    gap: 8px;
    backdrop-filter: blur(8px);
    min-width: 200px;
  }
  #brush-panel.visible { display: flex; }
  #brush-panel label {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    letter-spacing: 1px;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
  }
  #brush-panel input[type=range] {
    width: 100%;
    accent-color: #ff4444;
  }

  /* ── Brush cursor circle ── */
  #brush-circle {
    position: fixed;
    border: 2px solid red;
    border-radius: 50%;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s;
  }

  /* ── Palette wrapper ── */
  #palette-wrapper {
    position: fixed;
    bottom: 14px;
    right: 14px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  /* Current color swatch */
  #current-color-btn {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    border: 2px solid rgba(255,255,255,0.3);
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    transition: transform 0.15s;
  }
  #current-color-btn:hover { transform: scale(1.08); }

  /* Palette grid */
  #palette-div {
    display: none;
    background: rgba(18,18,18,0.95);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 10px;
    grid-template-columns: repeat(6,1fr);
    gap: 5px;
    max-height: 60vh;
    overflow-y: auto;
    backdrop-filter: blur(10px);
  }
  #palette-div.visible { display: grid; }

  /* Eyedropper button inside palette */
  #eyedropper-btn {
    grid-column: span 6;
    padding: 7px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    color: #ccc;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  #eyedropper-btn:hover {
    background: rgba(255,220,80,0.15);
    border-color: rgba(255,220,80,0.4);
    color: #ffd84f;
  }
  #eyedropper-btn.active {
    background: rgba(255,220,80,0.25);
    border-color: #ffd84f;
    color: #ffd84f;
  }

  .color-swatch {
    width: 26px;
    height: 26px;
    border-radius: 5px;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.05);
    transition: transform 0.1s, outline 0.1s;
  }
  .color-swatch:hover {
    transform: scale(1.2);
    outline: 2px solid #ffd84f;
  }

  /* cursor override when eyedropper is active */
  body.eyedropper-cursor * { cursor: crosshair !important; }
`;
document.head.appendChild(style);

// ===================== HAMBURGER BUTTON =====================
const hamburgerBtn = document.createElement('div');
hamburgerBtn.id = 'hamburger-btn';
hamburgerBtn.innerHTML = '<span></span><span></span><span></span>';
document.body.appendChild(hamburgerBtn);

// ===================== SIDE MENU =====================
const sideMenu = document.createElement('div');
sideMenu.id = 'side-menu';
document.body.appendChild(sideMenu);

hamburgerBtn.addEventListener('click', ()=>{
  hamburgerBtn.classList.toggle('open');
  sideMenu.classList.toggle('open');
});

// Close menu clicking outside
document.addEventListener('click', (e)=>{
  if(sideMenu.classList.contains('open') && !sideMenu.contains(e.target) && !hamburgerBtn.contains(e.target)){
    sideMenu.classList.remove('open');
    hamburgerBtn.classList.remove('open');
  }
});

function addMenuLabel(text){
  const lbl = document.createElement('div');
  lbl.className = 'menu-label';
  lbl.textContent = text;
  sideMenu.appendChild(lbl);
}

function addMenuBtn(icon, text, onClick){
  const btn = document.createElement('button');
  btn.className = 'menu-btn';
  btn.innerHTML = `<span>${icon}</span>${text}`;
  btn.addEventListener('click', ()=>{ onClick(btn); });
  sideMenu.appendChild(btn);
  return btn;
}

// ── File load (hidden input + styled label) ──
addMenuLabel('Archivo');

const loadInput = document.createElement('input');
loadInput.type = 'file';
loadInput.accept = '.glb';
loadInput.id = 'load-glb-input';
sideMenu.appendChild(loadInput);

const loadLabel = document.createElement('label');
loadLabel.htmlFor = 'load-glb-input';
loadLabel.className = 'menu-btn';
loadLabel.innerHTML = '<span>📂</span>Cargar';
sideMenu.appendChild(loadLabel);

loadInput.addEventListener('change', (e)=>{
  if(e.target.files.length > 0) loadGLB(e.target.files[0]);
  sideMenu.classList.remove('open');
  hamburgerBtn.classList.remove('open');
});

// ── Export buttons ──
addMenuLabel('Exportar');

addMenuBtn('🖼', 'Exportar Imagen 2×2', ()=>{
  exportImage();
  sideMenu.classList.remove('open');
  hamburgerBtn.classList.remove('open');
});

addMenuBtn('📦', 'Exportar GLB', ()=>{
  exportGLB();
  sideMenu.classList.remove('open');
  hamburgerBtn.classList.remove('open');
});

// ── Camera lock ──
addMenuLabel('Cámara');

const cameraBtn = addMenuBtn('🔓', 'Bloquear Cámara', (btn)=>{
  cameraLocked = !cameraLocked;
  controls.enableRotate = !cameraLocked;
  btn.innerHTML = cameraLocked
    ? '<span>🔒</span>Desbloquear Cámara'
    : '<span>🔓</span>Bloquear Cámara';
  btn.classList.toggle('active', cameraLocked);
});

// ===================== BRUSH TOGGLE BUTTON =====================
const brushToggleBtn = document.createElement('div');
brushToggleBtn.id = 'brush-toggle-btn';
brushToggleBtn.title = 'Tamaño de pincel';
brushToggleBtn.innerHTML = '✏️';
document.body.appendChild(brushToggleBtn);

// ===================== BRUSH PANEL =====================
const brushPanel = document.createElement('div');
brushPanel.id = 'brush-panel';
brushPanel.innerHTML = `<label>Tamaño de pincel</label>`;
document.body.appendChild(brushPanel);

const brushSlider = document.createElement('input');
brushSlider.type = 'range';
brushSlider.min = '1';
brushSlider.max = '10';
brushSlider.value = '1';
brushPanel.appendChild(brushSlider);

brushToggleBtn.addEventListener('click', ()=>{
  brushPanel.classList.toggle('visible');
});

// ===================== BRUSH CIRCLE =====================
const brushCircle = document.createElement('div');
brushCircle.id = 'brush-circle';
brushCircle.style.width = brushSize * 10 + 'px';
brushCircle.style.height = brushSize * 10 + 'px';
document.body.appendChild(brushCircle);

brushSlider.addEventListener('input', ()=>{
  brushSize = parseFloat(brushSlider.value);
  brushCircle.style.width = brushSize * 10 + 'px';
  brushCircle.style.height = brushSize * 10 + 'px';
  brushCircle.style.opacity = '1';
  setTimeout(()=>brushCircle.style.opacity = '0', 2000);
});

// ===================== PALETA DE COLORES =====================
function hslToHex(h,s,l){
  s/=100; l/=100;
  const k = n => (n+h/30)%12;
  const a = s*Math.min(l,1-l);
  const f = n => { const v = l - a*Math.max(Math.min(k(n)-3,9-k(n),1),-1); return Math.round(255*v).toString(16).padStart(2,'0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const colors = ['#000000','#888888','#ffffff'];
for(let i=0;i<97;i++) colors.push(hslToHex((i/97)*360,80,50));

// Wrapper
const paletteWrapper = document.createElement('div');
paletteWrapper.id = 'palette-wrapper';
document.body.appendChild(paletteWrapper);

// Current color button
const currentColorBtn = document.createElement('div');
currentColorBtn.id = 'current-color-btn';
currentColorBtn.style.background = currentColor;
currentColorBtn.title = 'Abrir paleta';
paletteWrapper.appendChild(currentColorBtn);

// Palette grid
const paletteDiv = document.createElement('div');
paletteDiv.id = 'palette-div';
paletteWrapper.appendChild(paletteDiv);

// Toggle palette on swatch click
currentColorBtn.addEventListener('click', ()=>{
  paletteDiv.classList.toggle('visible');
});

// ── Eyedropper button (first item in grid) ──
const eyedropperBtn = document.createElement('button');
eyedropperBtn.id = 'eyedropper-btn';
eyedropperBtn.innerHTML = '💉 Gotero';
paletteDiv.appendChild(eyedropperBtn);

eyedropperBtn.addEventListener('click', ()=>{
  eyedropperActive = !eyedropperActive;
  eyedropperBtn.classList.toggle('active', eyedropperActive);
  document.body.classList.toggle('eyedropper-cursor', eyedropperActive);
  if(eyedropperActive) paletteDiv.classList.remove('visible');
});

// ── Color swatches ──
colors.forEach(color=>{
  const btn = document.createElement('div');
  btn.className = 'color-swatch';
  btn.style.background = color;
  btn.title = color;
  btn.addEventListener('click', ()=>{
    currentColor = color;
    currentColorBtn.style.background = color;
    paletteDiv.classList.remove('visible');
  });
  paletteDiv.appendChild(btn);
});

// ===================== LOAD GLB FUNCTION =====================
function loadGLB(file){
  const url = URL.createObjectURL(file);
  loader.load(url, (gltf)=>{
    if(glbModel) scene.remove(glbModel);
    glbModel = gltf.scene;
    glbModel.scale.set(0.5,0.5,0.5);
    glbModel.position.set(0,0,0);
    glbModel.traverse(child=>{
      if(child.isMesh){
        child.material = baseMaterial.clone();
        child.userData.originalMaterial = child.material.clone();
        child.geometry.computeBoundingSphere();
      }
    });
    scene.add(glbModel);
    const box = new THREE.Box3().setFromObject(glbModel);
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    controls.update();
  });
}

// ===================== EXPORT FUNCTIONS =====================
function exportImage(){
  if(!glbModel) return alert("No hay modelo cargado");
  const positions = [
    new THREE.Vector3(0,22,70),
    new THREE.Vector3(0,22,-70),
    new THREE.Vector3(70,22,0),
    new THREE.Vector3(-70,22,0)
  ];
  const size=4096; const gap=10; const totalSize=size*2+gap;
  const canvas = document.createElement('canvas');
  canvas.width = totalSize; canvas.height = totalSize;
  const ctx = canvas.getContext('2d');
  const originalPos = camera.position.clone();
  const originalTarget = controls.target.clone();
  positions.forEach((pos,i)=>{
    camera.position.copy(pos);
    controls.target.set(0,22,0);
    controls.update();
    renderer.render(scene,camera);
    const imgData = renderer.domElement.toDataURL();
    const img = new Image(); img.src = imgData;
    const x=(i%2)*(size+gap);
    const y=Math.floor(i/2)*(size+gap);
    img.onload = ()=>ctx.drawImage(img,x,y,size,size);
  });
  setTimeout(()=>{
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'collage_2x2.png';
    link.click();
    camera.position.copy(originalPos);
    controls.target.copy(originalTarget);
    controls.update();
  }, 500);
}

function exportGLB(){
  if(!glbModel) return alert("No hay modelo cargado");
  const exporter = new GLTFExporter();
  exporter.parse(glbModel, (result)=>{
    const output = JSON.stringify(result, null, 2);
    const blob = new Blob([output], {type:'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo.glb';
    link.click();
  }, {binary:true});
}

// ===================== INTERACCIONES =====================
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mouseup', ()=>isDrawing=false);
renderer.domElement.addEventListener('contextmenu', e=>e.preventDefault());

function handleHoverAndPaint(intersects){
  if(intersects.length===0){
    if(!glbModel) return;
    glbModel.traverse(child=>{
      if(child.isMesh && child!==lastClickedObject) child.material.emissiveIntensity=0;
    });
    return;
  }
  const hitPoint = intersects[0].point;
  hoveredObject = intersects[0].object;

  glbModel.traverse(child=>{
    if(child.isMesh){
      let shouldHighlight = false;
      if(brushSize<=parseFloat(brushSlider.min)) shouldHighlight=(child===hoveredObject);
      else{
        const pos = child.geometry.attributes.position;
        for(let i=0;i<pos.count;i++){
          const vertex = new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
          if(vertex.distanceTo(hitPoint)<=brushSize){ shouldHighlight=true; break; }
        }
      }
      if(child!==lastClickedObject){
        child.material.emissive.setHex(0xffffff);
        child.material.emissiveIntensity = shouldHighlight ? 0.05 : 0;
      }
    }
  });

  if(isDrawing && hoveredObject && !eyedropperActive){
    if(brushSize<=parseFloat(brushSlider.min)){
      hoveredObject.material.color.set(currentColor);
      hoveredObject.userData.currentColor = hoveredObject.material.color.clone();
      if(!selectedObjects.includes(hoveredObject)) selectedObjects.push(hoveredObject);
    } else {
      glbModel.traverse(child=>{
        if(child.isMesh){
          const pos = child.geometry.attributes.position;
          for(let i=0;i<pos.count;i++){
            const vertex = new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
            if(vertex.distanceTo(hitPoint)<=brushSize){
              if(!child.userData.currentColor) child.material = child.userData.originalMaterial.clone();
              child.material.color.set(currentColor);
              child.userData.currentColor = child.material.color.clone();
              if(!selectedObjects.includes(child)) selectedObjects.push(child);
              break;
            }
          }
        }
      });
    }
  }
}

function onMouseMove(event){
  if(!glbModel) return;
  mouse.x = (event.clientX/window.innerWidth)*2-1;
  mouse.y = -(event.clientY/window.innerHeight)*2+1;
  brushCircle.style.left = event.clientX - brushCircle.offsetWidth/2 + 'px';
  brushCircle.style.top  = event.clientY - brushCircle.offsetHeight/2 + 'px';
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(glbModel.children, true);
  handleHoverAndPaint(intersects);
}

function onMouseDown(event){
  if(event.button!==0) return;
  if(!glbModel) return;
  mouse.x = (event.clientX/window.innerWidth)*2-1;
  mouse.y = -(event.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(glbModel.children, true);

  if(intersects.length>0){
    const clickedObj = intersects[0].object;

    // Eyedropper mode
    if(eyedropperActive){
      currentColor = '#' + clickedObj.material.color.getHexString();
      currentColorBtn.style.background = currentColor;
      eyedropperActive = false;
      eyedropperBtn.classList.remove('active');
      document.body.classList.remove('eyedropper-cursor');
      return;
    }

    isDrawing = true;
    if(lastClickedObject && lastClickedObject!==clickedObj) lastClickedObject.material.emissiveIntensity=0;
    lastClickedObject = clickedObj;
    lastClickedObject.material.emissive.setHex(0xffffff);
    lastClickedObject.material.emissiveIntensity = 0.05;
  } else {
    isDrawing = true;
  }
  handleHoverAndPaint(intersects);
}

// ===================== ANIMACIÓN =====================
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ===================== AJUSTE VENTANA =====================
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
