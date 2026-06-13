import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

// Ground-level props scattered through the forest: rocks, bushes.
// All use InstancedMesh to stay at a small number of draw calls.
// FUTURE: exclude city bounding box when Phase 4 city is added

const SPAWN_CLEAR = 15;

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function randomPos(
  rng: () => number,
  minR: number,
  excludeZones: CircleObstacle[] = [],
): { x: number; z: number } {
  let x = 0,
    z = 0;
  do {
    x = (rng() - 0.5) * 440;
    z = (rng() - 0.5) * 440;
  } while (
    Math.sqrt(x * x + z * z) < minR ||
    excludeZones.some(zone => {
      const dx = x - zone.x;
      const dz = z - zone.z;
      return Math.sqrt(dx * dx + dz * dz) < zone.radius;
    })
  );
  return { x, z };
}

export function createProps(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  mountainObstacles: CircleObstacle[] = [],
): void {
  const rng = makeRng(99);

  placeRocks(scene, getHeightAt, rng, mountainObstacles);
  placeBushes(scene, getHeightAt, rng, mountainObstacles);
}

// ---- Rocks ---------------------------------------------------------------

function placeRocks(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  rng: () => number,
  excludeZones: CircleObstacle[],
): void {
  const geo = new THREE.DodecahedronGeometry(0.7, 0);
  const dummy = new THREE.Object3D();

  const mats = [
    new THREE.MeshLambertMaterial({ color: 0x5a5a58 }),
    new THREE.MeshLambertMaterial({ color: 0x6a6860 }),
    new THREE.MeshLambertMaterial({ color: 0x4e5052 }),
  ];

  // Small/medium rocks
  const SM_COUNT = 200;
  const smPerMat = Math.ceil(SM_COUNT / mats.length);
  mats.forEach(mat => {
    const mesh = new THREE.InstancedMesh(geo, mat, smPerMat);
    mesh.castShadow = true;
    scene.add(mesh);

    for (let i = 0; i < smPerMat; i++) {
      const { x, z } = randomPos(rng, SPAWN_CLEAR, excludeZones);
      const groundY = getHeightAt(x, z);
      const scale = 0.3 + rng() * 1.1;

      // Dome-based: bury center slightly so only the top dome is visible
      const yScale = scale * (0.45 + rng() * 0.25);
      dummy.position.set(x, groundY - yScale * 0.4, z);
      dummy.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
      dummy.scale.set(scale * (0.8 + rng() * 0.4), yScale, scale * (0.8 + rng() * 0.4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Large boulders — fewer but noticeably bigger, same dome treatment
  const LG_COUNT = 45;
  const lgMats = [
    new THREE.MeshLambertMaterial({ color: 0x585856 }),
    new THREE.MeshLambertMaterial({ color: 0x4a4e50 }),
  ];
  const lgPerMat = Math.ceil(LG_COUNT / lgMats.length);
  lgMats.forEach(mat => {
    const mesh = new THREE.InstancedMesh(geo, mat, lgPerMat);
    mesh.castShadow = true;
    scene.add(mesh);

    for (let i = 0; i < lgPerMat; i++) {
      const { x, z } = randomPos(rng, SPAWN_CLEAR, excludeZones);
      const groundY = getHeightAt(x, z);
      const scale = 1.5 + rng() * 2.0; // 1.5–3.5x — genuinely large boulders

      const yScale = scale * (0.45 + rng() * 0.2);
      dummy.position.set(x, groundY - yScale * 0.45, z);
      dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.2);
      dummy.scale.set(scale * (0.85 + rng() * 0.3), yScale, scale * (0.85 + rng() * 0.3));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// ---- Bushes --------------------------------------------------------------

function placeBushes(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  rng: () => number,
  excludeZones: CircleObstacle[],
): void {
  const geo = new THREE.IcosahedronGeometry(1.0, 1);
  const dummy = new THREE.Object3D();

  // Main bushes — medium sized, varied dome proportions
  const mainMats = [
    new THREE.MeshLambertMaterial({ color: 0x1a4a0e }),
    new THREE.MeshLambertMaterial({ color: 0x153d0a }),
    new THREE.MeshLambertMaterial({ color: 0x204e12 }),
    new THREE.MeshLambertMaterial({ color: 0x2a5a16 }),
  ];
  const MAIN_COUNT = 250;
  const mainPerMat = Math.ceil(MAIN_COUNT / mainMats.length);
  mainMats.forEach(mat => {
    const mesh = new THREE.InstancedMesh(geo, mat, mainPerMat);
    mesh.castShadow = true;
    scene.add(mesh);

    for (let i = 0; i < mainPerMat; i++) {
      const { x, z } = randomPos(rng, SPAWN_CLEAR, excludeZones);
      const groundY = getHeightAt(x, z);
      const scale = 0.6 + rng() * 0.8;

      // Dome: center near groundY, Y scale smaller so top is a rounded cap
      const xzScale = scale * (1.0 + rng() * 0.5);
      const yScale = scale * (0.55 + rng() * 0.25); // not uniform — each bush different height
      dummy.position.set(x, groundY - yScale * 0.15, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(xzScale, yScale, xzScale * (0.85 + rng() * 0.3)); // slight XZ asymmetry
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Small ground-cover shrubs — replaces the old grass tufts
  const smMats = [
    new THREE.MeshLambertMaterial({ color: 0x1e3d0a }),
    new THREE.MeshLambertMaterial({ color: 0x254a0e }),
    new THREE.MeshLambertMaterial({ color: 0x18350a }),
  ];
  const SM_COUNT = 400;
  const smPerMat = Math.ceil(SM_COUNT / smMats.length);
  smMats.forEach(mat => {
    const mesh = new THREE.InstancedMesh(geo, mat, smPerMat);
    mesh.castShadow = false;
    scene.add(mesh);

    for (let i = 0; i < smPerMat; i++) {
      const { x, z } = randomPos(rng, SPAWN_CLEAR, excludeZones);
      const groundY = getHeightAt(x, z);
      const scale = 0.2 + rng() * 0.35; // small ground-hugging shrubs

      const xzScale = scale * (1.1 + rng() * 0.4);
      const yScale = scale * (0.45 + rng() * 0.2);
      dummy.position.set(x, groundY - yScale * 0.2, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(xzScale, yScale, xzScale * (0.8 + rng() * 0.4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}
