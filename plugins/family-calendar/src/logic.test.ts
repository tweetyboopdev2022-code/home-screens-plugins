import { describe, it, expect } from 'vitest';
import { schoolDay, iconFor, tidyTitle, dayKeysOf, addDaysKey } from './logic';
describe('cal', () => {
  it('school day', () => { expect(schoolDay('Day 3 · Phys. Ed, Library')).toBe(3); expect(schoolDay('Dayton trip')).toBe(null); });
  it('icons', () => { expect(iconFor('Hot lunch: Sloppy Joe')).toBe('🍽️'); expect(iconFor('No school — Pedagogical day')).toBe('🏠'); expect(iconFor('Thanksgiving', 'holidays')).toBe('🦃'); });
  it('tidy', () => { expect(tidyTitle('Hot lunch: Sloppy Joe')).toBe('Sloppy Joe'); expect(tidyTitle('No school — Pedagogical day')).toBe('No school: Pedagogical day'); });
  it('spans', () => {
    expect(dayKeysOf({ id: '1', title: '', start: '2026-10-08', end: '2026-10-09', allDay: true }, () => '')).toEqual(['2026-10-08']);
    expect(dayKeysOf({ id: '1', title: '', start: '2026-10-08', end: '2026-10-10', allDay: true }, () => '')).toEqual(['2026-10-08', '2026-10-09']);
    expect(addDaysKey('2026-10-31', 1)).toBe('2026-11-01');
  });
});
