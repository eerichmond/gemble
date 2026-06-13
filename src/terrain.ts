import * as THREE from 'three';

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface TerrainResult {
  mesh: THREE.Mesh;
  getHeightAt: (x: number, z: number) => number;
  mountainObstacles: CircleObstacle[];
}

// Pure function — exported for unit testing without needing a WebGL context.
// Layered sine/cosine gives ~±29 units of elevation variation (dramatic rolling hills).
// FUTURE: swap this for simplex-noise in Phase 2+ for richer, less repetitive terrain.
export function computeTerrainHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.015) * 12 +
    Math.cos(z * 0.018) * 10 +
    Math.sin(x * 0.05 + z * 0.04) * 4 +
    Math.cos(x * 0.09) * Math.sin(z * 0.08) * 3
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
    return hits.length > 0 ? hits[0].point.y : 0;
  }

  const mountainObstacles = addMountains(scene, getHeightAt);

  return { mesh, getHeightAt, mountainObstacles };
}

type HeightFn = (x: number, z: number) => number;

function addMountains(scene: THREE.Scene, getHeightAt: HeightFn): CircleObstacle[] {
  // Mountains at radius 225-245: near the terrain edge (±250) so they appear
  // deep in the distance. Light blue-grey color blends with fog at that range.
  // FUTURE Phase 2: material color updated to dark purple silhouette 0x150d25
  const material = new THREE.MeshLambertMaterial({ color: 0xb0c4cc });

  const angles = [15, 55, 100, 145, 200, 240, 290, 335];
  const radii = [235, 240, 228, 242, 238, 230, 244, 236];
  // Collision radius covers the full cone base of each group (peaks offset ≤25 + cone radius ≤72)
  const MOUNTAIN_RADIUS = 80;
  const obstacles: CircleObstacle[] = [];

  angles.forEach((angleDeg, i) => {
    const angle = (angleDeg * Math.PI) / 180;
    const radius = radii[i] ?? 235;
    const cx = Math.sin(angle) * radius;
    const cz = Math.cos(angle) * radius;
    const groundY = getHeightAt(cx, cz);

    // Collision circle per group center (covers all 3 peaks in the cluster)
    obstacles.push({ x: cx, z: cz, radius: MOUNTAIN_RADIUS });

    // Each group: 2–3 overlapping cones of varying height for a ridge silhouette
    const peaks: [number, number, number][] = [
      [0, 0, 120],
      [-22, 12, 85],
      [18, -8, 100],
    ];
    peaks.forEach(([dx, dz, height]) => {
      const geo = new THREE.ConeGeometry(52 + Math.random() * 20, height, 5);
      const cone = new THREE.Mesh(geo, material);
      // Bury the base 40% underground — only the upper portion is visible
      cone.position.set(cx + dx, groundY + height * 0.1, cz + dz);
      cone.castShadow = false;
      scene.add(cone);
    });
  });

  return obstacles;
}
