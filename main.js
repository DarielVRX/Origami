import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module'; 
import { GLTFLoader } from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module'; 
import { OrbitControls } from 'https://unpkg.com/three@0.163.0/examples/jsm/controls/OrbitControls.js?module'; 

// ===================== ESCENA Y CÁMARA ===================== 
const scene = new THREE.Scene(); 
scene.background = new THREE.Color(0xeeeeee); 
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000); 
camera.position.set(0, 22, 80); 
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
const baseMaterial = new THREE.MeshStandardMaterial({color:0xaaaaaa}); 
const hoverMaterial = baseMaterial.clone(); 
hoverMaterial.emissive.setHex(0x333333); 
let lastClickedOutline = null;

// ===================== GLB ===================== 
const loader = new GLTFLoader(); 
let glbModel = null; 

// ===================== RAYCASTER ===================== 
const raycaster = new THREE.Raycaster(); 
const mouse = new THREE.Vector2(); 
let hoveredObject = null; 
let lastClickedObject = null; 
let selectedObjects = []; 
let isDrawing = false; 
let currentColor = '#ff0000'; 
let brushSize = 1; 
let eyedropperActive = false;

// ===================== CARGAR GLB ===================== 
loader.load('ModeloGLB.glb', (gltf) => { 
  if(glbModel) scene.remove(glbModel); 
  glbModel = gltf.scene; 
  glbModel.scale.set(0.5, 0.5, 0.5); 
  glbModel.position.set(0, 0, 0); 
  glbModel.traverse(child => { 
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

// ===================== PALETA DE COLORES ===================== 
const colors = ['#000000','#888888','#ffffff']; 
for(let i=0;i<97;i++){ 
  const hue = (i/97)*360; 
  colors.push(hslToHex(hue,80,50)); 
} 
function hslToHex(h,s,l){ 
  s/=100;l/=100; 
  const k=n=>(n+h/30)%12; 
  const a=s*Math.min(l,1-l); 
  const f=n=>{ const val=l - a * Math.max(Math.min(k(n)-3,9-k(n),1),-1); return Math.round(255*val).toString(16).padStart(2,'0'); }; 
  return `#${f(0)}${f(8)}${f(4)}`; 
} 

// ================= PALETA COLLAPSABLE + GOTERO ================= 
const paletteWrapper = document.createElement('div'); 
paletteWrapper.style.position='fixed'; 
paletteWrapper.style.bottom='10px'; 
paletteWrapper.style.right='10px'; 
paletteWrapper.style.zIndex=1000; 
paletteWrapper.style.display='flex'; 
paletteWrapper.style.flexDirection='column'; 
paletteWrapper.style.alignItems='center'; 
document.body.appendChild(paletteWrapper); 

const currentColorBtn = document.createElement('div'); 
currentColorBtn.style.width='40px'; 
currentColorBtn.style.height='40px'; 
currentColorBtn.style.borderRadius='6px'; 
currentColorBtn.style.border='2px solid #000'; 
currentColorBtn.style.background=currentColor; 
currentColorBtn.style.cursor='pointer'; 
currentColorBtn.title = 'Click para abrir la paleta'; 
currentColorBtn.style.display='flex'; 
currentColorBtn.style.alignItems='center'; 
currentColorBtn.style.justifyContent='center'; 
currentColorBtn.style.boxShadow='0 0 5px rgba(0,0,0,0.5)'; 
paletteWrapper.appendChild(currentColorBtn); 

const eyedropperBtn = document.createElement('div');
eyedropperBtn.style.width = '30px';
eyedropperBtn.style.height = '30px';
eyedropperBtn.style.marginTop = '5px';
eyedropperBtn.style.borderRadius = '4px';
eyedropperBtn.style.border = '2px solid #000';
eyedropperBtn.style.background = 'url(data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTguNSAxOC41TDEwIDIwTDE2IDE0bC0xLjUtMS41TDguNSAxOC41eiIvPjwvc3ZnPg==) center/contain no-repeat';
eyedropperBtn.style.cursor = 'pointer';
eyedropperBtn.title = 'Activar gotero';
paletteWrapper.appendChild(eyedropperBtn);

eyedropperBtn.addEventListener('click', () => {
  eyedropperActive = !eyedropperActive;
  eyedropperBtn.style.boxShadow = eyedropperActive ? '0 0 8px 2px yellow' : 'none';
});

const paletteDiv = document.createElement('div'); 
paletteDiv.style.display='none'; 
paletteDiv.style.marginTop='5px'; 
paletteDiv.style.padding='5px'; 
paletteDiv.style.background='rgba(255,255,255,0.95)'; 
paletteDiv.style.gridTemplateColumns='repeat(6,1fr)'; 
paletteDiv.style.gridAutoRows='1fr'; 
paletteDiv.style.gap='6px'; 
paletteDiv.style.maxHeight='60vh'; 
paletteDiv.style.overflowY='auto'; 
paletteDiv.style.display='grid'; 
paletteWrapper.appendChild(paletteDiv); 

currentColorBtn.addEventListener('click',()=>{
  paletteDiv.style.display = paletteDiv.style.display==='none' ? 'grid':'none';
});

colors.forEach(color=>{
  const btn = document.createElement('div'); 
  btn.style.width='25px'; 
  btn.style.height='25px'; 
  btn.style.borderRadius='4px';
  btn.style.background=color; 
  btn.style.cursor='pointer'; 
  btn.title=color; 
  btn.addEventListener('mouseenter',()=>btn.style.outline='2px solid yellow'); 
  btn.addEventListener('mouseleave',()=>btn.style.outline='none'); 
  btn.addEventListener('click',()=>{
    currentColor=color;
    currentColorBtn.style.background=color;
    paletteDiv.style.display='none';
  });
  paletteDiv.appendChild(btn); 
});

// ================= SLIDER ================= 
const brushSlider = document.createElement('input'); 
brushSlider.type='range'; 
brushSlider.min='1'; 
brushSlider.max='10'; 
brushSlider.value=brushSize; 
brushSlider.style.position='fixed'; 
brushSlider.style.top='20px'; 
brushSlider.style.left='50%';
brushSlider.style.transform = 'translateX(-50%)';
brushSlider.style.zIndex=1000; 
brushSlider.style.width='1000px'; 
document.body.appendChild(brushSlider); 

const brushCircle = document.createElement('div'); 
brushCircle.style.position='fixed'; 
brushCircle.style.border='2px solid red'; 
brushCircle.style.borderRadius='50%'; 
brushCircle.style.pointerEvents='none'; 
brushCircle.style.width=brushSize*10+'px'; 
brushCircle.style.height=brushSize*10+'px'; 
brushCircle.style.transition='opacity 0.3s'; 
document.body.appendChild(brushCircle); 

brushSlider.addEventListener('input',()=>{ 
  brushSize = parseFloat(brushSlider.value); 
  brushCircle.style.width=brushSize*10+'px'; 
  brushCircle.style.height=brushSize*10+'px'; 
  brushCircle.style.opacity=1; 
  setTimeout(()=>brushCircle.style.opacity=0,2000); 
}); 

// ================= EXPORTAR 2x2 ================= 
const exportImgBtn = document.createElement('button'); 
exportImgBtn.textContent = "Exportar Imagen 2x2"; 
exportImgBtn.style.position='fixed'; 
exportImgBtn.style.bottom='10px'; 
exportImgBtn.style.left='10px'; 
exportImgBtn.style.padding='10px'; 
exportImgBtn.style.fontSize='1em'; 
exportImgBtn.style.cursor='pointer'; 
exportImgBtn.style.zIndex=1000; 
document.body.appendChild(exportImgBtn); 

exportImgBtn.addEventListener('click',()=>{ 
  if(!glbModel) return alert("No hay modelo cargado"); 
  const positions = [ 
    new THREE.Vector3(0,22,70), 
    new THREE.Vector3(0,22,-70), 
    new THREE.Vector3(70,22,0), 
    new THREE.Vector3(-70,22,0) 
  ]; 
  const size = 4096; 
  const gap = 10; 
  const totalSize = size*2 + gap; 
  const canvas = document.createElement('canvas'); 
  canvas.width=totalSize; 
  canvas.height=totalSize; 
  const ctx = canvas.getContext('2d'); 
  const originalPos = camera.position.clone(); 
  const originalTarget = controls.target.clone(); 
  positions.forEach((pos,i)=>{ 
    camera.position.copy(pos); 
    controls.target.set(0,22,0); 
    controls.update(); 
    renderer.render(scene,camera); 
    const imgData = renderer.domElement.toDataURL(); 
    const img = new Image(); 
    img.src = imgData; 
    const x = (i%2)*(size+gap); 
    const y = Math.floor(i/2)*(size+gap); 
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
  },500); 
}); 

// ================= BLOQUEO DE CÁMARA ================= 
let cameraLocked = false;
const cameraLockBtn = document.createElement('button');
cameraLockBtn.textContent = "Bloquear Cámara";
cameraLockBtn.style.position='fixed';
cameraLockBtn.style.bottom='100px';
cameraLockBtn.style.left='10px';
cameraLockBtn.style.padding='10px';
cameraLockBtn.style.fontSize='1em';
cameraLockBtn.style.cursor='pointer';
cameraLockBtn.style.zIndex=1000;
document.body.appendChild(cameraLockBtn);

cameraLockBtn.addEventListener('click', () => {
  cameraLocked = !cameraLocked;
  controls.enableRotate = !cameraLocked;
  cameraLockBtn.textContent = cameraLocked ? "Desbloquear Cámara" : "Bloquear Cámara";
});

// ================= INTERACCIONES ================= 
const maxDistance = 80;
renderer.domElement.addEventListener('mousemove',onMouseMove);
renderer.domElement.addEventListener('mousedown',onMouseDown);
renderer.domElement.addEventListener('mouseup',()=>isDrawing=false);
renderer.domElement.addEventListener('contextmenu', e=>e.preventDefault());

renderer.domElement.addEventListener('touchstart', onTouchStart, {passive: false});
renderer.domElement.addEventListener('touchmove', onTouchMove, {passive: false});
renderer.domElement.addEventListener('touchend', (event)=>{ if(event.touches.length===0) isDrawing=false; });

function onMouseMove(event){
  if(!glbModel) return;

  mouse.x = (event.clientX / window.innerWidth)*2-1;
  mouse.y = -(event.clientY / window.innerHeight)*2+1;

  brushCircle.style.left = event.clientX - brushCircle.offsetWidth/2 + 'px';
  brushCircle.style.top = event.clientY - brushCircle.offsetHeight/2 + 'px';

  raycaster.setFromCamera(mouse,camera);
  const intersects = raycaster.intersectObjects(glbModel.children,true);
  hoveredObject = intersects.length>0 ? intersects[0].object : null;

  if(eyedropperActive && hoveredObject){
    currentColor = '#' + hoveredObject.material.color.getHexString();
    currentColorBtn.style.background=currentColor;
    eyedropperActive=false;
    eyedropperBtn.style.boxShadow='none';
    return;
  }

  handleHoverAndPaint(intersects);
}

function onMouseDown(event){
  if(event.button!==0) return;
  isDrawing=true;

  mouse.x = (event.clientX / window.innerWidth)*2-1;
  mouse.y = -(event.clientY / window.innerHeight)*2+1;

  raycaster.setFromCamera(mouse,camera);
  const intersects = raycaster.intersectObjects(glbModel.children,true);

  if(eyedropperActive && intersects.length>0){
    currentColor = '#' + intersects[0].object.material.color.getHexString();
    currentColorBtn.style.background=currentColor;
    eyedropperActive=false;
    eyedropperBtn.style.boxShadow='none';
    return;
  }

  if(intersects.length>0){
    const clickedObj = intersects[0].object;
    if(lastClickedOutline){
      scene.remove(lastClickedOutline);
      lastClickedOutline.geometry.dispose();
      lastClickedOutline.material.dispose();
      lastClickedOutline=null;
    }
    lastClickedObject = clickedObj;

    const edges = new THREE.EdgesGeometry(clickedObj.geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffaa, linewidth: 2 })
    );
    line.position.copy(clickedObj.position);
    line.rotation.copy(clickedObj.rotation);
    line.scale.copy(clickedObj.scale);
    scene.add(line);
    lastClickedOutline = line;
  }

  handleHoverAndPaint(intersects);
}

// ================= FUNCIONES AUXILIARES ================= 
function handleHoverAndPaint(intersects){
  const hitPoint = intersects.length>0 ? intersects[0].point : null;

  glbModel.traverse(child=>{
    if(!child.isMesh) return;
    let shouldHighlight = false;
    if(hitPoint && brushSize>parseFloat(brushSlider.min)){
      const pos = child.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
        const vertex = new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
        if(vertex.distanceTo(hitPoint)<=brushSize){
          shouldHighlight=true; break;
        }
      }
    } else if(child===hoveredObject) shouldHighlight=true;

    if(child!==lastClickedObject) child.material.emissive.setHex(shouldHighlight?0x333333:0x000000);

    if(isDrawing && hitPoint){
      if(shouldHighlight){
        if(!child.userData.currentColor) child.material = child.userData.originalMaterial.clone();
        child.material.color.set(currentColor);
        child.userData.currentColor = child.material.color.clone();
        if(!selectedObjects.includes(child)) selectedObjects.push(child);
      }
    }
  });
}

// ================= TOUCH ================= 
function onTouchStart(event){
  if(!glbModel) return;
  if(event.touches.length===1){
    isDrawing=true;
    const touch=event.touches[0];
    mouse.x = (touch.clientX/window.innerWidth)*2-1;
    mouse.y = -(touch.clientY/window.innerHeight)*2+1;
    onMouseMove(touch);
  }
  if(event.touches.length===2){
    controls.enableRotate=!cameraLocked;
    controls.enableZoom=true;
  }
}
function onTouchMove(event){
  if(!glbModel || event.touches.length!==1 || !isDrawing) return;
  const touch = event.touches[0];
  mouse.x = (touch.clientX/window.innerWidth)*2-1;
  mouse.y = -(touch.clientY/window.innerHeight)*2+1;
  brushCircle.style.left = touch.clientX - brushCircle.offsetWidth/2 + 'px';
  brushCircle.style.top = touch.clientY - brushCircle.offsetHeight/2 + 'px';
  onMouseMove(touch);
}

// ================= ANIMACIÓN ================= 
function animate(){ 
  requestAnimationFrame(animate); 
  controls.update(); 
  renderer.render(scene,camera); 
} 
animate(); 

// ================= AJUSTE VENTANA ================= 
window.addEventListener('resize',()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});
