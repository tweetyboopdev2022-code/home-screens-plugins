// Family Calendar — day columns or a month grid where titles WRAP instead of being cut off.
// Sam's "Day 3 · Phys. Ed, …" events become a small "Day 3" badge in the day header.
import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, useNow, dayKey, fmtTime, useBox } from './ui';
import { Ev, schoolDay, iconFor, tidyTitle, isOff, dayKeysOf, addDaysKey, dowOf } from './logic';
import { homeDaily, pointAt, geocode, wmo, DayWx, PointWx } from './weather';

type Person = { name: string; color?: string; sourceIds?: string[] };
type Meta = { people: Person[] };
let metaCache: { at: number; v: Meta } | null = null;
const evCache = new Map<string, { at: number; v: Ev[] }>();

async function loadMeta(): Promise<Meta> {
  if (metaCache && Date.now() - metaCache.at < 600000) return metaCache.v;
  const c = await fetch('/api/config').then((r) => r.json());
  let people = (c.settings?.calendar?.people ?? []) as Person[];
  // Newer Home Screens: people live in /api/family, their calendars in settings.calendar.personSources[id].
  if (!people.length) {
    try {
      const f = await fetch('/api/family').then((r) => r.json());
      const src = (c.settings?.calendar?.personSources ?? {}) as Record<string, string[]>;
      people = (f.members ?? []).map((m: any) => ({ name: m.name, color: m.color, sourceIds: src[m.id] ?? [] }));
    } catch { /* no people → everything shows, no filter buttons */ }
  }
  const v = { people };
  metaCache = { at: Date.now(), v }; return v;
}
async function loadEvents(from: string, to: string, fresh = false): Promise<Ev[]> {
  const url = `/api/calendar?timeMin=${encodeURIComponent(from + 'T00:00:00')}&timeMax=${encodeURIComponent(to + 'T23:59:59')}`;
  const hit = evCache.get(url);
  if (!fresh && hit && Date.now() - hit.at < 240000) return hit.v;
  const j = await fetch(url).then((r) => r.json());
  const v: Ev[] = Array.isArray(j) ? j : j.events ?? [];
  evCache.set(url, { at: Date.now(), v }); return v;
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function FamilyCalendar({ config, style, timezone: tz, ...rest }: PluginComponentProps & { timeFormat?: string }) {
  const tf = (rest as any).timeFormat;
  const hs = (window as any).__HS_SDK__?.getHostSettings?.() ?? {};
  const lat = Number((rest as any).latitude ?? hs.latitude); const lon = Number((rest as any).longitude ?? hs.longitude);
  const zone = tz || hs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const showWx = config.showWeather !== false && Number.isFinite(lat) && Number.isFinite(lon);
  const now = useNow(60000);
  const today = dayKey(now, tz);
  const view = String(config.view ?? 'columns');
  const nDays = Math.max(1, Math.min(14, Number(config.days ?? 5)));
  const nWeeks = Math.max(1, Math.min(6, Number(config.weeks ?? 5)));
  const weekStart = Number(config.weekStart ?? 0);
  const accent = String(config.accentColor || '#f5c37e');
  const want = String(config.calendars ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const hideDayEvents = config.schoolDayBadge !== false;

  // Visible range
  const start = view === 'month' ? addDaysKey(today, -((dowOf(today) - weekStart + 7) % 7)) : today;
  const count = view === 'month' ? nWeeks * 7 : nDays;
  const days = Array.from({ length: count }, (_, i) => addDaysKey(start, i));
  const end = days[days.length - 1];

  const [meta, setMeta] = React.useState<Meta | null>(metaCache?.v ?? null);
  const [events, setEvents] = React.useState<Ev[] | null>(null);
  const [err, setErr] = React.useState(false);
  const tick = Math.floor(now.getTime() / 300000);
  React.useEffect(() => { let dead = false; (async () => {
    try {
      const [m, ev] = await Promise.all([loadMeta(), loadEvents(addDaysKey(start, -1), addDaysKey(end, 1))]);
      if (!dead) { setMeta(m); setEvents(ev); setErr(false); }
    } catch { if (!dead) setErr(true); }
  })(); return () => { dead = true; }; }, [start, end, tick]);

  const [wx, setWx] = React.useState<Map<string, DayWx> | null>(null);
  const wxTick = Math.floor(now.getTime() / 1800000);
  React.useEffect(() => { if (!showWx) return; let dead = false;
    homeDaily(lat, lon, zone).then((m) => { if (!dead) setWx(m); }).catch(() => {});
    return () => { dead = true; }; }, [showWx, lat, lon, zone, wxTick]);
  const [dayOpen, setDayOpen] = React.useState<string | null>(null);
  // Warm the location weather in the background so a tapped day shows it straight away.
  React.useEffect(() => {
    if (!showWx || !events) return;
    const soon = events.filter((e) => e.location && Date.parse(e.start) < Date.now() + 15 * 86400000 && Date.parse(e.end || e.start) > Date.now() - 3600000);
    (async () => { for (const e of soon) { const g = await geocode(e.location!).catch(() => null); if (g) pointAt(g.lat, g.lon, zone, new Date(e.start)).catch(() => {}); } })();
  }, [showWx, events, zone]);
  React.useEffect(() => { if (!dayOpen) return; const t = setTimeout(() => setDayOpen(null), 90000); return () => clearTimeout(t); }, [dayOpen]);

  // Person/colour per source
  const people = meta?.people ?? [];
  const personOf = (sid?: string) => people.find((p) => (p.sourceIds ?? []).includes(sid ?? ''));
  const colorOf = (e: Ev) => personOf(e.sourceId)?.color || e.calendarColor || accent;
  const matches = (e: Ev, w: string) => {
    const p = personOf(e.sourceId)?.name?.toLowerCase();
    const sid = String(e.sourceId ?? '').toLowerCase();
    return w === sid || w === p || (w === 'family' && sid.startsWith('family')) || (w === 'holidays' && sid === 'holidays');
  };
  // Tap a name in the legend to see only that calendar; resets by itself after a few minutes.
  const [only, setOnly] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Ev | null>(null);
  React.useEffect(() => { if (!open) return; const t = setTimeout(() => setOpen(null), 45000); return () => clearTimeout(t); }, [open]);
  React.useEffect(() => { if (!only) return; const t = setTimeout(() => setOnly(null), 180000); return () => clearTimeout(t); }, [only]);
  const allowed = (e: Ev) => (!want.length || want.some((w) => matches(e, w))) && (!only || matches(e, only));

  // Bucket by day
  const byDay = new Map<string, Ev[]>(); const badge = new Map<string, number>(); const off = new Set<string>();
  for (const e of (events ?? []).filter(allowed)) {
    const sd = schoolDay(e.title);
    for (const k of dayKeysOf(e, (d) => dayKey(d, tz))) {
      if (k < start || k > end) continue;
      if (sd != null && hideDayEvents) { badge.set(k, sd); continue; }
      if (isOff(e.title)) off.add(k);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
    }
  }
  const badgeAll = new Map<string, number>();
  for (const e of (events ?? []).filter(allowed)) { const sd = schoolDay(e.title); if (sd != null) for (const k of dayKeysOf(e, (d) => dayKey(d, tz))) badgeAll.set(k, sd); }
  const allDayEvents = (k: string) => (events ?? []).filter(allowed).filter((e) => !(schoolDay(e.title) != null && hideDayEvents) && dayKeysOf(e, (d) => dayKey(d, tz)).includes(k))
    .sort((a, b) => (a.allDay === b.allDay ? +new Date(a.start) - +new Date(b.start) : a.allDay ? -1 : 1));
  for (const [, l] of byDay) l.sort((a, b) => (a.allDay === b.allDay ? +new Date(a.start) - +new Date(b.start) : a.allDay ? -1 : 1));

  const chips = [
    ...people.filter((p) => !want.length || want.includes(p.name.toLowerCase())).map((p) => ({ key: p.name.toLowerCase(), label: p.name, color: p.color || accent })),
    ...(!want.length || want.includes('family') ? [{ key: 'family', label: 'Family', color: (events ?? []).find((e) => String(e.sourceId).startsWith('family'))?.calendarColor || '#9ca3af' }] : []),
  ];
  const chip = (key: string | null, label: string, color?: string) => {
    const on = key === null ? only === null : only === key;
    return (
      <button key={label} onClick={() => setOnly(key === null || on ? null : key)} style={{ appearance: 'none', font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4em',
        padding: '0.3em 0.8em', borderRadius: '999px', border: `0.1em solid ${on ? (color || accent) : 'transparent'}`, color: 'inherit',
        background: on ? `color-mix(in srgb, ${color || accent} 22%, transparent)` : ink(style, 0.06), opacity: only && !on ? 0.6 : 1, fontWeight: on ? 700 : 500 }}>
        {color && <span style={{ width: '0.65em', height: '0.65em', borderRadius: '50%', background: color }} />}{label}
      </button>
    );
  };
  const legend = config.showLegend !== false && chips.length > 1 && (
    <div style={{ display: 'flex', gap: '0.4em', flexWrap: 'wrap', fontSize: '0.66em', marginBottom: '0.5em' }}>
      {chip(null, 'All')}{chips.map((c) => chip(c.key, c.label, c.color))}
    </div>
  );

  const pill = (e: Ev, lines: number, size: string) => {
    const col = colorOf(e); const icon = iconFor(e.title, e.sourceId);
    const time = e.allDay ? '' : fmtTime(new Date(e.start), tz, tf).replace(':00', '').replace(/\s?([AP])M/i, (_, x) => x.toLowerCase());
    return (
      <div key={e.id + e.start} onClick={(ev) => { ev.stopPropagation(); setOpen(e); }} style={{ cursor: 'pointer', display: 'flex', gap: '0.3em', alignItems: 'flex-start', padding: '0.28em 0.4em', borderRadius: '0.4em', fontSize: size, lineHeight: 1.2,
        background: e.allDay ? `color-mix(in srgb, ${col} 20%, transparent)` : 'transparent', borderLeft: `0.22em solid ${col}` }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', wordBreak: 'normal', overflowWrap: 'anywhere' } as React.CSSProperties}>
          {icon && <span style={{ marginRight: '0.25em' }}>{icon}</span>}{time && <b style={{ fontWeight: 700, opacity: 0.8 }}>{time} </b>}{tidyTitle(e.title)}
        </span>
      </div>
    );
  };

  const header = (k: string, big: boolean) => {
    const isToday = k === today; const d = new Date(k + 'T12:00:00Z'); const b = badge.get(k); const w = showWx ? wx?.get(k) : undefined;
    return (
      <div onClick={(ev) => { ev.stopPropagation(); setDayOpen(k); }} style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', rowGap: '0.2em', alignItems: 'baseline', gap: '0.35em', padding: big ? '0.35em 0.45em' : '0.2em 0.3em', borderRadius: '0.45em',
        background: isToday ? `color-mix(in srgb, ${accent} 26%, transparent)` : off.has(k) ? ink(style, 0.1) : 'transparent', marginBottom: '0.25em' }}>
        {big && <span style={{ fontSize: '0.72em', fontWeight: 600, opacity: isToday ? 1 : 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.15em' }}>{isToday ? 'Today' : WD[d.getUTCDay()]}</span>}
        <span style={{ fontSize: big ? '0.9em' : '0.72em', fontWeight: 700, color: isToday ? accent : undefined }}>{d.getUTCDate() === 1 && !big ? new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(d) + ' ' : ''}{d.getUTCDate()}</span>
        {b != null && <span style={{ fontSize: big ? '0.6em' : '0.55em', fontWeight: 700, padding: '0.1em 0.45em', borderRadius: '999px', background: ink(style, 0.12), whiteSpace: 'nowrap' }}>Day {b}</span>}
        {w && <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.15em', fontSize: big ? '0.66em' : '0.55em', fontWeight: 600, whiteSpace: 'nowrap', opacity: 0.9 }}>
          <span style={{ fontSize: '1.25em', lineHeight: 1 }}>{wmo(w.code).icon}</span>{Math.round(w.hi)}°{big && <span style={{ opacity: 0.5, fontWeight: 500 }}>/{Math.round(w.lo)}°</span>}
        </span>}
      </div>
    );
  };

  return (
    <div style={frame(style, { gap: 0, position: 'relative' })}>
      {legend}
      {err && !events ? <div style={{ margin: 'auto', opacity: 0.5, fontSize: '0.8em' }}>Calendar unavailable right now</div>
        : view === 'month' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: `auto repeat(${nWeeks}, minmax(0, 1fr))`, gap: '0.3em' }}>
            {Array.from({ length: 7 }, (_, i) => <div key={i} style={{ textAlign: 'center', fontSize: '0.6em', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{WD[(weekStart + i) % 7]}</div>)}
            {days.map((k) => (
              <Cell key={k} past={k < today} style={style}>
                {header(k, false)}
                {(byDay.get(k) ?? []).map((e) => pill(e, 2, '0.62em'))}
              </Cell>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${nDays}, minmax(0, 1fr))`, gap: '0.45em' }}>
            {days.map((k) => (
              <Cell key={k} past={false} style={style} column>
                {header(k, true)}
                {(byDay.get(k) ?? []).map((e) => pill(e, 3, nDays > 5 ? '0.66em' : '0.74em'))}
                {!(byDay.get(k) ?? []).length && <div style={{ fontSize: '0.62em', opacity: 0.3, padding: '0.3em' }}>{off.has(k) ? '' : 'Nothing planned'}</div>}
              </Cell>
            ))}
          </div>
        )}
      {dayOpen && (
        <DaySheet k={dayOpen} today={today} events={allDayEvents(dayOpen)} badge={badgeAll.get(dayOpen)} wx={wx?.get(dayOpen)} style={style} accent={accent} tz={zone} tf={tf}
          colorOf={colorOf} onEvent={(e) => setOpen(e)} onClose={() => setDayOpen(null)} home={showWx ? { lat, lon } : null} />
      )}
      {open && (() => {
        const e = open; const col = colorOf(e); const who = personOf(e.sourceId)?.name;
        const d0 = new Date(e.allDay ? e.start.slice(0, 10) + 'T12:00:00Z' : e.start);
        const dateTxt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: e.allDay ? 'UTC' : tz }).format(d0);
        const timeTxt = e.allDay ? 'All day' : `${fmtTime(new Date(e.start), tz, tf)} – ${fmtTime(new Date(e.end), tz, tf)}`;
        return (
          <Overlay onClose={() => setOpen(null)} z={7} style={style}>
            <div onClick={(ev) => ev.stopPropagation()} style={{ width: 'min(92%, 32em)', maxHeight: '88%', overflow: 'auto', background: style.backgroundColor || '#1c1b1a', color: style.textColor, borderRadius: '1em', padding: '1em 1.2em', borderTop: `0.35em solid ${col}`, boxShadow: '0 1em 3em rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6em' }}>
                <div style={{ flex: 1, fontSize: '1.15em', fontWeight: 700, lineHeight: 1.25 }}>{iconFor(e.title, e.sourceId)} {e.title}</div>
                <button onClick={() => setOpen(null)} aria-label="Close" style={{ appearance: 'none', border: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', background: ink(style, 0.08), borderRadius: '999px', width: '1.8em', height: '1.8em', flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ marginTop: '0.5em', fontSize: '0.85em', opacity: 0.8 }}>{dateTxt} · {timeTxt}</div>
              {(who || e.sourceName) && <div style={{ marginTop: '0.25em', fontSize: '0.75em', display: 'flex', alignItems: 'center', gap: '0.4em', opacity: 0.7 }}><span style={{ width: '0.6em', height: '0.6em', borderRadius: '50%', background: col }} />{who || e.sourceName}</div>}
              {e.location && <div style={{ marginTop: '0.6em', fontSize: '0.85em' }}>📍 {e.location}</div>}
              {e.description && <div style={{ marginTop: '0.7em', fontSize: '0.8em', whiteSpace: 'pre-wrap', lineHeight: 1.4, opacity: 0.85 }}>{e.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}</div>}
            </div>
          </Overlay>
        );
      })()}
    </div>
  );
}

/** A day box that shows as many events as fit and a "+N more" line for the rest. */
function Cell({ children, past, style, column }: { children: React.ReactNode; past: boolean; style: any; column?: boolean }) {
  const [box, size] = useBox<HTMLDivElement>();
  const [hidden, setHidden] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const kids = Array.from(el.children).filter((c) => !(c as HTMLElement).dataset.more) as HTMLElement[];
    kids.forEach((c) => { c.style.display = ''; });
    const limit = el.clientHeight - 16; let n = 0;
    for (let i = kids.length - 1; i > 0; i--) {   // never hide the header (index 0)
      const c = kids[i];
      if (c.offsetTop + c.offsetHeight > limit) { c.style.display = 'none'; n++; } else break;
    }
    setHidden(n);
  });
  return (
    <div ref={box} style={{ position: 'relative', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.22em', padding: column ? '0.35em' : '0.25em',
      borderRadius: '0.6em', background: ink(style, column ? 0.035 : 0.03), opacity: past ? 0.45 : 1 }} data-size={size.h}>
      {children}
      {hidden > 0 && <div data-more="1" style={{ position: 'absolute', bottom: '0.15em', right: '0.4em', fontSize: '0.55em', fontWeight: 600, opacity: 0.6 }}>+{hidden} more</div>}
    </div>
  );
}

/** Full view of one day: weather, every event, and the weather where each event happens. */
function DaySheet({ k, today, events, badge, wx, style, accent, tz, tf, colorOf, onEvent, onClose, home }: {
  k: string; today: string; events: Ev[]; badge?: number; wx?: DayWx; style: any; accent: string; tz: string; tf?: string;
  colorOf: (e: Ev) => string; onEvent: (e: Ev) => void; onClose: () => void; home: { lat: number; lon: number } | null;
}) {
  const [spot, setSpot] = React.useState<Record<string, { wx: PointWx | null; town: string }>>({});
  React.useEffect(() => {
    if (!home) return; let dead = false;
    events.forEach(async (e) => {
      const when = new Date(e.allDay ? e.start.slice(0, 10) + 'T12:00:00' : e.start);
      if (when.getTime() < Date.now() - 3 * 3600000 || when.getTime() > Date.now() + 15.5 * 86400000) return;
      if (!e.location && e.allDay) return;   // all-day at home: the day's weather above covers it
      let place: { lat: number; lon: number } = home; let town = '';
      if (e.location) { const g = await geocode(e.location).catch(() => null); if (g) { place = g; town = g.town; } else town = 'near home'; }
      const p = await pointAt(place.lat, place.lon, tz, when).catch(() => null);
      if (!dead) setSpot((m) => ({ ...m, [e.id + e.start]: { wx: p, town } }));
    });
    return () => { dead = true; };
  }, [k, events.map((e) => e.id).join('|'), home?.lat, home?.lon]);  // eslint-disable-line react-hooks/exhaustive-deps

  const d = new Date(k + 'T12:00:00Z');
  const title = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
  const rel = k === today ? 'Today' : k === addDaysKey(today, 1) ? 'Tomorrow' : '';
  const w = wx ? wmo(wx.code) : null;
  const tfmt = (e: Ev) => e.allDay ? 'All day' : fmtTime(new Date(e.start), tz, tf);
  return (
    <Overlay onClose={onClose} z={6} style={style}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ width: 'min(92%, 36em)', maxHeight: '90%', overflow: 'auto', background: style.backgroundColor || '#1c1b1a', color: style.textColor, borderRadius: '1em', padding: '1em 1.2em', borderTop: `0.35em solid ${accent}`, boxShadow: '0 1em 3em rgba(0,0,0,0.5)', scrollbarWidth: 'none' } as React.CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6em' }}>
          <div style={{ flex: 1 }}>
            {rel && <div style={{ fontSize: '0.65em', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>{rel}</div>}
            <div style={{ fontSize: '1.2em', fontWeight: 700 }}>{title}{badge != null && <span style={{ marginLeft: '0.5em', fontSize: '0.55em', verticalAlign: 'middle', padding: '0.15em 0.55em', borderRadius: '999px', background: ink(style, 0.12) }}>Day {badge}</span>}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ appearance: 'none', border: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', background: ink(style, 0.08), borderRadius: '999px', width: '1.8em', height: '1.8em', flexShrink: 0 }}>✕</button>
        </div>
        {w && wx && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em', marginTop: '0.6em', padding: '0.5em 0.7em', borderRadius: '0.7em', background: ink(style, 0.06) }}>
            <span style={{ fontSize: '1.8em', lineHeight: 1 }}>{w.icon}</span>
            <div style={{ lineHeight: 1.2 }}><div style={{ fontWeight: 700 }}>{Math.round(wx.hi)}° / {Math.round(wx.lo)}°</div><div style={{ fontSize: '0.75em', opacity: 0.7 }}>{w.label} at home{wx.pop >= 20 ? ` · 💧 ${Math.round(wx.pop)}%` : ''}</div></div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45em', marginTop: '0.8em' }}>
          {!events.length && <div style={{ opacity: 0.5, fontSize: '0.85em', padding: '0.5em 0' }}>Nothing on the calendar.</div>}
          {events.map((e) => {
            const col = colorOf(e); const sp = spot[e.id + e.start]; const pw = sp?.wx ? wmo(sp.wx.code) : null;
            return (
              <div key={e.id + e.start} onClick={() => onEvent(e)} style={{ cursor: 'pointer', display: 'flex', gap: '0.6em', alignItems: 'center', padding: '0.5em 0.6em', borderRadius: '0.6em', background: ink(style, 0.05), borderLeft: `0.25em solid ${col}` }}>
                <div style={{ width: '4.2em', flexShrink: 0, fontSize: '0.8em', fontWeight: 700, opacity: 0.8 }}>{tfmt(e)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, lineHeight: 1.25 }}>{iconFor(e.title, e.sourceId)} {tidyTitle(e.title)}</div>
                  {e.location && <div style={{ fontSize: '0.72em', opacity: 0.65, marginTop: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {e.location}</div>}
                </div>
                {pw && sp?.wx && (
                  <div style={{ flexShrink: 0, textAlign: 'right', lineHeight: 1.15 }}>
                    <div style={{ fontWeight: 700 }}><span style={{ marginRight: '0.2em' }}>{pw.icon}</span>{Math.round(sp.wx.temp)}°</div>
                    <div style={{ fontSize: '0.62em', opacity: 0.6 }}>{sp.town || (e.location ? '' : 'home')}{sp.wx.pop >= 30 ? ` · 💧${Math.round(sp.wx.pop)}%` : ''}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Overlay>
  );
}

/** Pop-up layer. On the wall it covers the WHOLE screen (portal into the display canvas, bigger text);
 *  anywhere else (editor preview) it covers just this block. */
function Overlay({ children, onClose, z, style }: { children: React.ReactNode; onClose: () => void; z: number; style: any }) {
  const anchor = React.useRef<HTMLSpanElement>(null);
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    // The screen root (1080×1920, carries the wall's scaling/rotation) is the parent of our module box.
    if (/\/editor/.test(location.pathname)) return;
    const screen = (anchor.current?.closest('[data-module-type]') as HTMLElement | null)?.parentElement ?? null;
    if (screen && screen.offsetHeight > 600 && (window as any).ReactDOM?.createPortal) setHost(screen);
  }, []);
  const fs = Math.max(24, (Number(style?.fontSize) || 18) * 1.45);
  const layer = (full: boolean) => (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: full ? 10000 : z,
      borderRadius: full ? 0 : 'inherit', ...(full ? { fontSize: fs, fontFamily: style?.fontFamily, color: style?.textColor } : {}) }}>
      {children}
    </div>
  );
  return (
    <>
      <span ref={anchor} style={{ display: 'none' }} />
      {host ? (window as any).ReactDOM.createPortal(layer(true), host) : layer(false)}
    </>
  );
}
