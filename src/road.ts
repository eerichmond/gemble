import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

const ROAD_WIDTH = 12;
const ROAD_HALF = ROAD_WIDTH / 2;
// Small clearance above terrain. Per-vertex, multi-column sampling handles draping.
const Y_ROAD = 0.18;
const Y_LINE = Y_ROAD + 0.04; // edge lines sit just above road surface
const LINE_HALF = 0.3; // half-width of edge line strips

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
  [10, -216],
  [14, -245],
  [4, -248], // south end — city entrance
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

export function createRoad(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): void {
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

  addCrystals(scene, getHeightAt);
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

// Light white-pink triangular crystal formation at the north end of the road.
function addCrystals(scene: THREE.Scene, getHeightAt: (x: number, z: number) => number): void {
  const northEnd = SPINE[0];
  if (!northEnd) return;
  const [cx, cz] = northEnd;

  // [xOff, zOff, baseRadius, height, tiltX, tiltZ, yaw]
  type CrystalDef = readonly [number, number, number, number, number, number, number];
  const defs: CrystalDef[] = [
    [0, 0, 4.0, 92, 0.1, 0.0, 0.4],
    [-7, 3, 3.0, 80, -0.22, 0.18, 1.1],
    [8, -2, 2.8, 88, 0.28, -0.15, 2.3],
    [-12, -4, 2.4, 72, 0.15, 0.3, 0.8],
    [5, 9, 3.5, 84, -0.12, 0.22, 1.8],
    [13, 5, 2.0, 70, 0.3, -0.24, 3.1],
    [-6, -10, 2.8, 76, -0.24, -0.12, 2.6],
    [14, -8, 2.2, 68, 0.18, 0.28, 0.2],
    [-15, 7, 1.8, 74, -0.16, 0.24, 1.5],
    [2, -14, 2.5, 78, 0.2, -0.18, 3.5],
  ];

  // Light white-pink shades — soft crystal glow
  const colors = [0xffe8f5, 0xfff0fa, 0xfce4f0, 0xfff5fc];

  defs.forEach(([xOff, zOff, radius, height, tiltX, tiltZ, yaw], idx) => {
    const wx = cx + xOff;
    const wz = cz + zOff;
    const groundY = getHeightAt(wx, wz);
    // 3 sides = triangular cross-section — jagged, clearly non-spherical
    const geo = new THREE.ConeGeometry(radius, height, 3);
    const mat = new THREE.MeshLambertMaterial({
      color: colors[idx % colors.length],
      emissive: 0x100808,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Bury base 25% underground so crystals look like they erupted from the ground
    mesh.position.set(wx, groundY + height * 0.35, wz);
    mesh.rotation.set(tiltX, yaw, tiltZ);
    mesh.castShadow = true;
    scene.add(mesh);
  });
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
