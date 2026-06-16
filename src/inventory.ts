import * as THREE from 'three';
import { isKeyDown } from './input';
import { buildLoot, type LootType } from './chests';

// ── Inventory / Held-Item HUD (Phase 8b) ─────────────────────────────────────
// The player can hold one item at a time (picked up from a chest).
// Shift+Space: toggle the held-item view — the item appears at the bottom of
// the screen as if the player is holding it in first-person.
// The arm group is parented to the camera so it always follows the view.

export function createInventory(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): {
  pickupItem: (type: LootType) => void;
  update: () => void;
} {
  // The camera must be in the scene graph for its children to render.
  scene.add(camera);

  const armGroup = new THREE.Group();
  // Slightly right, low, in front — typical first-person item position
  armGroup.position.set(0.30, -0.80, -1.50);
  armGroup.scale.setScalar(0.35);
  armGroup.rotation.set(0.15, -0.25, 0.05);
  armGroup.visible = false;
  camera.add(armGroup);

  let heldType: LootType | null = null;
  let shiftSpaceWasDown = false;

  return {
    pickupItem(type: LootType): void {
      heldType = type;
      // Replace existing item mesh in armGroup
      while (armGroup.children.length > 0) {
        armGroup.remove(armGroup.children[0]!);
      }
      armGroup.add(buildLoot(type));
    },

    update(): void {
      const shiftDown = isKeyDown('ShiftLeft') || isKeyDown('ShiftRight');
      const spaceDown = isKeyDown('Space');
      const shiftSpaceDown = shiftDown && spaceDown;
      const justPressed = shiftSpaceDown && !shiftSpaceWasDown;
      shiftSpaceWasDown = shiftSpaceDown;

      if (justPressed && heldType !== null) {
        armGroup.visible = !armGroup.visible;
      }
    },
  };
}
