import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface BuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CityResult {
  collisionBoxes: BuildingBox[];
  update: (dt: number) => void;
}

type HeightFn = (x: number, z: number) => number;

// (Parking lot materials removed — parking lot was removed in Phase 10 river update)

// ---------------------------------------------------------------------------
// Public factory
// City is placed directly on the extended terrain mesh — no separate ground
// plane. Each building/prop samples getHeightAt at its center for Y.
// ---------------------------------------------------------------------------

export function createCity(
  scene: THREE.Scene,
  getHeightAt: HeightFn,
): CityResult {
  const collisionBoxes: BuildingBox[] = [
    buildGasStation(scene, getHeightAt),
    buildGroceryStore(scene, getHeightAt),
    buildApartment(scene, getHeightAt),
    buildHouse(scene, getHeightAt, -18, -335, 10, 8, 4.5, 3.5, 0x6a5a4a),
    buildHouse(scene, getHeightAt, -14, -360, 12, 9, 5.0, 3.5, 0x5a6a5a),
    // Extended city — 6 more buildings on alternating sides of road
    buildHouse(scene, getHeightAt, -21, -385, 11, 9, 4.5, 3.0, 0x7a6040),
    buildCommercial(scene, getHeightAt, 27, -385, 15, 11, 7, 0x6a5a5a, 3, 2),
    buildCommercial(scene, getHeightAt, -22, -410, 16, 11, 7, 0x606050, 3, 2),
    buildHouse(scene, getHeightAt, 29, -410, 10, 8, 4.5, 3.5, 0x3a5040),
    buildHouse(scene, getHeightAt, -18, -430, 9, 7, 4.0, 2.5, 0x4a3830),
    buildCommercial(scene, getHeightAt, 28, -430, 14, 12, 14, 0x4a506a, 3, 4),
  ];

  placeStopSign(scene, getHeightAt, 10, -293);
  placeStopSign(scene, getHeightAt, -3, -313);
  placeStreetlights(scene, getHeightAt);

  const tumbleweedMesh = createTumbleweed(scene, getHeightAt);

  function update(dt: number): void {
    tumbleweedMesh.rotation.x += dt * 0.8;
    tumbleweedMesh.rotation.z += dt * 0.45;
  }

  return { collisionBoxes, update };
}

// ---------------------------------------------------------------------------
// Streets & parking
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Gas station  (-22, G, -300)  14×10×5
// ---------------------------------------------------------------------------

function buildGasStation(scene: THREE.Scene, getHeightAt: HeightFn): BuildingBox {
  const bx = -22;
  const bz = -300;
  const w = 14;
  const d = 10;
  const h = 5;
  const G = getHeightAt(bx, bz);
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });

  addBox(scene, w, h, d, bx, G + h / 2, bz, mat);
  addWindows(scene, bx, bz, G, w, h, d, 2, 1, 'wens');

  // Door on north face
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x7a6655 });
  addBox(scene, 1.4, 2.2, 0.12, bx, G + 1.1, bz + d / 2 + 0.06, doorMat);

  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x9a8a6a });
  addBox(scene, 18, 0.4, 12, bx, G + h + 0.2, bz, canopyMat);

  const poleMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  [-5, 5].forEach(ox => {
    addBox(scene, 0.3, h + 0.4, 0.3, bx + ox, G + (h + 0.4) / 2, bz + 5, poleMat);
  });

  const pumpMat = new THREE.MeshLambertMaterial({ color: 0xb0a090 });
  [-3, 0, 3].forEach(oz => {
    addBox(scene, 0.8, 2.8, 0.5, bx + 4.5, G + 1.4, bz + oz, pumpMat);
  });

  return { minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 };
}

// ---------------------------------------------------------------------------
// Grocery store  (20, G, -285)  24×16×7
// ---------------------------------------------------------------------------

function buildGroceryStore(scene: THREE.Scene, getHeightAt: HeightFn): BuildingBox {
  const bx = 28;
  const bz = -300;
  const w = 24;
  const d = 16;
  const h = 7;
  const G = getHeightAt(bx, bz);
  const mat = new THREE.MeshLambertMaterial({ color: 0x6a6a5a });

  addBox(scene, w, h, d, bx, G + h / 2, bz, mat);
  addWindows(scene, bx, bz, G, w, h, d, 4, 2, 'wens');

  // Door on north face (wide storefront entrance)
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x7a6655 });
  addBox(scene, 2.2, 2.8, 0.12, bx, G + 1.4, bz + d / 2 + 0.06, doorMat);

  const trim = new THREE.MeshLambertMaterial({ color: 0x5a5a4a });
  addBox(scene, w + 0.4, 0.5, d + 0.4, bx, G + h + 0.25, bz, trim);

  return { minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 };
}

// ---------------------------------------------------------------------------
// Apartment building  (25, G, -330)  20×15×25
// ---------------------------------------------------------------------------

function buildApartment(scene: THREE.Scene, getHeightAt: HeightFn): BuildingBox {
  const bx = 25;
  const bz = -330;
  const w = 20;
  const d = 15;
  const h = 25;
  const G = getHeightAt(bx, bz);
  const mat = new THREE.MeshLambertMaterial({ color: 0x5a5a6a });

  addBox(scene, w, h, d, bx, G + h / 2, bz, mat);
  addWindows(scene, bx, bz, G, w, h, d, 4, 10, 'wens');

  // Door on north face (outward normal +Z, facing toward player approaching from north)
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x7a6655 });
  addBox(scene, 1.8, 2.5, 0.12, bx, G + 1.25, bz + d / 2 + 0.06, doorMat);

  const ledge = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
  addBox(scene, w + 0.5, 0.6, d + 0.5, bx, G + h + 0.3, bz, ledge);

  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
  addBox(scene, 3, 1.5, 2, bx - 4, G + h + 0.75 + 0.6, bz, roofMat);
  addBox(scene, 2, 1.2, 1.5, bx + 4, G + h + 0.6 + 0.6, bz - 2, roofMat);

  return { minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 };
}

// ---------------------------------------------------------------------------
// Houses
// ---------------------------------------------------------------------------

function buildHouse(
  scene: THREE.Scene,
  getHeightAt: HeightFn,
  bx: number,
  bz: number,
  w: number,
  d: number,
  bodyH: number,
  roofH: number,
  color: number,
): BuildingBox {
  const G = getHeightAt(bx, bz);
  const mat = new THREE.MeshLambertMaterial({ color });
  addBox(scene, w, bodyH, d, bx, G + bodyH / 2, bz, mat);
  addWindows(scene, bx, bz, G, w, bodyH, d, 2, 1, 'wens');

  // Door on north face
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x7a6655 });
  addBox(scene, 1.2, 2.0, 0.12, bx, G + 1.0, bz + d / 2 + 0.06, doorMat);

  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
  const roofGeo = new THREE.CylinderGeometry(0, Math.max(w, d) * 0.6, roofH, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(bx, G + bodyH + roofH / 2, bz);
  roof.rotation.y = Math.PI / 4;
  scene.add(roof);

  return { minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 };
}

// ---------------------------------------------------------------------------
// Generic flat-roofed commercial building (parameterised)
// ---------------------------------------------------------------------------

function buildCommercial(
  scene: THREE.Scene,
  getHeightAt: HeightFn,
  bx: number,
  bz: number,
  w: number,
  d: number,
  h: number,
  color: number,
  cols = 2,
  rows = 1,
): BuildingBox {
  const G = getHeightAt(bx, bz);
  addBox(scene, w, h, d, bx, G + h / 2, bz, new THREE.MeshLambertMaterial({ color }));
  addWindows(scene, bx, bz, G, w, h, d, cols, rows, 'wens');
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x7a6655 });
  addBox(scene, 1.4, 2.2, 0.12, bx, G + 1.1, bz + d / 2 + 0.06, doorMat);
  return { minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 };
}

// ---------------------------------------------------------------------------
// Shared building helpers
// ---------------------------------------------------------------------------

function addBox(
  scene: THREE.Scene,
  w: number,
  h: number,
  d: number,
  cx: number,
  cy: number,
  cz: number,
  mat: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(cx, cy, cz);
  scene.add(mesh);
  return mesh;
}

/**
 * Add a grid of window planes on specified faces of a building.
 * faces: combination of 'w' (west), 'e' (east), 'n' (north), 's' (south).
 * N/S faces use cols directly; W/E faces scale proportionally by depth.
 */
function addWindows(
  scene: THREE.Scene,
  bx: number,
  bz: number,
  G: number,
  w: number,
  h: number,
  d: number,
  cols: number,
  rows: number,
  faces: string,
): void {
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x888890 });
  const paneMat = new THREE.MeshLambertMaterial({ color: 0x0a0c14, side: THREE.FrontSide });
  const wW = 0.65;
  const wH = 0.8;
  const vStep = (h - 1.5) / rows;

  function placeWindow(px: number, py: number, pz: number, rotY: number): void {
    const frameGeo = new THREE.PlaneGeometry(wW + 0.14, wH + 0.14);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(px, py, pz);
    frame.rotation.y = rotY;
    scene.add(frame);

    const paneGeo = new THREE.PlaneGeometry(wW, wH);
    const pane = new THREE.Mesh(paneGeo, paneMat);
    // Nudge pane just in front of frame so it's not z-fighting
    const nudge = 0.005;
    pane.position.set(px + Math.sin(rotY) * nudge, py, pz + Math.cos(rotY) * nudge);
    pane.rotation.y = rotY;
    scene.add(pane);
  }

  // W/E faces: windows spread along Z, placed at x = bx ± w/2
  if (faces.includes('w') || faces.includes('e')) {
    const faceCols = Math.max(1, Math.round((d - 2) / ((w - 2) / cols)));
    const colStep = (d - 2) / faceCols;
    const weConfigs: Array<{ faceX: number; rotY: number }> = [];
    if (faces.includes('w')) weConfigs.push({ faceX: bx - w / 2, rotY: -Math.PI / 2 });
    if (faces.includes('e')) weConfigs.push({ faceX: bx + w / 2, rotY: Math.PI / 2 });
    for (const { faceX, rotY } of weConfigs) {
      for (let r = 0; r < rows; r++) {
        const wy = G + 1.2 + r * vStep + vStep / 2;
        for (let c = 0; c < faceCols; c++) {
          const offset = -((faceCols - 1) / 2) * colStep + c * colStep;
          placeWindow(faceX, wy, bz + offset, rotY);
        }
      }
    }
  }

  // N/S faces: windows spread along X
  // North face (normal +Z, facing player): faceZ = bz + d/2, rotY = 0
  // South face (normal -Z): faceZ = bz - d/2, rotY = π
  if (faces.includes('n') || faces.includes('s')) {
    const colStep = (w - 2) / cols;
    const nsConfigs: Array<{ faceZ: number; rotY: number }> = [];
    if (faces.includes('n')) nsConfigs.push({ faceZ: bz + d / 2, rotY: 0 });
    if (faces.includes('s')) nsConfigs.push({ faceZ: bz - d / 2, rotY: Math.PI });
    for (const { faceZ, rotY } of nsConfigs) {
      for (let r = 0; r < rows; r++) {
        const wy = G + 1.2 + r * vStep + vStep / 2;
        for (let c = 0; c < cols; c++) {
          const offset = -((cols - 1) / 2) * colStep + c * colStep;
          placeWindow(bx + offset, wy, faceZ, rotY);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stop signs
// ---------------------------------------------------------------------------

function placeStopSign(scene: THREE.Scene, getHeightAt: HeightFn, x: number, z: number): void {
  const G = getHeightAt(x, z);
  const group = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6),
    new THREE.MeshLambertMaterial({ color: 0x888888 }),
  );
  pole.position.y = 1.4;
  group.add(pole);

  const shape = new THREE.Shape();
  const r = 0.38;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.closePath();

  const sign = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshLambertMaterial({ color: 0xcc0000, side: THREE.DoubleSide }),
  );
  sign.position.set(0.02, 2.9, 0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  group.position.set(x, G, z);
  scene.add(group);
}

// ---------------------------------------------------------------------------
// Streetlights (4 at city intersections)
// ---------------------------------------------------------------------------

function placeStreetlights(scene: THREE.Scene, getHeightAt: HeightFn): void {
  const positions: [number, number][] = [
    [11, -282],
    [-8, -282],
    [11, -310],
    [-8, -310],
    [11, -380],
    [-8, -380],
    [11, -420],
    [-8, -420],
  ];
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

  for (const [x, z] of positions) {
    const G = getHeightAt(x, z);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), poleMat);
    pole.position.set(x, G + 3, z);
    scene.add(pole);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), headMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(x + 0.6, G + 6.1, z);
    scene.add(arm);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.25, 6), headMat);
    head.position.set(x + 1.2, G + 5.95, z);
    scene.add(head);

    const light = new THREE.PointLight(0xffe080, 3.0, 25);
    light.position.set(x + 1.2, G + 5.8, z);
    scene.add(light);
  }
}

// ---------------------------------------------------------------------------
// Tumbleweed
// ---------------------------------------------------------------------------

function createTumbleweed(scene: THREE.Scene, getHeightAt: HeightFn): THREE.Mesh {
  const G = getHeightAt(8, -300);
  const geo = new THREE.SphereGeometry(0.4, 6, 4);
  const mat = new THREE.MeshLambertMaterial({ color: 0x7a6a40, wireframe: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(8, G + 0.4, -300);
  scene.add(mesh);
  return mesh;
}
