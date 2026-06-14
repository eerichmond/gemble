import * as THREE from 'three';
import Stats from 'stats.js';
import { initScene, onResize } from './scene';
import { createTerrain } from './terrain';
import { createTrees } from './trees';
import { createProps } from './props';
import { createPlayer } from './player';
import { initInput } from './input';
import { createRoad, getRoadObstacles } from './road';
// FUTURE Phase 2: import { applyDuskAtmosphere } from './atmosphere';
// FUTURE Phase 4: import { createCity } from './city';
// FUTURE Phase 4: import { createGem } from './gem';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const { scene, renderer, camera } = initScene(canvas);

const stats = new Stats();
document.body.appendChild(stats.dom);

initInput();

const { getHeightAt, mountainObstacles } = createTerrain(scene);
const roadObstacles = getRoadObstacles();
const excludeZones = [...mountainObstacles, ...roadObstacles];
const { treePositions } = createTrees(scene, getHeightAt, excludeZones);
createProps(scene, getHeightAt, excludeZones);
createRoad(scene, getHeightAt);
const { update: updatePlayer } = createPlayer(
  camera,
  getHeightAt,
  treePositions,
  mountainObstacles,
);
// FUTURE Phase 4: const { collisionBoxes, update: updateCity } = createCity(scene, getHeightAt);
// FUTURE Phase 4: const { update: updateGem } = createGem(scene, getHeightAt);

const clock = new THREE.Clock();

function loop(): void {
  requestAnimationFrame(loop);
  stats.begin();

  const dt = clock.getDelta();
  updatePlayer(dt);
  // FUTURE Phase 4: updateCity(dt); updateGem(dt);

  renderer.render(scene, camera);
  stats.end();
}

loop();
window.addEventListener('resize', onResize);
