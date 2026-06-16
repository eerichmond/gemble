import * as THREE from 'three';
import type { CircleObstacle } from './terrain';
import { riverChannelOffset } from './terrain';

const ROAD_WIDTH = 12;
const ROAD_HALF = ROAD_WIDTH / 2;
// Small clearance above terrain. Per-vertex, multi-column sampling handles draping.
const Y_ROAD = 0.18;
const Y_LINE = Y_ROAD + 0.04; // edge lines sit just above road surface
const LINE_HALF = 0.3; // half-width of edge line strips

// City asphalt road is 1.5× the gravel width (two marked lanes).
const CITY_ROAD_HALF = ROAD_HALF * 1.5; // 9 units

// Road runs the full map length: crystals at north end (z≈+238), city at south end (z≈−248).
// Passes ~15 units east of spawn so it's visible on the right when facing south.
const SPINE: ReadonlyArray<readonly [number, number]> = [
  [20, 238], // north end — crystal formation blocks here
  [24, 195],
  [28, 150],
  [24, 105],
  [16, 60],
  [18, 20], // passes east of spawn (~18 units right of player at z=0)
  [8, -20],
  [0, -55],
  [-12, -90],
  [-24, -125],
  [-18, -158],
  [-5, -188],
  [4, -216],  // aligned with city road, smooth approach
  [4, -248], // south end — gravel ends / asphalt begins
] as const;

// City extension: asphalt two-lane road, same starting point as gravel end.
const CITY_SPINE: ReadonlyArray<readonly [number, number]> = [
  [4, -248], // joins gravel road end for seamless connection
  [4, -265],
  [4, -290], // near gas station / grocery cross-street
  [4, -340], // apartment zone
  [4, -395],
  [4, -440], // city south end
] as const;

// Export road centerline obstacles so trees/props are placed clear of the road.
// Called before createTrees/createProps in main.ts.
export function getRoadObstacles(): CircleObstacle[] {
  const obs: CircleObstacle[] = [];
  for (let i = 0; i < SPINE.length - 1; i++) {
    const a = SPINE[i];
    const b = SPINE[i + 1];
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.ceil(len / 4));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      obs.push({ x: a[0] + dx * t, z: a[1] + dz * t, radius: ROAD_HALF + 4 });
    }
  }
  return obs;
}

// Returns a height function that bridges the road over the carved river channel.
// In the bridge zone (z: -248→-282 at x≈4) it adds the carved depth back plus a
// parabolic arch — the road surface gently rises 0.8 u at mid-span (~4.7% grade).
// Exported so main.ts can use it for the player's height function too.
export function makeBridgedHeight(
  getHeightAt: (x: number, z: number) => number,
): (x: number, z: number) => number {
  const Z1 = -248, Z2 = -282;
  const X_CENTER = 4, X_HALF = 14;
  const ARCH = 0.8;
  return (x: number, z: number): number => {
    if (z <= Z1 && z >= Z2 && Math.abs(x - X_CENTER) < X_HALF) {
      const t = (z - Z1) / (Z2 - Z1); // 0=north bank, 1=south bank
      const uncarved = getHeightAt(x, z) + riverChannelOffset(x, z);
      return uncarved + ARCH * 4 * t * (1 - t);
    }
    return getHeightAt(x, z);
  };
}

export function createRoad(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): { crystalObstacles: CircleObstacle[] } {
  // 1 unit sample step for dense longitudinal terrain conformance.
  const pts = sampleSpine(SPINE, 1.0);

  // Main road: 7 columns across 12 units → 2-unit-wide quads, catches all terrain features.
  const roadMat = new THREE.MeshLambertMaterial({ map: buildGravelTexture(), color: 0xffffff });
  scene.add(new THREE.Mesh(buildRibbon(pts, getHeightAt, 0, ROAD_HALF, Y_ROAD, 6, 7), roadMat));

  // Dark gray edge lines
  const lineMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  scene.add(
    new THREE.Mesh(
      buildRibbon(pts, getHeightAt, -(ROAD_HALF - LINE_HALF), LINE_HALF, Y_LINE, 4, 2),
      lineMat,
    ),
  );
  scene.add(
    new THREE.Mesh(
      buildRibbon(pts, getHeightAt, ROAD_HALF - LINE_HALF, LINE_HALF, Y_LINE, 4, 2),
      lineMat,
    ),
  );

  const crystalObstacles = addCrystals(scene, getHeightAt);

  // ── City asphalt section ─────────────────────────────────────────────────
  // Starts at the same spine point as the gravel end ([4,-248]).
  // Y offsets are all raised by 0.03 above the gravel surface so the asphalt
  // sits on top of the gravel edge at the junction — no z-fighting.
  // Width is 1.5× gravel (18 units total = two lanes).
  const CITY_Y = Y_ROAD + 0.03;       // asphalt surface
  const CITY_Y_DASH = CITY_Y + 0.08;  // centre dashes above asphalt
  const CITY_Y_EDGE = CITY_Y + 0.04;  // shoulder lines above asphalt
  const cityPts = sampleSpine(CITY_SPINE, 1.0);
  const cityH = makeBridgedHeight(getHeightAt); // bridges over the carved river channel

  const asphaltMat = new THREE.MeshLambertMaterial({ color: 0x1e1e1e });
  scene.add(new THREE.Mesh(
    buildRibbon(cityPts, cityH, 0, CITY_ROAD_HALF, CITY_Y, 6, 9),
    asphaltMat,
  ));

  // Yellow dashed centre divider (between the two lanes)
  const dashMat = new THREE.MeshLambertMaterial({ map: buildDashTexture() });
  scene.add(new THREE.Mesh(
    buildRibbon(cityPts, cityH, 0, 0.25, CITY_Y_DASH, 8, 2),
    dashMat,
  ));

  // White shoulder lines at each road edge
  const cityLineMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
  scene.add(new THREE.Mesh(
    buildRibbon(cityPts, cityH, -(CITY_ROAD_HALF - LINE_HALF), LINE_HALF, CITY_Y_EDGE, 4, 2),
    cityLineMat,
  ));
  scene.add(new THREE.Mesh(
    buildRibbon(cityPts, cityH, CITY_ROAD_HALF - LINE_HALF, LINE_HALF, CITY_Y_EDGE, 4, 2),
    cityLineMat,
  ));

  return { crystalObstacles };
}

// Sample the spine at regular intervals (~step world units per point).
function sampleSpine(
  spine: ReadonlyArray<readonly [number, number]>,
  step: number,
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < spine.length - 1; i++) {
    const a = spine[i];
    const b = spine[i + 1];
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      out.push([a[0] + dx * t, a[1] + dz * t]);
    }
  }
  const last = spine[spine.length - 1];
  if (last) out.push([last[0], last[1]]);
  return out;
}

// Build a ribbon (flat band) following the sample path.
// lateralOffset: lateral shift from spine centre (+right, −left).
// halfW: half-width of this ribbon.
// yOff: clearance above terrain.
// uvTile: world-units per UV.v tile repeat.
// cols: number of vertices across the width — more cols = smaller quads = better terrain fit.
function buildRibbon(
  pts: [number, number][],
  getHeightAt: (x: number, z: number) => number,
  lateralOffset: number,
  halfW: number,
  yOff: number,
  uvTile: number,
  cols: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvArr: number[] = [];
  const indices: number[] = [];
  let vAccum = 0;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const [cx, cz] = p;

    if (i > 0) {
      const prev = pts[i - 1];
      if (prev) {
        const dx = cx - prev[0];
        const dz = cz - prev[1];
        vAccum += Math.sqrt(dx * dx + dz * dz);
      }
    }

    // Smooth tangent from both neighbours
    let fx = 0,
      fz = 0;
    if (i < pts.length - 1) {
      const q = pts[i + 1];
      if (q) {
        fx += q[0] - cx;
        fz += q[1] - cz;
      }
    }
    if (i > 0) {
      const q = pts[i - 1];
      if (q) {
        fx += cx - q[0];
        fz += cz - q[1];
      }
    }
    const fLen = Math.sqrt(fx * fx + fz * fz);
    if (fLen > 0) {
      fx /= fLen;
      fz /= fLen;
    }

    // Right direction in XZ (forward rotated 90° clockwise)
    const rx = fz,
      rz = -fx;

    // Centre of this ribbon strip
    const ocx = cx + rx * lateralOffset;
    const ocz = cz + rz * lateralOffset;

    // Emit `cols` vertices across the width, each sampling its own terrain height.
    // With cols=7 across ROAD_HALF=6, vertices are every 2 units — finer than the
    // terrain mesh's 5-unit vertex spacing, so no terrain peak falls between vertices.
    for (let c = 0; c < cols; c++) {
      const u = cols > 1 ? c / (cols - 1) : 0.5; // 0..1 across width
      const lateral = (u - 0.5) * 2 * halfW; // -halfW..+halfW
      const vx = ocx + rx * lateral;
      const vz = ocz + rz * lateral;
      const vy = getHeightAt(vx, vz) + yOff;
      positions.push(vx, vy, vz);
      uvArr.push(u, vAccum / uvTile);
    }

    if (i > 0) {
      const bRow = (i - 1) * cols;
      const tRow = i * cols;
      for (let c = 0; c < cols - 1; c++) {
        const b0 = bRow + c,
          b1 = bRow + c + 1;
        const t0 = tRow + c,
          t1 = tRow + c + 1;
        // Winding: normals face +Y (visible from above)
        indices.push(b0, t0, b1, b1, t0, t1);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Light pink square-pyramid crystal formation at the north end of the road.
// Pyramids are ~deciduous-tree height, wide base tapering to a point, covering the road.
function addCrystals(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): CircleObstacle[] {
  const northEnd = SPINE[0];
  if (!northEnd) return [];
  const [cx, cz] = northEnd;

  // [xOff, zOff, baseRadius, height, tiltX, tiltZ, yaw]
  // xOff is east-west (road spans x≈-6..+6 from cx=20); zOff is north-south.
  // Heights 14–24 units → visible tip ~12–20 units above ground (≈ deciduous tree height).
  // Radius 0.4–0.5 × height gives chunky pyramid proportions.
  type CrystalDef = readonly [number, number, number, number, number, number, number];
  const defs: CrystalDef[] = [
    [0, 0, 10, 24, 0.04, 0.0, 0.3], // large central pyramid, road center
    [-5, 1, 8, 20, -0.06, 0.05, 0.9], // left lane
    [5, -1, 7, 22, 0.07, -0.04, 1.8], // right lane
    [-9, 2, 8, 18, 0.05, 0.08, 2.4], // left road edge
    [9, -2, 9, 20, -0.06, 0.05, 0.1], // right road edge
    [-13, 0, 6, 16, 0.1, -0.07, 3.0], // outside left
    [13, 1, 7, 18, -0.08, 0.06, 1.4], // outside right
    [2, -5, 6, 16, -0.05, -0.06, 2.0], // south accent
    [-4, -7, 7, 19, 0.07, 0.09, 2.7], // south-left
    [7, 4, 5, 14, 0.1, -0.08, 0.6], // north-right accent
    [-8, 5, 5, 15, -0.08, 0.1, 1.7], // north-left accent
  ];

  // Light pink shades
  const colors = [0xffe8f5, 0xfff0fa, 0xfce4f0, 0xfff5fc];
  const obstacles: CircleObstacle[] = [];

  defs.forEach(([xOff, zOff, radius, height, tiltX, tiltZ, yaw], idx) => {
    const wx = cx + xOff;
    const wz = cz + zOff;
    const groundY = getHeightAt(wx, wz);
    // 4 sides; rotateY(PI/4) aligns flat faces outward for a true square-pyramid look
    const geo = new THREE.ConeGeometry(radius, height, 4);
    geo.rotateY(Math.PI / 4);
    const mat = new THREE.MeshLambertMaterial({
      color: colors[idx % colors.length],
      emissive: 0x100808,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Bury base 20% underground so pyramids appear to erupt from the ground
    mesh.position.set(wx, groundY + height * 0.4, wz);
    mesh.rotation.set(tiltX, yaw, tiltZ);
    mesh.castShadow = true;
    scene.add(mesh);
    obstacles.push({ x: wx, z: wz, radius });
  });

  return obstacles;
}

// Yellow-dashed centre-line texture: yellow dash (~60%) then dark gap (~40%).
// With uvTile=8 in buildRibbon this gives ≈4.8-unit dashes and ≈3.2-unit gaps.
function buildDashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1e1e1e'; // gap matches asphalt
  ctx.fillRect(0, 0, 4, 128);
  ctx.fillStyle = '#f0cc00'; // yellow dash
  ctx.fillRect(0, 0, 4, 76); // 76/128 ≈ 59% of each repeat = 4.7 world units
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Procedural gravel texture: warm light brownish-gray base with aggregate speckles.
function buildGravelTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8a7a68';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 5000; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const v = 90 + Math.floor(Math.random() * 60);
    const warm = Math.random() > 0.5 ? 8 : 0;
    ctx.fillStyle = `rgb(${v + warm},${v},${Math.max(0, v - warm * 0.5)})`;
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    const r = 0.8 + Math.random() * 2.0;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
