import * as THREE from 'three';
import Stats from 'stats.js';
import { initScene, onResize } from './scene';
import { createTerrain } from './terrain';
import { createTrees } from './trees';
import { createProps } from './props';
import { createPlayer } from './player';
import { initInput } from './input';
import { createRoad, getRoadObstacles } from './road';
import { createCity } from './city';
import { createGem } from './gem';
import { createCompass } from './compass';
import { initAudio } from './audio';
import { createFlyingEye } from './monsters';
// FUTURE Phase 2: import { applyDuskAtmosphere } from './atmosphere';

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

// Phase 4: city sits directly on the extended terrain mesh
const { collisionBoxes, update: updateCity } = createCity(scene, getHeightAt);

// Phase 4: gem at the apartment base
const { update: updateGem, obstacle: gemObstacle } = createGem(scene, getHeightAt);

const { update: updatePlayer } = createPlayer(
  camera,
  getHeightAt,
  treePositions,
  [...mountainObstacles, gemObstacle],
  collisionBoxes,
);

const compass = createCompass(camera);
initAudio();
const { update: updateFlyingEye } = createFlyingEye(scene, getHeightAt(0, -310));

const clock = new THREE.Clock();

function loop(): void {
  requestAnimationFrame(loop);
  stats.begin();

  const dt = clock.getDelta();
  updatePlayer(dt);
  updateCity(dt);
  updateGem(dt);
  updateFlyingEye(dt, camera.position.x, camera.position.z);
  compass.update();

  renderer.render(scene, camera);
  stats.end();
}

loop();
window.addEventListener('resize', onResize);
