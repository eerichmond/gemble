import { describe, it, expect } from 'vitest';
import { shouldStartle } from './birds';

describe('shouldStartle', () => {
  it('returns true when player is within startle radius', () => {
    expect(shouldStartle(0, 0, 3, 3, 10)).toBe(true);
  });

  it('returns false when player is outside startle radius', () => {
    expect(shouldStartle(0, 0, 10, 10, 5)).toBe(false);
  });

  it('returns true when player is at the bird position', () => {
    expect(shouldStartle(5, -10, 5, -10, 1)).toBe(true);
  });
});
