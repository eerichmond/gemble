import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

// ── Birds (Phase 5) ───────────────────────────────────────────────────────────
// Crows rest in groups of 3-4. Walk within 5 units of any bird and the whole
// group startles together — caw sound, panic flap, then they all scatter.

const STARTLE_RADIUS = 5;    // player must get within 5 units to trigger
const LIFT_HEIGHT = 3;       // units raised during startled phase
const LIFT_TIME = 0.5;       // seconds for startled → flying
const FLY_SPEED = 10;        // horizontal units/s while flying
const CLIMB_SPEED = 5;       // vertical units/s climbing
const CLIMB_TIME = 2;        // seconds to keep climbing
const DISPOSE_DIST = 150;    // units from spawn before mesh removal
const GROUP_SPREAD = 5;      // max offset for each bird within its group

// Player spawn — keep birds away at start
const SPAWN_X = -52;
const SPAWN_Z = 130;
const SPAWN_CLEAR = 25;

// 4 groups; each entry is the number of birds in that group (15 total)
const GROUP_SIZES = [4, 4, 3, 4];

type BirdState = 'resting' | 'startled' | 'flying';

interface BirdData {
  group: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  state: BirdState;
  groupId: number;
  spawnX: number;
  spawnZ: number;
  baseY: number;
  flightDir: { x: number; z: number };
  stateTimer: number;
  animTime: number;
}

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Pure helper — exported for unit tests (no Three.js dependency)
export function shouldStartle(
  birdX: number, birdZ: number,
  playerX: number, playerZ: number,
  radius: number,
): boolean {
  const dx = birdX - playerX;
  const dz = birdZ - playerZ;
  return dx * dx + dz * dz < radius * radius;
}

function playCaw(): void {
  let plays = 0;
  const caw = new Audio('/assets/crow-caw.wav');
  caw.volume = 0.7;
  caw.addEventListener('ended', () => {
    if (++plays < 3) caw.play().catch(() => {});
  });
  caw.play().catch(() => {});
}

export function createBirds(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
  excludeZones: CircleObstacle[] = [],
): { update: (dt: number, playerX: number, playerZ: number) => void } {
  // Shared geometries across all birds
  const bodyGeo = new THREE.SphereGeometry(0.25, 6, 4);
  const headGeo = new THREE.SphereGeometry(0.12, 6, 4);
  const beakGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
  const wingGeo = new THREE.BoxGeometry(0.4, 0.04, 0.18);
  const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const yellowMat = new THREE.MeshLambertMaterial({ color: 0xf0c020 });

  function buildBird(): { group: THREE.Group; wingL: THREE.Group; wingR: THREE.Group } {
    const group = new THREE.Group();

    const body = new THREE.Mesh(bodyGeo, blackMat);
    body.scale.set(1, 0.6, 1.5);
    group.add(body);

    const head = new THREE.Mesh(headGeo, blackMat);
    head.position.set(0, 0.14, 0.28);
    group.add(head);

    // Beak: ConeGeometry points +Y by default; rotation.x = -PI/2 makes it face +Z
    const beak = new THREE.Mesh(beakGeo, yellowMat);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0, 0.11);
    head.add(beak);

    // Wing Groups pivot at shoulder so rotation.z folds/flaps from attachment point
    const wingL = new THREE.Group();
    wingL.position.set(-0.25, 0, 0);
    const wlm = new THREE.Mesh(wingGeo, blackMat);
    wlm.position.set(-0.2, 0, 0);
    wingL.add(wlm);
    wingL.rotation.z = 0.15;
    group.add(wingL);

    const wingR = new THREE.Group();
    wingR.position.set(0.25, 0, 0);
    const wrm = new THREE.Mesh(wingGeo, blackMat);
    wrm.position.set(0.2, 0, 0);
    wingR.add(wrm);
    wingR.rotation.z = -0.15;
    group.add(wingR);

    return { group, wingL, wingR };
  }

  const rng = makeRng(55);
  const birds: BirdData[] = [];

  // Place each group: pick a clear center, then scatter members within GROUP_SPREAD
  GROUP_SIZES.forEach((count, groupId) => {
    // Pick group center — avoid spawn zone and all exclusion zones (mountains, trees)
    let cx = 0, cz = 0;
    for (let tries = 0; tries < 200; tries++) {
      cx = (rng() * 2 - 1) * 170;
      cz = (rng() * 2 - 1) * 170;
      const dsx = cx - SPAWN_X, dsz = cz - SPAWN_Z;
      if (dsx * dsx + dsz * dsz < SPAWN_CLEAR * SPAWN_CLEAR) continue;
      const blocked = excludeZones.some(e => {
        const dx = cx - e.x, dz = cz - e.z;
        return dx * dx + dz * dz < (e.radius + 1) * (e.radius + 1);
      });
      if (!blocked) break;
    }

    for (let m = 0; m < count; m++) {
      const x = cx + (rng() * 2 - 1) * GROUP_SPREAD;
      const z = cz + (rng() * 2 - 1) * GROUP_SPREAD;
      const groundY = getHeightAt(x, z);

      const { group, wingL, wingR } = buildBird();
      group.position.set(x, groundY + 0.1, z);
      group.rotation.y = rng() * Math.PI * 2;
      scene.add(group);

      birds.push({
        group, wingL, wingR,
        state: 'resting',
        groupId,
        spawnX: x, spawnZ: z,
        baseY: groundY,
        flightDir: { x: 0, z: 0 },
        stateTimer: 0,
        animTime: rng() * Math.PI * 2,
      });
    }
  });

  // Startle every resting bird in a group, picking diverging flight directions
  function startleGroup(groupId: number): void {
    playCaw();
    const members = birds.filter(b => b.groupId === groupId && b.state === 'resting');
    const baseAngle = Math.random() * Math.PI * 2;
    members.forEach((b, i) => {
      b.state = 'startled';
      b.stateTimer = 0;
      // Spread birds in different directions so they scatter visually
      const angle = baseAngle + (i / Math.max(1, members.length)) * Math.PI * 2;
      b.flightDir = { x: Math.cos(angle), z: Math.sin(angle) };
    });
  }

  function update(dt: number, playerX: number, playerZ: number): void {
    // Track which groups we've already startled this frame to avoid double-caw
    const startledGroups = new Set<number>();

    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      b.animTime += dt;

      if (b.state === 'resting') {
        b.wingL.rotation.z = 0.15;
        b.wingR.rotation.z = -0.15;

        if (shouldStartle(b.group.position.x, b.group.position.z, playerX, playerZ, STARTLE_RADIUS)) {
          if (!startledGroups.has(b.groupId)) {
            startledGroups.add(b.groupId);
            startleGroup(b.groupId);
          }
        }

      } else if (b.state === 'startled') {
        b.stateTimer += dt;

        // Panic flap — 6 Hz
        const flap = 0.6 * Math.sin(b.animTime * 6 * Math.PI * 2);
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;

        const t = Math.min(1, b.stateTimer / LIFT_TIME);
        b.group.position.y = b.baseY + t * LIFT_HEIGHT;

        if (b.stateTimer >= LIFT_TIME) {
          b.state = 'flying';
          b.stateTimer = 0;
        }

      } else {
        // flying
        b.stateTimer += dt;

        // Rhythmic flap — 4 Hz
        const flap = 0.6 * Math.sin(b.animTime * 4 * Math.PI * 2);
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;

        b.group.position.x += b.flightDir.x * FLY_SPEED * dt;
        b.group.position.z += b.flightDir.z * FLY_SPEED * dt;
        b.group.rotation.y = Math.atan2(b.flightDir.x, b.flightDir.z);

        if (b.stateTimer < CLIMB_TIME) {
          b.group.position.y += CLIMB_SPEED * dt;
        }

        const dx = b.group.position.x - b.spawnX;
        const dz = b.group.position.z - b.spawnZ;
        if (dx * dx + dz * dz > DISPOSE_DIST * DISPOSE_DIST) {
          scene.remove(b.group);
          birds.splice(i, 1);
        }
      }
    }
  }

  return { update };
}
