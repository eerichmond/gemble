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

  // Phase 0: plain daylight sky — replaced with dusk purple in Phase 2
  scene.background = new THREE.Color(0x87ceeb);
  // Light haze softens the terrain edge at the horizon; density 0.004 fades at ~300 units.
  // FUTURE Phase 2: replace with FogExp2(0x1a1228, 0.018) for dusk atmosphere
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.004);

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800);
  // Rotation order must be YXZ for FPS camera: yaw (Y) applied first in world space,
  // so pitch (X) added later in Phase 1+ won't cause roll.
  camera.rotation.order = 'YXZ';

  // Ambient: soft fill so terrain is never pitch-black
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  // Sun: warm directional light casting shadows
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
  sun.position.set(80, 120, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -200;
  sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200;
  sun.shadow.camera.bottom = -200;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  scene.add(sun);
  // FUTURE Phase 2: swap sun color/position and add secondary fill light for dusk

  return { scene, renderer, camera };
}

export function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
