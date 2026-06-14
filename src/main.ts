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
import { createChests } from './chests';
import { createBirds } from './birds';
import { createCapybaras } from './capybaras';
import { createGhosts } from './ghosts';
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
const { crystalObstacles } = createRoad(scene, getHeightAt);

// Phase 4: city sits directly on the extended terrain mesh
const { collisionBoxes, update: updateCity } = createCity(scene, getHeightAt);

// Phase 4: gem at the apartment base
const { update: updateGem, obstacles: gemObstacles } = createGem(scene, getHeightAt);

const { update: updateChests, obstacles: chestObstacles } = createChests(scene, getHeightAt, mountainObstacles);

const { update: updatePlayer } = createPlayer(
  camera,
  getHeightAt,
  treePositions,
  [...mountainObstacles, ...gemObstacles, ...chestObstacles, ...crystalObstacles],
  collisionBoxes,
);
const { update: updateBirds } = createBirds(scene, getHeightAt);
const { update: updateCapybaras } = createCapybaras(scene, getHeightAt, excludeZones);
const { update: updateGhosts } = createGhosts(scene, getHeightAt);

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
  updateChests(dt, camera.position.x, camera.position.z);
  updateBirds(dt, camera.position.x, camera.position.z);
  updateCapybaras(dt);
  updateGhosts(dt);
  compass.update();

  renderer.render(scene, camera);
  stats.end();
}

loop();
window.addEventListener('resize', onResize);
