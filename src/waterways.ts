import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

// ── Phase 10 — Waterways ──────────────────────────────────────────────────────
// Winding river at the city/forest boundary (z≈-262), with freeway-style bridge
// where the road crosses. East and west arms wind south along the city flanks.
// Terrain carving in terrain.ts creates the embankment; water planes sit at RIVER_Y.

// Water surface sits inside the carved channel (terrain.ts carves 6 u deep; flat
// terrain≈0 → channel floor≈-6; RIVER_Y=-3 gives ~3 u visible water depth).
const RIVER_Y = -3.0;
const ARM_Y = -2.5; // arms are shallower

// ── River spine waypoints — must match terrain.ts RIVER_*_SPINE exactly ───────
const MAIN_SPINE: [number, number][] = [
  [-250, -280],
  [-160, -270],
  [-80, -264],
  [-30, -262],
  [4, -261],
  [35, -261],
  [90, -267],
  [165, -275],
  [250, -283],
];
const WEST_ARM: [number, number][] = [
  [-80, -264],
  [-90, -305],
  [-102, -352],
  [-114, -400],
  [-118, -450],
];
const EAST_ARM: [number, number][] = [
  [90, -267],
  [100, -312],
  [110, -358],
  [120, -408],
  [130, -450],
];

// Bridge spans z=-285 (city side) to z=-237 (gravel side) — matches road endpoints
// and makeBridgedHeight zone in road.ts.
const BRIDGE_Z_CENTER = -261; // midpoint of z=-237..z=-285
const BRIDGE_Z_HALF = 24; // half-length: 48-unit span

// ── River ribbon builder ───────────────────────────────────────────────────────
function buildRiverRibbon(
  pts: [number, number][],
  y: number,
  width: number,
  mat: THREE.Material,
  scene: THREE.Scene,
): void {
  const pos: number[] = [],
    uvs: number[] = [],
    idx: number[] = [];
  let vAcc = 0;

  for (let i = 0; i < pts.length; i++) {
    const [cx, cz] = pts[i];
    if (i > 0) {
      const [px, pz] = pts[i - 1];
      vAcc += Math.sqrt((cx - px) ** 2 + (cz - pz) ** 2);
    }

    let fx = 0,
      fz = 0;
    if (i < pts.length - 1) {
      const q = pts[i + 1];
      fx += q[0] - cx;
      fz += q[1] - cz;
    }
    if (i > 0) {
      const q = pts[i - 1];
      fx += cx - q[0];
      fz += cz - q[1];
    }
    const len = Math.sqrt(fx * fx + fz * fz);
    if (len > 0) {
      fx /= len;
      fz /= len;
    }
    const rx = fz,
      rz = -fx;

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

// ── Approach wedge ────────────────────────────────────────────────────────────
// Tapered concrete block that ramps from terrain level to bridge deck height (0.2).
// zBridge = z at bridge end (top=0.2), zFar = z at road end (tapers to ground).
function buildApproachWedge(
  scene: THREE.Scene,
  color: number,
  centerX: number,
  halfW: number,
  zBridge: number,
  zFar: number,
): void {
  const TOP = 0.2;
  // prettier-ignore
  const positions = new Float32Array([
    centerX - halfW, 0,   zBridge, // 0 bridge-left-bot
    centerX + halfW, 0,   zBridge, // 1 bridge-right-bot
    centerX - halfW, 0,   zFar,    // 2 far-left-bot
    centerX + halfW, 0,   zFar,    // 3 far-right-bot
    centerX - halfW, TOP, zBridge, // 4 bridge-left-top
    centerX + halfW, TOP, zBridge, // 5 bridge-right-top
    centerX - halfW, 0,   zFar,    // 6 far-left-top (flush with ground)
    centerX + halfW, 0,   zFar,    // 7 far-right-top
  ]);
  // prettier-ignore
  const indices = [
    4, 7, 5,  4, 6, 7, // top
    0, 5, 4,  0, 1, 5, // bridge face
    2, 6, 4,  2, 4, 0, // left side
    3, 5, 7,  3, 1, 5, // right side
    0, 2, 1,  1, 2, 3, // bottom
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(geo, mat));
}

// ── Bridge visual structure ────────────────────────────────────────────────────
// Standalone concrete bridge spanning z=-285 to z=-237 (road endpoints). No road
// overlay — the bridge IS the road surface. Piers run from river floor to deck soffit.
// Approach ramps taper from bridge deck height down to terrain on each road end.

function buildBridge(scene: THREE.Scene): void {
  const concreteMat = new THREE.MeshLambertMaterial({ color: 0x8a8a80 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x606058 });

  const DECK_TOP = 0.2;
  const DECK_H = 0.4;
  const DECK_CY = DECK_TOP - DECK_H / 2; // center y = 0.0
  const SPAN = BRIDGE_Z_HALF * 2; // 48 units

  // Deck slab — the walkable surface
  const deckGeo = new THREE.BoxGeometry(20, DECK_H, SPAN);
  const deck = new THREE.Mesh(deckGeo, concreteMat);
  deck.position.set(4, DECK_CY, BRIDGE_Z_CENTER);
  scene.add(deck);

  // Piers — two pairs, symmetric about road centre (x=4)
  const PIER_BOTTOM = RIVER_Y - 0.5; // -3.5
  const PIER_H = DECK_CY - DECK_H / 2 - PIER_BOTTOM; // soffit to river bed
  const PIER_CY = PIER_BOTTOM + PIER_H / 2;
  const pierGeo = new THREE.CylinderGeometry(0.7, 0.9, PIER_H, 8);
  for (const bz of [-250, -272] as const) {
    for (const bx of [-2, 10] as const) {
      const pier = new THREE.Mesh(pierGeo, darkMat);
      pier.position.set(bx, PIER_CY, bz);
      scene.add(pier);
    }
  }

  // Railings — full span, sitting on deck top
  const RAIL_H = 0.9;
  const RAIL_CY = DECK_TOP + RAIL_H / 2; // 0.65
  const railGeo = new THREE.BoxGeometry(0.45, RAIL_H, SPAN + 2);
  for (const rx of [-5.5, 13.5] as const) {
    const rail = new THREE.Mesh(railGeo, concreteMat);
    rail.position.set(rx, RAIL_CY, BRIDGE_Z_CENTER);
    scene.add(rail);
  }

  // Approach ramps — taper from deck height (0.2) down to terrain on each end.
  // North (gravel side): z=-237..z=-231.  South (city side): z=-285..z=-291.
  buildApproachWedge(scene, 0x8a8a80, 4, 11, -237, -231);
  buildApproachWedge(scene, 0x8a8a80, 4, 11, -285, -291);

  // Approach side walls — connect bridge railings into each road zone
  const wallGeo = new THREE.BoxGeometry(0.45, RAIL_H, 7);
  for (const wx of [-5.5, 13.5] as const) {
    // North approach wall: z=-237 going north 7 units → center at -233.5
    const wallN = new THREE.Mesh(wallGeo, concreteMat);
    wallN.position.set(wx, RAIL_CY, -237 + 3.5);
    scene.add(wallN);
    // South approach wall: z=-285 going south 7 units → center at -288.5
    const wallS = new THREE.Mesh(wallGeo, concreteMat);
    wallS.position.set(wx, RAIL_CY, -285 - 3.5);
    scene.add(wallS);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createWaterways(scene: THREE.Scene): void {
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

  buildRiverRibbon(MAIN_SPINE, RIVER_Y, 28, waterMat, scene);
  buildRiverRibbon(WEST_ARM, ARM_Y, 14, armMat, scene);
  buildRiverRibbon(EAST_ARM, ARM_Y, 14, armMat, scene);
  buildBridge(scene);
}

// Exclusion circles along the river spines to keep flank trees out of the water.
function spineExclusions(spine: [number, number][], radius: number): CircleObstacle[] {
  const out: CircleObstacle[] = [];
  for (let i = 0; i < spine.length - 1; i++) {
    const [ax, az] = spine[i];
    const [bx, bz] = spine[i + 1];
    const len = Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2);
    const steps = Math.max(2, Math.ceil(len / 22));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      out.push({ x: ax + t * (bx - ax), z: az + t * (bz - az), radius });
    }
  }
  return out;
}

export const RIVER_WEST_EXCLUSIONS: CircleObstacle[] = spineExclusions(WEST_ARM, 15);
export const RIVER_EAST_EXCLUSIONS: CircleObstacle[] = spineExclusions(EAST_ARM, 15);
// Main river body exclusions — keeps flank trees out of the E-W crossing channel.
export const RIVER_MAIN_EXCLUSIONS: CircleObstacle[] = spineExclusions(MAIN_SPINE, 17);
