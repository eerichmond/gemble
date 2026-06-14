import * as THREE from 'three';
import type { CircleObstacle } from './terrain';
import type { BuildingBox } from './city';

// ── Phase 10 — Waterways ──────────────────────────────────────────────────────
// Pond west of city → stream → cliff face → river at west map edge.

// Pond at (-110, terrain, -340): directly west of the apartment building (25, -330).
// Radius 11 ≈ apartment footprint width of 20. Stream runs due west to cliff at x=-185.
// River (55 u wide) sits behind the cliff at y=-5, visible from cliff top.

const POND_X      = -110;
const POND_Z      = -340;
const POND_RADIUS = 11;

const STREAM_Z    = -340;
const STREAM_W    = 3.2;    // stream width in units
const STREAM_SEGS = 8;      // terrain-sample segments
const STREAM_X0   = POND_X - POND_RADIUS - 0.5; // -121.5 (west edge of pond + gap)
const STREAM_X1   = -185;   // cliff base

const CLIFF_X     = -189;   // cliff face center x
const RIVER_Y     = -5;     // river surface (below typical terrain near cliff)
const RIVER_W     = 55;     // well over 30-unit minimum

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ── Pond ──────────────────────────────────────────────────────────────────────

function buildPond(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): CircleObstacle {
  const y = getHeightAt(POND_X, POND_Z) + 0.05;

  const geo = new THREE.CircleGeometry(POND_RADIUS, 40);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: 0x2a5a8a,
    transparent: true,
    opacity: 0.90,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(POND_X, y, POND_Z);
  scene.add(mesh);

  return { x: POND_X, z: POND_Z, radius: POND_RADIUS + 0.5 };
}

// ── Pond surrounds — rocks and bushes ─────────────────────────────────────────

function buildPondSurrounds(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): void {
  const rng = makeLcg(303);

  const rockMat = new THREE.MeshLambertMaterial({ color: 0x707060 });
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x2a5a1a });

  // 10 rocks in a loose ring 12–17 u from pond center
  for (let i = 0; i < 10; i++) {
    const angle = rng() * Math.PI * 2;
    const dist  = 12 + rng() * 5;
    const rx    = POND_X + Math.cos(angle) * dist;
    const rz    = POND_Z + Math.sin(angle) * dist;
    const ry    = getHeightAt(rx, rz);
    const r     = 0.4 + rng() * 0.5;
    const geo   = new THREE.SphereGeometry(r, 7, 5);
    const mesh  = new THREE.Mesh(geo, rockMat);
    // Bury slightly so only dome shows
    mesh.position.set(rx, ry - r * 0.3, rz);
    scene.add(mesh);
  }

  // 7 bushes slightly further out (15–22 u)
  for (let i = 0; i < 7; i++) {
    const angle = rng() * Math.PI * 2;
    const dist  = 15 + rng() * 7;
    const bx    = POND_X + Math.cos(angle) * dist;
    const bz    = POND_Z + Math.sin(angle) * dist;
    const by    = getHeightAt(bx, bz);
    const r     = 0.7 + rng() * 0.5;
    const geo   = new THREE.SphereGeometry(r, 7, 5);
    const mesh  = new THREE.Mesh(geo, bushMat);
    mesh.scale.set(1.6, 0.85, 1.6);
    mesh.position.set(bx, by + r * 0.3, bz);
    scene.add(mesh);
  }
}

// ── Stream ────────────────────────────────────────────────────────────────────
// Terrain-following ribbon: STREAM_SEGS segments, each sampling terrain height
// at its center to handle sloping ground between pond and cliff.

function buildStream(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): void {
  const totalLen  = STREAM_X1 - STREAM_X0; // negative (going west)
  const segLen    = totalLen / STREAM_SEGS;
  const streamMat = new THREE.MeshLambertMaterial({
    color: 0x2a6a6a,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });

  for (let i = 0; i < STREAM_SEGS; i++) {
    const xCenter = STREAM_X0 + (i + 0.5) * segLen;
    const y       = getHeightAt(xCenter, STREAM_Z) + 0.08;
    const geo     = new THREE.PlaneGeometry(Math.abs(segLen) + 0.2, STREAM_W);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, streamMat);
    mesh.position.set(xCenter, y, STREAM_Z);
    scene.add(mesh);
  }
}

// ── Cliff Face ────────────────────────────────────────────────────────────────
// Tall rocky wall from z=-450 to z=+250 at x≈-185 to -193.
// Two overlapping panels at slightly different heights/x give a craggy layered look.

function buildCliff(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): BuildingBox {
  const CLIFF_DEPTH = 10;
  const CLIFF_H     = 18;   // tall enough to be visible from 80+ u
  const CLIFF_SPAN  = 710;  // z span: -450 to +260

  // Base y: sample terrain at cliff midpoint; cliff face protrudes from ground up
  const baseY = getHeightAt(CLIFF_X, -100);

  const mat1 = new THREE.MeshLambertMaterial({ color: 0x3a3a30 });
  const mat2 = new THREE.MeshLambertMaterial({ color: 0x2a2a20 });

  // Main cliff slab
  const geo1  = new THREE.BoxGeometry(CLIFF_DEPTH, CLIFF_H, CLIFF_SPAN);
  const face1 = new THREE.Mesh(geo1, mat1);
  face1.position.set(CLIFF_X, baseY + CLIFF_H * 0.5 - 2, -100);
  scene.add(face1);

  // Secondary jagged layer: slightly narrower, pushed forward, different height
  const geo2  = new THREE.BoxGeometry(CLIFF_DEPTH * 0.6, CLIFF_H * 0.7, CLIFF_SPAN);
  const face2 = new THREE.Mesh(geo2, mat2);
  face2.position.set(CLIFF_X + 4, baseY + CLIFF_H * 0.35 - 2, -100);
  scene.add(face2);

  // Collision: AABB blocking player from crossing into the river
  return { minX: CLIFF_X - CLIFF_DEPTH, maxX: CLIFF_X + 2, minZ: -450, maxZ: 260 };
}

// ── River ─────────────────────────────────────────────────────────────────────
// Wide flat water plane behind the cliff, running the full north-south world extent.

function buildRiver(scene: THREE.Scene): void {
  // Center the river between cliff face and map edge
  const cx = (CLIFF_X + (-250)) / 2; // ≈ -219.5

  const geo = new THREE.PlaneGeometry(RIVER_W, 720);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({
    color: 0x1a4a7a,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, RIVER_Y, -100);
  scene.add(mesh);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface WaterwaysResult {
  pondObstacle: CircleObstacle;
  cliffBox: BuildingBox;
}

export function createWaterways(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): WaterwaysResult {
  const pondObstacle = buildPond(scene, getHeightAt);
  buildPondSurrounds(scene, getHeightAt);
  buildStream(scene, getHeightAt);
  const cliffBox = buildCliff(scene, getHeightAt);
  buildRiver(scene);

  return { pondObstacle, cliffBox };
}

// Export pond position so trees.ts can exclude the pond area from flank placement
export const POND_EXCLUSION: CircleObstacle = { x: POND_X, z: POND_Z, radius: 22 };
