import { renderer, scene, camera, controls } from './core.js';

export function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
