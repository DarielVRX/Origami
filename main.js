import './core.js';
import './materials.js';
import { loadModel } from './modelLoader.js';
import './palette.js';
import './brush.js';
import './exportImage.js';
import './cameraLock.js';
import './interactions.js';
import { animate } from './animation.js';

loadModel();
animate();
