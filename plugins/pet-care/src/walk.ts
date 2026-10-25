export interface Wx { time: string[]; apparent_temperature: number[]; precipitation_probability: (number | null)[]; precipitation: number[]; wind_speed_10m: number[]; weather_code: number[] }
/** Most pleasant hour for a walk between max(fromNow, from) and to: dry first, then feels-like near 16°C, then low wind. */
export function bestWalk(w: Wx, day: string, fromNow: number, from: number, to: number): { hour: number; feels: number; pop: number } | null {
  let best: { hour: number; feels: number; pop: number; score: number } | null = null;
  for (let h = Math.max(fromNow, from); h <= to; h++) {
    const i = w.time.indexOf(`${day}T${String(h).padStart(2, '0')}:00`);
    if (i < 0) continue;
    const pop = Number(w.precipitation_probability?.[i] ?? 0), feels = w.apparent_temperature?.[i] ?? 15;
    const score = pop * 1.5 + (w.precipitation?.[i] ?? 0) * 40 + Math.abs(feels - 16) * 2 + (w.wind_speed_10m?.[i] ?? 0) * 0.3 + ((w.weather_code?.[i] ?? 0) >= 95 ? 200 : 0);
    if (!best || score < best.score) best = { hour: h, feels, pop, score };
  }
  return best && { hour: best.hour, feels: best.feels, pop: best.pop };
}
