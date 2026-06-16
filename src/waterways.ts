import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

// ── Phase 10 — Waterways ──────────────────────────────────────────────────────
// Winding river at the city/forest boundary (z≈-262), with freeway-style bridge
// where the road crosses. East and west arms wind south along the city flanks.
// Terrain carving in terrain.ts creates the embankment; water planes sit at RIVER_Y.

const POND_X = -110;
const POND_Z = -340;
const POND_RADIUS = 11;

// Water surface sits inside the carved channel (terrain.ts carves 6 u deep; flat
// terrain≈0 → channel floor≈-6; RIVER_Y=-3 gives ~3 u visible water depth).
const RIVER_Y = -3.0;
const ARM_Y   = -2.5; // arms are shallower

// ── River spine waypoints — must match terrain.ts RIVER_*_SPINE exactly ───────
const MAIN_SPINE: [number, number][] = [
  [-250, -280], [-160, -270], [-80, -264], [-30, -262],
  [4, -261], [35, -261], [90, -267], [165, -275], [250, -283],
];
const WEST_ARM: [number, number][] = [
  [-80, -264], [-90, -305], [-102, -352], [-114, -400], [-118, -450],
];
const EAST_ARM: [number, number][] = [
  [90, -267], [100, -312], [110, -358], [120, -408], [130, -450],
];

// Bridge geometry constants — kept in sync with road.ts makeBridgedHeight
const BRIDGE_Z_CENTER = -265; // midpoint of z=-248..z=-282
const BRIDGE_Z_HALF   = 17;   // half-length of bridge span
const BANK_Y          = 0.8;  // approximate flat terrain y near crossing
const ARCH_PEAK       = 0.8;  // peak arch height from road.ts

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ── River ribbon builder ───────────────────────────────────────────────────────
// Builds a flat horizontal ribbon at constant y following a spine, with `width`
// world units across. Terrain carving makes the banks visible above the water.

function buildRiverRibbon(
  pts: [number, number][],
  y: number,
  width: number,
  mat: THREE.Material,
  scene: THREE.Scene,
): void {
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  let vAcc = 0;

  for (let i = 0; i < pts.length; i++) {
    const [cx, cz] = pts[i]!;
    if (i > 0) {
      const [px, pz] = pts[i - 1]!;
      vAcc += Math.sqrt((cx - px) ** 2 + (cz - pz) ** 2);
    }

    // Smooth tangent from neighbours
    let fx = 0, fz = 0;
    if (i < pts.length - 1) { const q = pts[i + 1]!; fx += q[0] - cx; fz += q[1] - cz; }
    if (i > 0)               { const q = pts[i - 1]!; fx += cx - q[0]; fz += cz - q[1]; }
    const len = Math.sqrt(fx * fx + fz * fz);
    if (len > 0) { fx /= len; fz /= len; }
    const rx = fz, rz = -fx; // right vector

    for (const s of [0, 1] as const) {
      const side = (s - 0.5) * width;
      pos.push(cx + rx * side, y, cz + rz * side);
      uvs.push(s, vAcc / width);
    }
    if (i > 0) {
      const b = (i - 1) * 2;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, mat));
}

// ── Bridge visual structure ────────────────────────────────────────────────────
// The road ribbon (from road.ts) already follows the arch. These pieces add the
// visible concrete structure beneath: deck soffit, round piers, and railings.

function buildBridge(scene: THREE.Scene): void {
  const concreteMat = new THREE.MeshLambertMaterial({ color: 0x8a8a80 });
  const darkMat     = new THREE.MeshLambertMaterial({ color: 0x606058 });

  // Bridge deck soffit — flat slab visible above the water from the river bank.
  // Slightly below the arched road surface so it reads as the deck underside.
  const deckGeo = new THREE.BoxGeometry(20, 0.6, BRIDGE_Z_HALF * 2 + 4);
  const deck = new THREE.Mesh(deckGeo, concreteMat);
  deck.position.set(4, BANK_Y + ARCH_PEAK * 0.4, BRIDGE_Z_CENTER);
  scene.add(deck);

  // 4 round piers: 2 pairs at z=-256 and z=-272, spread either side of road centre.
  // Height spans from 0.5 u below river surface to the deck underside.
  const PIER_BOTTOM = RIVER_Y - 0.5;
  const PIER_TOP    = BANK_Y + 0.2;
  const PIER_H      = PIER_TOP - PIER_BOTTOM;
  const PIER_CY     = PIER_BOTTOM + PIER_H / 2;
  const pierGeo = new THREE.CylinderGeometry(0.7, 0.9, PIER_H, 8);
  for (const bz of [-256, -272] as const) {
    for (const bx of [-2, 10] as const) {
      const pier = new THREE.Mesh(pierGeo, darkMat);
      pier.position.set(bx, PIER_CY, bz);
      scene.add(pier);
    }
  }

  // Concrete railings along each edge of the bridge deck.
  const RAILING_H   = 0.9;
  const RAILING_Y   = BANK_Y + ARCH_PEAK * 0.5 + RAILING_H / 2; // approximate mid-arch
  const railGeo = new THREE.BoxGeometry(0.45, RAILING_H, BRIDGE_Z_HALF * 2 + 2);
  for (const rx of [-5.5, 13.5] as const) {
    const rail = new THREE.Mesh(railGeo, concreteMat);
    rail.position.set(rx, RAILING_Y, BRIDGE_Z_CENTER);
    scene.add(rail);
  }
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

  for (let i = 0; i < 10; i++) {
    const angle = rng() * Math.PI * 2;
    const dist  = 12 + rng() * 5;
    const rx    = POND_X + Math.cos(angle) * dist;
    const rz    = POND_Z + Math.sin(angle) * dist;
    const ry    = getHeightAt(rx, rz);
    const r     = 0.4 + rng() * 0.5;
    const geo   = new THREE.SphereGeometry(r, 7, 5);
    const mesh  = new THREE.Mesh(geo, rockMat);
    mesh.position.set(rx, ry - r * 0.3, rz);
    scene.add(mesh);
  }

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

// ── Public API ────────────────────────────────────────────────────────────────

export interface WaterwaysResult {
  pondObstacle: CircleObstacle;
}

export function createWaterways(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): WaterwaysResult {
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x1a4a7a,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const armMat = new THREE.MeshLambertMaterial({
    color: 0x1e5470,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });

  // Main E-W crossing — 28-unit wide ribbon at RIVER_Y
  buildRiverRibbon(MAIN_SPINE, RIVER_Y, 28, waterMat, scene);

  // West and east arms winding south along city flanks — narrower, shallower
  buildRiverRibbon(WEST_ARM, ARM_Y, 14, armMat, scene);
  buildRiverRibbon(EAST_ARM, ARM_Y, 14, armMat, scene);

  // Freeway bridge where the road crosses at z≈-265
  buildBridge(scene);

  const pondObstacle = buildPond(scene, getHeightAt);
  buildPondSurrounds(scene, getHeightAt);

  return { pondObstacle };
}

// Export pond position so trees.ts can exclude the pond area from flank placement
export const POND_EXCLUSION: CircleObstacle = { x: POND_X, z: POND_Z, radius: 22 };
