import * as THREE from 'three';
import type { CircleObstacle } from './terrain';

export interface GemResult {
  update: (dt: number) => void;
  obstacles: CircleObstacle[];
}

const GEM_X = -52;
const GEM_Z = 108;
const PYRAMID_H = 12;   // ~deciduous tree height
const PYRAMID_R = 2.5;  // base radius
const CRYSTAL_DIST = 12; // one road-width away in each cardinal direction

const CRYSTAL_OFFSETS: [number, number][] = [
  [0, CRYSTAL_DIST],   // north
  [0, -CRYSTAL_DIST],  // south
  [CRYSTAL_DIST, 0],   // east
  [-CRYSTAL_DIST, 0],  // west
];

function crystalMat(): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({
    color: 0x6040ff,
    emissive: 0x300090,
    specular: 0xffffff,
    shininess: 150,
    transparent: true,
    opacity: 0.85,
  });
}

export function createGem(
  scene: THREE.Scene,
  getHeightAt: (x: number, z: number) => number,
): GemResult {
  const groundY = getHeightAt(GEM_X, GEM_Z);

  // Four large pyramid crystals (square-base, ~tree height) around the gem
  const pyramidGeo = new THREE.ConeGeometry(PYRAMID_R, PYRAMID_H, 4);
  pyramidGeo.rotateY(Math.PI / 4); // rotate so faces point cardinal directions
  for (const [ox, oz] of CRYSTAL_OFFSETS) {
    const cx = GEM_X + ox;
    const cz = GEM_Z + oz;
    const cy = getHeightAt(cx, cz);
    const crystal = new THREE.Mesh(pyramidGeo, crystalMat());
    crystal.position.set(cx, cy + PYRAMID_H / 2, cz);
    scene.add(crystal);
  }

  const geo = new THREE.OctahedronGeometry(0.5, 0);
  const gem = new THREE.Mesh(geo, crystalMat());
  // Eye-level: 1.5 units above ground (player eye height ~1.7, well below tree canopy)
  gem.position.set(GEM_X, groundY + 1.5, GEM_Z);
  scene.add(gem);

  // Area glow — strong enough to reach nearby trees and cast purple on them
  const areaLight = new THREE.PointLight(0x8060ff, 8, 22);
  areaLight.position.set(GEM_X, groundY + 1.8, GEM_Z);
  scene.add(areaLight);

  // Ground pool — low light paints the terrain floor and tree trunks with purple
  const groundLight = new THREE.PointLight(0x6030cc, 4, 12);
  groundLight.position.set(GEM_X, groundY + 0.4, GEM_Z);
  scene.add(groundLight);

  let t = 0;

  function update(dt: number): void {
    t += dt;
    gem.rotation.y = t * 1.2;
    gem.position.y = groundY + 1.5 + Math.sin(t * 1.5) * 0.15;
    areaLight.position.y = gem.position.y + 0.3;
    // groundLight stays fixed near the ground — creates stable pool even as gem bobs
  }

  // FUTURE: detect proximity < 2 units → trigger collection
  // FUTURE: play sound + show victory screen on pickup

  const obstacles: CircleObstacle[] = [
    { x: GEM_X, z: GEM_Z, radius: 1.5 },
    ...CRYSTAL_OFFSETS.map(([ox, oz]) => ({ x: GEM_X + ox, z: GEM_Z + oz, radius: 3.0 })),
  ];

  return { update, obstacles };
}
