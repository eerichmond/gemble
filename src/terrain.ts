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

// ── River channel carving (Phase 10) ─────────────────────────────────────────
// Spine waypoints for the winding city-entrance river.
// Main crossing cuts the city/forest boundary at z≈-262; arms wind south along
// the city flanks following the tree lines. Must stay in sync with waterways.ts.

const RIVER_MAIN_SPINE: readonly [number, number][] = [
  [-250, -280],
  [-160, -270],
  [-80, -264],
  [-30, -262],
  [4, -261],
  [35, -261],
  [90, -267],
  [165, -275],
  [250, -283],
] as const;

const RIVER_WEST_SPINE: readonly [number, number][] = [
  [-80, -264],
  [-90, -305],
  [-102, -352],
  [-114, -400],
  [-118, -450],
] as const;

const RIVER_EAST_SPINE: readonly [number, number][] = [
  [90, -267],
  [100, -312],
  [110, -358],
  [120, -408],
  [130, -450],
] as const;

function distToSpine(spine: readonly [number, number][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < spine.length - 1; i++) {
    const [ax, az] = spine[i];
    const [bx, bz] = spine[i + 1];
    const dx = bx - ax,
      dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    const ex = ax + t * dx - x,
      ez = az + t * dz - z;
    best = Math.min(best, ex * ex + ez * ez);
  }
  return Math.sqrt(best);
}

function carveBank(d: number, inner: number, outer: number, depth: number): number {
  if (d >= outer) return 0;
  if (d <= inner) return depth;
  return depth * (1 - (d - inner) / (outer - inner));
}

// Returns how many units to carve DOWN at (x, z) for the river channel.
// Main: 28-unit flat bottom (inner=14), tapers to 0 at 44 units (outer=22), depth 6.
// Arms: 14-unit flat bottom (inner=7), tapers to 0 at 26 units (outer=13), depth 4.
export function riverChannelOffset(x: number, z: number): number {
  return Math.max(
    carveBank(distToSpine(RIVER_MAIN_SPINE, x, z), 14, 22, 6),
    carveBank(distToSpine(RIVER_WEST_SPINE, x, z), 7, 13, 4),
    carveBank(distToSpine(RIVER_EAST_SPINE, x, z), 7, 13, 4),
  );
}

export function createTerrain(scene: THREE.Scene): TerrainResult {
  // Extend 200 units south vs. the original 500×500 to cover the city zone.
  // translate(0, 100, 0) shifts the plane before rotation so after rotateX
  // the Z range becomes [-450, +250] (city sits at z:[-260,-440]).
  const geometry = new THREE.PlaneGeometry(500, 700, 100, 140);
  geometry.translate(0, 100, 0);

  // Rotate flat XY plane to lie on XZ (the ground plane)
  geometry.rotateX(-Math.PI / 2);

  // Apply height to each vertex.
  // South of z=-180 the amplitude fades so the city zone (z < -260) is
  // gently rolling rather than dramatic hills — buildings can sit flush.
  const positions = geometry.attributes['position'] as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const rawH = computeTerrainHeight(x, z);
    let h: number;
    if (z < -180) {
      const flattenT = Math.min(1, (-z - 180) / 80); // 0 at z=-180, 1.0 at z=-260+
      h = rawH * (1 - flattenT * 0.92); // ≈8% amplitude in city
    } else {
      h = rawH;
    }
    positions.setY(i, h - riverChannelOffset(x, z));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  // Color tints the texture toward forest-floor green under cool moonlight
  const material = new THREE.MeshLambertMaterial({ map: createGroundTexture(), color: 0x6a9a58 });

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

// Procedural ground texture: grass strokes + dirt patches, tiled across the terrain.
// Uses the browser Canvas 2D API — no image assets needed.
function createGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4a7c3f';
  ctx.fillRect(0, 0, size, size);

  // Dark-green clumps
  for (let i = 0; i < 28; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const rx = 18 + Math.random() * 55;
    const ry = 12 + Math.random() * 38;
    ctx.globalAlpha = 0.14 + Math.random() * 0.2;
    ctx.fillStyle = Math.random() < 0.5 ? '#2d5a1e' : '#5a8a38';
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine individual grass strokes for close-up texture detail
  const blades = ['#2d5520', '#3d6a28', '#5a8840', '#4a7035', '#226018', '#3a5c28'];
  for (let i = 0; i < 3500; i++) {
    const bx = Math.random() * size;
    const by = Math.random() * size;
    const len = 3 + Math.random() * 8;
    const angle = -(Math.PI / 2) + (Math.random() - 0.5) * 0.55;
    ctx.strokeStyle = blades[Math.floor(Math.random() * blades.length)]!;
    ctx.lineWidth = 0.6 + Math.random() * 0.8;
    ctx.globalAlpha = 0.45 + Math.random() * 0.55;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(angle) * len, by + Math.sin(angle) * len);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24); // each tile ≈ 21×21 world units
  return tex;
}

type HeightFn = (x: number, z: number) => number;

function addMountains(scene: THREE.Scene, getHeightAt: HeightFn): CircleObstacle[] {
  // Mountains at radius 225-245: near the terrain edge (±250) so they appear
  // deep in the distance. Light blue-grey color blends with fog at that range.
  // FUTURE Phase 2: material color updated to dark purple silhouette 0x150d25
  const material = new THREE.MeshLambertMaterial({ color: 0x2a3a4a });

  // angle=15 removed — its left peak at ~[39,239] collided with the crystal formation
  const angles = [55, 100, 145, 200, 240, 290, 335];
  const radii = [240, 228, 242, 238, 230, 244, 236];
  // Cones are buried 40% underground, so the visible cross-section at ground level
  // = base_radius × 0.6 ≈ 31–43 units. Use 37 (average) so the player stops right
  // at the mountain surface without a large invisible buffer.
  const PEAK_RADIUS = 37;
  const obstacles: CircleObstacle[] = [];

  angles.forEach((angleDeg, i) => {
    const angle = (angleDeg * Math.PI) / 180;
    const radius = radii[i] ?? 235;
    const cx = Math.sin(angle) * radius;
    const cz = Math.cos(angle) * radius;
    const groundY = getHeightAt(cx, cz);

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
      // One collision circle per peak — matches visual cone base closely
      obstacles.push({ x: cx + dx, z: cz + dz, radius: PEAK_RADIUS });
    });
  });

  return obstacles;
}
