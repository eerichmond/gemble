import * as THREE from 'three';

export interface TerrainResult {
  mesh: THREE.Mesh;
  getHeightAt: (x: number, z: number) => number;
}

// Pure function — exported for unit testing without needing a WebGL context.
// Layered sine/cosine gives ~±20 units of elevation variation (gentle rolling hills).
// FUTURE: swap this for simplex-noise in Phase 2+ for richer, less repetitive terrain.
export function computeTerrainHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.015) * 8 +
    Math.cos(z * 0.018) * 7 +
    Math.sin(x * 0.05 + z * 0.04) * 3 +
    Math.cos(x * 0.09) * Math.sin(z * 0.08) * 2
  );
}

export function createTerrain(scene: THREE.Scene): TerrainResult {
  const geometry = new THREE.PlaneGeometry(500, 500, 100, 100);

  // Rotate flat XY plane to lie on XZ (the ground plane)
  geometry.rotateX(-Math.PI / 2);

  // Apply height to each vertex using the pure height function
  const positions = geometry.attributes['position'] as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(i, computeTerrainHeight(x, z));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  // Phase 0: mid green. Darkened to near-black forest floor in Phase 2.
  // FUTURE Phase 2: update color to 0x1a2e12
  const material = new THREE.MeshLambertMaterial({ color: 0x4a7c3f });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Reusable raycaster for height sampling — allocated once, polled every frame.
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);

  function getHeightAt(x: number, z: number): number {
    origin.set(x, 200, z);
    raycaster.set(origin, down);
    const hits = raycaster.intersectObject(mesh);
    return hits.length > 0 ? hits[0]!.point.y : 0;
  }

  // Add distant mountain silhouettes — visual only, no collision needed
  addMountains(scene);

  return { mesh, getHeightAt };
}

function addMountains(scene: THREE.Scene): void {
  // 8 mountain groups placed at radius 380–440, spread around the horizon
  const material = new THREE.MeshLambertMaterial({ color: 0x8a9a9a });

  const positions: [number, number, number, number][] = [
    // [angle degrees, radius, xOffset, zOffset from center of group]
    [15, 400, 0, 0],
    [55, 420, 0, 0],
    [100, 390, 0, 0],
    [145, 410, 0, 0],
    [200, 430, 0, 0],
    [240, 400, 0, 0],
    [290, 420, 0, 0],
    [335, 410, 0, 0],
  ];

  positions.forEach(([angleDeg, radius]) => {
    const angle = (angleDeg * Math.PI) / 180;
    const cx = Math.sin(angle) * radius;
    const cz = Math.cos(angle) * radius;

    // Each mountain group = 2-3 overlapping cones of varying height
    [[0, 0, 120], [-25, 15, 90], [20, -10, 100]].forEach(([dx, dz, height]) => {
      const geo = new THREE.ConeGeometry(55 + Math.random() * 20, height ?? 100, 5);
      const cone = new THREE.Mesh(geo, material);
      cone.position.set(cx + (dx ?? 0), (height ?? 100) / 2 - 10, cz + (dz ?? 0));
      cone.castShadow = false; // distant — no shadow needed
      scene.add(cone);
    });
  });
}
