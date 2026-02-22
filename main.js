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
const lastClickMaterial = baseMaterial.clone();
lastClickMaterial.emissive.setHex(0xffffff);
lastClickMaterial.emissiveIntensity = 0.05;
const hoverMaterial = baseMaterial.clone();
hoverMaterial.emissive.setHex(0xffffff);
hoverMaterial.emissiveIntensity = 0.05;

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

// ===================== CARGA DE GLB =====================
function loadGLB(file){
    const url = URL.createObjectURL(file);
    loader.load(url, (gltf) => {
        if(glbModel) scene.remove(glbModel);
        glbModel = gltf.scene;
        glbModel.scale.set(0.5, 0.5, 0.5);
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

// Botón de carga
const loadBtn = document.createElement('input');
loadBtn.type = 'file';
loadBtn.accept = '.glb';
loadBtn.style.position='fixed';
loadBtn.style.top='10px';
loadBtn.style.left='10px';
loadBtn.style.zIndex=1000;
document.body.appendChild(loadBtn);
loadBtn.addEventListener('change', (e)=>{
    if(e.target.files.length>0) loadGLB(e.target.files[0]);
});

// ===================== PALETA =====================
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
    const f=n=>{ const val=l - a * Math.max(Math.min(k(n)-3,9-k(n),1),-1); return Math.round(255*val).toString(16).padStart(2,'0'); };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// ===================== MENU COLLAPSABLE =====================
const menuBtn = document.createElement('div');
menuBtn.textContent = '≡';
menuBtn.style.position='fixed';
menuBtn.style.top='10px';
menuBtn.style.right='10px';
menuBtn.style.fontSize='24px';
menuBtn.style.cursor='pointer';
menuBtn.style.zIndex=1000;
menuBtn.style.background='white';
menuBtn.style.padding='4px';
menuBtn.style.borderRadius='4px';
document.body.appendChild(menuBtn);

const menuPanel = document.createElement('div');
menuPanel.style.position='fixed';
menuPanel.style.top='40px';
menuPanel.style.right='10px';
menuPanel.style.background='rgba(255,255,255,0.95)';
menuPanel.style.padding='8px';
menuPanel.style.borderRadius='6px';
menuPanel.style.display='none';
menuPanel.style.flexDirection='column';
menuPanel.style.gap='6px';
menuPanel.style.zIndex=1000;
document.body.appendChild(menuPanel);

menuBtn.addEventListener('click',()=>menuPanel.style.display = menuPanel.style.display==='none' ? 'flex':'none');

// ====== Slider ======
const brushSlider = document.createElement('input');
brushSlider.type='range';
brushSlider.min='1';
brushSlider.max='10';
brushSlider.value=brushSize;
brushSlider.style.width='150px';
menuPanel.appendChild(brushSlider);

const brushCircle = document.createElement('div');
brushCircle.style.position='fixed';
brushCircle.style.border='2px solid red';
brushCircle.style.borderRadius='50%';
brushCircle.style.pointerEvents='none';
brushCircle.style.width=brushSize*10+'px';
brushCircle.style.height=brushSize*10+'px';
brushCircle.style.transition='opacity 0.3s';
document.body.appendChild(brushCircle);

brushSlider.addEventListener('input',()=>{ brushSize=parseFloat(brushSlider.value); brushCircle.style.width=brushSize*10+'px'; brushCircle.style.height=brushSize*10+'px'; brushCircle.style.opacity=1; setTimeout(()=>brushCircle.style.opacity=0,2000); });

// ====== Exportar Imagen 2x2 ======
const exportImgBtn = document.createElement('button');
exportImgBtn.textContent = 'Exportar Imagen 2x2';
menuPanel.appendChild(exportImgBtn);

// ====== Exportar GLB ======
const exportGLBBtn = document.createElement('button');
exportGLBBtn.textContent = 'Exportar GLB';
menuPanel.appendChild(exportGLBBtn);
import { GLTFExporter } from 'https://unpkg.com/three@0.163.0/examples/jsm/exporters/GLTFExporter.js?module';
const exporter = new GLTFExporter();
exportGLBBtn.addEventListener('click',()=>{
    if(!glbModel) return alert("No hay modelo cargado");
    exporter.parse(glbModel, (result)=>{
        const output = JSON.stringify(result);
        const blob = new Blob([output], {type:'application/json'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'modelo.glb';
        link.click();
    });
});

// ====== Bloqueo cámara ======
let cameraLocked=false;
const cameraLockBtn = document.createElement('button');
cameraLockBtn.textContent = 'Bloquear cámara';
menuPanel.appendChild(cameraLockBtn);
cameraLockBtn.addEventListener('click', ()=>{
    cameraLocked = !cameraLocked;
    controls.enableRotate = !cameraLocked;
    cameraLockBtn.textContent = cameraLocked ? 'Desbloquear cámara':'Bloquear cámara';
});

// ===================== INTERACCIONES =====================
const maxDistance = 80;
renderer.domElement.addEventListener('mousemove',onMouseMove);
renderer.domElement.addEventListener('mousedown',onMouseDown);
renderer.domElement.addEventListener('mouseup',()=>{ isDrawing=false; if(brushSliderDragging) finishBrushDrag(); });
renderer.domElement.addEventListener('contextmenu', e=>e.preventDefault());

let brushSliderDragging=false;
brushSlider.addEventListener('mousedown',()=>brushSliderDragging=true);
brushSlider.addEventListener('mouseup',()=>{ if(brushSliderDragging){ brushSliderDragging=false; }});

// ====== GOTERO ======
let eyedropperActive=false;
function handleEyedropperClick(obj){
    if(obj.material && obj.material.color){
        currentColor = '#'+obj.material.color.getHexString();
    }
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
