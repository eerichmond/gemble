import { describe, it, expect } from 'vitest';
import { computeTerrainHeight, riverChannelOffset } from './terrain';

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

describe('riverChannelOffset', () => {
  it('returns 0 far from all river spines', () => {
    expect(riverChannelOffset(0, 0)).toBe(0);
  });

  it('returns full depth (6) at main crossing center', () => {
    // (4, -261) lies on the main spine — dist=0, within inner=14 → depth=6
    expect(riverChannelOffset(4, -261)).toBeCloseTo(6, 1);
  });

  it('returns 0 beyond outer edge of main crossing', () => {
    // (4, -238) is 23 units north of main spine; outer=22 → no carve
    expect(riverChannelOffset(4, -238)).toBe(0);
  });

  it('tapers in ramp zone between inner and outer edge', () => {
    // (22, -243) is 18 units perpendicular from the main spine
    // carveBank(18, inner=14, outer=22, depth=6) = 6*(1-4/8) = 3
    expect(riverChannelOffset(22, -243)).toBeCloseTo(3, 1);
  });

  it('returns full arm depth (4) at west arm spine', () => {
    // (-90, -305) is exactly on the west arm waypoint
    expect(riverChannelOffset(-90, -305)).toBeCloseTo(4, 1);
  });
});
