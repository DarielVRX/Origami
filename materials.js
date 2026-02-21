import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js?module';

export const baseMaterial = new THREE.MeshStandardMaterial({color:0xaaaaaa});

export const hoverMaterial = baseMaterial.clone();
hoverMaterial.emissive.setHex(0x333333);

export const lastClickedMaterial = baseMaterial.clone();
lastClickedMaterial.emissive.setHex(0x555555);
