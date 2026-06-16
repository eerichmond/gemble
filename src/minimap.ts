import type { MonsterPosition } from './monsters';

// ── Minimap (Phase 8b) ────────────────────────────────────────────────────────
// Small 130×160 px canvas pinned bottom-left, similar to the compass.
// World bounds: X [-250, +250], Z [-440, +250] — maps to canvas [0,130]×[0,160].

interface StaticEntity {
  x: number;
  z: number;
  type: 'gem' | 'chest' | 'flyingEye';
}

export function createMinimap(
  staticEntities: StaticEntity[],
  monsterPositions: MonsterPosition[],
  capybaraPositions: { x: number; z: number }[],
): {
  update: (playerX: number, playerZ: number, playerYaw: number) => void;
} {
  const W = 130, H = 160;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  Object.assign(canvas.style, {
    position:     'fixed',
    bottom:       '16px',
    left:         '16px',
    width:        `${W}px`,
    height:       `${H}px`,
    borderRadius: '6px',
    border:       '1px solid rgba(255,255,255,0.25)',
    background:   'rgba(0,0,0,0.55)',
    pointerEvents:'none',
    zIndex:       '10',
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;

  // World spans: X ∈ [-250, +250] → width 500; Z ∈ [-440, +250] → height 690
  function toMap(wx: number, wz: number): [number, number] {
    const mx = (wx + 250) / 500 * W;
    const my = (250 - wz) / 690 * H;
    return [mx, my];
  }

  function dot(x: number, y: number, r: number, color: string): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  return {
    update(playerX: number, playerZ: number, playerYaw: number): void {
      ctx.clearRect(0, 0, W, H);

      // Static: gem (purple), chests (gold), flying eye (red)
      for (const e of staticEntities) {
        const [mx, my] = toMap(e.x, e.z);
        const color = e.type === 'gem' ? '#aa44ff'
          : e.type === 'chest'     ? '#ffcc00'
          : '#ff4444';
        dot(mx, my, 3, color);
      }

      // Live: capybaras (green)
      for (const c of capybaraPositions) {
        const [mx, my] = toMap(c.x, c.z);
        dot(mx, my, 2, '#44bb44');
      }

      // Live: troll + winged monsters (red)
      for (const m of monsterPositions) {
        const [mx, my] = toMap(m.x, m.z);
        dot(mx, my, 3, '#ff4444');
      }

      // Player — small triangle arrow pointing in facing direction
      const [px, py] = toMap(playerX, playerZ);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(playerYaw + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -6);   // tip (pointing up before rotation)
      ctx.lineTo(-4, 4);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.restore();
    },
  };
}
