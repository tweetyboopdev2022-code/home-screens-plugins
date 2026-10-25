import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, caps, Icon, I, useNow, dayKey, Fit, clampLines } from './ui';

type Ev = { id: string; title: string; start: string; allDay: boolean; sourceId?: string };
export function dish(title: string): string {
  return title.replace(/^(school\s*|hot\s*)?(lunch|dîner|diner)\s*(menu)?\s*[:\-–—]\s*/i, '').trim() || title;
}
export default function SchoolLunch(props: PluginComponentProps & { events?: Ev[]; people?: { name: string; sourceIds?: string[] }[] }) {
  const { config, style } = props; const tz = props.timezone;
  const now = useNow(60000);
  const accent = String(config.accentColor || '#db2777');
  let re: RegExp; try { re = new RegExp(String(config.match || 'lunch'), 'i'); } catch { re = /lunch/i; }
  const person = String(config.personName ?? '').trim().toLowerCase();
  const ids = person ? (props.people ?? []).find((p) => p.name.toLowerCase() === person)?.sourceIds ?? [] : null;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(now));
  const fromDay = dayKey(new Date(now.getTime() + (hour >= Number(config.switchHour ?? 14) ? 86400000 : 0)), tz);
  const lunches = ((props.events ?? []) as Ev[]).filter((e) => re.test(e.title) && !/review/i.test(e.title) && (!ids || (e.sourceId && ids.includes(e.sourceId))))
    .map((e) => ({ ...e, day: dayKey(new Date(e.allDay ? e.start.slice(0, 10) + 'T12:00:00' : e.start), tz) }))
    .filter((e) => e.day >= fromDay).sort((a, b) => a.day.localeCompare(b.day));
  // One lunch per day; a hot lunch you ordered wins over the menu entry for that day.
  const ordered = (t: string) => /^hot\s*lunch/i.test(t);
  const pickDay = new Map<string, typeof lunches[number]>();
  for (const l of lunches) { const cur = pickDay.get(l.day); if (!cur || (ordered(l.title) && !ordered(cur.title))) pickDay.set(l.day, l); }
  const byDay = Array.from(pickDay.values()).slice(0, Number(config.days ?? 5));
  const shortDate = (d: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
  const label = (d: string) => d === dayKey(now, tz) ? 'Today' : d === dayKey(new Date(now.getTime() + 86400000), tz) ? 'Tomorrow' : new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(d + 'T12:00:00'));
  const [first, ...rest] = byDay;
  const badge = (t: string) => ordered(t) ? <span style={{ fontSize: '0.55em', fontWeight: 700, letterSpacing: '0.06em', padding: '0.15em 0.5em', borderRadius: '0.4em', background: `color-mix(in srgb, ${accent} 22%, transparent)`, color: accent, whiteSpace: 'nowrap' }}>ORDERED</span> : null;
  return (
    <div style={frame(style)}>
      {!first ? (
        <div style={{ margin: 'auto', display: 'flex', alignItems: 'center', gap: '0.6em', opacity: 0.4 }}><Icon d={I.utensils} size="1.6em" stroke={1.5} /><span style={{ fontSize: '0.85em' }}>No school lunch on the calendar — pack a lunch!</span></div>
      ) : (
        <Fit max={1.6} min={0.5}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5em 1.2em' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7em', minWidth: 0, flex: '1 1 14em' }}>
              <div style={{ width: '2.6em', height: '2.6em', borderRadius: '50%', background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon d={I.utensils} size="1.3em" stroke={1.8} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...caps, display: 'flex', alignItems: 'center', gap: '0.5em' }}>{label(first.day)} · {shortDate(first.day)} {badge(first.title)}</div>
                <div style={{ fontSize: '1.45em', fontWeight: 600, lineHeight: 1.15, ...clampLines(2) }}>{dish(first.title)}</div>
              </div>
            </div>
            {rest.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35em', flexWrap: 'wrap', flex: '1 1 16em', minWidth: 0 }}>
                {rest.map((l) => (
                  <div key={l.id} style={{ padding: '0.3em 0.65em', borderRadius: '0.5em', background: ordered(l.title) ? `color-mix(in srgb, ${accent} 14%, transparent)` : ink(style, 0.06), fontSize: '0.72em', whiteSpace: 'nowrap' }}>
                    <span style={{ opacity: 0.55 }}>{shortDate(l.day)} · </span><span style={{ fontWeight: 500 }}>{dish(l.title)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Fit>
      )}
    </div>
  );
}
