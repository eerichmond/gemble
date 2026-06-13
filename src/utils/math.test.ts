import { clamp, lerp, degToRad } from './math';

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(0, 10, 0)).toBe(0);
  });
  it('returns b at t=1', () => {
    expect(lerp(0, 10, 1)).toBe(10);
  });
  it('interpolates midpoint', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe('degToRad', () => {
  it('converts 180 degrees to PI', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
  it('converts 90 degrees to PI/2', () => {
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
  });
  it('converts 0 degrees to 0', () => {
    expect(degToRad(0)).toBe(0);
  });
});
