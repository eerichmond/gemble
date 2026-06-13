import * as THREE from 'three';

let renderer: THREE.WebGLRenderer;
let camera: THREE.PerspectiveCamera;

export interface SceneResult {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
}

export function initScene(canvas: HTMLCanvasElement): SceneResult {
  const scene = new THREE.Scene();

  // Dark navy night sky — dusk/night theme. Phase 2 will swap to deep purple dusk.
  // FUTURE Phase 2: replace with FogExp2(0x1a1228, 0.018) for full dusk atmosphere
  scene.background = new THREE.Color(0x1a2a4a);
  scene.fog = new THREE.FogExp2(0x1a2a4a, 0.004);

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800);
  // Rotation order must be YXZ for FPS camera: yaw (Y) applied first in world space,
  // so pitch (X) added later in Phase 1+ won't cause roll.
  camera.rotation.order = 'YXZ';

  // Ambient: cool blue-grey moonlight fill
  const ambient = new THREE.AmbientLight(0x9aaec8, 0.5);
  scene.add(ambient);

  // Moon: cool directional light, lower angle than midday sun
  const moon = new THREE.DirectionalLight(0xd0ddf0, 0.85);
  moon.position.set(80, 120, 50);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -200;
  moon.shadow.camera.right = 200;
  moon.shadow.camera.top = 200;
  moon.shadow.camera.bottom = -200;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 400;
  scene.add(moon);
  // FUTURE Phase 2: swap to orange dusk sun + purple fill light

  addClouds(scene);

  return { scene, renderer, camera };
}

// Clouds: a handful of overlapping blob meshes high in the sky.
// Each cloud is 2–3 squashed IcosahedronGeometry blobs grouped loosely.
function addClouds(scene: THREE.Scene): void {
  // Slightly blue-tinted white — moonlit clouds against dark navy sky
  const mat = new THREE.MeshLambertMaterial({ color: 0xc8d4e8, transparent: true, opacity: 0.88 });
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);

  // [groupX, groupY, groupZ, halfWidthX, halfWidthZ, halfHeight]
  const groups: [number, number, number, number, number, number][] = [
    [-80, 148, -110, 28, 18, 9],
    [65, 142, 85, 22, 15, 7],
    [155, 152, -35, 32, 20, 10],
    [-135, 145, 55, 25, 16, 8],
  ];

  groups.forEach(([gx, gy, gz, hw, hd, hh]) => {
    // main blob
    const b0 = new THREE.Mesh(blobGeo, mat);
    b0.position.set(gx, gy, gz);
    b0.scale.set(hw, hh, hd);
    scene.add(b0);
    // right sub-blob
    const b1 = new THREE.Mesh(blobGeo, mat);
    b1.position.set(gx + hw * 0.9, gy - hh * 0.12, gz + hd * 0.1);
    b1.scale.set(hw * 0.68, hh * 0.75, hd * 0.7);
    scene.add(b1);
    // left sub-blob
    const b2 = new THREE.Mesh(blobGeo, mat);
    b2.position.set(gx - hw * 0.85, gy - hh * 0.08, gz - hd * 0.08);
    b2.scale.set(hw * 0.6, hh * 0.7, hd * 0.65);
    scene.add(b2);
  });
}

export function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
