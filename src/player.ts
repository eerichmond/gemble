import * as THREE from 'three';
import { isKeyDown } from './input';
import type { TreePosition } from './trees';

const TURN_SPEED = 1.8; // radians per second
const MOVE_SPEED = 8; // units per second
const PLAYER_HEIGHT = 1.7; // camera eye height above ground
const COLLISION_RADIUS = 0.5; // player body radius for collision
const WORLD_LIMIT = 240; // clamp position to ±240 (terrain is ±250)

export interface PlayerResult {
  update: (dt: number) => void;
}

// --- Pure helper functions (no Three.js — safe to unit test in Node) ---

export function computeMovementDelta(
  yaw: number,
  speed: number,
  dt: number,
): { dx: number; dz: number } {
  return {
    dx: Math.sin(yaw) * speed * dt,
    dz: Math.cos(yaw) * speed * dt,
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
// FUTURE Phase 4: add isBlockedByBuilding(x, z, boxes, radius) pure helper here

// --- Stateful player controller ---

// FUTURE Phase 4: add buildingBoxes: BuildingBox[] parameter for city collision
export function createPlayer(
  camera: THREE.PerspectiveCamera,
  getHeightAt: (x: number, z: number) => number,
  treePositions: TreePosition[] = [],
): PlayerResult {
  let yaw = 0;
  let posX = 0;
  let posZ = 0;

  // Place camera at spawn height immediately
  camera.position.set(posX, getHeightAt(posX, posZ) + PLAYER_HEIGHT, posZ);

  function update(dt: number): void {
    // Rotation
    if (isKeyDown('ArrowLeft')) yaw += TURN_SPEED * dt;
    if (isKeyDown('ArrowRight')) yaw -= TURN_SPEED * dt;

    // Forward / backward movement
    if (isKeyDown('ArrowUp') || isKeyDown('ArrowDown')) {
      const dir = isKeyDown('ArrowUp') ? 1 : -1;
      const { dx, dz } = computeMovementDelta(yaw, MOVE_SPEED * dir, dt);

      let newX = posX + dx;
      let newZ = posZ + dz;

      // World boundary
      const clamped = clampToWorld(newX, newZ, WORLD_LIMIT);
      newX = clamped.x;
      newZ = clamped.z;

      // Tree collision — only update position if the candidate is clear
      if (!isBlockedByTree(newX, newZ, treePositions, COLLISION_RADIUS)) {
        posX = newX;
        posZ = newZ;
      }
      // FUTURE Phase 4: also check isBlockedByBuilding(newX, newZ, buildingBoxes, COLLISION_RADIUS)
    }

    // Stick camera to terrain surface
    const groundY = getHeightAt(posX, posZ);
    camera.position.set(posX, groundY + PLAYER_HEIGHT, posZ);

    // YXZ rotation order: yaw-first is correct for FPS cameras.
    // Pitch (X) can be added later without causing roll.
    camera.rotation.set(0, yaw, 0, 'YXZ');
  }

  return { update };
}
