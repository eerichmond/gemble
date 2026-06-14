import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

// ── Capybaras ─────────────────────────────────────────────────────────────────
// 10 capybaras in 3 groups (3, 3, 4). Per group: 2 large + rest small.
// All geometry is pure BoxGeometry (cubed/rectangular bodies, black stick legs).
// Each capybara's head group pivots at the neck joint and bobs as it grazes.

interface CapybaraEntity {
  headGroup: THREE.Group;
  bobSpeed: number;  // rad/s — varies per animal for staggered motion
  bobPhase: number;  // radians — random offset so they don't nod in sync
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ── Materials (shared across all instances) ───────────────────────────────────
const _brown     = new THREE.MeshLambertMaterial({ color: 0x7a4a1e });
const _darkBrown = new THREE.MeshLambertMaterial({ color: 0x4a2a08 });
const _black     = new THREE.MeshLambertMaterial({ color: 0x111111 });

// ── Size definition ───────────────────────────────────────────────────────────
// All geometries are pre-built once per size and shared.
interface CapDef {
  bW: number; bH: number; bL: number;   // body
  hW: number; hH: number; hL: number;   // head
  lW: number; lH: number;               // leg cross-section width, height
  eW: number; eH: number; eD: number;   // ear
  bodyGeo: THREE.BoxGeometry;
  headGeo: THREE.BoxGeometry;
  legGeo:  THREE.BoxGeometry;
  earGeo:  THREE.BoxGeometry;
  eyeGeo:  THREE.BoxGeometry;
  noseGeo: THREE.BoxGeometry;
}

function makeDef(
  bW: number, bH: number, bL: number,
  hW: number, hH: number, hL: number,
  lW: number, lH: number,
  eW: number, eH: number, eD: number,
  eyeS: number, nW: number, nH: number,
): CapDef {
  return {
    bW, bH, bL, hW, hH, hL, lW, lH, eW, eH, eD,
    bodyGeo: new THREE.BoxGeometry(bW, bH, bL),
    headGeo: new THREE.BoxGeometry(hW, hH, hL),
    legGeo:  new THREE.BoxGeometry(lW, lH, lW),
    earGeo:  new THREE.BoxGeometry(eW, eH, eD),
    eyeGeo:  new THREE.BoxGeometry(eyeS, eyeS, 0.02),
    noseGeo: new THREE.BoxGeometry(nW, nH, 0.04),
  };
}

// Large: body 1.0×0.55×1.8, head 0.70×0.55×0.65
const DEF_L = makeDef(
  1.00, 0.55, 1.80,
  0.70, 0.55, 0.65,
  0.10, 0.40,
  0.13, 0.16, 0.08,
  0.09, 0.18, 0.10,
);

// Small: body 0.65×0.38×1.2, head 0.48×0.38×0.47
const DEF_S = makeDef(
  0.65, 0.38, 1.20,
  0.48, 0.38, 0.47,
  0.08, 0.28,
  0.10, 0.12, 0.06,
  0.07, 0.14, 0.08,
);

function buildOne(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  x: number, z: number,
  rotY: number,
  large: boolean,
): CapybaraEntity {
  const d = large ? DEF_L : DEF_S;
  const { bW, bH, bL, hW, hH, hL, lW, lH, eH } = d;

  const root = new THREE.Group();
  root.position.set(x, getHeightAt(x, z), z);
  root.rotation.y = rotY;
  scene.add(root);

  // ── Body ─────────────────────────────────────────────────────────────────────
  const body = new THREE.Mesh(d.bodyGeo, _brown);
  body.position.y = lH + bH / 2;
  root.add(body);

  // ── Legs — four black stick legs at body corners ───────────────────────────
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

  // ── Head group ────────────────────────────────────────────────────────────────
  // Pivot point: front-top of body (neck joint).
  // rotation.x > 0 = head nods forward-down into grazing posture.
  const headGroup = new THREE.Group();
  headGroup.position.set(0, lH + bH, bL / 2);
  root.add(headGroup);

  // Head mesh: back-bottom edge sits at pivot origin, extends forward (+Z) and up (+Y)
  const head = new THREE.Mesh(d.headGeo, _brown);
  head.position.set(0, hH / 2, hL / 2);
  headGroup.add(head);

  // Ears — small square blocks on top of head, near the back
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(d.earGeo, _brown);
    ear.position.set(side * hW * 0.44, hH + eH / 2, hL * 0.26);
    headGroup.add(ear);
  }

  // Eyes — black squares flush with front face of head, upper sides
  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(d.eyeGeo, _black);
    eye.position.set(side * hW * 0.33, hH * 0.62, hL + 0.01);
    headGroup.add(eye);
  }

  // Nose — darker brown square, front face lower-center
  const nose = new THREE.Mesh(d.noseGeo, _darkBrown);
  nose.position.set(0, hH * 0.18, hL + 0.02);
  headGroup.add(nose);

  return { headGroup, bobSpeed: 0, bobPhase: 0 };
}

export function createCapybaras(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  excludeZones: CircleObstacle[] = [],
): { update: (dt: number) => void } {
  const rng = lcg(88);
  const capybaras: CapybaraEntity[] = [];

  // 3 groups: [L,L,S], [L,L,S], [L,L,S,S] → 10 total
  const groupDefs: boolean[][] = [
    [true, true, false],
    [true, true, false],
    [true, true, false, false],
  ];

  const SPAWN_X = -52, SPAWN_Z = 130;

  for (const members of groupDefs) {
    // Find a valid group center in the forest
    let gx = 0, gz = 0;
    for (let a = 0; a < 300; a++) {
      gx = (rng() * 2 - 1) * 150;
      gz = (rng() * 2 - 1) * 130;

      // Not too close to player spawn
      const dsx = gx - SPAWN_X, dsz = gz - SPAWN_Z;
      if (dsx * dsx + dsz * dsz < 900) continue;  // 30 units from spawn

      // Avoid road corridor and city zone
      if (gx > 5 && gx < 30) continue;
      if (gz < -258) continue;

      // Avoid mountain bases, gem crystals, etc.
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

      const cap = buildOne(scene, getHeightAt, gx + ox, gz + oz, rotY, large);
      // 0.8–1.4 rad/s → one graze cycle every 4.5–7.8 seconds
      cap.bobSpeed = 0.8 + rng() * 0.6;
      cap.bobPhase = rng() * Math.PI * 2;
      capybaras.push(cap);
    }
  }

  let globalT = 0;

  return {
    update(dt: number): void {
      globalT += dt;
      for (const cap of capybaras) {
        // Smooth oscillation: 0 rad (head level) ↔ 0.35 rad (head dipped, grazing)
        cap.headGroup.rotation.x =
          (1 - Math.cos(globalT * cap.bobSpeed + cap.bobPhase)) * 0.175;
      }
    },
  };
}
