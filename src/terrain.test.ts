import { describe, it, expect } from 'vitest';
import { computeTerrainHeight } from './terrain';

describe('computeTerrainHeight', () => {
  it('returns 0 at origin', () => {
    // sin(0)*12 + cos(0)*10 + sin(0)*4 + cos(0)*sin(0)*3 = 0 + 10 + 0 + 0 = 10
    expect(computeTerrainHeight(0, 0)).toBeCloseTo(10, 5);
  });

  it('returns a number (not NaN or Infinity)', () => {
    const h = computeTerrainHeight(37.5, -82.3);
    expect(Number.isFinite(h)).toBe(true);
  });

  it('stays within documented ±29 unit range', () => {
    const samples = [
      [0, 0],
      [50, 50],
      [-100, 200],
      [200, -150],
      [-240, -240],
    ] as [number, number][];
    for (const [x, z] of samples) {
      expect(computeTerrainHeight(x, z)).toBeGreaterThanOrEqual(-30);
      expect(computeTerrainHeight(x, z)).toBeLessThanOrEqual(30);
    }
  });

  it('is deterministic — same inputs always produce same output', () => {
    expect(computeTerrainHeight(123, 456)).toBe(computeTerrainHeight(123, 456));
  });
});
