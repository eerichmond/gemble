import * as THREE from 'three';

const ROAD_WIDTH = 12;
const ROAD_HALF = ROAD_WIDTH / 2;
// Raise road 0.25 above terrain so it clears the terrain mesh on steep slopes.
// Higher offset is more reliable on rolling hills; 0.06 was too tight.
const Y_ROAD = 0.25;
const Y_MARK = Y_ROAD + 0.02; // markings above road surface
const EDGE_HALF = 0.2; // half-width of white edge lines
const DASH_HALF = 0.18; // half-width of center dashes
const DASH_LEN = 2.5; // length of each yellow dash
const DASH_PERIOD = 6.5; // dash + gap length

// Spine (x, z) waypoints — first waypoint at z=−20 so the road is visible
// just ahead from spawn, then curves gently southwest toward the city.
const SPINE: ReadonlyArray<readonly [number, number]> = [
  [-3, -20],
  [-10, -52],
  [-20, -88],
  [-26, -122],
  [-20, -155],
  [-6, -186],
  [10, -216],
  [14, -245],
  [4, -262],
] as const;

export function createRoad(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): void {
  // Sample every 1.5 units for dense terrain-following vertices on rolling hills
  const pts = sampleSpine(SPINE, 1.5);

  const roadMat = new THREE.MeshLambertMaterial({
    map: buildAsphaltTexture(),
    color: 0xffffff,
  });
  scene.add(new THREE.Mesh(buildRibbon(pts, getHeightAt, 0, ROAD_HALF, Y_ROAD, 6), roadMat));

  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xd0d0d0 });
  // Left edge line (negative offset = left side)
  scene.add(
    new THREE.Mesh(
      buildRibbon(pts, getHeightAt, -(ROAD_HALF - EDGE_HALF), EDGE_HALF, Y_MARK, 4),
      whiteMat,
    ),
  );
  // Right edge line
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
}

// Walk the spine, emitting one (x, z) sample every ~step world units.
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
// lateralOffset: shifts the ribbon center left (-) or right (+) of the spine.
// halfW: half-width of the ribbon.
// yOff: vertical clearance above terrain.
// uvTile: world units per UV.v repeat (controls how the texture tiles along the road).
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

    // Forward direction — average with neighbours for smoother tangent
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

    // Right direction in XZ: rotate forward 90° clockwise → (fz, -fx)
    const rx = fz,
      rz = -fx;

    const ocx = cx + rx * lateralOffset;
    const ocz = cz + rz * lateralOffset;
    const lx = ocx - rx * halfW,
      lz = ocz - rz * halfW;
    const ex = ocx + rx * halfW,
      ez = ocz + rz * halfW;

    const ly = getHeightAt(lx, lz) + yOff;
    const ey = getHeightAt(ex, ez) + yOff;

    positions.push(lx, ly, lz, ex, ey, ez);
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
      // Winding: b→t→b+1 and b+1→t→t+1 gives normals pointing up (+Y)
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

// Build the yellow dashed centerline as a single BufferGeometry.
// halfW: half-width of each dash quad.
// dashLen: length of each visible dash.
// period: total dash+gap length (dash repeats every `period` units).
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
  let phase = 0; // position within current period

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
        const y0 = getHeightAt(x0, z0) + yOff;
        const y1 = getHeightAt(x1, z1) + yOff;

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
        // Winding: 0→3→1 and 1→3→2 gives normals pointing up (+Y)
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

// Procedural asphalt texture: dark gray base with aggregate grain speckles.
function buildAsphaltTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#242424';
  ctx.fillRect(0, 0, size, size);

  // Coarse aggregate speckles — slightly lighter and darker flecks
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

  // Subtle longitudinal wear streaks
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
