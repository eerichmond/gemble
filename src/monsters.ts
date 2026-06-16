import * as THREE from 'three';
import type { CircleObstacle } from './terrain';
import type { BuildingBox } from './city';

// ── Flying Eye ────────────────────────────────────────────────────────────────
// Floats at city center, bobs and drifts, always slowly rotates to face player.

const EYE_X = 0;
const EYE_Z = -310;

const _ph = (color: number, emissive = 0, ei = 0) =>
  new THREE.MeshPhongMaterial({ color, emissive, emissiveIntensity: ei });

export function createFlyingEye(
  scene: THREE.Scene,
  groundY: number,
): {
  update: (dt: number, playerX: number, playerZ: number) => void;
} {
  const EYE_BASE_Y = groundY + 5.0;
  const group = new THREE.Group();
  group.position.set(EYE_X, EYE_BASE_Y, EYE_Z);
  scene.add(group);

  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 20), _ph(0x2050a0)));

  const iris = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 20, 16),
    _ph(0xaa66ee, 0x7733cc, 0.7),
  );
  iris.position.set(0, 0, 0.30);
  group.add(iris);

  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    _ph(0x080018, 0x110033, 0.3),
  );
  pupil.position.set(0, 0, 0.52);
  group.add(pupil);

  { const _yUp = new THREE.Vector3(0, 1, 0);
    for (const side of [-1, 1] as const) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.32, 5), _ph(0x2e68cc));
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(_yUp, new THREE.Vector3(side, 0, 0));
      c.quaternion.copy(q);
      c.position.set(side * (0.55 + 0.16), 0, 0);
      group.add(c);
    }
  }

  group.add(new THREE.PointLight(0x8060ff, 3, 14));

  const _dir     = new THREE.Vector3();
  const _target  = new THREE.Vector3();
  const _forward = new THREE.Vector3(0, 0, 1);
  const _tgtQ    = new THREE.Quaternion();
  let time = 0;

  return {
    update(dt, playerX, playerZ) {
      time += dt;
      group.position.y = EYE_BASE_Y + Math.sin(time * 1.3) * 0.60;
      group.position.x = EYE_X      + Math.sin(time * 0.35) * 1.60;
      iris.rotation.x  = Math.sin(time * 0.7)  * 0.15;
      iris.rotation.y  = Math.sin(time * 0.5)  * 0.12;
      pupil.rotation.y = Math.sin(time * 0.55) * 0.10;
      _target.set(playerX, groundY + 1.7, playerZ);
      _dir.subVectors(_target, group.position).normalize();
      _tgtQ.setFromUnitVectors(_forward, _dir);
      group.quaternion.slerp(_tgtQ, Math.min(1.0, dt * 1.2));
    },
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function lam(c: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: c });
}

function place(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number, y: number, z: number,
  rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rz !== 0) m.rotation.z = rz;
  parent.add(m);
  return m;
}

function clearOfCircles(x: number, z: number, circles: CircleObstacle[]): boolean {
  return !circles.some(m => {
    const dx = x - m.x, dz = z - m.z;
    return dx * dx + dz * dz < (m.radius + 3) * (m.radius + 3);
  });
}

function clearOfBoxes(x: number, z: number, boxes: BuildingBox[]): boolean {
  const PAD = 2;
  return !boxes.some(b =>
    x > b.minX - PAD && x < b.maxX + PAD &&
    z > b.minZ - PAD && z < b.maxZ + PAD,
  );
}

function safePos(
  x: number, z: number,
  circles: CircleObstacle[],
  boxes: BuildingBox[] = [],
): [number, number] {
  const ok = (px: number, pz: number) =>
    clearOfCircles(px, pz, circles) && clearOfBoxes(px, pz, boxes);
  if (ok(x, z)) return [x, z];
  for (const [ox, oz] of [
    [15,0],[-15,0],[0,15],[0,-15],[25,0],[-25,0],[0,25],[0,-25],[20,20],[-20,20],
    [-20,-20],[20,-20],[30,0],[-30,0],[0,30],[0,-30],
  ] as [number,number][]) {
    if (ok(x + ox, z + oz)) return [x + ox, z + oz];
  }
  return [x, z];
}

// ── Skin colors (dark blue) ───────────────────────────────────────────────────
const SKIN    = 0x1e3068;
const SKIN_DK = 0x0e1840;

// ── Crystal Troll ─────────────────────────────────────────────────────────────
// ~2.2 u tall stocky humanoid. Dark blue skin, no clothes.
// Steel-blue crystal spikes on crown. Arms raised with clawed hands.

interface TrollAnim {
  headGroup: THREE.Group;
  rootGroup: THREE.Group;
}

function buildCrystalTroll(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  x: number, z: number,
  rotY: number,
): TrollAnim {
  const root = new THREE.Group();
  root.position.set(x, getHeightAt(x, z), z);
  root.rotation.y = rotY;
  scene.add(root);

  const skin    = lam(SKIN);
  const skinDk  = lam(SKIN_DK);
  const eyeW    = lam(0xddddc0);
  const eyeD    = lam(0x080808);
  const crystal = new THREE.MeshLambertMaterial({
    color: 0x4a85b5, emissive: new THREE.Color(0x1e4d88),
  });

  const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 8);
  const sph = (r: number)            => new THREE.SphereGeometry(r, 10, 8);

  // ── Legs ────────────────────────────────────────────────────────────────────
  for (const sx of [-0.13, 0.13]) {
    place(root, cap(0.09, 0.28), skin, sx, 0.36, 0);
    place(root, sph(0.105),      skin, sx, 0.62, 0);
    place(root, cap(0.12, 0.22), skin, sx * 0.65, 0.84, 0);
  }
  place(root, sph(0.19), skin, 0, 1.08, 0);

  // ── Chest ───────────────────────────────────────────────────────────────────
  place(root, cap(0.24, 0.14), skin, 0, 1.40, 0);
  place(root, sph(0.135), skin, -0.38, 1.66, 0);
  place(root, sph(0.135), skin,  0.38, 1.66, 0);

  // ── Arms ────────────────────────────────────────────────────────────────────
  for (const sx of [-1, 1] as const) {
    const udx = sx * 0.94, udy = 0.34;
    const uRz = Math.atan2(-udx, udy);
    const uLen = 0.44;
    place(root, cap(0.09, 0.26), skin,
      sx * 0.38 + udx * 0.22, 1.66 + udy * 0.22, 0, uRz);
    const ex = sx * 0.38 + udx * uLen;
    const ey = 1.66 + udy * uLen;
    place(root, sph(0.095), skin, ex, ey, 0);

    const fdx = sx * 0.50, fdy = 0.87;
    const fRz = Math.atan2(-fdx, fdy);
    const fLen = 0.40;
    place(root, cap(0.085, 0.23), skin,
      ex + fdx * 0.20, ey + fdy * 0.20, 0, fRz);
    const fx = ex + fdx * fLen;
    const fy = ey + fdy * fLen;
    place(root, sph(0.095), skinDk, fx, fy, 0);

    for (const spread of [-0.26, 0, 0.26]) {
      const cRz = fRz + spread;
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 4), skinDk);
      claw.rotation.z = cRz;
      claw.position.set(fx - Math.sin(cRz) * 0.12, fy + Math.cos(cRz) * 0.12, 0);
      root.add(claw);
    }
  }

  // ── Neck ────────────────────────────────────────────────────────────────────
  place(root, cap(0.10, 0.06), skin, 0, 1.82, 0);

  // ── Head group (animates) ────────────────────────────────────────────────────
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.10, 0);
  root.add(headGroup);

  headGroup.add(new THREE.Mesh(sph(0.27), skin));

  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.09), skinDk);
    m.position.set(0, 0.10, 0.21); headGroup.add(m); }

  for (const sx of [-1, 1] as const) {
    const eb = new THREE.Mesh(sph(0.075), eyeW);
    eb.position.set(sx * 0.12, 0.05, 0.21); headGroup.add(eb);
    const ep = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 4), eyeD);
    ep.position.set(sx * 0.12, 0.046, 0.263); headGroup.add(ep);
  }

  { const m = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 4), skinDk);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, -0.02, 0.25); headGroup.add(m); }

  for (const sx of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 4), skin);
    ear.rotation.z = sx * Math.PI / 2;
    ear.position.set(sx * 0.30, 0.08, 0); headGroup.add(ear);
  }

  for (const [spx, spy, spRz] of [
    [0, 0.28, 0], [-0.12, 0.24, -0.22], [0.12, 0.24, 0.22],
  ] as [number, number, number][]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.37, 4), crystal);
    sp.rotation.y = Math.PI / 4;
    sp.rotation.z = spRz;
    sp.position.set(spx, spy, 0);
    headGroup.add(sp);
  }

  return { headGroup, rootGroup: root };
}

// ── Winged Monster ────────────────────────────────────────────────────────────
// Narrow humanoid with bat wings. Dark blue body. No clothes.
// Wings flap via rotation.z on each wing group.

interface WingedAnim {
  leftWing:  THREE.Group;
  rightWing: THREE.Group;
  headGroup: THREE.Group;
}

function buildWingedMonster(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  x: number, z: number,
  rotY: number,
): WingedAnim {
  const root = new THREE.Group();
  root.position.set(x, getHeightAt(x, z), z);
  root.rotation.y = rotY;
  scene.add(root);

  const body  = lam(SKIN);
  const bodyDk = lam(SKIN_DK);
  const spar  = lam(0x3a2a5a);
  const wMem  = new THREE.MeshLambertMaterial({ color: 0x0a0418, side: THREE.DoubleSide });
  const eyeD  = lam(0x080808);
  const hair  = lam(0x1a1828);

  const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 8);
  const sph = (r: number)            => new THREE.SphereGeometry(r, 10, 8);

  // ── Legs ────────────────────────────────────────────────────────────────────
  for (const sx of [-0.10, 0.10]) {
    place(root, cap(0.07, 0.26), body, sx, 0.32, 0);
    place(root, sph(0.085),      body, sx, 0.54, 0);
    place(root, cap(0.10, 0.20), body, sx * 0.55, 0.74, 0);
  }
  place(root, sph(0.15), body, 0, 0.90, 0);

  // ── Chest (narrow) ──────────────────────────────────────────────────────────
  place(root, cap(0.17, 0.14), body, 0, 1.20, 0);
  place(root, sph(0.10), body, -0.30, 1.46, 0);
  place(root, sph(0.10), body,  0.30, 1.46, 0);

  // T-pose arms
  for (const sx of [-1, 1] as const) {
    const arm = new THREE.Mesh(cap(0.07, 0.38), body);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(sx * 0.52, 1.46, 0);
    root.add(arm);
    place(root, sph(0.065), bodyDk, sx * 0.71, 1.46, 0);
  }

  // ── Neck + Head ─────────────────────────────────────────────────────────────
  place(root, cap(0.08, 0.08), body, 0, 1.61, 0);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.84, 0);
  root.add(headGroup);

  headGroup.add(new THREE.Mesh(sph(0.22), body));

  for (const sx of [-1, 1] as const) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 4), eyeD);
    e.position.set(sx * 0.10, 0.04, 0.18); headGroup.add(e);
  }

  for (const [hx, hy, hrz] of [
    [0, 0.22, 0], [-0.09, 0.18, -0.28], [0.09, 0.18, 0.28],
  ] as [number, number, number][]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 4), hair);
    sp.rotation.z = hrz;
    sp.position.set(hx, hy, -0.04); headGroup.add(sp);
  }

  // ── Wings ────────────────────────────────────────────────────────────────────
  const leftWing  = new THREE.Group();
  const rightWing = new THREE.Group();
  leftWing.position.set(-0.24, 1.52, 0.06);
  rightWing.position.set(0.24, 1.52, 0.06);
  root.add(leftWing);
  root.add(rightWing);

  function buildWing(parent: THREE.Group, side: -1 | 1): void {
    const armSpar = new THREE.Mesh(cap(0.04, 0.80), spar);
    armSpar.rotation.z = Math.PI / 2;
    armSpar.position.set(side * 0.44, 0, 0);
    parent.add(armSpar);

    place(parent, sph(0.055), spar, side * 0.88, 0, 0);

    for (const [fdx, fdy] of [
      [side * 0.52,  0.85],
      [side * 0.90,  0.15],
      [side * 0.52, -0.85],
    ] as [number, number][]) {
      const fSpar = new THREE.Mesh(cap(0.028, 0.46), spar);
      fSpar.rotation.z = Math.atan2(-fdx, fdy);
      fSpar.position.set(side * 0.88 + fdx * 0.25, fdy * 0.25, 0);
      parent.add(fSpar);
    }

    const mem = new THREE.Mesh(new THREE.PlaneGeometry(1.30, 0.92), wMem);
    mem.position.set(side * 0.76, -0.05, 0);
    parent.add(mem);
  }

  buildWing(leftWing,  -1);
  buildWing(rightWing,  1);

  return { leftWing, rightWing, headGroup };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MonsterPosition {
  x: number; z: number; type: 'troll' | 'winged';
}

export function createMonsters(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  circleObstacles: CircleObstacle[] = [],
  buildingBoxes: BuildingBox[] = [],
): {
  update: (dt: number) => void;
  positions: MonsterPosition[];
} {
  const [tx,  tz]  = safePos(-20,  50,  circleObstacles, []);               // troll, forest
  const [w1x, w1z] = safePos(-18, -373, circleObstacles, buildingBoxes);    // winged #1, city gap
  const [w2x, w2z] = safePos(55,  -30,  circleObstacles, []);               // winged #2, forest east

  const troll  = buildCrystalTroll(scene, getHeightAt, tx,  tz,  0.3);
  const winged1 = buildWingedMonster(scene, getHeightAt, w1x, w1z, 1.6);
  const winged2 = buildWingedMonster(scene, getHeightAt, w2x, w2z, -2.0);

  const positions: MonsterPosition[] = [
    { x: tx,  z: tz,  type: 'troll'  },
    { x: w1x, z: w1z, type: 'winged' },
    { x: w2x, z: w2z, type: 'winged' },
  ];

  let time = 0;

  return {
    positions,
    update(dt: number): void {
      time += dt;

      troll.headGroup.rotation.y = Math.sin(time * 0.55) * 0.30;
      troll.rootGroup.rotation.z = Math.sin(time * 0.40) * 0.035;

      winged1.headGroup.rotation.y = Math.sin(time * 0.45) * 0.25;
      const w1Angle = Math.sin(time * 0.90) * 0.40;
      winged1.leftWing.rotation.z  = -w1Angle;
      winged1.rightWing.rotation.z =  w1Angle;

      winged2.headGroup.rotation.y = Math.sin(time * 0.48 + 1.0) * 0.25;
      const w2Angle = Math.sin(time * 0.85 + 0.5) * 0.40;
      winged2.leftWing.rotation.z  = -w2Angle;
      winged2.rightWing.rotation.z =  w2Angle;
    },
  };
}
