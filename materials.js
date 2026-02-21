import { THREE } from './core.js';

export const baseMaterial = new THREE.MeshStandardMaterial({color:0xaaaaaa});

export const hoverMaterial = baseMaterial.clone();
hoverMaterial.emissive.setHex(0x333333);

export const lastClickedMaterial = baseMaterial.clone();
lastClickedMaterial.emissive.setHex(0x555555);
