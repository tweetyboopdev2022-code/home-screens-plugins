export type Ev = { id: string; title: string; start: string; end: string; allDay: boolean; sourceId?: string; calendarColor?: string; location?: string; description?: string; sourceName?: string };

/** "Day 3 · Phys. Ed, Library" → { day: 3 }; anything else → null. */
export function schoolDay(title: string): number | null {
  const m = title.match(/^\s*(?:Day|Jour)\s*(\d)\b/i);
  return m ? Number(m[1]) : null;
}
const ICONS: [RegExp, string][] = [
  [/no school|pedagogical|ped day|journée péd|congé/i, '🏠'], [/hot lunch|school lunch|lunch/i, '🍽️'], [/test|quiz|exam/i, '📝'],
  [/birthday|anniversaire|bday/i, '🎂'], [/picture day|photo/i, '📸'], [/halloween/i, '🎃'], [/ice ?cream|icecream/i, '🍦'],
  [/run\b|terry fox|race/i, '🏃'], [/thanksgiving|action de gr/i, '🦃'], [/christmas|noël/i, '🎄'], [/play ?date/i, '🧸'],
  [/doctor|dentist|appointment|rdv/i, '🩺'], [/payment|mortgage|bill|payday/i, '💵'],
];
export function iconFor(title: string, sourceId?: string): string {
  const hit = ICONS.find(([r]) => r.test(title)); if (hit) return hit[1];
  return sourceId === 'holidays' ? '🎉' : '';
}
/** Strip prefixes the icon already says. */
export function tidyTitle(t: string): string {
  return t.replace(/^\s*(school lunch|hot lunch)\s*:\s*/i, '').replace(/^\s*no school\s*[—–-]\s*/i, 'No school: ').trim();
}
export const isOff = (t: string) => /no school|pedagogical|ped day|congé/i.test(t);

/** YYYY-MM-DD keys an event covers (all-day end is exclusive). */
export function dayKeysOf(e: Ev, keyOf: (d: Date) => string): string[] {
  if (e.allDay) {
    const s = e.start.slice(0, 10), en = (e.end || e.start).slice(0, 10);
    const out: string[] = []; let d = new Date(s + 'T12:00:00Z');
    for (let i = 0; i < 60; i++) { const k = d.toISOString().slice(0, 10); if (i > 0 && k >= en) break; out.push(k); d = new Date(d.getTime() + 86400000); }
    return out;
  }
  const a = new Date(e.start), b = new Date(e.end || e.start);
  const out = [keyOf(a)]; let d = new Date(a.getTime());
  for (let i = 0; i < 14; i++) { d = new Date(d.getTime() + 86400000); if (d.getTime() >= b.getTime()) break; const k = keyOf(d); if (!out.includes(k)) out.push(k); }
  return out;
}
export const addDaysKey = (k: string, n: number) => new Date(Date.parse(k + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const dowOf = (k: string) => new Date(k + 'T12:00:00Z').getUTCDay();
