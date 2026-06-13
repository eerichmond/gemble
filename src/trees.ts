import * as THREE from 'three';

export interface TreePosition {
  x: number;
  z: number;
  radius: number;
}

export interface TreesResult {
  treePositions: TreePosition[];
}

// Seeded pseudo-random for deterministic tree placement across hot-reloads.
// Using a simple LCG so the forest layout is always identical.
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function createTrees(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): TreesResult {
  const rng = makeRng(42);
  const treePositions: TreePosition[] = [];

  // --- Shared materials (one instance per material across all trees) ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3d2005 });
  // Three canopy tiers: slightly different greens give the layered pine look
  const canopyMats = [
    new THREE.MeshLambertMaterial({ color: 0x0d2e0d }),
    new THREE.MeshLambertMaterial({ color: 0x0f3a0f }),
    new THREE.MeshLambertMaterial({ color: 0x122e12 }),
  ];

  // --- Shared base geometries (scaled per instance via dummy Object3D) ---
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
  const canopyGeos = [
    new THREE.ConeGeometry(2.5, 4, 7), // bottom — widest
    new THREE.ConeGeometry(1.8, 3.5, 7), // middle
    new THREE.ConeGeometry(1.1, 3, 7), // top — narrowest
  ];

  // --- InstancedMeshes: 4 draw calls total regardless of tree count ---
  const COUNT = 600;
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, COUNT);
  const canopy0 = new THREE.InstancedMesh(canopyGeos[0]!, canopyMats[0]!, COUNT);
  const canopy1 = new THREE.InstancedMesh(canopyGeos[1]!, canopyMats[1]!, COUNT);
  const canopy2 = new THREE.InstancedMesh(canopyGeos[2]!, canopyMats[2]!, COUNT);

  [trunkMesh, canopy0, canopy1, canopy2].forEach(m => {
    m.castShadow = true;
    m.receiveShadow = false; // trees don't need to receive shadows from each other
    scene.add(m);
  });

  const dummy = new THREE.Object3D();
  const SPAWN_CLEAR = 20; // keep trees away from the player spawn point
  // FUTURE Phase 4: also exclude city bounding box [-60,60] × [-260,-380]

  for (let i = 0; i < COUNT; i++) {
    let x: number, z: number;
    // Reject positions too close to spawn — give the player room to orient
    do {
      x = (rng() - 0.5) * 440; // spread across [-220, 220]
      z = (rng() - 0.5) * 440;
    } while (Math.sqrt(x * x + z * z) < SPAWN_CLEAR);

    const groundY = getHeightAt(x, z);
    // Scale 2.0–3.5: at player height 1.7 units (~5.5 ft), this gives trees
    // roughly 30–50 ft tall — towering pines that make the player feel small.
    const scale = 2.0 + rng() * 1.5;
    const yaw = rng() * Math.PI * 2;

    treePositions.push({ x, z, radius: 2.5 * scale });

    // Trunk — centered at ground + 1 unit (half trunk height = 1)
    dummy.position.set(x, groundY + 1 * scale, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    // Bottom canopy — sits just above trunk base, cone center at mid-height
    dummy.position.set(x, groundY + 2 * scale + 2 * scale, z);
    dummy.updateMatrix();
    canopy0.setMatrixAt(i, dummy.matrix);

    // Middle canopy — overlaps bottom by ~1 unit
    dummy.position.set(x, groundY + 2 * scale + 3.5 * scale, z);
    dummy.updateMatrix();
    canopy1.setMatrixAt(i, dummy.matrix);

    // Top canopy
    dummy.position.set(x, groundY + 2 * scale + 5 * scale, z);
    dummy.updateMatrix();
    canopy2.setMatrixAt(i, dummy.matrix);
  }

  [trunkMesh, canopy0, canopy1, canopy2].forEach(m => {
    m.instanceMatrix.needsUpdate = true;
  });

  return { treePositions };
}
