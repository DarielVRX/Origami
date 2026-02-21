import { controls } from './core.js';

export let cameraLocked=false;

const cameraLockBtn=document.createElement('button');
cameraLockBtn.textContent="Bloquear Cámara";
cameraLockBtn.style.position='fixed';
cameraLockBtn.style.bottom='100px';
cameraLockBtn.style.left='10px';
cameraLockBtn.style.padding='10px';
cameraLockBtn.style.zIndex=1000;
document.body.appendChild(cameraLockBtn);

cameraLockBtn.addEventListener('click',()=>{
  cameraLocked=!cameraLocked;
  controls.enableRotate=!cameraLocked;
  cameraLockBtn.textContent=cameraLocked?
    "Desbloquear Cámara":"Bloquear Cámara";
});
