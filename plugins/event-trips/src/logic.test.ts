import { describe, it, expect } from 'vitest';
import { isDrivableLocation, resolveSourceIds, selectTrips, shortPlace, weatherAt, leaveBy, formatDuration, weatherInfo } from './logic';

const now = new Date('2026-09-26T14:00:00Z');
const ev = (id: string, start: string, loc?: string, src = 'v@x', allDay = false) =>
  ({ id, title: id, start, end: new Date(new Date(start).getTime() + 3600000).toISOString(), location: loc, allDay, sourceId: src });

describe('logic', () => {
  it('filters non-drivable locations', () => {
    expect(isDrivableLocation('https://zoom.us/j/1')).toBe(false);
    expect(isDrivableLocation('Google Meet: meet.google.com/abc')).toBe(false);
    expect(isDrivableLocation('TBD')).toBe(false);
    expect(isDrivableLocation('Warehouse Store, Springfield, QC')).toBe(true);
    expect(isDrivableLocation(undefined)).toBe(false);
  });
  it('resolves person calendars', () => {
    const people = [{ name: 'Alex', sourceIds: ['v@x'] }];
    expect(resolveSourceIds(people, 'alex', '')).toEqual(['v@x']);
    expect(resolveSourceIds(people, '', '')).toBeNull();
    expect(resolveSourceIds(people, 'Nobody', '')).toEqual([]);
    expect(resolveSourceIds(people, 'Alex', 'a, b')).toEqual(['a', 'b']);
  });
  it('selects upcoming trips in order within horizon', () => {
    const list = [
      ev('late', '2026-09-30T12:00:00Z', 'Gym, Springfield'),
      ev('past', '2026-09-26T10:00:00Z', 'Old'),
      ev('soon', '2026-09-26T16:00:00Z', 'Office, Downtown'),
      ev('noloc', '2026-09-26T17:00:00Z'),
      ev('other', '2026-09-26T18:00:00Z', 'Somewhere', 't@x'),
      ev('far', '2026-10-20T12:00:00Z', 'Far'),
    ];
    expect(selectTrips(list, ['v@x'], now, 7, 5).map((e) => e.id)).toEqual(['soon', 'late']);
    expect(selectTrips(list, null, now, 7, 5).map((e) => e.id)).toEqual(['soon', 'other', 'late']);
  });
  it('short place', () => {
    expect(shortPlace('Warehouse Store Wholesale, 100 Example Blvd, Springfield')).toBe('Warehouse Store Wholesale');
  });
  it('weather nearest hour and all-day noon', () => {
    const base = Date.parse('2026-09-27T00:00:00Z') / 1000;
    const hourly = { time: Array.from({ length: 48 }, (_, i) => base + i * 3600), temperature_2m: Array.from({ length: 48 }, (_, i) => i), precipitation_probability: Array(48).fill(40), weather_code: Array(48).fill(61) };
    const w = weatherAt(hourly, ev('a', '2026-09-27T15:20:00Z', 'x'));
    expect(w?.temp).toBe(15);
    expect(weatherInfo(w?.code).label).toBe('Rain');
    expect(weatherAt(hourly, ev('b', '2026-10-15T15:00:00Z', 'x'))).toBeNull();
  });
  it('leave by and durations', () => {
    expect(leaveBy(ev('a', '2026-09-26T16:00:00Z', 'x'), 1800, 10).toISOString()).toBe('2026-09-26T15:20:00.000Z');
    expect(formatDuration(1500)).toBe('25 min');
    expect(formatDuration(4500)).toBe('1 h 15 min');
  });
});
import { townFromLocation, trafficLevel } from './logic';
describe('v1.1 helpers', () => {
  it('town', () => {
    expect(townFromLocation('12 Main Street, Riverton, QC, Canada')).toBe('Riverton');
    expect(townFromLocation('Warehouse Store, 100 Example Blvd, Springfield, QC A1A 1A1, Canada')).toBe('Springfield');
    expect(townFromLocation('Warehouse Store')).toBeUndefined();
  });
  it('traffic', () => {
    expect(trafficLevel(1500, 60)).toBe('clear');
    expect(trafficLevel(1500, 240)).toBe('moderate');
    expect(trafficLevel(2400, 900)).toBe('heavy');
  });
});
