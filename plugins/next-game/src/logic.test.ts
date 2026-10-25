import { describe, it, expect } from 'vitest';
import { pickGames, channels, type Game } from './logic';
const G = (id: number, t: string, state = 'FUT', tv: any[] = []): Game => ({ id, gameType: 2, startTimeUTC: t, gameState: state, awayTeam: { abbrev: 'CAR' }, homeTeam: { abbrev: 'MTL' }, tvBroadcasts: tv });
describe('next game', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  it('picks the next unfinished game and the last result', () => {
    const r = pickGames([G(1, '2026-10-01T23:00:00Z', 'OFF'), G(2, '2026-10-03T23:00:00Z'), G(3, '2026-10-06T23:00:00Z')], now);
    expect([r.last?.id, r.next?.id, r.upcoming.map((g) => g.id)]).toEqual([1, 2, [3]]);
  });
  it('prefers a live game', () => {
    expect(pickGames([G(2, '2026-10-03T11:00:00Z', 'LIVE'), G(3, '2026-10-06T23:00:00Z')], now).live?.id).toBe(2);
  });
  it('lists Canadian channels, home market first, with friendly names', () => {
    const g = G(1, '2026-10-06T23:00:00Z', 'FUT', [
      { market: 'N', countryCode: 'CA', network: 'SNE', sequenceNumber: 30 }, { market: 'H', countryCode: 'CA', network: 'RDS', sequenceNumber: 145 },
      { market: 'H', countryCode: 'CA', network: 'TSN2', sequenceNumber: 112 }, { market: 'H', countryCode: 'US', network: 'SN-PIT' }]);
    expect(channels(g)).toEqual(['TSN2', 'RDS', 'Sportsnet East']);
    expect(channels(g, 'fr')).toEqual(['RDS']);
  });
});
