import { describe, it, expect } from 'vitest';
import { makeBridgedHeight } from './road';

const flat: (x: number, z: number) => number = () => 0;
const deep: (x: number, z: number) => number = () => -10;

describe('makeBridgedHeight', () => {
  it('returns raw height north of bridge zone', () => {
    // z=-200 is well north of Z1=-235 — outside zone, no river carving there
    expect(makeBridgedHeight(flat)(4, -200)).toBeCloseTo(0, 3);
  });

  it('returns raw height south of bridge zone', () => {
    // z=-320 is well south of Z2=-282 — outside zone, no river carving there
    expect(makeBridgedHeight(flat)(4, -320)).toBeCloseTo(0, 3);
  });

  it('returns uncarved height inside bridge zone', () => {
    // (4, -265) is at the river spine center — carve=6, so uncarved = 0+6 = 6
    expect(makeBridgedHeight(flat)(4, -265)).toBeCloseTo(6, 1);
  });

  it('clamps height to river floor outside bridge zone over river channel', () => {
    // (50, -265) is in the river channel but outside bridge x-range (|50-4|=46 > 14)
    // With deeply carved terrain (mock returns -10), player is clamped to RIVER_FLOOR (-3)
    expect(makeBridgedHeight(deep)(50, -265)).toBeCloseTo(-3, 1);
  });
});
