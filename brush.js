import { state } from './state.js';

export const brushSlider=document.createElement('input');
brushSlider.type='range';
brushSlider.min='1';
brushSlider.max='10';
brushSlider.value=state.brushSize;
brushSlider.style.position='fixed';
brushSlider.style.top='20px';
brushSlider.style.left='50%';
brushSlider.style.transform='translateX(-50%)';
brushSlider.style.zIndex=1000;
brushSlider.style.width='1000px';
document.body.appendChild(brushSlider);

export const brushCircle=document.createElement('div');
brushCircle.style.position='fixed';
brushCircle.style.border='2px solid red';
brushCircle.style.borderRadius='50%';
brushCircle.style.pointerEvents='none';
brushCircle.style.width=state.brushSize*10+'px';
brushCircle.style.height=state.brushSize*10+'px';
brushCircle.style.transition='opacity 0.3s';
document.body.appendChild(brushCircle);

brushSlider.addEventListener('input',()=>{
  state.brushSize = parseFloat(brushSlider.value);

  brushCircle.style.width = state.brushSize*10+'px';
  brushCircle.style.height = state.brushSize*10+'px';
  brushCircle.style.opacity = 1;

  setTimeout(()=>brushCircle.style.opacity=0,2000);
});
