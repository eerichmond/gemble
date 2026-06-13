import * as THREE from 'three';
import { isKeyDown } from './input';

const TURN_SPEED = 1.8; // radians per second
const PLAYER_HEIGHT = 1.7; // camera height above ground in units

export interface PlayerResult {
  update: (dt: number) => void;
}

// Phase 0: rotation only. Player stands at the origin and looks around.
// FUTURE Phase 1: add posX/posZ state, MOVE_SPEED, forward/back movement, tree collision
// FUTURE Phase 1: signature becomes createPlayer(camera, getHeightAt, treePositions)
// FUTURE Phase 4: add buildingBoxes parameter for city collision
export function createPlayer(
  camera: THREE.PerspectiveCamera,
  getHeightAt: (x: number, z: number) => number,
): PlayerResult {
  let yaw = 0;

  // Fix the camera at the spawn point for Phase 0
  const spawnX = 0;
  const spawnZ = 0;
  const groundY = getHeightAt(spawnX, spawnZ);
  camera.position.set(spawnX, groundY + PLAYER_HEIGHT, spawnZ);

  function update(dt: number): void {
    if (isKeyDown('ArrowLeft')) yaw += TURN_SPEED * dt;
    if (isKeyDown('ArrowRight')) yaw -= TURN_SPEED * dt;

    // YXZ order: yaw (Y) is applied first in world space.
    // This is the correct order for FPS cameras — adding pitch (X) later won't cause roll.
    camera.rotation.set(0, yaw, 0, 'YXZ');
  }

  return { update };
}
