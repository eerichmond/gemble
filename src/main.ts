import * as THREE from 'three';
import Stats from 'stats.js';
import { initScene, onResize } from './scene';
import { createTerrain } from './terrain';
import { createTrees } from './trees';
import { createProps } from './props';
import { createPlayer } from './player';
import { initInput } from './input';
import { createRoad, getRoadObstacles, makeBridgedHeight } from './road';
import { createCity } from './city';
import { createGem } from './gem';
import { createCompass } from './compass';
import { initAudio } from './audio';
import { createFlyingEye, createMonsters } from './monsters';
import { createChests } from './chests';
import { createBirds } from './birds';
import { createCapybaras } from './capybaras';
import { createGhosts } from './ghosts';
import {
  createWaterways,
  RIVER_WEST_EXCLUSIONS,
  RIVER_EAST_EXCLUSIONS,
  RIVER_MAIN_EXCLUSIONS,
} from './waterways';
import { createFlankTrees } from './trees';
import { createInventory } from './inventory';
import { createMinimap } from './minimap';

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

const { collisionBoxes, update: updateCity } = createCity(scene, getHeightAt);
const { update: updateGem, obstacles: gemObstacles } = createGem(scene, getHeightAt);

const inventory = createInventory(scene, camera);

// All circle exclusion zones: mountains + road + tree trunks
const allCircleZones = [...excludeZones, ...treePositions];

const { update: updateChests, obstacles: chestObstacles } = createChests(
  scene,
  getHeightAt,
  allCircleZones,
  type => inventory.pickupItem(type),
);

createWaterways(scene);
const flankTreePositions = createFlankTrees(scene, getHeightAt, [
  ...RIVER_MAIN_EXCLUSIONS,
  ...RIVER_WEST_EXCLUSIONS,
  ...RIVER_EAST_EXCLUSIONS,
]);

const playerHeightAt = makeBridgedHeight(getHeightAt);

const { update: updatePlayer } = createPlayer(
  camera,
  playerHeightAt,
  [...treePositions, ...flankTreePositions],
  [...mountainObstacles, ...gemObstacles, ...chestObstacles, ...crystalObstacles],
  collisionBoxes,
);
const { update: updateBirds } = createBirds(scene, getHeightAt, allCircleZones);
const { update: updateCapybaras, capybaraPositions } = createCapybaras(
  scene,
  getHeightAt,
  allCircleZones,
);
const { update: updateGhosts } = createGhosts(scene, getHeightAt);
const { update: updateForestMonsters, positions: monsterPositions } = createMonsters(
  scene,
  getHeightAt,
  allCircleZones,
  collisionBoxes,
);

const compass = createCompass(camera);
initAudio();
const { update: updateFlyingEye } = createFlyingEye(scene, getHeightAt(0, -310));

// Minimap: gem at (-52, 108), flying eye at (0, -310), chests from chestObstacles
const minimap = createMinimap(
  [
    { x: -52, z: 108, type: 'gem' },
    { x: 0, z: -310, type: 'flyingEye' },
    ...chestObstacles.map(c => ({ x: c.x, z: c.z, type: 'chest' as const })),
  ],
  monsterPositions,
  capybaraPositions,
);

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
  updateForestMonsters(dt);
  compass.update();
  inventory.update();
  minimap.update(camera.position.x, camera.position.z, camera.rotation.y);

  renderer.render(scene, camera);
  stats.end();
}

loop();
window.addEventListener('resize', onResize);
