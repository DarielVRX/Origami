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
const lastClickedMaterial = baseMaterial.clone(); 
lastClickedMaterial.emissive.setHex(0x555555); 

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
let brushSize = 2; 

// ===================== CARGAR GLB AUTOMÁTICAMENTE ===================== 
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

// ================= PALETA DE 100 COLORES GRADUAL ================= 
const colors = ['#000000','#888888','#ffffff']; 
const totalColors = 97; 
for(let i=0;i<totalColors;i++){ 
  const hue = (i/totalColors)*360; 
  const saturation = 80; 
  const lightness = 50; 
  colors.push(hslToHex(hue,saturation,lightness)); 
} 
function hslToHex(h,s,l){ 
  s/=100;l/=100; 
  const k=n=>(n+h/30)%12; 
  const a=s*Math.min(l,1-l); 
  const f=n=>{ 
    const val=l - a * Math.max(Math.min(k(n)-3,9-k(n),1),-1); 
    return Math.round(255*val).toString(16).padStart(2,'0'); 
  }; 
  return `#${f(0)}${f(8)}${f(4)}`; 
} 

// ================= PALETA COLLAPSABLE ================= 
const paletteWrapper = document.createElement('div'); 
paletteWrapper.style.position='fixed'; 
paletteWrapper.style.bottom='10px'; 
paletteWrapper.style.right='10px'; 
paletteWrapper.style.zIndex=1000; 
paletteWrapper.style.display='flex'; 
paletteWrapper.style.flexDirection='column'; 
paletteWrapper.style.alignItems='center'; 
document.body.appendChild(paletteWrapper); 

// Botón color actual
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

// Contenedor de paleta (oculto inicialmente)
const paletteDiv = document.createElement('div'); 
paletteDiv.style.display='none'; 
paletteDiv.style.marginTop='5px'; 
paletteDiv.style.padding='5px'; 
paletteDiv.style.background='rgba(255,255,255,0.95)'; 
paletteDiv.style.display='grid'; 
paletteDiv.style.gridTemplateColumns='repeat(6,1fr)'; 
paletteDiv.style.gridAutoRows='1fr'; 
paletteDiv.style.gap='6px'; 
paletteDiv.style.maxHeight='60vh'; 
paletteDiv.style.overflowY='auto'; 
paletteWrapper.appendChild(paletteDiv); 

// Mostrar/ocultar paleta al hacer click
currentColorBtn.addEventListener('click',()=>{
  paletteDiv.style.display = paletteDiv.style.display==='none' ? 'grid':'none';
});

// Crear colores
colors.forEach(color=>{
  const btn = document.createElement('div'); 
  btn.style.width='25px'; 
  btn.style.height='25px'; 
  btn.style.borderRadius='4px';
  btn.style.background=color; 
  btn.style.cursor='pointer'; 
  btn.title=color; 

  // Hover: resaltar contorno
  btn.addEventListener('mouseenter',()=>btn.style.outline='2px solid yellow'); 
  btn.addEventListener('mouseleave',()=>btn.style.outline='none'); 

  // Click: usar color
  btn.addEventListener('click',()=>{
    currentColor=color;
    currentColorBtn.style.background=color;
  });

  paletteDiv.appendChild(btn); 
});

// ================= SLIDER PUNTERO ================= 
const brushSlider = document.createElement('input'); 
brushSlider.type='range'; 
brushSlider.min='1'; 
brushSlider.max='10'; 
brushSlider.value=1; 
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

// ================= EXPORTAR IMAGEN 2x2 ================= 
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

// ================= BLOQUEO DE CAMARA =================
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

function onMouseMove(event){
  if(!glbModel) return;

  mouse.x = (event.clientX / window.innerWidth)*2-1;
  mouse.y = -(event.clientY / window.innerHeight)*2+1;

  brushCircle.style.left = event.clientX - brushCircle.offsetWidth/2 + 'px';
  brushCircle.style.top = event.clientY - brushCircle.offsetHeight/2 + 'px';

  raycaster.setFromCamera(mouse,camera);
  const intersects = raycaster.intersectObjects(glbModel.children,true);

  hoveredObject = intersects.length>0 ? intersects[0].object : null;

  if(intersects.length > 0 && intersects[0].distance <= maxDistance){
    const hitPoint = intersects[0].point;

    // ======= HOVER / RESALTADO =======
    glbModel.traverse(child => {
      if(child.isMesh){
        let shouldHighlight = false;
        if(brushSize <= parseFloat(brushSlider.min)){
          shouldHighlight = (child === hoveredObject);
        } else {
          const pos = child.geometry.attributes.position;
          for(let i=0;i<pos.count;i++){
            const vertex = new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
            if(vertex.distanceTo(hitPoint) <= brushSize){
              shouldHighlight = true;
              break;
            }
          }
        }
        if(child !== lastClickedObject){
          child.material.emissive.setHex(shouldHighlight ? 0x333333 : 0x000000);
        }
      }
    });

    // ======= PINTADO CONTINUO =======
    if(isDrawing && hoveredObject){
      if(brushSize <= parseFloat(brushSlider.min)){
        hoveredObject.material.color.set(currentColor);
        hoveredObject.userData.currentColor = hoveredObject.material.color.clone();
        if(!selectedObjects.includes(hoveredObject)) selectedObjects.push(hoveredObject);
      } else {
        glbModel.traverse(child => {
          if(child.isMesh){
            const pos = child.geometry.attributes.position;
            for(let i=0;i<pos.count;i++){
              const vertex = new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
              if(vertex.distanceTo(hitPoint) <= brushSize){
                if(!child.userData.currentColor){
                  child.material = child.userData.originalMaterial.clone();
                }
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

  } else {
    glbModel.traverse(child => {
      if(child.isMesh && child!==lastClickedObject){
        child.material.emissive.setHex(0x000000);
      }
    });
  }
}

function onMouseDown(event){
  if(event.button===0){
    isDrawing = true;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(glbModel.children, true);

    if(intersects.length > 0){
      if(lastClickedObject && lastClickedObject !== intersects[0].object){
        lastClickedObject.material.emissive.setHex(0x000000);
      }
      lastClickedObject = intersects[0].object;
      lastClickedObject.material.emissive.setHex(0x555555);
    }

    onMouseMove(event);
  }
}

// ================= INTERACCIONES TÁCTILES =================
renderer.domElement.addEventListener('touchstart', (event) => {
  if (!glbModel) return;
  if (event.touches.length === 1) {
    isDrawing = true;
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    onTouchHover(mouse);
  }
  if (event.touches.length === 2) {
    controls.enableRotate = !cameraLocked;
    controls.enableZoom = true;
  }
}, {passive: false});

renderer.domElement.addEventListener('touchmove', (event) => {
  if (!glbModel) return;
  if (event.touches.length === 1 && isDrawing) {
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    onTouchHover(mouse);
    brushCircle.style.left = touch.clientX - brushCircle.offsetWidth / 2 + 'px';
    brushCircle.style.top = touch.clientY - brushCircle.offsetHeight / 2 + 'px';
  }
}, {passive: false});

renderer.domElement.addEventListener('touchend', (event) => {
  if (event.touches.length === 0) isDrawing = false;
});

function onTouchHover(touchVec2){
  raycaster.setFromCamera(touchVec2, camera);
  const intersects = raycaster.intersectObjects(glbModel.children, true);
  hoveredObject = intersects.length>0 ? intersects[0].object : null;

  if(intersects.length > 0 && intersects[0].distance <= maxDistance){
    const hitPoint = intersects[0].point;

    glbModel.traverse(child => {
      if(child.isMesh){
        let shouldHighlight = false;
        if(brushSize <= parseFloat(brushSlider.min)){
          shouldHighlight = (child === hoveredObject);
        } else {
          const pos = child.geometry.attributes.position;
          for(let i=0;i<pos.count;i++){
            const vertex = new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
            if(vertex.distanceTo(hitPoint) <= brushSize){
              shouldHighlight = true;
              break;
            }
          }
        }
        if(child !== lastClickedObject){
          child.material.emissive.setHex(shouldHighlight ? 0x333333 : 0x000000);
        }
      }
    });

    if(isDrawing && hoveredObject){
      if(brushSize <= parseFloat(brushSlider.min)){
        hoveredObject.material.color.set(currentColor);
        hoveredObject.userData.currentColor = hoveredObject.material.color.clone();
        if(!selectedObjects.includes(hoveredObject)) selectedObjects.push(hoveredObject);
      } else {
        glbModel.traverse(child => {
          if(child.isMesh){
            const pos = child.geometry.attributes.position;
            for(let i=0;i<pos.count;i++){
              const vertex = new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
              if(vertex.distanceTo(hitPoint) <= brushSize){
                if(!child.userData.currentColor){
                  child.material = child.userData.originalMaterial.clone();
                }
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

  } else {
    glbModel.traverse(child => {
      if(child.isMesh && child!==lastClickedObject){
        child.material.emissive.setHex(0x000000);
      }
    });
  }
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

