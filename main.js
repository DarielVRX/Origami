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

// ===================== GLB =====================
const loader = new GLTFLoader();
let glbModel = null;

// ===================== RAYCASTER =====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const maxDistance = 80;

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

// ===================== PALETA DE COLORES =====================
let eyedropperActive = false;
const colors = ['#000000','#888888','#ffffff'];
const totalColors = 97;
for(let i=0;i<totalColors;i++){
  const hue = (i/totalColors)*360;
  const saturation=80;
  const lightness=50;
  colors.push(hslToHex(hue,saturation,lightness));
}
function hslToHex(h,s,l){
  s/=100;l/=100;
  const k=n=>(n+h/30)%12;
  const a=s*Math.min(l,1-l);
  const f=n=>{ const val=l - a * Math.max(Math.min(k(n)-3,9-k(n),1),-1); return Math.round(255*val).toString(16).padStart(2,'0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ===================== PALETA COLLAPSABLE =====================
const paletteWrapper = document.createElement('div');
paletteWrapper.style.position='fixed';
paletteWrapper.style.bottom='10px';
paletteWrapper.style.right='10px';
paletteWrapper.style.zIndex=1000;
paletteWrapper.style.display='flex';
paletteWrapper.style.flexDirection='column';
paletteWrapper.style.alignItems='center';
document.body.appendChild(paletteWrapper);

// Botón toggle paleta
const paletteToggleBtn = document.createElement('button');
paletteToggleBtn.innerHTML='&#x1F308;'; // icono arcoiris
paletteToggleBtn.style.fontSize='1.5em';
paletteToggleBtn.style.width='40px';
paletteToggleBtn.style.height='40px';
paletteToggleBtn.style.borderRadius='6px';
paletteToggleBtn.style.cursor='pointer';
paletteToggleBtn.style.border='2px solid #000';
paletteToggleBtn.style.background='#fff';
paletteWrapper.appendChild(paletteToggleBtn);

// Botón color actual
const currentColorBtn = document.createElement('div');
currentColorBtn.style.width='40px';
currentColorBtn.style.height='40px';
currentColorBtn.style.borderRadius='6px';
currentColorBtn.style.border='2px solid #000';
currentColorBtn.style.background=currentColor;
currentColorBtn.style.cursor='pointer';
currentColorBtn.style.display='flex';
currentColorBtn.style.alignItems='center';
currentColorBtn.style.justifyContent='center';
currentColorBtn.style.boxShadow='0 0 5px rgba(0,0,0,0.5)';
paletteWrapper.appendChild(currentColorBtn);

// Contenedor de paleta
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

paletteToggleBtn.addEventListener('click',()=>{
    paletteDiv.style.display = paletteDiv.style.display==='none'?'grid':'none';
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
  btn.addEventListener('mouseenter',()=>btn.style.outline='2px solid yellow');
  btn.addEventListener('mouseleave',()=>btn.style.outline='none');
  btn.addEventListener('click',()=>{ currentColor=color; currentColorBtn.style.background=color; paletteDiv.style.display='none'; });
  paletteDiv.appendChild(btn);
});

// ===================== SLIDER COLLAPSABLE =====================
const sliderWrapper = document.createElement('div');
sliderWrapper.style.position='fixed';
sliderWrapper.style.top='10px';
sliderWrapper.style.right='10px';
sliderWrapper.style.zIndex=1000;
sliderWrapper.style.display='flex';
sliderWrapper.style.flexDirection='column';
sliderWrapper.style.alignItems='center';
document.body.appendChild(sliderWrapper);

// Botón toggle slider
const sliderBtn = document.createElement('button');
sliderBtn.innerHTML='&#x1F39A;'; // icono estilo "slider"
sliderBtn.style.fontSize='1.5em';
sliderBtn.style.width='40px';
sliderBtn.style.height='40px';
sliderBtn.style.borderRadius='6px';
sliderBtn.style.cursor='pointer';
sliderBtn.style.border='2px solid #000';
sliderBtn.style.background='#fff';
sliderBtn.style.marginBottom='5px';
sliderWrapper.appendChild(sliderBtn);

// Slider oculto por defecto
brushSlider.type='range';
brushSlider.min='1';
brushSlider.max='10';
brushSlider.value='1';
brushSlider.style.width='100px';
brushSlider.style.display='none';
sliderWrapper.appendChild(brushSlider);

sliderBtn.addEventListener('click',()=> {
    brushSlider.style.display = brushSlider.style.display==='none'?'block':'none';
});

// Slider puntero circle
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
  brushSize=parseFloat(brushSlider.value);
  brushCircle.style.width=brushSize*10+'px';
  brushCircle.style.height=brushSize*10+'px';
  brushCircle.style.opacity=1;
  setTimeout(()=>brushCircle.style.opacity=0,2000);
});

// ===================== BOTONES =====================
const exportImgBtn = document.createElement('button');
exportImgBtn.textContent="Exportar Imagen 2x2";
exportImgBtn.style.position='fixed';
exportImgBtn.style.bottom='10px';
exportImgBtn.style.left='10px';
exportImgBtn.style.padding='10px';
exportImgBtn.style.fontSize='1em';
exportImgBtn.style.cursor='pointer';
exportImgBtn.style.zIndex=1000;
document.body.appendChild(exportImgBtn);

const exportGLBBtn = document.createElement('button');
exportGLBBtn.textContent="Exportar GLB";
exportGLBBtn.style.position='fixed';
exportGLBBtn.style.bottom='60px';
exportGLBBtn.style.left='10px';
exportGLBBtn.style.padding='10px';
exportGLBBtn.style.fontSize='1em';
exportGLBBtn.style.cursor='pointer';
exportGLBBtn.style.zIndex=1000;
document.body.appendChild(exportGLBBtn);

const cameraLockBtn=document.createElement('button');
cameraLockBtn.textContent="Bloquear Cámara";
cameraLockBtn.style.position='fixed';
cameraLockBtn.style.bottom='100px';
cameraLockBtn.style.left='10px';
cameraLockBtn.style.padding='10px';
cameraLockBtn.style.fontSize='1em';
cameraLockBtn.style.cursor='pointer';
cameraLockBtn.style.zIndex=1000;
document.body.appendChild(cameraLockBtn);

// ===================== CARGA DE GLB =====================
const loadBtnWrapperGLB = document.createElement('div');
loadBtnWrapperGLB.style.position='fixed';
loadBtnWrapperGLB.style.top='60px';
loadBtnWrapperGLB.style.right='10px';
loadBtnWrapperGLB.style.zIndex=1000;
document.body.appendChild(loadBtnWrapperGLB);

// Botón hamburguesa para toggle input
const loadHamburgerBtn = document.createElement('button');
loadHamburgerBtn.innerHTML='&#9776;';
loadHamburgerBtn.style.fontSize='1.5em';
loadHamburgerBtn.style.width='40px';
loadHamburgerBtn.style.height='40px';
loadHamburgerBtn.style.borderRadius='6px';
loadHamburgerBtn.style.cursor='pointer';
loadHamburgerBtn.style.border='2px solid #000';
loadHamburgerBtn.style.background='#fff';
loadBtnWrapperGLB.appendChild(loadHamburgerBtn);

// Input oculto
const loadFileInput = document.createElement('input');
loadFileInput.type='file';
loadFileInput.accept='.glb';
loadFileInput.style.display='none';
loadBtnWrapperGLB.appendChild(loadFileInput);

// Toggle input
loadHamburgerBtn.addEventListener('click',()=>{
    loadFileInput.style.display = loadFileInput.style.display==='none'?'block':'none';
});

loadFileInput.addEventListener('change', (e)=>{
    if(e.target.files.length>0) loadGLB(e.target.files[0]);
});

// ===================== INTERACCIONES =====================
renderer.domElement.addEventListener('mousemove',onMouseMove);
renderer.domElement.addEventListener('mousedown',onMouseDown);
renderer.domElement.addEventListener('mouseup',()=>isDrawing=false);
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());

// ===================== FUNCIONES DE INTERACCIÓN =====================
function handleHoverAndPaint(intersects){
  if(intersects.length===0){
    if(!glbModel) return;
    glbModel.traverse(child=>{ if(child.isMesh && child!==lastClickedObject) child.material.emissiveIntensity=0; });
    return;
  }
  const hitPoint=intersects[0].point;
  hoveredObject=intersects[0].object;
  glbModel.traverse(child=>{
    if(child.isMesh){
      let shouldHighlight=false;
      if(brushSize<=parseFloat(brushSlider.min)) shouldHighlight=(child===hoveredObject);
      else{
        const pos=child.geometry.attributes.position;
        for(let i=0;i<pos.count;i++){
          const vertex=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
          if(vertex.distanceTo(hitPoint)<=brushSize){ shouldHighlight=true; break; }
        }
      }
      if(child!==lastClickedObject){
        child.material.emissive.setHex(0xffffff);
        child.material.emissiveIntensity=shouldHighlight?0.05:0;
      }
    }
  });
  if(isDrawing && hoveredObject){
    if(brushSize<=parseFloat(brushSlider.min)){
      hoveredObject.material.color.set(currentColor);
      hoveredObject.userData.currentColor=hoveredObject.material.color.clone();
      if(!selectedObjects.includes(hoveredObject)) selectedObjects.push(hoveredObject);
    } else{
      glbModel.traverse(child=>{
        if(child.isMesh){
          const pos=child.geometry.attributes.position;
          for(let i=0;i<pos.count;i++){
            const vertex=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(child.matrixWorld);
            if(vertex.distanceTo(hitPoint)<=brushSize){
              if(!child.userData.currentColor) child.material=child.userData.originalMaterial.clone();
              child.material.color.set(currentColor);
              child.userData.currentColor=child.material.color.clone();
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
  mouse.x=(event.clientX/window.innerWidth)*2-1;
  mouse.y=-(event.clientY/window.innerHeight)*2+1;
  brushCircle.style.left=event.clientX-brushCircle.offsetWidth/2+'px';
  brushCircle.style.top=event.clientY-brushCircle.offsetHeight/2+'px';
  raycaster.setFromCamera(mouse,camera);
  const intersects=raycaster.intersectObjects(glbModel.children,true);
  handleHoverAndPaint(intersects);
}

function onMouseDown(event){
  if(event.button!==0) return;
  isDrawing=true;
  mouse.x=(event.clientX/window.innerWidth)*2-1;
  mouse.y=-(event.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const intersects=raycaster.intersectObjects(glbModel.children,true);
  if(intersects.length>0){
    const clickedObj=intersects[0].object;
    if(eyedropperActive){
      currentColor='#'+clickedObj.material.color.getHexString();
      currentColorBtn.style.background=currentColor;
      eyedropperActive=false;
      return;
    }
    if(lastClickedObject && lastClickedObject!==clickedObj) lastClickedObject.material.emissiveIntensity=0;
    lastClickedObject=clickedObj;
    lastClickedObject.material.emissive.setHex(0xffffff);
    lastClickedObject.material.emissiveIntensity=0.05;
  }
  handleHoverAndPaint(intersects);
}

// ===================== EVENTOS BOTONES =====================
let cameraLocked=false;
cameraLockBtn.addEventListener('click', ()=>{
  cameraLocked=!cameraLocked;
  controls.enableRotate=!cameraLocked;
  cameraLockBtn.textContent=cameraLocked?"Desbloquear Cámara":"Bloquear Cámara";
});

exportImgBtn.addEventListener('click',()=>{
  if(!glbModel) return alert("No hay modelo cargado");
  const positions=[ new THREE.Vector3(0,22,70), new THREE.Vector3(0,22,-70), new THREE.Vector3(70,22,0), new THREE.Vector3(-70,22,0) ];
  const size=4096; const gap=10; const totalSize=size*2+gap;
  const canvas=document.createElement('canvas'); canvas.width=totalSize; canvas.height=totalSize;
  const ctx=canvas.getContext('2d');
  const originalPos=camera.position.clone();
  const originalTarget=controls.target.clone();
  positions.forEach((pos,i)=>{
    camera.position.copy(pos);
    controls.target.set(0,22,0);
    controls.update();
    renderer.render(scene,camera);
    const imgData=renderer.domElement.toDataURL();
    const img=new Image(); img.src=imgData;
    const x=(i%2)*(size+gap);
    const y=Math.floor(i/2)*(size+gap);
    img.onload=()=>ctx.drawImage(img,x,y,size,size);
  });
  setTimeout(()=>{
    const link=document.createElement('a');
    link.href=canvas.toDataURL('image/png');
    link.download='collage_2x2.png';
    link.click();
    camera.position.copy(originalPos);
    controls.target.copy(originalTarget);
    controls.update();
  },500);
});

exportGLBBtn.addEventListener('click', ()=>{
  if(!glbModel) return alert("No hay modelo cargado");
  const exporter = new GLTFExporter();
  exporter.parse(glbModel, (result)=>{
    const output = JSON.stringify(result, null, 2);
    const blob = new Blob([output], {type:'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download='modelo.glb';
    link.click();
  }, {binary:true});
});

// ===================== ANIMACIÓN =====================
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();

// ===================== AJUSTE VENTANA =====================
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});
