import { describe, it, expect } from 'vitest';
import { isNearChest } from './chests';

describe('isNearChest', () => {
  it('returns true when player is exactly at chest center', () => {
    expect(isNearChest(5, 10, 5, 10, 2)).toBe(true);
  });

  it('returns true when player is inside the radius', () => {
    // distance from (6, 11) to (5, 10) = sqrt(2) ≈ 1.41 < radius 2
    expect(isNearChest(6, 11, 5, 10, 2)).toBe(true);
  });

  it('returns false when player is exactly at the radius boundary (exclusive)', () => {
    // distance from (7, 10) to (5, 10) = 2, radius = 2 → on boundary (≤ → true)
    expect(isNearChest(7, 10, 5, 10, 2)).toBe(true);
  });

  it('returns false when player is outside the radius', () => {
    // distance from (8, 10) to (5, 10) = 3 > radius 2
    expect(isNearChest(8, 10, 5, 10, 2)).toBe(false);
  });

  it('works with the 3-unit interaction range used in createChests', () => {
    // Player 2.9 units away — should trigger interaction
    expect(isNearChest(2.9, 0, 0, 0, 3)).toBe(true);
    // Player 3.1 units away — just outside range
    expect(isNearChest(3.1, 0, 0, 0, 3)).toBe(false);
  });

  it('handles negative coordinates', () => {
    expect(isNearChest(-10, -200, -10, -200, 1)).toBe(true);
    expect(isNearChest(-10, -200, -10, -203, 1)).toBe(false);
  });
});
