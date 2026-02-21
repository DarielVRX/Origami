import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { renderer, camera } from './core.js';
import { state } from './state.js';
import { brushCircle } from './brush.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const maxDistance = 80;

renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mouseup', () => state.isDrawing = false);
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

function onMouseMove(event){

  if(!state.glbModel) return;

  mouse.x = (event.clientX / window.innerWidth)*2-1;
  mouse.y = -(event.clientY / window.innerHeight)*2+1;

  brushCircle.style.left = event.clientX - brushCircle.offsetWidth/2 + 'px';
  brushCircle.style.top = event.clientY - brushCircle.offsetHeight/2 + 'px';

  raycaster.setFromCamera(mouse,camera);
  const intersects = raycaster.intersectObjects(state.glbModel.children,true);

  if(intersects.length > 0 && intersects[0].distance <= maxDistance){

    const hitPoint = intersects[0].point;

    if(state.isDrawing){

      state.glbModel.traverse(child=>{

        if(child.isMesh){

          child.geometry.computeBoundingSphere();

          const sphere = child.geometry.boundingSphere
            .clone()
            .applyMatrix4(child.matrixWorld);

          const dist = sphere.center.distanceTo(hitPoint);

          if(dist <= state.brushSize){

            if(!child.userData.currentColor){
              child.material = child.userData.originalMaterial.clone();
            }

            child.material.color.set(state.currentColor);
            child.userData.currentColor = child.material.color.clone();

            if(!state.selectedObjects.includes(child)){
              state.selectedObjects.push(child);
            }
          }
        }
      });
    }
  }
}

function onMouseDown(event){
  if(event.button===0){
    state.isDrawing = true;
    onMouseMove(event);
  }
}
