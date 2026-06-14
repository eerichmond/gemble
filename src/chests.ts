import * as THREE from 'three';
import { isKeyDown } from './input';
import type { CircleObstacle } from './terrain';

// ── Treasure Chests ───────────────────────────────────────────────────────────
// State machine per chest:  closed → opening → open → looted → closing → closed
//   Space (within 3 units, state=closed)  → start opening
//   Space (state=open)                    → pick up armor
//   Space (state=looted)                  → start closing

type ChestState = 'closed' | 'opening' | 'open' | 'looted' | 'closing';

interface Chest {
  lidGroup: THREE.Group;
  armor: THREE.Group;
  interiorLight: THREE.PointLight;
  state: ChestState;
  animTimer: number;   // opening: 0→ANIM_DUR; closing: ANIM_DUR→0
  armorSpinT: number;  // cumulative time while in 'open' state
  x: number;
  z: number;
}

export function isNearChest(
  playerX: number, playerZ: number,
  chestX: number, chestZ: number,
  radius: number,
): boolean {
  const dx = playerX - chestX;
  const dz = playerZ - chestZ;
  return dx * dx + dz * dz <= radius * radius;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0x100000000;
  };
}

// ── Dimensions ────────────────────────────────────────────────────────────────
const ANIM_DUR   = 0.6;
const LID_ANGLE  = 2.1;    // radians; positive = lid swings UP and backward
const W          = 1.60;
const H          = 1.60;   // body height; deeper interior than v1 (was 1.40)
const D          = 1.00;
const LID_H      = 0.60;

// ── Shared chest geometry ─────────────────────────────────────────────────────
const _bodyGeo  = new THREE.BoxGeometry(W, H, D);
const _lidGeo   = new THREE.BoxGeometry(W, LID_H, D);
const _bandGeo  = new THREE.BoxGeometry(W + 0.08, 0.12, D + 0.08);
const _lockGeo  = new THREE.BoxGeometry(0.20, 0.24, 0.12);
const _floorGeo = new THREE.BoxGeometry(W - 0.16, 0.02, D - 0.16);

// BoxGeometry material slots: [+x, -x, +y(TOP), -y, +z, -z]
// Slot 2 (+y) = transparent → player can look down through open top
const _wood    = new THREE.MeshLambertMaterial({ color: 0x3d1f08, side: THREE.DoubleSide });
const _open    = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0, depthWrite: false });
const _bodyMats: THREE.Material[] = [_wood, _wood, _open, _wood, _wood, _wood];
const _metal   = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
const _hasp    = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
const _velvet  = new THREE.MeshLambertMaterial({ color: 0x2a0808 });

// ── Armor geometry — gold chest plate ─────────────────────────────────────────
// Floats above the open chest; clearly visible at eye level since it hovers at
// H + 0.45 ≈ 2.05 units above terrain (player eye = 1.70 → armor ~0.35 above).
const _goldMain = new THREE.MeshLambertMaterial({ color: 0xd4a020, emissive: new THREE.Color(0x3a2800) });
const _goldTrim = new THREE.MeshLambertMaterial({ color: 0xa07810 });

const _platGeo     = new THREE.BoxGeometry(0.68, 0.78, 0.10);
const _shoulderGeo = new THREE.BoxGeometry(0.26, 0.24, 0.12);
const _neckGeo     = new THREE.BoxGeometry(0.28, 0.14, 0.10);
const _waistGeo    = new THREE.BoxGeometry(0.62, 0.12, 0.10);
const _ribGeo      = new THREE.BoxGeometry(0.58, 0.06, 0.11);

function buildArmor(): THREE.Group {
  const g = new THREE.Group();

  // Main torso plate
  g.add(new THREE.Mesh(_platGeo, _goldMain));

  // Shoulder guards (left & right)
  for (const side of [-1, 1] as const) {
    const s = new THREE.Mesh(_shoulderGeo, _goldTrim);
    s.position.set(side * 0.47, 0.33, 0);
    g.add(s);
  }

  // Neck guard
  const neck = new THREE.Mesh(_neckGeo, _goldTrim);
  neck.position.set(0, 0.46, 0);
  g.add(neck);

  // Waist band
  const waist = new THREE.Mesh(_waistGeo, _goldMain);
  waist.position.set(0, -0.45, 0);
  g.add(waist);

  // Horizontal mid-chest rib
  const rib = new THREE.Mesh(_ribGeo, _goldTrim);
  rib.position.set(0, 0.05, 0.01);
  g.add(rib);

  return g;
}

function buildChest(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  x: number,
  z: number,
  rotY: number,
): Chest {
  const group = new THREE.Group();
  group.position.set(x, getHeightAt(x, z), z);
  group.rotation.y = rotY;
  scene.add(group);

  // Body — transparent +Y face exposes interior when looking from above
  const body = new THREE.Mesh(_bodyGeo, _bodyMats);
  body.position.y = H / 2;  // 0.80
  group.add(body);

  // Metal bands
  for (const bY of [0.28, 1.22]) {
    const band = new THREE.Mesh(_bandGeo, _metal);
    band.position.y = bY;
    group.add(band);
  }

  // Lock hasp on front face (−Z)
  const lock = new THREE.Mesh(_lockGeo, _hasp);
  lock.position.set(0, H / 2, -(D / 2 + 0.08));
  group.add(lock);

  // Velvet floor — visible through open top
  const floor = new THREE.Mesh(_floorGeo, _velvet);
  floor.position.set(0, 0.04, 0);
  group.add(floor);

  // Interior glow — starts off, fades in as lid opens
  const interiorLight = new THREE.PointLight(0xffa040, 0, 6);
  interiorLight.position.set(0, H / 2, 0);
  group.add(interiorLight);

  // Lid — hinge at back-top edge (0, H, +D/2)
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, H, D / 2);
  group.add(lidGroup);

  // lidMesh: back-bottom edge at pivot origin → shift y+=LID_H/2, z-=D/2
  const lidMesh = new THREE.Mesh(_lidGeo, _wood);
  lidMesh.position.set(0, LID_H / 2, -D / 2);
  lidGroup.add(lidMesh);

  // Armor — floats H+0.45 above chest base (≈2.05 u above terrain)
  // Hidden until chest opens; bobbing/spinning while in 'open' state
  const armor = buildArmor();
  armor.position.set(0, H + 0.45, 0);
  armor.visible = false;
  group.add(armor);

  return { lidGroup, armor, interiorLight, state: 'closed', animTimer: 0, armorSpinT: 0, x, z };
}

export function createChests(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  mountainObstacles: CircleObstacle[] = [],
): {
  update: (dt: number, playerX: number, playerZ: number) => void;
  obstacles: CircleObstacle[];
} {
  const rng = lcg(77);
  const chests: Chest[] = [];
  const obstacles: CircleObstacle[] = [];

  // Hitbox radius: half-diagonal of 1.60×1.00 footprint ≈ 0.94 → 0.95
  // Player stops at 0.95 + 0.50 = 1.45 from chest center (at surface, still within 3-unit trigger range)
  const HITBOX_R = 0.95;

  let placed = 0;
  for (let attempts = 0; placed < 8 && attempts < 600; attempts++) {
    const x = (rng() * 2 - 1) * 200;
    const z = (rng() * 2 - 1) * 200;

    if (x * x + z * z < 64) continue;                          // too close to spawn
    if (x > -82 && x < 82 && z < -258 && z > -442) continue;  // city zone
    if (x > 5 && x < 30) continue;                             // road corridor

    const tooClose = mountainObstacles.some(m => {
      const dx = x - m.x, dz = z - m.z;
      return dx * dx + dz * dz < (m.radius + 4) * (m.radius + 4);
    });
    if (tooClose) continue;

    chests.push(buildChest(scene, getHeightAt, x, z, rng() * Math.PI * 2));
    obstacles.push({ x, z, radius: HITBOX_R });
    placed++;
  }

  let spaceWasDown = false;

  return {
    obstacles,
    update(dt: number, playerX: number, playerZ: number): void {
      const spaceDown = isKeyDown('Space');
      const spaceJustPressed = spaceDown && !spaceWasDown;
      spaceWasDown = spaceDown;

      // Handle Space interactions — only in interactable states, nearest within 3 u
      if (spaceJustPressed) {
        let nearest: Chest | null = null;
        let nearestDist = Infinity;
        for (const chest of chests) {
          if (
            chest.state !== 'closed' &&
            chest.state !== 'open' &&
            chest.state !== 'looted'
          ) continue;
          const dx = playerX - chest.x, dz = playerZ - chest.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 3 && dist < nearestDist) { nearest = chest; nearestDist = dist; }
        }
        if (nearest) {
          if (nearest.state === 'closed') {
            nearest.state = 'opening';
            nearest.animTimer = 0;
          } else if (nearest.state === 'open') {
            // Pick up armor — it disappears, light dims to indicate empty chest
            nearest.armor.visible = false;
            nearest.interiorLight.intensity = 1;
            nearest.state = 'looted';
          } else if (nearest.state === 'looted') {
            // Close the empty chest — run animation in reverse
            nearest.state = 'closing';
            nearest.animTimer = ANIM_DUR;
          }
        }
      }

      // Per-chest animation
      for (const chest of chests) {
        switch (chest.state) {
          case 'opening': {
            chest.animTimer = Math.min(chest.animTimer + dt, ANIM_DUR);
            const t = chest.animTimer / ANIM_DUR;
            chest.lidGroup.rotation.x = LID_ANGLE * t;
            chest.interiorLight.intensity = t * 4;
            if (chest.animTimer >= ANIM_DUR) {
              chest.state = 'open';
              chest.armor.visible = true;
              chest.armorSpinT = 0;
            }
            break;
          }

          case 'open': {
            // Armor spins and bobs above the open chest
            chest.armorSpinT += dt;
            chest.armor.rotation.y = chest.armorSpinT * 1.5;
            chest.armor.position.y = H + 0.45 + Math.sin(chest.armorSpinT * 2.0) * 0.08;
            break;
          }

          case 'closing': {
            // Reverse the opening animation — timer counts down from ANIM_DUR to 0
            chest.animTimer = Math.max(chest.animTimer - dt, 0);
            const t = chest.animTimer / ANIM_DUR;
            chest.lidGroup.rotation.x = LID_ANGLE * t;
            chest.interiorLight.intensity = t;  // was 1 (looted dim), fades to 0
            if (chest.animTimer <= 0) {
              chest.state = 'closed';
            }
            break;
          }
        }
      }
    },
  };
}
