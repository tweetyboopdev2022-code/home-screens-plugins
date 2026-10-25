// Pure helpers for the Next Game block (NHL schedule from api-web.nhle.com).
export interface Team { abbrev: string; commonName?: { default: string }; placeName?: { default: string }; logo?: string; darkLogo?: string; score?: number }
export interface Broadcast { market: string; countryCode: string; network: string; sequenceNumber?: number }
export interface Game { id: number; gameType: number; startTimeUTC: string; gameState: string; venue?: { default: string }; awayTeam: Team; homeTeam: Team; tvBroadcasts?: Broadcast[]; periodDescriptor?: { number?: number; periodType?: string }; gameOutcome?: { lastPeriodType?: string } }

export const NETWORKS: Record<string, string> = {
  SN: 'Sportsnet', SNE: 'Sportsnet East', SNO: 'Sportsnet Ontario', SNP: 'Sportsnet Pacific', SNW: 'Sportsnet West', SN1: 'Sportsnet One', SN360: 'Sportsnet 360', 'SN NOW': 'Sportsnet+', 'SN+': 'Sportsnet+',
  CBC: 'CBC', CITY: 'Citytv', TVAS: 'TVA Sports', TVAS2: 'TVA Sports 2', RDS: 'RDS', RDS2: 'RDS 2', RDSI: 'RDS Info', TSN: 'TSN', TSN1: 'TSN1', TSN2: 'TSN2', TSN3: 'TSN3', TSN4: 'TSN4', TSN5: 'TSN5', PRIME: 'Prime Video', AMZN: 'Prime Video',
};
export const FRENCH = new Set(['TVAS', 'TVAS2', 'RDS', 'RDS2', 'RDSI']);

export const isLive = (g: Game) => ['LIVE', 'CRIT'].includes(g.gameState);
export const isOver = (g: Game) => ['FINAL', 'OFF'].includes(g.gameState);

/** The game to feature: a live one, else the next one that hasn't finished (games in the last 3 h count as "now"). */
export function pickGames(games: Game[], now: number): { live?: Game; next?: Game; last?: Game; upcoming: Game[] } {
  const sorted = [...games].sort((a, b) => a.startTimeUTC.localeCompare(b.startTimeUTC));
  const live = sorted.find(isLive);
  const future = sorted.filter((g) => !isOver(g) && !isLive(g) && Date.parse(g.startTimeUTC) > now - 3 * 3600e3);
  const past = sorted.filter(isOver);
  return { live, next: future[0], last: past[past.length - 1], upcoming: future.slice(live ? 0 : 1, (live ? 0 : 1) + 3) };
}

/** Canadian channels, home-market first, French or English first depending on preference. */
export function channels(g: Game, prefer: 'fr' | 'en' | 'both' = 'both', country = 'CA'): string[] {
  const list = (g.tvBroadcasts ?? []).filter((b) => b.countryCode === country)
    .filter((b) => prefer === 'both' || (prefer === 'fr' ? FRENCH.has(b.network) : !FRENCH.has(b.network)));
  list.sort((a, b) => (a.market === 'H' ? 0 : 1) - (b.market === 'H' ? 0 : 1) || (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
  return Array.from(new Set(list.map((b) => NETWORKS[b.network] ?? b.network)));
}

export const teamName = (t: Team) => [t.placeName?.default, t.commonName?.default].filter(Boolean).join(' ') || t.abbrev;
