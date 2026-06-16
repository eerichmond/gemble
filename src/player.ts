import type * as THREE from 'three';
import { isKeyDown } from './input';
import type { TreePosition } from './trees';
import type { CircleObstacle } from './terrain';
import type { BuildingBox } from './city';

const TURN_SPEED = 1.8; // radians per second
const MOVE_SPEED = 8; // units per second
const PLAYER_HEIGHT = 1.7; // camera eye height above ground
const COLLISION_RADIUS = 0.5; // player body radius for collision
const WORLD_LIMIT = 240; // clamp X and north Z to ±240 (terrain is ±250)
const SOUTH_LIMIT = 435; // city extends further south to z≈-440

export interface PlayerResult {
  update: (dt: number) => void;
  setPosition: (x: number, z: number) => void;
}

// --- Pure helper functions (no Three.js — safe to unit test in Node) ---

export function computeMovementDelta(
  yaw: number,
  speed: number,
  dt: number,
): { dx: number; dz: number } {
  // Camera looks down -Z; forward in world space is (-sin(yaw), -cos(yaw))
  return {
    dx: -Math.sin(yaw) * speed * dt,
    dz: -Math.cos(yaw) * speed * dt,
  };
}

export function isBlockedByTree(
  x: number,
  z: number,
  trees: TreePosition[],
  playerRadius: number,
): boolean {
  for (const tree of trees) {
    const dx = x - tree.x;
    const dz = z - tree.z;
    if (Math.sqrt(dx * dx + dz * dz) < playerRadius + tree.radius) return true;
  }
  return false;
}

export function clampToWorld(x: number, z: number, limit: number): { x: number; z: number } {
  return {
    x: Math.max(-limit, Math.min(limit, x)),
    z: Math.max(-limit, Math.min(limit, z)),
  };
}
export function isBlockedByBuilding(
  x: number,
  z: number,
  boxes: BuildingBox[],
  radius: number,
): boolean {
  for (const b of boxes) {
    if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) {
      return true;
    }
  }
  return false;
}

// --- Stateful player controller ---

export function createPlayer(
  camera: THREE.PerspectiveCamera,
  getHeightAt: (x: number, z: number) => number,
  treePositions: TreePosition[] = [],
  mountainObstacles: CircleObstacle[] = [],
  buildingBoxes: BuildingBox[] = [],
): PlayerResult {
  let yaw = 0;
  // Spawn on the city road, facing south into the city
  let posX = 0;
  let posZ = -265;

  // Place camera at spawn height immediately
  camera.position.set(posX, getHeightAt(posX, posZ) + PLAYER_HEIGHT, posZ);

  function update(dt: number): void {
    // Rotation
    if (isKeyDown('ArrowLeft')) yaw += TURN_SPEED * dt;
    if (isKeyDown('ArrowRight')) yaw -= TURN_SPEED * dt;

    // Forward / backward movement (hold Shift to sprint at 3× speed)
    if (isKeyDown('ArrowUp') || isKeyDown('ArrowDown')) {
      const dir = isKeyDown('ArrowUp') ? 1 : -1;
      const sprint = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight') ? 3 : 1;
      const { dx, dz } = computeMovementDelta(yaw, MOVE_SPEED * dir * sprint, dt);

      let newX = posX + dx;
      let newZ = posZ + dz;

      // World boundary — city extends further south than forest terrain
      newX = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, newX));
      newZ = Math.max(-SOUTH_LIMIT, Math.min(WORLD_LIMIT, newZ));

      // Tree, mountain, and building collision
      if (
        !isBlockedByTree(newX, newZ, treePositions, COLLISION_RADIUS) &&
        !isBlockedByTree(newX, newZ, mountainObstacles, COLLISION_RADIUS) &&
        !isBlockedByBuilding(newX, newZ, buildingBoxes, COLLISION_RADIUS)
      ) {
        posX = newX;
        posZ = newZ;
      }
    }

    // Stick camera to terrain surface
    const groundY = getHeightAt(posX, posZ);
    camera.position.set(posX, groundY + PLAYER_HEIGHT, posZ);

    // YXZ rotation order: yaw-first is correct for FPS cameras.
    // Pitch (X) can be added later without causing roll.
    camera.rotation.set(0, yaw, 0, 'YXZ');
  }

  function setPosition(x: number, z: number): void {
    posX = x;
    posZ = z;
  }

  return { update, setPosition };
}
