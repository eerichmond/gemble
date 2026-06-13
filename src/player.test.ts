import { describe, it, expect } from 'vitest';
import { computeMovementDelta, isBlockedByTree, clampToWorld } from './player';

describe('computeMovementDelta', () => {
  it('moves forward along -Z when yaw is 0', () => {
    const { dx, dz } = computeMovementDelta(0, 8, 1);
    expect(dx).toBeCloseTo(0, 5);
    expect(dz).toBeCloseTo(-8, 5);
  });

  it('scales with dt', () => {
    const full = computeMovementDelta(0, 8, 1);
    const half = computeMovementDelta(0, 8, 0.5);
    expect(half.dz).toBeCloseTo(full.dz / 2, 5);
  });

  it('reverses direction for negative speed (backward movement)', () => {
    const fwd = computeMovementDelta(0, 8, 1);
    const bwd = computeMovementDelta(0, -8, 1);
    expect(bwd.dz).toBeCloseTo(-fwd.dz, 5);
  });

  it('dt=0 produces no movement', () => {
    const { dx, dz } = computeMovementDelta(1.2, 8, 0);
    expect(dx).toBeCloseTo(0);
    expect(dz).toBeCloseTo(0);
  });
});

describe('isBlockedByTree', () => {
  const trees = [{ x: 10, z: 10, radius: 1 }];

  it('returns false when player is far from all trees', () => {
    expect(isBlockedByTree(0, 0, trees, 0.5)).toBe(false);
  });

  it('returns true when player overlaps a tree', () => {
    // distance to (10,10) from (10.5, 10) = 0.5; playerRadius 0.5 + treeRadius 1 = 1.5 > 0.5 → blocked
    expect(isBlockedByTree(10.5, 10, trees, 0.5)).toBe(true);
  });

  it('returns false with an empty tree list', () => {
    expect(isBlockedByTree(0, 0, [], 0.5)).toBe(false);
  });

  it('returns true when standing exactly at tree center', () => {
    expect(isBlockedByTree(10, 10, trees, 0.5)).toBe(true);
  });
});

describe('clampToWorld', () => {
  it('passes through positions inside the limit', () => {
    expect(clampToWorld(50, -100, 240)).toEqual({ x: 50, z: -100 });
  });

  it('clamps x above limit', () => {
    expect(clampToWorld(300, 0, 240)).toEqual({ x: 240, z: 0 });
  });

  it('clamps z below negative limit', () => {
    expect(clampToWorld(0, -300, 240)).toEqual({ x: 0, z: -240 });
  });

  it('clamps both axes simultaneously', () => {
    expect(clampToWorld(999, -999, 240)).toEqual({ x: 240, z: -240 });
  });
});
