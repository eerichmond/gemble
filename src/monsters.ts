import * as THREE from 'three';

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

// ── Crystal Troll ─────────────────────────────────────────────────────────────
// ~2.2 u tall stocky humanoid. Olive-green skin, tan BoxGeometry clothes,
// steel-blue crystal spikes on crown. Arms raised with clawed hands.

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

  const skin    = lam(0x5a7040);
  const skinDk  = lam(0x3d5030);
  const tan     = lam(0xc8a060);
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

  // Tan pants over hips
  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.34, 0.26), tan);
    m.position.set(0, 0.91, 0); root.add(m); }

  // ── Chest ───────────────────────────────────────────────────────────────────
  place(root, cap(0.24, 0.14), skin, 0, 1.40, 0);

  // Tan tunic panel (lower chest)
  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.20, 0.28), tan);
    m.position.set(0, 1.26, 0); root.add(m); }

  // Shoulder joints
  place(root, sph(0.135), skin, -0.38, 1.66, 0);
  place(root, sph(0.135), skin,  0.38, 1.66, 0);

  // ── Arms: outward+up, forearms bend further up ────────────────────────────
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

    // 3 claws fanning from fist
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

  // Brow ridge
  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.09), skinDk);
    m.position.set(0, 0.10, 0.21); headGroup.add(m); }

  // Eyes: white base + dark pupil
  for (const sx of [-1, 1] as const) {
    const eb = new THREE.Mesh(sph(0.075), eyeW);
    eb.position.set(sx * 0.12, 0.05, 0.21); headGroup.add(eb);
    const ep = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 4), eyeD);
    ep.position.set(sx * 0.12, 0.046, 0.263); headGroup.add(ep);
  }

  // Nose
  { const m = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 4), skinDk);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, -0.02, 0.25); headGroup.add(m); }

  // Ears
  for (const sx of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 4), skin);
    ear.rotation.z = sx * Math.PI / 2;
    ear.position.set(sx * 0.30, 0.08, 0); headGroup.add(ear);
  }

  // Crystal crown spikes (3, 4-sided pyramids)
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
// Narrow humanoid, dark charcoal. Bat wings from upper back — 3 finger spars
// + PlaneGeometry membrane. Wings flap via rotation.z on each wing group.

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

  const body  = lam(0x2a2830);
  const bodyDk = lam(0x1a1820);
  const spar  = lam(0x3a2a3a);
  const wMem  = new THREE.MeshLambertMaterial({ color: 0x1a0a1a, side: THREE.DoubleSide });
  const eyeD  = lam(0x080808);
  const cloth = lam(0x3a3025);
  const hair  = lam(0x1a1818);

  const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 8);
  const sph = (r: number)            => new THREE.SphereGeometry(r, 10, 8);

  // ── Legs ────────────────────────────────────────────────────────────────────
  for (const sx of [-0.10, 0.10]) {
    place(root, cap(0.07, 0.26), body, sx, 0.32, 0);
    place(root, sph(0.085),      body, sx, 0.54, 0);
    place(root, cap(0.10, 0.20), body, sx * 0.55, 0.74, 0);
  }
  place(root, sph(0.15), body, 0, 0.90, 0);

  // Dark cloth wrap at waist
  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.26, 0.22), cloth);
    m.position.set(0, 0.78, 0); root.add(m); }

  // ── Chest (narrow) ──────────────────────────────────────────────────────────
  place(root, cap(0.17, 0.14), body, 0, 1.20, 0);

  // Dark cloth tunic
  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.22), cloth);
    m.position.set(0, 1.10, 0); root.add(m); }

  // Shoulder joints
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

  // Spiky hair (3 cones on crown, slightly back-tilted)
  for (const [hx, hy, hrz] of [
    [0, 0.22, 0], [-0.09, 0.18, -0.28], [0.09, 0.18, 0.28],
  ] as [number, number, number][]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 4), hair);
    sp.rotation.z = hrz;
    sp.position.set(hx, hy, -0.04); headGroup.add(sp);
  }

  // ── Wings ────────────────────────────────────────────────────────────────────
  // Each group pivots at back-shoulder. rotation.z flaps the wing.
  // leftWing.rotation.z = -sin(t): negative → left tip (−X) goes UP.
  // rightWing.rotation.z = +sin(t): positive → right tip (+X) goes UP.
  const leftWing  = new THREE.Group();
  const rightWing = new THREE.Group();
  leftWing.position.set(-0.24, 1.52, 0.06);
  rightWing.position.set(0.24, 1.52, 0.06);
  root.add(leftWing);
  root.add(rightWing);

  function buildWing(parent: THREE.Group, side: -1 | 1): void {
    // Arm spar extends to wrist
    const armSpar = new THREE.Mesh(cap(0.04, 0.80), spar);
    armSpar.rotation.z = Math.PI / 2;
    armSpar.position.set(side * 0.44, 0, 0);
    parent.add(armSpar);

    // Wrist ball
    place(parent, sph(0.055), spar, side * 0.88, 0, 0);

    // 3 finger spars: F1 up-out, F2 horizontal, F3 down-out (symmetric)
    const fingerDirs: [number, number][] = [
      [side * 0.52,  0.85],
      [side * 0.90,  0.15],
      [side * 0.52, -0.85],
    ];
    for (const [fdx, fdy] of fingerDirs) {
      const fSpar = new THREE.Mesh(cap(0.028, 0.46), spar);
      fSpar.rotation.z = Math.atan2(-fdx, fdy);
      fSpar.position.set(side * 0.88 + fdx * 0.25, fdy * 0.25, 0);
      parent.add(fSpar);
    }

    // Membrane: flat plane in XY (faces ±Z), DoubleSide visible from front/back
    const mem = new THREE.Mesh(new THREE.PlaneGeometry(1.30, 0.92), wMem);
    mem.position.set(side * 0.76, -0.05, 0);
    parent.add(mem);
  }

  buildWing(leftWing,  -1);
  buildWing(rightWing,  1);

  return { leftWing, rightWing, headGroup };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createMonsters(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): { update: (dt: number) => void } {
  // Troll: ~85 u south of spawn, likely behind a terrain rise — visible once you crest the hill
  const troll  = buildCrystalTroll(scene, getHeightAt, -20, 50, 0.3);
  // Winged monster: west side of city, between the houses (z=-360 to -385)
  const winged = buildWingedMonster(scene, getHeightAt, -18, -365, 1.6);

  let time = 0;

  return {
    update(dt: number): void {
      time += dt;

      // Troll: head turns side-to-side; body sways gently
      troll.headGroup.rotation.y  = Math.sin(time * 0.55) * 0.30;
      troll.rootGroup.rotation.z  = Math.sin(time * 0.40) * 0.035;

      // Winged monster: head sways; wings flap together
      winged.headGroup.rotation.y = Math.sin(time * 0.45) * 0.25;
      const wingAngle = Math.sin(time * 0.90) * 0.40;
      winged.leftWing.rotation.z  = -wingAngle;
      winged.rightWing.rotation.z =  wingAngle;
    },
  };
}
