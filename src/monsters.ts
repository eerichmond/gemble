import * as THREE from 'three';

// ── Flying Eye ────────────────────────────────────────────────────────────────
// Floats at city center, bobs and drifts, always slowly rotates to face player.

const EYE_X = 0;
const EYE_Z = -310;

const _ph = (color: number, emissive = 0, ei = 0) =>
  new THREE.MeshPhongMaterial({ color, emissive, emissiveIntensity: ei });

export function createFlyingEye(
  scene: THREE.Scene,
  groundY: number,
): {
  update: (dt: number, playerX: number, playerZ: number) => void;
} {
  const EYE_BASE_Y = groundY + 5.0; // well above player eye-height (~1.7)
  const group = new THREE.Group();
  group.position.set(EYE_X, EYE_BASE_Y, EYE_Z);
  scene.add(group);

  // Outer sphere
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 20),
    _ph(0x2050a0),
  ));

  // Iris (glowing purple)
  const iris = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 20, 16),
    _ph(0xaa66ee, 0x7733cc, 0.7),
  );
  iris.position.set(0, 0, 0.30);
  group.add(iris);

  // Pupil
  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    _ph(0x080018, 0x110033, 0.3),
  );
  pupil.position.set(0, 0, 0.52);
  group.add(pupil);

  // Side horns: tips point straight outward in ±X, base touching sphere surface
  { const _yUp = new THREE.Vector3(0, 1, 0);
    for (const side of [-1, 1] as const) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.32, 5), _ph(0x2e68cc));
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(_yUp, new THREE.Vector3(side, 0, 0));
      c.quaternion.copy(q);
      // center so base sits at sphere surface (R=0.55, half-height=0.16)
      c.position.set(side * (0.55 + 0.16), 0, 0);
      group.add(c);
    }
  }

  // Purple point-light glow
  group.add(new THREE.PointLight(0x8060ff, 3, 14));

  // Per-frame reusable objects (avoids GC pressure)
  const _dir = new THREE.Vector3();
  const _target = new THREE.Vector3();
  const _forward = new THREE.Vector3(0, 0, 1);
  const _targetQuat = new THREE.Quaternion();
  let time = 0;

  return {
    update(dt, playerX, playerZ) {
      time += dt;

      // Bob up/down (doubled amplitude) and gentle side-drift
      group.position.y = EYE_BASE_Y + Math.sin(time * 1.3) * 0.30;
      group.position.x = EYE_X      + Math.sin(time * 0.35) * 0.80;

      // Iris scanning animation
      iris.rotation.x  = Math.sin(time * 0.7)  * 0.15;
      iris.rotation.y  = Math.sin(time * 0.5)  * 0.12;
      pupil.rotation.y = Math.sin(time * 0.55) * 0.10;

      // Smooth player-tracking: slerp rotation so +Z faces the player.
      _target.set(playerX, groundY + 1.7, playerZ);
      _dir.subVectors(_target, group.position).normalize();
      _targetQuat.setFromUnitVectors(_forward, _dir);
      group.quaternion.slerp(_targetQuat, Math.min(1.0, dt * 1.2));
    },
  };
}
