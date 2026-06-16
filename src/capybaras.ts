import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

// ── Capybaras ─────────────────────────────────────────────────────────────────
// 10 capybaras in 3 groups (3, 3, 4). Per group: 2 large + rest small.
// Body: oval ellipsoid (SphereGeometry scaled). Legs: black sticks.
// Head: oval SphereGeometry with eyes on top and black nose at snout tip.
// Each capybara slowly wanders within 15 u of its starting position.

interface CapybaraEntity {
  root: THREE.Group;
  headGroup: THREE.Group;
  bobSpeed: number;
  bobPhase: number;
  posX: number;
  posZ: number;
  startX: number;
  startZ: number;
  wanderAngle: number;
  wanderTimer: number;
  wanderSpeed: number;
  getHeightAt: (x: number, z: number) => number;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ── Shared materials & geometry ───────────────────────────────────────────────
const _brown   = new THREE.MeshLambertMaterial({ color: 0x7a4a1e });
const _black   = new THREE.MeshLambertMaterial({ color: 0x111111 });
const _bodyGeo = new THREE.SphereGeometry(1, 12, 8);  // scaled to oval per instance
const _headGeo = new THREE.SphereGeometry(1, 8, 6);   // scaled to oval per instance

// ── Size definitions ──────────────────────────────────────────────────────────
interface CapDef {
  bW: number; bH: number; bL: number;
  hrX: number; hrY: number; hrZ: number;
  lW: number; lH: number;
  eH: number; eyeS: number;
  legGeo:  THREE.BoxGeometry;
  earGeo:  THREE.BoxGeometry;
  eyeGeo:  THREE.BoxGeometry;
  noseGeo: THREE.BoxGeometry;
}

// Large: ~1.30×0.70×2.30 oval body (30% bigger than original)
const DEF_L: CapDef = {
  bW: 1.30, bH: 0.70, bL: 2.30,
  hrX: 0.39, hrY: 0.33, hrZ: 0.52,
  lW: 0.12, lH: 0.50,
  eH: 0.20, eyeS: 0.11,
  legGeo:  new THREE.BoxGeometry(0.12, 0.50, 0.12),
  earGeo:  new THREE.BoxGeometry(0.16, 0.20, 0.09),
  eyeGeo:  new THREE.BoxGeometry(0.11, 0.11, 0.02),
  noseGeo: new THREE.BoxGeometry(0.18, 0.11, 0.07),
};

// Small: ~0.85×0.48×1.55 oval body
const DEF_S: CapDef = {
  bW: 0.85, bH: 0.48, bL: 1.55,
  hrX: 0.27, hrY: 0.23, hrZ: 0.36,
  lW: 0.09, lH: 0.34,
  eH: 0.14, eyeS: 0.08,
  legGeo:  new THREE.BoxGeometry(0.09, 0.34, 0.09),
  earGeo:  new THREE.BoxGeometry(0.12, 0.14, 0.07),
  eyeGeo:  new THREE.BoxGeometry(0.08, 0.08, 0.02),
  noseGeo: new THREE.BoxGeometry(0.13, 0.08, 0.07),
};

function buildOne(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  x: number, z: number,
  rotY: number,
  large: boolean,
  rng: () => number,
): CapybaraEntity {
  const d = large ? DEF_L : DEF_S;
  const { bW, bH, bL, hrX, hrY, hrZ, lW, lH, eH, eyeS } = d;

  const root = new THREE.Group();
  root.position.set(x, getHeightAt(x, z), z);
  root.rotation.y = rotY;
  scene.add(root);

  // ── Body — oval ellipsoid ──────────────────────────────────────────────────
  const body = new THREE.Mesh(_bodyGeo, _brown);
  body.scale.set(bW / 2, bH / 2, bL / 2);
  body.position.y = lH + bH / 2;
  root.add(body);

  // ── Legs — four black sticks at body corners ───────────────────────────────
  const legCorners: [number, number][] = [
    [-bW / 2 + lW / 2,  bL / 2 - lW / 2],
    [ bW / 2 - lW / 2,  bL / 2 - lW / 2],
    [-bW / 2 + lW / 2, -bL / 2 + lW / 2],
    [ bW / 2 - lW / 2, -bL / 2 + lW / 2],
  ];
  for (const [lx, lz] of legCorners) {
    const leg = new THREE.Mesh(d.legGeo, _black);
    leg.position.set(lx, lH / 2, lz);
    root.add(leg);
  }

  // ── Head group (pivots at neck, bobs while grazing) ────────────────────────
  const headGroup = new THREE.Group();
  headGroup.position.set(0, lH + bH, bL / 2);
  root.add(headGroup);

  const head = new THREE.Mesh(_headGeo, _brown);
  head.scale.set(hrX, hrY, hrZ);
  head.position.set(0, hrY, hrZ);
  headGroup.add(head);

  for (const sx of [-1, 1] as const) {
    const ear = new THREE.Mesh(d.earGeo, _brown);
    ear.position.set(sx * hrX * 0.72, hrY * 2 + eH / 2, hrZ * 0.55);
    headGroup.add(ear);
  }

  for (const sx of [-1, 1] as const) {
    const eye = new THREE.Mesh(d.eyeGeo, _black);
    eye.position.set(sx * hrX * 0.50, hrY * 2 - eyeS * 0.3, hrZ * 1.35);
    headGroup.add(eye);
  }

  const nose = new THREE.Mesh(d.noseGeo, _black);
  nose.position.set(0, hrY * 0.55, hrZ * 2);
  headGroup.add(nose);

  return {
    root, headGroup,
    bobSpeed: 0, bobPhase: 0,
    posX: x, posZ: z,
    startX: x, startZ: z,
    wanderAngle: rng() * Math.PI * 2,
    wanderTimer: 1 + rng() * 4,
    wanderSpeed: 0.4 + rng() * 0.4,
    getHeightAt,
  };
}

export function createCapybaras(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  excludeZones: CircleObstacle[] = [],
): {
  update: (dt: number) => void;
  capybaraPositions: { x: number; z: number }[];
} {
  const rng = lcg(88);
  const capybaras: CapybaraEntity[] = [];

  const groupDefs: boolean[][] = [
    [true, true, false],
    [true, true, false],
    [true, true, false, false],
  ];

  const SPAWN_X = -52, SPAWN_Z = 130;

  for (const members of groupDefs) {
    let gx = 0, gz = 0;
    for (let a = 0; a < 300; a++) {
      gx = (rng() * 2 - 1) * 150;
      gz = (rng() * 2 - 1) * 130;
      const dsx = gx - SPAWN_X, dsz = gz - SPAWN_Z;
      if (dsx * dsx + dsz * dsz < 900) continue;
      if (gx > 5 && gx < 30) continue;
      if (gz < -258) continue;
      const blocked = excludeZones.some(e => {
        const dx = gx - e.x, dz = gz - e.z;
        return dx * dx + dz * dz < (e.radius + 8) * (e.radius + 8);
      });
      if (blocked) continue;
      break;
    }

    for (const large of members) {
      const ox = (rng() * 2 - 1) * 5;
      const oz = (rng() * 2 - 1) * 5;
      const rotY = rng() * Math.PI * 2;
      const cap = buildOne(scene, getHeightAt, gx + ox, gz + oz, rotY, large, rng);
      cap.bobSpeed = 0.8 + rng() * 0.6;
      cap.bobPhase = rng() * Math.PI * 2;
      capybaras.push(cap);
    }
  }

  // Live position array — mutated each frame, read by minimap
  const capybaraPositions: { x: number; z: number }[] =
    capybaras.map(c => ({ x: c.posX, z: c.posZ }));

  let globalT = 0;

  return {
    capybaraPositions,
    update(dt: number): void {
      globalT += dt;

      for (let i = 0; i < capybaras.length; i++) {
        const cap = capybaras[i]!;

        // ── Wander ─────────────────────────────────────────────────────────
        cap.wanderTimer -= dt;
        if (cap.wanderTimer <= 0) {
          cap.wanderAngle += (Math.random() - 0.5) * Math.PI;
          cap.wanderTimer = 2 + Math.random() * 5;
        }

        const nx = cap.posX + Math.sin(cap.wanderAngle) * cap.wanderSpeed * dt;
        const nz = cap.posZ + Math.cos(cap.wanderAngle) * cap.wanderSpeed * dt;
        const dhx = nx - cap.startX, dhz = nz - cap.startZ;
        if (dhx * dhx + dhz * dhz < 15 * 15) {
          cap.posX = nx;
          cap.posZ = nz;
        } else {
          cap.wanderAngle = Math.atan2(cap.startX - cap.posX, cap.startZ - cap.posZ)
            + (Math.random() - 0.5) * 0.4;
          cap.wanderTimer = 1;
        }

        cap.root.position.x = cap.posX;
        cap.root.position.z = cap.posZ;
        cap.root.position.y = cap.getHeightAt(cap.posX, cap.posZ);
        cap.root.rotation.y = -cap.wanderAngle;

        capybaraPositions[i]!.x = cap.posX;
        capybaraPositions[i]!.z = cap.posZ;

        // ── Head bob ──────────────────────────────────────────────────────
        cap.headGroup.rotation.x =
          (1 - Math.cos(globalT * cap.bobSpeed + cap.bobPhase)) * 0.175;
      }
    },
  };
}
