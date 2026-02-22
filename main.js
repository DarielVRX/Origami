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

// Botón color actual
const currentColorBtn = document.createElement('div');
currentColorBtn.style.width='40px';
currentColorBtn.style.height='40px';
currentColorBtn.style.borderRadius='6px';
currentColorBtn.style.border='2px solid #000';
currentColorBtn.style.background=currentColor;
currentColorBtn.style.cursor='pointer';
currentColorBtn.title='Click para abrir la paleta';
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

// Mostrar/ocultar paleta
currentColorBtn.addEventListener('click',()=>{
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

// ===================== SLIDER PUNTERO COLAPSABLE =====================
const sliderContainer = document.createElement('div');
sliderContainer.style.position='fixed';
sliderContainer.style.top='20px';
sliderContainer.style.left='50%';
sliderContainer.style.transform='translateX(-50%)';
sliderContainer.style.zIndex=1000;
sliderContainer.style.width='200px';
sliderContainer.style.height='20px';
sliderContainer.style.background='#ccc';
sliderContainer.style.borderRadius='10px';
sliderContainer.style.cursor='pointer';
sliderContainer.style.display='flex';
sliderContainer.style.alignItems='center';
sliderContainer.style.justifyContent='center';
document.body.appendChild(sliderContainer);

const sliderPoint = document.createElement('div');
sliderPoint.style.width='12px';
sliderPoint.style.height='12px';
sliderPoint.style.background='red';
sliderPoint.style.borderRadius='50%';
sliderPoint.style.position='absolute';
sliderPoint.style.left='50%';
sliderPoint.style.transform='translateX(-50%)';
sliderContainer.appendChild(sliderPoint);

const brushSlider = document.createElement('input');
brushSlider.type='range';
brushSlider.min='1';
brushSlider.max='10';
brushSlider.value='1';
brushSlider.style.position='absolute';
brushSlider.style.top='30px';
brushSlider.style.left='50%';
brushSlider.style.transform='translateX(-50%)';
brushSlider.style.width='300px';
brushSlider.style.display='none';
brushSlider.style.zIndex=1001;
document.body.appendChild(brushSlider);

sliderContainer.addEventListener('click',()=>{
  brushSlider.style.display='block';
});
brushSlider.addEventListener('change',()=>{
  brushSize=parseFloat(brushSlider.value);
  brushCircle.style.width=brushSize*10+'px';
  brushCircle.style.height=brushSize*10+'px';
  brushSlider.style.display='none';
});

// ===================== TEXTO DE ARCHIVO =====================
const fileLabel = document.createElement('div');
fileLabel.style.position='fixed';
fileLabel.style.top='70px';
fileLabel.style.left='50%';
fileLabel.style.transform='translateX(-50%)';
fileLabel.style.padding='5px 10px';
fileLabel.style.border='2px solid #444';
fileLabel.style.borderRadius='6px';
fileLabel.style.background='rgba(255,255,255,0.9)';
fileLabel.style.zIndex=1000;
fileLabel.style.fontFamily='sans-serif';
fileLabel.style.fontSize='0.9em';
fileLabel.textContent='No se ha seleccionado';
document.body.appendChild(fileLabel);

// ===================== BOTÓN CARGA ARCHIVO =====================
const fileInput = document.createElement('input');
fileInput.type='file';
fileInput.accept='.glb,.gltf';
fileInput.style.display='none';
document.body.appendChild(fileInput);

const menuBtn = document.createElement('button');
menuBtn.textContent='☰';
menuBtn.style.position='fixed';
menuBtn.style.bottom='10px';
menuBtn.style.left='10px';
menuBtn.style.padding='10px';
menuBtn.style.fontSize='1.2em';
menuBtn.style.cursor='pointer';
menuBtn.style.zIndex=1000;
document.body.appendChild(menuBtn);

const menuContainer = document.createElement('div');
menuContainer.style.position='fixed';
menuContainer.style.bottom='50px';
menuContainer.style.left='10px';
menuContainer.style.padding='5px';
menuContainer.style.background='rgba(255,255,255,0.95)';
menuContainer.style.border='1px solid #000';
menuContainer.style.borderRadius='6px';
menuContainer.style.display='none';
menuContainer.style.flexDirection='column';
menuContainer.style.gap='5px';
menuContainer.style.zIndex=1000;
document.body.appendChild(menuContainer);

menuBtn.addEventListener('click',()=>menuContainer.style.display = menuContainer.style.display==='none'?'flex':'none');

// Botones internos del menú
const exportImgBtn = document.createElement('button');
exportImgBtn.textContent="Exportar Imagen 2x2";
const exportGLBBtn = document.createElement('button');
exportGLBBtn.textContent="Exportar GLB";
const cameraLockBtn = document.createElement('button');
cameraLockBtn.textContent="Bloquear Cámara";
const loadModelBtn = document.createElement('button');
loadModelBtn.textContent="Cargar Modelo";

[exportImgBtn, exportGLBBtn, cameraLockBtn, loadModelBtn].forEach(b=>{
  b.style.padding='5px';
  b.style.fontSize='0.9em';
  b.style.cursor='pointer';
  menuContainer.appendChild(b);
});

// ===================== FUNCIONALIDADES MENU =====================
let cameraLocked=false;
cameraLockBtn.addEventListener('click',()=>{
  cameraLocked=!cameraLocked;
  controls.enableRotate=!cameraLocked;
  cameraLockBtn.textContent=cameraLocked?"Desbloquear Cámara":"Bloquear Cámara";
});

exportImgBtn.addEventListener('click',()=>{
  if(!glbModel) return alert("No hay modelo cargado");
  const positions=[ new THREE.Vector3(0,22,70), new THREE.Vector3(0,22,-70), new THREE.Vector3(70,22,0), new THREE.Vector3(-70,22,0) ];
  const size=4096;
  const gap=10;
  const totalSize=size*2+gap;
  const canvas=document.createElement('canvas');
  canvas.width=totalSize;
  canvas.height=totalSize;
  const ctx=canvas.getContext('2d');
  const originalPos=camera.position.clone();
  const originalTarget=controls.target.clone();
  positions.forEach((pos,i)=>{
    camera.position.copy(pos);
    controls.target.set(0,22,0);
    controls.update();
    renderer.render(scene,camera);
    const imgData=renderer.domElement.toDataURL();
    const img=new Image();
    img.src=imgData;
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


// ===================== EXPORTAR GLB FUNCIONAL =====================
function exportGLB(){
  if(!glbModel) return alert("No hay modelo cargado");

  // Actualizar materiales con colores seleccionados
  glbModel.traverse(child=>{
    if(child.isMesh){
      child.material = child.userData.originalMaterial.clone();
      if(child.userData.currentColor) child.material.color.copy(child.userData.currentColor);
    }
  });

  const exporter = new GLTFExporter();
  exporter.parse(glbModel, function(result){
    let blob;
    if(result instanceof ArrayBuffer){
      blob = new Blob([result], {type:'model/gltf-binary'});
    } else {
      const output = JSON.stringify(result, null, 2);
      blob = new Blob([output], {type:'application/json'});
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download='modelo.glb';
    link.click();
  }, {binary:true});
}

loadModelBtn.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{
  const file = e.target.files[0];
  if(!file) return;
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
  fileLabel.textContent=file.name;
});

// ===================== GOTERO =====================
const eyedropperBtn = document.createElement('div');
eyedropperBtn.style.width='30px';
eyedropperBtn.style.height='30px';
eyedropperBtn.style.marginTop='5px';
eyedropperBtn.style.borderRadius='4px';
eyedropperBtn.style.border='2px solid #000';
eyedropperBtn.style.background='url(data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTguNSAxOC41TDEwIDIwTDE2IDE0bC0xLjUtMS41TDguNSAxOC41eiIvPjwvc3ZnPg==) center/contain no-repeat';
eyedropperBtn.style.cursor='pointer';
eyedropperBtn.title='Activar gotero';
paletteWrapper.appendChild(eyedropperBtn);

eyedropperBtn.addEventListener('click',()=>{
  eyedropperActive=!eyedropperActive;
  eyedropperBtn.style.boxShadow = eyedropperActive?'0 0 8px 2px yellow':'none';
});

// ===================== INTERACCIONES =====================
const brushCircle = document.createElement('div');
brushCircle.style.position='fixed';
brushCircle.style.border='2px solid red';
brushCircle.style.borderRadius='50%';
brushCircle.style.pointerEvents='none';
brushCircle.style.width=brushSize*10+'px';
brushCircle.style.height=brushSize*10+'px';
brushCircle.style.transition='opacity 0.3s';
document.body.appendChild(brushCircle);

renderer.domElement.addEventListener('mousemove',onMouseMove);
renderer.domElement.addEventListener('mousedown',onMouseDown);
renderer.domElement.addEventListener('mouseup',()=>isDrawing=false);
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());

function handleHoverAndPaint(intersects){
  if(intersects.length===0){
    if(glbModel) glbModel.traverse(child=>{ if(child.isMesh && child!==lastClickedObject) child.material.emissiveIntensity=0; });
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
      eyedropperBtn.style.boxShadow='none';
      return;
    }
    if(lastClickedObject && lastClickedObject!==clickedObj) lastClickedObject.material.emissiveIntensity=0;
    lastClickedObject=clickedObj;
    lastClickedObject.material.emissive.setHex(0xffffff);
    lastClickedObject.material.emissiveIntensity=0.05;
  }
  handleHoverAndPaint(intersects);
}

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

