import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

// ── Capybaras ─────────────────────────────────────────────────────────────────
// 10 capybaras in 3 groups (3, 3, 4). Per group: 2 large + rest small.
// Body/legs: BoxGeometry. Head: oval SphereGeometry scaled to an ellipsoid.
// Eyes sit on top of the head, forward of center. Black square nose at snout tip.
// Head group pivots at the neck joint and bobs as it grazes.

interface CapybaraEntity {
  headGroup: THREE.Group;
  bobSpeed: number;
  bobPhase: number;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ── Shared materials ──────────────────────────────────────────────────────────
const _brown = new THREE.MeshLambertMaterial({ color: 0x7a4a1e });
const _black = new THREE.MeshLambertMaterial({ color: 0x111111 });

// Unit sphere shared across all head instances; scaled per-individual
const _headGeo = new THREE.SphereGeometry(1, 8, 6);

// ── Size definitions ──────────────────────────────────────────────────────────
// hrX/hrY/hrZ are the ellipsoid semi-axes applied via mesh.scale.
// Head center is placed at (0, hrY, hrZ) in headGroup so its back sits at pivot.
// Eyes: on TOP of head (y ≈ 2*hrY), forward half (z ≈ hrZ*1.35) — visible from above.
// Nose: black square at snout tip (z ≈ 2*hrZ), slightly below center height.
interface CapDef {
  bW: number; bH: number; bL: number;   // body box
  hrX: number; hrY: number; hrZ: number; // head ellipsoid semi-axes
  lW: number; lH: number;               // leg cross-section, height
  eH: number;                           // ear height (used for top-of-head offset)
  eyeS: number;                         // eye box half-size (used for y offset)
  bodyGeo: THREE.BoxGeometry;
  legGeo:  THREE.BoxGeometry;
  earGeo:  THREE.BoxGeometry;
  eyeGeo:  THREE.BoxGeometry;
  noseGeo: THREE.BoxGeometry;
}

// Large: body 1.0×0.55×1.8, head ellipsoid ~0.60×0.50×0.80
const DEF_L: CapDef = {
  bW: 1.00, bH: 0.55, bL: 1.80,
  hrX: 0.30, hrY: 0.25, hrZ: 0.40,
  lW: 0.10, lH: 0.40,
  eH: 0.16, eyeS: 0.09,
  bodyGeo: new THREE.BoxGeometry(1.00, 0.55, 1.80),
  legGeo:  new THREE.BoxGeometry(0.10, 0.40, 0.10),
  earGeo:  new THREE.BoxGeometry(0.13, 0.16, 0.08),
  eyeGeo:  new THREE.BoxGeometry(0.09, 0.09, 0.02),
  noseGeo: new THREE.BoxGeometry(0.14, 0.09, 0.06),
};

// Small: body 0.65×0.38×1.2, head ellipsoid ~0.42×0.36×0.56
const DEF_S: CapDef = {
  bW: 0.65, bH: 0.38, bL: 1.20,
  hrX: 0.21, hrY: 0.18, hrZ: 0.28,
  lW: 0.08, lH: 0.28,
  eH: 0.12, eyeS: 0.07,
  bodyGeo: new THREE.BoxGeometry(0.65, 0.38, 1.20),
  legGeo:  new THREE.BoxGeometry(0.08, 0.28, 0.08),
  earGeo:  new THREE.BoxGeometry(0.10, 0.12, 0.06),
  eyeGeo:  new THREE.BoxGeometry(0.07, 0.07, 0.02),
  noseGeo: new THREE.BoxGeometry(0.10, 0.07, 0.06),
};

function buildOne(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  x: number, z: number,
  rotY: number,
  large: boolean,
): CapybaraEntity {
  const d = large ? DEF_L : DEF_S;
  const { bW, bH, bL, hrX, hrY, hrZ, lW, lH, eH, eyeS } = d;

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
  // Pivot at front-top of body (neck joint). rotation.x > 0 = grazing nod.
  const headGroup = new THREE.Group();
  headGroup.position.set(0, lH + bH, bL / 2);
  root.add(headGroup);

  // Oval head: unit sphere scaled to an ellipsoid.
  // Placed so its back-bottom edge is at pivot origin, extends forward+up.
  const head = new THREE.Mesh(_headGeo, _brown);
  head.scale.set(hrX, hrY, hrZ);
  head.position.set(0, hrY, hrZ);   // center = (0, hrY, hrZ) → back at z=0, top at y=2*hrY
  headGroup.add(head);

  // Ears — brown squares on TOP of head, back-center portion
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(d.earGeo, _brown);
    ear.position.set(side * hrX * 0.72, hrY * 2 + eH / 2, hrZ * 0.55);
    headGroup.add(ear);
  }

  // Eyes — black squares on TOP of head, set forward (toward snout)
  // "set back from the nose, in the front half" — top surface, z ≈ 67% along head
  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(d.eyeGeo, _black);
    eye.position.set(side * hrX * 0.50, hrY * 2 - eyeS * 0.3, hrZ * 1.35);
    headGroup.add(eye);
  }

  // Nose — black square at snout tip, slightly below center height
  const nose = new THREE.Mesh(d.noseGeo, _black);
  nose.position.set(0, hrY * 0.55, hrZ * 2);
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
    let gx = 0, gz = 0;
    for (let a = 0; a < 300; a++) {
      gx = (rng() * 2 - 1) * 150;
      gz = (rng() * 2 - 1) * 130;

      const dsx = gx - SPAWN_X, dsz = gz - SPAWN_Z;
      if (dsx * dsx + dsz * dsz < 900) continue;  // 30 u from player spawn
      if (gx > 5 && gx < 30) continue;             // road corridor
      if (gz < -258) continue;                      // city zone

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
      cap.bobSpeed = 0.8 + rng() * 0.6;   // 0.8–1.4 rad/s, one cycle per 4.5–7.8 s
      cap.bobPhase = rng() * Math.PI * 2;
      capybaras.push(cap);
    }
  }

  let globalT = 0;

  return {
    update(dt: number): void {
      globalT += dt;
      for (const cap of capybaras) {
        // 0 = head level, 0.35 rad = head dipped grazing
        cap.headGroup.rotation.x =
          (1 - Math.cos(globalT * cap.bobSpeed + cap.bobPhase)) * 0.175;
      }
    },
  };
}
