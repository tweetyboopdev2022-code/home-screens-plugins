import { describe, it, expect } from 'vitest';
import { parseRotation, whoOn, toggleSwap, eveningOf, scheduled } from './rotation';

const base = parseRotation({ people: 'Jordan, Alex', nightsEach: 2, anchorDate: '2026-09-29', anchorPerson: 'Jordan', anchorNight: 1, swaps: '' })!;

describe('bedtime rotation', () => {
  it('follows 2 nights each from the anchor', () => {
    const seq = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']
      .map((d) => whoOn(base, d).person);
    expect(seq).toEqual(['Jordan', 'Jordan', 'Alex', 'Alex', 'Jordan', 'Jordan']);
    expect(scheduled(base, '2026-09-30').night).toBe(2);
  });
  it('works backwards in time too', () => {
    expect(whoOn(base, '2026-09-28').person).toBe('Alex');
    expect(whoOn(base, '2026-09-26').person).toBe('Jordan');
  });
  it('a swap only changes that one night, and tapping again undoes it', () => {
    const swaps = toggleSwap(base, '2026-09-29', '2026-09-29');
    const r = { ...base, swaps };
    expect(whoOn(r, '2026-09-29')).toMatchObject({ person: 'Alex', swapped: true });
    expect(whoOn(r, '2026-09-30').person).toBe('Jordan');
    expect(toggleSwap(r, '2026-09-29', '2026-09-29')).toEqual({});
  });
  it('after midnight still counts as last night until 5 am', () => {
    expect(eveningOf('2026-09-30', 60)).toBe('2026-09-29');
    expect(eveningOf('2026-09-30', 6 * 60)).toBe('2026-09-30');
  });
  it('handles anchor on the 2nd night', () => {
    const r = parseRotation({ people: 'Jordan,Alex', nightsEach: 2, anchorDate: '2026-09-29', anchorPerson: 'Jordan', anchorNight: 2 })!;
    expect(whoOn(r, '2026-09-30').person).toBe('Alex');
  });
});
