import { state } from './state.js';

function hslToHex(h,s,l){
  s/=100; l/=100;
  const k=n=>(n+h/30)%12;
  const a=s*Math.min(l,1-l);
  const f=n=>{
    const val=l - a*Math.max(Math.min(k(n)-3,9-k(n),1),-1);
    return Math.round(255*val).toString(16).padStart(2,'0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const colors = ['#000000','#888888','#ffffff'];
const totalColors = 97;

for(let i=0;i<totalColors;i++){
  const hue=(i/totalColors)*360;
  colors.push(hslToHex(hue,80,50));
}

const paletteDiv=document.createElement('div');
paletteDiv.style.position='fixed';
paletteDiv.style.bottom='10px';
paletteDiv.style.right='10px';
paletteDiv.style.display='grid';
paletteDiv.style.gridTemplateColumns='repeat(6,1fr)';
paletteDiv.style.gap='6px';
paletteDiv.style.background='rgba(255,255,255,0.95)';
paletteDiv.style.padding='5px';
paletteDiv.style.maxHeight='60vh';
paletteDiv.style.overflowY='auto';
paletteDiv.style.zIndex=1000;
document.body.appendChild(paletteDiv);

colors.forEach(color=>{
  const btn=document.createElement('div');
  btn.style.width='25px';
  btn.style.height='25px';
  btn.style.background=color;
  btn.style.cursor='pointer';
  btn.title=color;

  btn.addEventListener('click',()=>{
    state.currentColor = color;
  });

  paletteDiv.appendChild(btn);
});
