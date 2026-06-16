import * as THREE from 'three';
import { isKeyDown } from './input';
import { buildLoot, type LootType } from './chests';

// ── Inventory / Held-Item HUD (Phase 8b) ─────────────────────────────────────
// Accumulated item list — each chest pickup appends to `items`.
// Shift+Space cycles through them one at a time:
//   press → show items[0], press → hide, press → show items[1], press → hide …
// Wraps back to the first item after the last.

export function createInventory(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): {
  pickupItem: (type: LootType) => void;
  update: () => void;
} {
  scene.add(camera);

  const armGroup = new THREE.Group();
  armGroup.position.set(0.3, -0.8, -1.5);
  armGroup.scale.setScalar(0.35);
  armGroup.rotation.set(0.15, -0.25, 0.05);
  armGroup.visible = false;
  camera.add(armGroup);

  const EQUIPPABLE: ReadonlySet<LootType> = new Set(['sword', 'shield']);
  const items: LootType[] = [];
  let nextIdx = 0; // index into equippable items
  let showing = false;
  let wasDown = false;

  function showItem(type: LootType): void {
    while (armGroup.children.length > 0) armGroup.remove(armGroup.children[0]);
    armGroup.add(buildLoot(type));
    armGroup.visible = true;
  }

  return {
    pickupItem(type: LootType): void {
      if (EQUIPPABLE.has(type)) items.push(type);
    },

    update(): void {
      const shiftDown = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight');
      const spaceDown = isKeyDown('Space');
      const down = shiftDown && spaceDown;
      const justPressed = down && !wasDown;
      wasDown = down;

      if (!justPressed) return;

      if (showing) {
        armGroup.visible = false;
        showing = false;
      } else if (items.length > 0) {
        showItem(items[nextIdx % items.length]);
        nextIdx = (nextIdx + 1) % items.length;
        showing = true;
      }
    },
  };
}
