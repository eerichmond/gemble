import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

export interface TreePosition {
  x: number;
  z: number;
  radius: number;
}

export interface TreesResult {
  treePositions: TreePosition[];
}

// Seeded pseudo-random for deterministic tree placement across hot-reloads.
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const PINE_COUNT = 480; // ~80% of forest
const DECIDUOUS_COUNT = 120; // ~20% — scattered broadleaf trees
const SPAWN_CLEAR = 20; // no trees within 20 units of spawn
// FUTURE Phase 4: also exclude city bounding box [-60,60] × [-260,-380]

export function createTrees(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  mountainObstacles: CircleObstacle[] = [],
): TreesResult {
  const rng = makeRng(42);
  const treePositions: TreePosition[] = [];
  const dummy = new THREE.Object3D();

  placePines(scene, getHeightAt, rng, dummy, treePositions, mountainObstacles);
  placeDeciduousTrees(scene, getHeightAt, rng, dummy, treePositions, mountainObstacles);

  return { treePositions };
}

// ---- Pine trees (cone-layered silhouette) --------------------------------

function placePines(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  rng: () => number,
  dummy: THREE.Object3D,
  out: TreePosition[],
  excludeZones: CircleObstacle[] = [],
): void {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3d2005 });
  const canopyMats = [
    new THREE.MeshLambertMaterial({ color: 0x0d2e0d }),
    new THREE.MeshLambertMaterial({ color: 0x0f3a0f }),
    new THREE.MeshLambertMaterial({ color: 0x122e12 }),
  ];

  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
  const canopyGeos = [
    new THREE.ConeGeometry(2.5, 4, 7),
    new THREE.ConeGeometry(1.8, 3.5, 7),
    new THREE.ConeGeometry(1.1, 3, 7),
  ];

  // 4 draw calls total for all pine instances
  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, PINE_COUNT);
  const c0 = new THREE.InstancedMesh(canopyGeos[0], canopyMats[0], PINE_COUNT);
  const c1 = new THREE.InstancedMesh(canopyGeos[1], canopyMats[1], PINE_COUNT);
  const c2 = new THREE.InstancedMesh(canopyGeos[2], canopyMats[2], PINE_COUNT);
  [trunk, c0, c1, c2].forEach(m => {
    m.castShadow = true;
    scene.add(m);
  });

  for (let i = 0; i < PINE_COUNT; i++) {
    const { x, z } = randomWorldPos(rng, SPAWN_CLEAR, excludeZones);
    const groundY = getHeightAt(x, z);
    // 2.0–3.5x scale → ~30–50 ft at game scale (player eye = 1.7 units ≈ 5.5 ft)
    const scale = 2.0 + rng() * 1.5;
    const yaw = rng() * Math.PI * 2;

    // Trunk-only collision: base radius 0.25 * scale (CylinderGeometry base r=0.25)
    out.push({ x, z, radius: 0.25 * scale });

    dummy.rotation.set(0, yaw, 0);
    dummy.scale.setScalar(scale);

    dummy.position.set(x, groundY + scale, z);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, groundY + 4 * scale, z);
    dummy.updateMatrix();
    c0.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, groundY + 5.5 * scale, z);
    dummy.updateMatrix();
    c1.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, groundY + 7 * scale, z);
    dummy.updateMatrix();
    c2.setMatrixAt(i, dummy.matrix);
  }

  [trunk, c0, c1, c2].forEach(m => (m.instanceMatrix.needsUpdate = true));
}

// ---- Deciduous trees (wide-cone canopy, classic broadleaf silhouette) ----

// Deciduous canopy colors: brighter, more varied greens than pine
const DECIDUOUS_CANOPY_COLORS = [0x2d7a1a, 0x3a8a1e, 0x237010, 0x4a8a22, 0x1e6a14];

function placeDeciduousTrees(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  rng: () => number,
  dummy: THREE.Object3D,
  out: TreePosition[],
  excludeZones: CircleObstacle[] = [],
): void {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a10 });

  // IcosahedronGeometry(1,1): 20 lumpy facets give an organic foliage look, no sharp point.
  // Scaled wide (XZ 2.2×) and flatter (Y 1.4×) so it reads as a spreading broadleaf crown,
  // clearly distinct from the layered-cone pines.
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 1);

  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, DECIDUOUS_COUNT);
  trunk.castShadow = true;
  scene.add(trunk);

  // One InstancedMesh per canopy color so each tree can have its own shade
  const perColor = Math.ceil(DECIDUOUS_COUNT / DECIDUOUS_CANOPY_COLORS.length);
  const canopyMeshes = DECIDUOUS_CANOPY_COLORS.map(color => {
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.InstancedMesh(canopyGeo, mat, perColor);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  });

  for (let i = 0; i < DECIDUOUS_COUNT; i++) {
    const { x, z } = randomWorldPos(rng, SPAWN_CLEAR, excludeZones);
    const groundY = getHeightAt(x, z);
    // Deciduous trees slightly smaller than pines: 1.8–3.0x scale
    const scale = 1.8 + rng() * 1.2;
    const yaw = rng() * Math.PI * 2;

    // Trunk-only collision: base radius 0.28 * scale (CylinderGeometry base r=0.28)
    out.push({ x, z, radius: 0.28 * scale });

    dummy.rotation.set(0, yaw, 0);
    dummy.scale.setScalar(scale);

    // Trunk: center at groundY + scale → top at groundY + 2*scale
    dummy.position.set(x, groundY + scale, z);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);

    // Icosahedron radius = 1. Y-scale = 1.4*scale → Y-extent = ±1.4*scale.
    // Center at groundY + 3.4*scale so bottom = 3.4 - 1.4 = 2.0 = trunk top. ✓
    const colorIdx = i % DECIDUOUS_CANOPY_COLORS.length;
    const instanceIdx = Math.floor(i / DECIDUOUS_CANOPY_COLORS.length);
    dummy.position.set(x, groundY + 3.4 * scale, z);
    dummy.scale.set(scale * 2.2, scale * 1.4, scale * 2.2); // wide spreading dome
    dummy.updateMatrix();
    canopyMeshes[colorIdx].setMatrixAt(instanceIdx, dummy.matrix);
    dummy.scale.setScalar(scale);
  }

  trunk.instanceMatrix.needsUpdate = true;
  canopyMeshes.forEach(m => (m.instanceMatrix.needsUpdate = true));
}

// ---- Shared helpers -------------------------------------------------------

function randomWorldPos(
  rng: () => number,
  minRadius: number,
  excludeZones: CircleObstacle[] = [],
): { x: number; z: number } {
  let x = 0,
    z = 0;
  do {
    x = (rng() - 0.5) * 440;
    z = (rng() - 0.5) * 440;
  } while (
    Math.sqrt(x * x + z * z) < minRadius ||
    excludeZones.some(zone => {
      const dx = x - zone.x;
      const dz = z - zone.z;
      return Math.sqrt(dx * dx + dz * dz) < zone.radius;
    })
  );
  return { x, z };
}
