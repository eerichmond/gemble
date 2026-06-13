import * as THREE from 'three';

// Ground-level props scattered through the forest: rocks, bushes, grass tufts.
// All use InstancedMesh to stay at 3 draw calls regardless of count.
// FUTURE: exclude city bounding box when Phase 4 city is added

const SPAWN_CLEAR = 15;

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function randomPos(rng: () => number, minR: number): { x: number; z: number } {
  let x: number, z: number;
  do {
    x = (rng() - 0.5) * 440;
    z = (rng() - 0.5) * 440;
  } while (Math.sqrt(x * x + z * z) < minR);
  return { x, z };
}

export function createProps(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): void {
  const rng = makeRng(99); // different seed from trees so they don't overlap exactly

  placeRocks(scene, getHeightAt, rng);
  placeBushes(scene, getHeightAt, rng);
  placeGrass(scene, getHeightAt, rng);
}

// ---- Rocks ---------------------------------------------------------------

function placeRocks(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  rng: () => number,
): void {
  const COUNT = 200;
  // DodecahedronGeometry gives a satisfyingly craggy, faceted boulder silhouette
  const geo = new THREE.DodecahedronGeometry(0.7, 0);
  const dummy = new THREE.Object3D();

  // Three slightly different rock tones for variety
  const mats = [
    new THREE.MeshLambertMaterial({ color: 0x5a5a58 }),
    new THREE.MeshLambertMaterial({ color: 0x6a6860 }),
    new THREE.MeshLambertMaterial({ color: 0x4e5052 }),
  ];

  const perMat = Math.ceil(COUNT / mats.length);
  mats.forEach((mat, mi) => {
    const mesh = new THREE.InstancedMesh(geo, mat, perMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    for (let i = 0; i < perMat; i++) {
      const { x, z } = randomPos(rng, SPAWN_CLEAR);
      const groundY = getHeightAt(x, z);
      const scale = 0.3 + rng() * 1.2; // small pebbles to medium boulders

      dummy.position.set(x, groundY + scale * 0.5, z);
      // Random tilt — rocks don't sit perfectly upright
      dummy.rotation.set((rng() - 0.5) * 0.6, rng() * Math.PI * 2, (rng() - 0.5) * 0.4);
      dummy.scale.set(scale, scale * (0.5 + rng() * 0.6), scale); // flatten some rocks
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Suppress unused variable warning for mi
      void mi;
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// ---- Bushes --------------------------------------------------------------

function placeBushes(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  rng: () => number,
): void {
  const COUNT = 250;
  // Icosahedron detail=1 looks more organic than a sphere for shrubs
  const geo = new THREE.IcosahedronGeometry(1.0, 1);
  const dummy = new THREE.Object3D();

  const mats = [
    new THREE.MeshLambertMaterial({ color: 0x1a4a0e }),
    new THREE.MeshLambertMaterial({ color: 0x153d0a }),
    new THREE.MeshLambertMaterial({ color: 0x204e12 }),
    new THREE.MeshLambertMaterial({ color: 0x2a5a16 }),
  ];

  const perMat = Math.ceil(COUNT / mats.length);
  mats.forEach(mat => {
    const mesh = new THREE.InstancedMesh(geo, mat, perMat);
    mesh.castShadow = true;
    scene.add(mesh);

    for (let i = 0; i < perMat; i++) {
      const { x, z } = randomPos(rng, SPAWN_CLEAR);
      const groundY = getHeightAt(x, z);
      const scale = 0.6 + rng() * 0.8; // small shrubs to large bushes

      // Center at ground level so bottom half is buried — only the dome is visible
      dummy.position.set(x, groundY, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(scale * (1.1 + rng() * 0.4), scale * 0.7, scale * (1.1 + rng() * 0.4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// ---- Grass tufts ---------------------------------------------------------

function placeGrass(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  rng: () => number,
): void {
  const COUNT = 600;
  const dummy = new THREE.Object3D();

  // Two crossed planes per tuft — classic billboard grass trick
  // We create a single merged geometry of two intersecting quads
  const geo = buildGrassTuftGeo();

  const mats = [
    new THREE.MeshLambertMaterial({ color: 0x1e3d0a, side: THREE.DoubleSide }),
    new THREE.MeshLambertMaterial({ color: 0x254a0e, side: THREE.DoubleSide }),
    new THREE.MeshLambertMaterial({ color: 0x18350a, side: THREE.DoubleSide }),
  ];

  const perMat = Math.ceil(COUNT / mats.length);
  mats.forEach(mat => {
    const mesh = new THREE.InstancedMesh(geo, mat, perMat);
    mesh.castShadow = false; // grass tufts don't need shadow casting
    scene.add(mesh);

    for (let i = 0; i < perMat; i++) {
      const { x, z } = randomPos(rng, SPAWN_CLEAR);
      const groundY = getHeightAt(x, z);
      const scale = 0.4 + rng() * 0.5;

      dummy.position.set(x, groundY, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(scale * (0.8 + rng() * 0.4), scale, scale * (0.8 + rng() * 0.4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// Two intersecting quads forming a cross — the classic grass tuft billboard shape
function buildGrassTuftGeo(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // Each quad: 4 vertices, 2 triangles
  // Quad A: lies in XY plane; Quad B: lies in ZY plane
  const h = 1.0; // height
  const hw = 0.5; // half-width
  // prettier-ignore
  const verts = new Float32Array([
    // Quad A (X axis)
    -hw, 0,   0,
     hw, 0,   0,
     hw, h,   0,
    -hw, h,   0,
    // Quad B (Z axis)
     0,  0, -hw,
     0,  0,  hw,
     0,  h,  hw,
     0,  h, -hw,
  ]);
  // prettier-ignore
  const indices = new Uint16Array([
    0, 1, 2,  0, 2, 3, // Quad A
    4, 5, 6,  4, 6, 7, // Quad B
  ]);
  // prettier-ignore
  const uvs = new Float32Array([
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
  ]);

  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}
