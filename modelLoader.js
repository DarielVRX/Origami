import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';
import { GLTFLoader } from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js?module';
import { scene, controls } from './core.js';
import { baseMaterial } from './materials.js';
import { state } from './state.js';

const loader = new GLTFLoader();

export function loadModel(){

  loader.load(
    'ModeloGLB.glb',

    (gltf) => {

      if(state.glbModel){
        scene.remove(state.glbModel);
      }

      state.glbModel = gltf.scene;

      state.glbModel.scale.set(0.5, 0.5, 0.5);
      state.glbModel.position.set(0, 0, 0);

      state.glbModel.traverse(child => {

        if(child.isMesh){

          child.material = baseMaterial.clone();

          child.userData.originalMaterial = child.material.clone();

          child.geometry.computeBoundingSphere();
        }

      });

      scene.add(state.glbModel);

      const box = new THREE.Box3().setFromObject(state.glbModel);
      const center = box.getCenter(new THREE.Vector3());

      controls.target.copy(center);
      controls.update();

      console.log("¡GLB cargado automáticamente!");

    },

    undefined,

    (error) => {
      console.error(error);
    }

  );
}
