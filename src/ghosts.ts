import * as THREE from 'three';

// ── City Ghosts (Phase 9) ─────────────────────────────────────────────────────
// 3 white translucent ghosts float between buildings. Each waits 12–28 s inside
// a building then drifts to another, bobs gently, and vanishes on arrival.

const FLOAT_HEIGHT = 1.0;  // group origin above terrain (ghost bottom)
const FLOAT_SPEED = 3.5;   // units/second horizontal travel
const WAIT_MIN = 12;
const WAIT_MAX = 28;

// City building centers — ghost waypoints
const BUILDINGS: [number, number][] = [
  [-22, -285], [ 28, -285],
  [ 25, -330], [-18, -335],
  [-14, -360],
  [-21, -385], [ 27, -385],
  [-22, -410], [ 29, -410],
  [-18, -430], [ 28, -430],
];

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

type GhostState = 'dormant' | 'floating';

interface GhostData {
  group: THREE.Group;
  shadow: THREE.Mesh;
  shadowMat: THREE.MeshLambertMaterial;
  state: GhostState;
  srcIdx: number;
  dstIdx: number;
  waitTimer: number;
  animTime: number;
  srcY: number;
  dstY: number;
}

export function createGhosts(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): { update: (dt: number) => void } {
  const rng = makeRng(42);

  const ghostMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
  });
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a33 });

  const headGeo = new THREE.SphereGeometry(0.9, 10, 8);
  const bodyGeo = new THREE.CylinderGeometry(0.8, 1.1, 4.5, 10);
  const eyeGeo = new THREE.SphereGeometry(0.18, 6, 5);
  const shadowGeo = new THREE.PlaneGeometry(2.6, 1.2);

  function buildGhost(): { group: THREE.Group; shadow: THREE.Mesh; shadowMat: THREE.MeshLambertMaterial } {
    const group = new THREE.Group();

    const body = new THREE.Mesh(bodyGeo, ghostMat);
    body.position.y = 2.25;
    group.add(body);

    const head = new THREE.Mesh(headGeo, ghostMat);
    head.position.y = 5.4; // top of body (4.5) + head radius (0.9)
    group.add(head);

    // Eyes face forward (+Z in group-local space)
    for (const ex of [-0.3, 0.3]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ex, 5.45, 0.82);
      group.add(eye);
    }

    const shadowMat = new THREE.MeshLambertMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;

    return { group, shadow, shadowMat };
  }

  const ghosts: GhostData[] = [];

  for (let i = 0; i < 3; i++) {
    const { group, shadow, shadowMat } = buildGhost();
    scene.add(group);
    scene.add(shadow);
    group.visible = false;
    shadow.visible = false;

    const srcIdx = Math.floor(rng() * BUILDINGS.length);
    let dstIdx = srcIdx;
    while (dstIdx === srcIdx) dstIdx = Math.floor(rng() * BUILDINGS.length);

    const src = BUILDINGS[srcIdx]!;
    ghosts.push({
      group, shadow, shadowMat,
      state: 'dormant',
      srcIdx, dstIdx,
      waitTimer: WAIT_MIN + rng() * (WAIT_MAX - WAIT_MIN) + i * 9,
      animTime: rng() * Math.PI * 2,
      srcY: getHeightAt(src[0], src[1]) + FLOAT_HEIGHT,
      dstY: 0,
    });
  }

  function update(dt: number): void {
    for (const g of ghosts) {
      g.animTime += dt;

      if (g.state === 'dormant') {
        g.waitTimer -= dt;
        if (g.waitTimer <= 0) {
          const src = BUILDINGS[g.srcIdx]!;
          const dst = BUILDINGS[g.dstIdx]!;
          g.srcY = getHeightAt(src[0], src[1]) + FLOAT_HEIGHT;
          g.dstY = getHeightAt(dst[0], dst[1]) + FLOAT_HEIGHT;
          g.group.position.set(src[0], g.srcY, src[1]);
          g.shadow.position.set(src[0], getHeightAt(src[0], src[1]) + 0.05, src[1]);
          g.group.visible = true;
          g.shadow.visible = true;
          g.state = 'floating';
        }
      } else {
        const dst = BUILDINGS[g.dstIdx]!;
        const cx = g.group.position.x;
        const cz = g.group.position.z;
        const rdx = dst[0] - cx;
        const rdz = dst[1] - cz;
        const remDist = Math.sqrt(rdx * rdx + rdz * rdz);
        const moveAmt = FLOAT_SPEED * dt;

        if (remDist <= moveAmt + 0.1) {
          // Arrived — hide and pick a new route
          g.group.visible = false;
          g.shadow.visible = false;
          g.srcIdx = g.dstIdx;
          let newDst = g.srcIdx;
          while (newDst === g.srcIdx) newDst = Math.floor(Math.random() * BUILDINGS.length);
          g.dstIdx = newDst;
          g.waitTimer = WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN);
          g.state = 'dormant';
        } else {
          // Interpolate base height between src and dst ground levels
          const src = BUILDINGS[g.srcIdx]!;
          const totalDx = dst[0] - src[0];
          const totalDz = dst[1] - src[1];
          const totalDist = Math.sqrt(totalDx * totalDx + totalDz * totalDz);
          const traveled = totalDist - remDist;
          const t = totalDist > 0 ? traveled / totalDist : 0;
          const baseY = g.srcY + (g.dstY - g.srcY) * t;
          const bob = Math.sin(g.animTime * 1.8) * 0.3;

          const nx = cx + (rdx / remDist) * moveAmt;
          const nz = cz + (rdz / remDist) * moveAmt;
          g.group.position.set(nx, baseY + bob, nz);
          g.group.rotation.y = Math.atan2(rdx, rdz);

          const groundY = getHeightAt(nx, nz);
          g.shadow.position.set(nx, groundY + 0.05, nz);
          // Shadow fades as ghost rises higher above ground
          const heightAbove = (baseY + bob) - groundY;
          g.shadowMat.opacity = Math.max(0.04, 0.28 - heightAbove * 0.015);
        }
      }
    }
  }

  return { update };
}
