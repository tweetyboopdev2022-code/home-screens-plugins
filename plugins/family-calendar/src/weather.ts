// Weather for the calendar: daily forecast at home (Open-Meteo, 16 days) and
// hourly weather at an event's own location (Nominatim geocode → Open-Meteo).
const PID = 'family-calendar';
const sdk = () => (window as any).__HS_SDK__;

export type DayWx = { code: number; hi: number; lo: number; pop: number };
export type PointWx = { code: number; temp: number; pop: number };
export type Geo = { lat: number; lon: number; town: string };

/** WMO weather code → emoji + words. */
export function wmo(code: number, night = false): { icon: string; label: string } {
  if (code === 0) return night ? { icon: '🌙', label: 'Clear' } : { icon: '☀️', label: 'Sunny' };
  if (code <= 2) return { icon: night ? '☁️' : '⛅', label: 'Partly cloudy' };
  if (code === 3) return { icon: '☁️', label: 'Cloudy' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Fog' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '❄️', label: 'Snow' };
  if (code >= 95) return { icon: '⛈️', label: 'Thunderstorms' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Drizzle' };
  if (code >= 61) return { icon: '🌧️', label: 'Rain' };
  return { icon: '☁️', label: 'Cloudy' };
}

async function getJson(url: string, ttl: number) {
  const r: Response = await sdk().pluginFetch(PID, { url, cacheTtlMs: ttl });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

let dailyCache: { key: string; at: number; v: Map<string, DayWx> } | null = null;
export async function homeDaily(lat: number, lon: number, tz: string): Promise<Map<string, DayWx>> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (dailyCache && dailyCache.key === key && Date.now() - dailyCache.at < 1800000) return dailyCache.v;
  const j = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(tz)}&forecast_days=16`, 1800000);
  const d = j.daily ?? {}; const m = new Map<string, DayWx>();
  (d.time ?? []).forEach((t: string, i: number) => m.set(t, { code: d.weather_code[i], hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i], pop: d.precipitation_probability_max?.[i] ?? 0 }));
  dailyCache = { key, at: Date.now(), v: m }; return m;
}

const hourlyCache = new Map<string, { at: number; v: any }>();
/** Weather at a place at a given time (within the next 16 days). */
export async function pointAt(lat: number, lon: number, tz: string, when: Date): Promise<PointWx | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  let h = hourlyCache.get(key);
  if (!h || Date.now() - h.at > 1800000) {
    const j = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
      + `&hourly=temperature_2m,weather_code,precipitation_probability&timezone=GMT&forecast_days=16`, 1800000);
    h = { at: Date.now(), v: j.hourly }; hourlyCache.set(key, h);
  }
  const times: string[] = h.v?.time ?? []; if (!times.length) return null;
  const target = when.getTime();
  let best = -1, bestD = Infinity;
  times.forEach((t, i) => { const d = Math.abs(Date.parse(t + ':00Z') - target); if (d < bestD) { bestD = d; best = i; } });
  if (best < 0 || bestD > 2 * 3600000) return null;
  return { code: h.v.weather_code[best], temp: h.v.temperature_2m[best], pop: h.v.precipitation_probability?.[best] ?? 0 };
}

const GEO_KEY = 'family-calendar:geo3';
type GeoEntry = { g: Geo | null; at: number };
function geoStore(): Record<string, GeoEntry> { try { return JSON.parse(localStorage.getItem(GEO_KEY) || '{}'); } catch { return {}; } }
const inflight = new Map<string, Promise<Geo | null>>();
let lastNominatim = 0;
const UA = { 'User-Agent': 'WallHub-family-calendar/1.4 (home wall display)' };

async function nominatim(q: string): Promise<Geo | null> {
  // Nominatim asks for at most one request per second.
  const wait = lastNominatim + 1100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const r: Response = await sdk().pluginFetch(PID, { url: `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=ca&q=${encodeURIComponent(q)}`, cacheTtlMs: 86400000, headers: UA });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json(); const x = j?.[0]; if (!x) return null;
  const a = x.address ?? {};
  return { lat: Number(x.lat), lon: Number(x.lon), town: a.city || a.town || a.village || a.municipality || a.county || '' };
}
async function openMeteoPlace(name: string): Promise<Geo | null> {
  const j = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&countryCode=CA&name=${encodeURIComponent(name)}`, 86400000);
  const x = j?.results?.[0]; return x ? { lat: x.latitude, lon: x.longitude, town: x.name } : null;
}

/** Address → coordinates. Cached on this display (misses retried after a day). */
export function geocode(q: string): Promise<Geo | null> {
  const k = q.trim().toLowerCase();
  const hit = geoStore()[k];
  if (hit && (hit.g || Date.now() - hit.at < 86400000)) return Promise.resolve(hit.g);
  if (inflight.has(k)) return inflight.get(k)!;
  const job = (async () => {
    const parts = q.split(',').map((x) => x.trim()).filter(Boolean);
    let found: Geo | null = null;
    try { found = await nominatim(q); } catch { /* fall through */ }
    // "Tacos Victor, 4280 R. Notre Dame O, Montréal, …" → retry without the business name.
    if (!found && parts.length > 2 && !/\d/.test(parts[0])) { try { found = await nominatim(parts.slice(1).join(', ')); } catch { /* next */ } }
    // Town-level is plenty for weather: try each place name in the address, last first.
    const towns = parts.slice().reverse().filter((x) => !/\d|^canada$|^(qc|quebec|québec|on|ontario)\b/i.test(x));
    for (const t of towns) {
      if (found) break;
      try { found = await openMeteoPlace(t); } catch { /* next */ }
    }
    const store = geoStore(); store[k] = { g: found, at: Date.now() };
    try { localStorage.setItem(GEO_KEY, JSON.stringify(store)); } catch { /* ignore */ }
    inflight.delete(k); return found;
  })();
  inflight.set(k, job); return job;
}
