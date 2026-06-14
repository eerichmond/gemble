import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

const ROAD_WIDTH = 12;
const ROAD_HALF = ROAD_WIDTH / 2;
const Y_ROAD = 0.3; // clearance above terrain — raised further by max-height sampling
const Y_MARK = Y_ROAD + 0.03; // markings sit above road surface
const EDGE_HALF = 0.2;
const DASH_HALF = 0.18;
const DASH_LEN = 2.5;
const DASH_PERIOD = 6.5;

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
  const pts = sampleSpine(SPINE, 1.5);

  const roadMat = new THREE.MeshLambertMaterial({ map: buildAsphaltTexture(), color: 0xffffff });
  scene.add(new THREE.Mesh(buildRibbon(pts, getHeightAt, 0, ROAD_HALF, Y_ROAD, 6), roadMat));

  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xd0d0d0 });
  scene.add(
    new THREE.Mesh(
      buildRibbon(pts, getHeightAt, -(ROAD_HALF - EDGE_HALF), EDGE_HALF, Y_MARK, 4),
      whiteMat,
    ),
  );
  scene.add(
    new THREE.Mesh(
      buildRibbon(pts, getHeightAt, ROAD_HALF - EDGE_HALF, EDGE_HALF, Y_MARK, 4),
      whiteMat,
    ),
  );

  const yellowMat = new THREE.MeshLambertMaterial({ color: 0xd4aa00 });
  scene.add(
    new THREE.Mesh(
      buildDashes(pts, getHeightAt, DASH_HALF, DASH_LEN, DASH_PERIOD, Y_MARK),
      yellowMat,
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

// Sample terrain height at left, centre, and right edges of the road at a given
// cross-section, return the maximum. Ensures the road surface sits above the
// highest terrain point across its width — prevents grass poking through.
function roadSurfaceH(
  getHeightAt: (x: number, z: number) => number,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  yOff: number,
): number {
  return (
    Math.max(
      getHeightAt(cx - rx * ROAD_HALF, cz - rz * ROAD_HALF),
      getHeightAt(cx, cz),
      getHeightAt(cx + rx * ROAD_HALF, cz + rz * ROAD_HALF),
    ) + yOff
  );
}

// Build a ribbon (flat band) following the sample path.
// lateralOffset: lateral shift from spine centre (+right, −left).
// halfW: half-width of this ribbon.
// yOff: clearance above terrain (must be ≥ Y_ROAD so markings sit above road).
// uvTile: world-units per UV.v tile repeat.
function buildRibbon(
  pts: [number, number][],
  getHeightAt: (x: number, z: number) => number,
  lateralOffset: number,
  halfW: number,
  yOff: number,
  uvTile: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvArr: number[] = [];
  const indices: number[] = [];
  let vAccum = 0;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const [cx, cz] = p;

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

    // Lateral centre of this ribbon strip
    const ocx = cx + rx * lateralOffset;
    const ocz = cz + rz * lateralOffset;
    const lx = ocx - rx * halfW,
      lz = ocz - rz * halfW;
    const ex = ocx + rx * halfW,
      ez = ocz + rz * halfW;

    // Use max terrain height across the full road width so the road never
    // clips below any terrain point in its cross-section.
    const y = roadSurfaceH(getHeightAt, cx, cz, rx, rz, yOff);

    positions.push(lx, y, lz, ex, y, ez);
    uvArr.push(0, vAccum / uvTile, 1, vAccum / uvTile);

    if (i > 0) {
      const prev = pts[i - 1];
      if (prev) {
        const dx = cx - prev[0];
        const dz = cz - prev[1];
        vAccum += Math.sqrt(dx * dx + dz * dz);
      }
      const b = (i - 1) * 2;
      const t = i * 2;
      // Winding: b→t→b+1 and b+1→t→t+1 → normals face +Y
      indices.push(b, t, b + 1, b + 1, t, t + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Build yellow center dashes as a single BufferGeometry.
function buildDashes(
  pts: [number, number][],
  getHeightAt: (x: number, z: number) => number,
  halfW: number,
  dashLen: number,
  period: number,
  yOff: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let phase = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const segLen = Math.sqrt(dx * dx + dz * dz);
    if (segLen < 0.001) continue;

    const fx = dx / segLen,
      fz = dz / segLen;
    const rx = fz,
      rz = -fx;

    let walked = 0;
    while (walked < segLen) {
      const inDash = phase < dashLen;
      const remaining = segLen - walked;

      if (inDash) {
        const draw = Math.min(dashLen - phase, remaining);
        const t0 = walked / segLen;
        const t1 = (walked + draw) / segLen;

        const x0 = a[0] + dx * t0,
          z0 = a[1] + dz * t0;
        const x1 = a[0] + dx * t1,
          z1 = a[1] + dz * t1;

        // Use max road-width height at each dash endpoint to match road surface
        const y0 = roadSurfaceH(getHeightAt, x0, z0, rx, rz, yOff);
        const y1 = roadSurfaceH(getHeightAt, x1, z1, rx, rz, yOff);

        const base = positions.length / 3;
        positions.push(
          x0 - rx * halfW,
          y0,
          z0 - rz * halfW,
          x0 + rx * halfW,
          y0,
          z0 + rz * halfW,
          x1 + rx * halfW,
          y1,
          z1 + rz * halfW,
          x1 - rx * halfW,
          y1,
          z1 - rz * halfW,
        );
        // Winding: 0→3→1 and 1→3→2 → normals face +Y
        indices.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);

        phase += draw;
        walked += draw;
      } else {
        const skip = Math.min(period - phase, remaining);
        phase += skip;
        walked += skip;
      }

      if (phase >= period) phase = 0;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Dark blue-green jagged crystal formation that rises from the north end of the
// road, blocking passage — signals this direction leads nowhere safe.
function addCrystals(scene: THREE.Scene, getHeightAt: (x: number, z: number) => number): void {
  const northEnd = SPINE[0];
  if (!northEnd) return;
  const [cx, cz] = northEnd;

  // [xOff, zOff, baseRadius, height, tiltX, tiltZ, yaw]
  type CrystalDef = readonly [number, number, number, number, number, number, number];
  const defs: CrystalDef[] = [
    [0, 0, 4.5, 62, 0.08, 0.0, 0.4],
    [-6, 3, 3.5, 54, -0.14, 0.12, 1.1],
    [7, -2, 3.2, 58, 0.18, -0.1, 2.3],
    [-11, -4, 2.8, 46, 0.1, 0.22, 0.8],
    [4, 8, 3.8, 50, -0.08, 0.14, 1.8],
    [12, 5, 2.2, 40, 0.22, -0.16, 3.1],
    [-5, -9, 3.2, 52, -0.16, -0.08, 2.6],
    [13, -7, 2.5, 44, 0.12, 0.2, 0.2],
    [-14, 6, 2.0, 38, -0.1, 0.18, 1.5],
  ];

  // Two slightly different dark blue-green shades for visual variety
  const colors = [0x0a2820, 0x0d3228, 0x0b2f25, 0x102e24];

  defs.forEach(([xOff, zOff, radius, height, tiltX, tiltZ, yaw], idx) => {
    const wx = cx + xOff;
    const wz = cz + zOff;
    const groundY = getHeightAt(wx, wz);
    const geo = new THREE.ConeGeometry(radius, height, 4);
    const mat = new THREE.MeshLambertMaterial({
      color: colors[idx % colors.length],
      emissive: 0x040e0a,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Bury base 20% underground so crystals look like they erupted from the ground
    mesh.position.set(wx, groundY + height * 0.4, wz);
    mesh.rotation.set(tiltX, yaw, tiltZ);
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

// Procedural asphalt texture: dark gray base with aggregate grain speckles.
function buildAsphaltTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#242424';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 5000; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const v = 22 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.globalAlpha = 0.4 + Math.random() * 0.6;
    const r = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 12; i++) {
    const px = Math.random() * size;
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px + (Math.random() - 0.5) * 20, size);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
