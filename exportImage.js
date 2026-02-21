import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { scene, camera, renderer, controls } from './core.js';
import { glbModel } from './modelLoader.js';

const exportImgBtn=document.createElement('button');
exportImgBtn.textContent="Exportar Imagen 2x2";
exportImgBtn.style.position='fixed';
exportImgBtn.style.bottom='10px';
exportImgBtn.style.left='10px';
exportImgBtn.style.padding='10px';
exportImgBtn.style.zIndex=1000;
document.body.appendChild(exportImgBtn);

exportImgBtn.addEventListener('click',()=>{
  if(!glbModel) return alert("No hay modelo cargado");

  const positions=[
    new THREE.Vector3(0,22,70),
    new THREE.Vector3(0,22,-70),
    new THREE.Vector3(70,22,0),
    new THREE.Vector3(-70,22,0)
  ];

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
