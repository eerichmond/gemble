import type * as THREE from 'three';

export function createCompass(camera: THREE.PerspectiveCamera): { update: () => void } {
  const SIZE = 80;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  Object.assign(canvas.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    width: `${SIZE}px`,
    height: `${SIZE}px`,
    pointerEvents: 'none',
    zIndex: '10',
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = SIZE / 2 - 4;

  function update(): void {
    // camera.rotation.y equals the player's yaw:
    //   yaw=0  → facing south (−Z);  yaw=π → facing north (+Z)
    //   yaw=−π/2 → facing east (+X); yaw=π/2 → facing west (−X)
    const yaw = camera.rotation.y;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rotate the compass face so the current facing direction is at the top.
    // Derivation: the "compass angle" of the facing direction = yaw + π.
    // To put that angle at the top we rotate the face by −(yaw + π).
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-yaw - Math.PI);

    // 8 radial tick marks
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (R - 1), -Math.cos(a) * (R - 1));
      ctx.lineTo(Math.sin(a) * (R - 5), -Math.cos(a) * (R - 5));
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cardinal labels — each counter-rotated by (yaw + π) so the glyphs stay upright
    // while their positions orbit the circle.
    const cardinals: [string, number, string][] = [
      ['N', 0, '#ff5555'],
      ['E', Math.PI / 2, 'rgba(255,255,255,0.85)'],
      ['S', Math.PI, 'rgba(255,255,255,0.85)'],
      ['W', -Math.PI / 2, 'rgba(255,255,255,0.85)'],
    ];

    for (const [label, angle, color] of cardinals) {
      const r = R - 13;
      const lx = Math.sin(angle) * r;
      const ly = -Math.cos(angle) * r;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(yaw + Math.PI);
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    ctx.restore();

    // Fixed white triangle at the top = "you are looking in this direction"
    ctx.save();
    ctx.translate(cx, cy - (R - 2));
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(-4, 3);
    ctx.lineTo(4, 3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.restore();
  }

  return { update };
}
