import * as THREE from 'three';
import Stats from 'stats.js';
import { initScene, onResize } from './scene';
import { createTerrain } from './terrain';
import { createPlayer } from './player';
import { initInput } from './input';
// FUTURE Phase 1: import { createTrees } from './trees';
// FUTURE Phase 2: import { applyDuskAtmosphere } from './atmosphere';
// FUTURE Phase 2: import { createProps } from './props';
// FUTURE Phase 3: import { createRoad } from './road';
// FUTURE Phase 4: import { createCity } from './city';
// FUTURE Phase 4: import { createGem } from './gem';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const { scene, renderer, camera } = initScene(canvas);

const stats = new Stats();
document.body.appendChild(stats.dom);

initInput();

const { getHeightAt } = createTerrain(scene);
const { update: updatePlayer } = createPlayer(camera, getHeightAt);
// FUTURE Phase 1: const { treePositions, update: updateTrees } = createTrees(scene, getHeightAt);
// FUTURE Phase 4: const { collisionBoxes, update: updateCity } = createCity(scene, getHeightAt);
// FUTURE Phase 4: const { update: updateGem } = createGem(scene, getHeightAt);

const clock = new THREE.Clock();

function loop(): void {
  requestAnimationFrame(loop);
  stats.begin();

  const dt = clock.getDelta();
  updatePlayer(dt);
  // FUTURE Phase 1: updateTrees(dt);
  // FUTURE Phase 4: updateCity(dt); updateGem(dt);

  renderer.render(scene, camera);
  stats.end();
}

loop();
window.addEventListener('resize', onResize);
