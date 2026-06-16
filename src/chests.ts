import * as THREE from 'three';
import { isKeyDown } from './input';
import type { CircleObstacle } from './terrain';

// ── Treasure Chests (Phase 6) ─────────────────────────────────────────────────
// 4 chests, each containing a unique Minecraft-style loot item.
// State machine: closed → opening → open → looted → closing → closed
//   Space (within 3 u, state=closed)  → start opening
//   Space (state=open)                → pick up loot (one-time)
//   Space (state=looted)              → start closing

export type LootType = 'armor' | 'sword' | 'shield' | 'food';

type ChestState = 'closed' | 'opening' | 'open' | 'looted' | 'closing';

interface Chest {
  lidGroup: THREE.Group;
  loot: THREE.Group;
  lootType: LootType;
  interiorLight: THREE.PointLight;
  state: ChestState;
  animTimer: number; // opening: 0→ANIM_DUR; closing: ANIM_DUR→0
  lootSpinT: number; // cumulative time while in 'open' state
  lootTaken: boolean; // true once loot has been picked up — never re-appears
  x: number;
  z: number;
}

export function isNearChest(
  playerX: number,
  playerZ: number,
  chestX: number,
  chestZ: number,
  radius: number,
): boolean {
  const dx = playerX - chestX;
  const dz = playerZ - chestZ;
  return dx * dx + dz * dz <= radius * radius;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ── Dimensions ────────────────────────────────────────────────────────────────
const ANIM_DUR = 0.6;
const LID_ANGLE = 2.1; // radians; lid swings UP and backward
const W = 1.6;
const H = 1.6; // body height
const D = 1.0;
const LID_H = 0.6;
const LOOT_Y = H + 0.45; // hover height above chest base (≈2.05 u above terrain)

// ── Shared chest geometry ─────────────────────────────────────────────────────
const _bodyGeo = new THREE.BoxGeometry(W, H, D);
const _lidGeo = new THREE.BoxGeometry(W, LID_H, D);
const _bandGeo = new THREE.BoxGeometry(W + 0.08, 0.12, D + 0.08);
const _lockGeo = new THREE.BoxGeometry(0.2, 0.24, 0.12);
const _floorGeo = new THREE.BoxGeometry(W - 0.16, 0.02, D - 0.16);

// BoxGeometry material slots: [+x, -x, +y(TOP), -y, +z, -z]
// Slot 2 (+y) = transparent → player can look down through open top
const _wood = new THREE.MeshLambertMaterial({ color: 0x3d1f08, side: THREE.DoubleSide });
const _open = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0, depthWrite: false });
const _bodyMats: THREE.Material[] = [_wood, _wood, _open, _wood, _wood, _wood];
const _metal = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
const _hasp = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
const _velvet = new THREE.MeshLambertMaterial({ color: 0x2a0808 });

// ── Loot item builders ────────────────────────────────────────────────────────
// All items are centered at y=0 in their group.
// They float at LOOT_Y above the chest base and spin/bob while visible.

function buildArmor(): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({
    color: 0xd4a020,
    emissive: new THREE.Color(0x3a2800),
  });
  const trim = new THREE.MeshLambertMaterial({ color: 0xa07810 });

  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.78, 0.1), gold));

  for (const side of [-1, 1] as const) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.12), trim);
    s.position.set(side * 0.47, 0.33, 0);
    g.add(s);
  }

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.1), trim);
  neck.position.set(0, 0.46, 0);
  g.add(neck);

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.1), gold);
  waist.position.set(0, -0.45, 0);
  g.add(waist);

  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.11), trim);
  rib.position.set(0, 0.05, 0.01);
  g.add(rib);

  return g;
}

// Sword: blade(0.80) + guard(0.10) + handle(0.35) + pommel(0.12) = 1.37 total.
// Centers calculated so the whole sword is vertically centered at y=0.
function buildSword(): THREE.Group {
  const g = new THREE.Group();
  const silver = new THREE.MeshLambertMaterial({
    color: 0xb8b8c8,
    emissive: new THREE.Color(0x101018),
  });
  const steel = new THREE.MeshLambertMaterial({ color: 0x606070 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x6a3810 });

  // Blade: top at +0.625, center at +0.225, bottom at -0.175
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.08), silver);
  blade.position.y = 0.225;
  g.add(blade);

  // Cross-guard: center at -0.225
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), steel);
  guard.position.y = -0.225;
  g.add(guard);

  // Handle: center at -0.45
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 0.1), wood);
  handle.position.y = -0.45;
  g.add(handle);

  // Pommel cap: bottom of sword
  const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.14), steel);
  pommel.position.y = -0.68;
  g.add(pommel);

  return g;
}

// Shield: heater-shield silhouette (rectangle top, tapers to a bottom point) with a raised gold boss.
function buildShield(): THREE.Group {
  const g = new THREE.Group();
  const brown = new THREE.MeshLambertMaterial({ color: 0x7a4a20 });
  const boss = new THREE.MeshLambertMaterial({
    color: 0xc0a030,
    emissive: new THREE.Color(0x302800),
  });

  const shape = new THREE.Shape();
  shape.moveTo(-0.36, 0.42);
  shape.lineTo(0.36, 0.42);
  shape.lineTo(0.36, -0.1);
  shape.lineTo(0, -0.48);
  shape.lineTo(-0.36, -0.1);
  shape.closePath();

  const plate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }),
    brown,
  );
  plate.position.z = -0.04;
  g.add(plate);

  const center = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.08), boss);
  center.position.set(0, 0.05, 0.08);
  g.add(center);

  return g;
}

// Food: blocky red apple — cube body, brown stem, small green leaf.
function buildFood(): THREE.Group {
  const g = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xdd2222 });
  const stem = new THREE.MeshLambertMaterial({ color: 0x6a3810 });
  const leaf = new THREE.MeshLambertMaterial({ color: 0x2a9a2a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), red);
  g.add(body);

  const stk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), stem);
  stk.position.y = 0.28;
  g.add(stk);

  const lf = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), leaf);
  lf.position.set(0.12, 0.3, 0);
  g.add(lf);

  return g;
}

export function buildLoot(type: LootType): THREE.Group {
  switch (type) {
    case 'armor':
      return buildArmor();
    case 'sword':
      return buildSword();
    case 'shield':
      return buildShield();
    case 'food':
      return buildFood();
  }
}

// ── Chest constructor ─────────────────────────────────────────────────────────

function buildChest(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  x: number,
  z: number,
  rotY: number,
  lootType: LootType,
): Chest {
  const group = new THREE.Group();
  group.position.set(x, getHeightAt(x, z), z);
  group.rotation.y = rotY;
  scene.add(group);

  // Body — transparent +Y face exposes interior when looking from above
  const body = new THREE.Mesh(_bodyGeo, _bodyMats);
  body.position.y = H / 2;
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

  const lidMesh = new THREE.Mesh(_lidGeo, _wood);
  lidMesh.position.set(0, LID_H / 2, -D / 2);
  lidGroup.add(lidMesh);

  // Loot item — hidden until chest opens; bobs/spins while in 'open' state
  const loot = buildLoot(lootType);
  loot.position.set(0, LOOT_Y, 0);
  loot.visible = false;
  group.add(loot);

  return {
    lidGroup,
    loot,
    lootType,
    interiorLight,
    state: 'closed',
    animTimer: 0,
    lootSpinT: 0,
    lootTaken: false,
    x,
    z,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createChests(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  excludeZones: CircleObstacle[] = [],
  onLootPickedUp?: (type: LootType) => void,
): {
  update: (dt: number, playerX: number, playerZ: number) => void;
  obstacles: CircleObstacle[];
} {
  const rng = lcg(77);
  const chests: Chest[] = [];
  const obstacles: CircleObstacle[] = [];

  // Hitbox radius: half-diagonal of 1.60×1.00 footprint ≈ 0.94 → 0.95
  const HITBOX_R = 0.95;
  const TOTAL_CHESTS = 4;
  const lootTypes: LootType[] = ['armor', 'sword', 'shield', 'food'];

  let placed = 0;
  for (let attempts = 0; placed < TOTAL_CHESTS && attempts < 600; attempts++) {
    const x = (rng() * 2 - 1) * 200;
    const z = (rng() * 2 - 1) * 200;

    if (x * x + z * z < 64) continue; // too close to spawn
    if (x > -82 && x < 82 && z < -258 && z > -442) continue; // city zone
    if (x > 5 && x < 30) continue; // road corridor

    const tooClose = excludeZones.some(m => {
      const dx = x - m.x,
        dz = z - m.z;
      return dx * dx + dz * dz < (m.radius + 2) * (m.radius + 2);
    });
    if (tooClose) continue;

    chests.push(buildChest(scene, getHeightAt, x, z, rng() * Math.PI * 2, lootTypes[placed]!));
    obstacles.push({ x, z, radius: HITBOX_R });
    placed++;
  }

  let spaceWasDown = false;

  return {
    obstacles,
    update(dt: number, playerX: number, playerZ: number): void {
      const spaceDown = isKeyDown('Space');
      const shift = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight');
      const spaceJustPressed = spaceDown && !spaceWasDown && !shift;
      spaceWasDown = spaceDown;

      if (spaceJustPressed) {
        let nearest: Chest | null = null;
        let nearestDist = Infinity;
        for (const chest of chests) {
          if (chest.state !== 'closed' && chest.state !== 'open' && chest.state !== 'looted')
            continue;
          const dx = playerX - chest.x,
            dz = playerZ - chest.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 3 && dist < nearestDist) {
            nearest = chest;
            nearestDist = dist;
          }
        }
        if (nearest) {
          if (nearest.state === 'closed') {
            nearest.state = 'opening';
            nearest.animTimer = 0;
          } else if (nearest.state === 'open') {
            if (!nearest.lootTaken) {
              nearest.loot.visible = false;
              nearest.lootTaken = true;
              onLootPickedUp?.(nearest.lootType);
            }
            nearest.interiorLight.intensity = 1;
            nearest.state = 'looted';
          } else if (nearest.state === 'looted') {
            nearest.state = 'closing';
            nearest.animTimer = ANIM_DUR;
          }
        }
      }

      for (const chest of chests) {
        switch (chest.state) {
          case 'opening': {
            chest.animTimer = Math.min(chest.animTimer + dt, ANIM_DUR);
            const t = chest.animTimer / ANIM_DUR;
            chest.lidGroup.rotation.x = LID_ANGLE * t;
            chest.interiorLight.intensity = t * 4;
            if (chest.animTimer >= ANIM_DUR) {
              chest.state = 'open';
              chest.loot.visible = !chest.lootTaken;
              chest.lootSpinT = 0;
            }
            break;
          }

          case 'open': {
            chest.lootSpinT += dt;
            chest.loot.rotation.y = chest.lootSpinT * 1.5;
            chest.loot.position.y = LOOT_Y + Math.sin(chest.lootSpinT * 2.0) * 0.08;
            break;
          }

          case 'closing': {
            chest.animTimer = Math.max(chest.animTimer - dt, 0);
            const t = chest.animTimer / ANIM_DUR;
            chest.lidGroup.rotation.x = LID_ANGLE * t;
            chest.interiorLight.intensity = t;
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
