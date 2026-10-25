import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, Icon, wxIcon, useNow, fmtTime, dayKey, useBox } from './ui';
import { Overlay, WeatherPopup } from './wxpop';

type Ev = { id: string; title: string; start: string; end: string; allDay: boolean; sourceId?: string; calendarColor?: string; location?: string };
type Props = PluginComponentProps & { events?: Ev[]; hourly?: any[]; forecast?: any[]; people?: { name: string; sourceIds?: string[] }[]; timeFormat?: string; units?: string };

/** "" today · "Tomorrow" · "Thu" within the week · "Thu, Oct 8" further out — so "Thu" never means next week. */
export function whenLabel(start: Date, now: Date, tz?: string): string {
  const k = (d: Date) => dayKey(d, tz);
  if (k(start) === k(now)) return '';
  const days = Math.round((Date.parse(k(start)) - Date.parse(k(now))) / 86400000);
  if (days === 1) return 'Tomorrow';
  const wd = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: tz }).format(start);
  if (days > 1 && days < 7) return wd;
  return `${wd}, ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: tz }).format(start)}`;
}

export default function HeroHeader(props: Props) {
  const { config, style } = props; const tz = props.timezone; const tf = props.timeFormat;
  const now = useNow(15000);
  const [box, size] = useBox<HTMLDivElement>();
  const fs = Number(style?.fontSize) || 18;
  // Slim layout when the block is short: everything on one band.
  const slim = config.layout === 'slim' || (config.layout !== 'tall' && size.h > 0 && size.h < fs * 11);
  const accent = String(config.accentColor || '#b45309');
  const name = String(config.name ?? '').trim();
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(now));
  const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
  const greeting = name ? `${part}, ${name}` : part;
  const time = fmtTime(now, tz, tf);
  const [hm, ampm] = time.split(/\s(?=[AP]M$)/i);
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }).format(now);

  const hourly = (props.hourly ?? []) as any[]; const fc = (props.forecast ?? []) as any[];
  const cur = hourly.find((x) => new Date(x.time).getTime() >= now.getTime() - 3600000) ?? hourly[0];
  const today = fc.find((d) => d.date === dayKey(now, tz)) ?? fc[0];
  const deg = props.units === 'imperial' ? '°F' : '°';
  const night = h < 6 || h >= 20;
  const canPop = config.weatherPopup !== false;
  const [wxOpen, setWxOpen] = React.useState(false);
  const closeWx = React.useCallback(() => setWxOpen(false), []);

  const person = String(config.personName ?? '').trim().toLowerCase();
  const ids = person ? (props.people ?? []).find((p) => p.name.toLowerCase() === person)?.sourceIds ?? [] : null;
  const next = ((props.events ?? []) as Ev[]).filter((e) => !e.allDay && new Date(e.end).getTime() > now.getTime() && (!ids || (e.sourceId && ids.includes(e.sourceId))))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  const nextNow = next && new Date(next.start).getTime() <= now.getTime();
  const nextWhen = next ? [whenLabel(new Date(next.start), now, tz), fmtTime(new Date(next.start), tz, tf)].filter(Boolean).join(' · ') : '';

  const chip = config.showNext !== false && next && (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', padding: '0.45em 0.9em', borderRadius: '999px', background: ink(style, 0.06), fontSize: '0.95em', minWidth: 0, maxWidth: slim ? '100%' : '55%' }}>
      <span style={{ width: '0.55em', height: '0.55em', borderRadius: '50%', background: next.calendarColor || accent, flexShrink: 0 }} />
      <span style={{ opacity: 0.55, whiteSpace: 'nowrap' }}>{nextNow ? 'Now' : 'Next'} · {nextWhen}</span>
      <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next.title}</span>
    </div>
  );
  const weather = (big: boolean) => config.showWeather !== false && cur && (
    <div onClick={canPop ? (ev) => { ev.stopPropagation(); setWxOpen(true); } : undefined} role={canPop ? 'button' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5em', flexShrink: 0, cursor: canPop ? 'pointer' : undefined }}>
      <Icon d={wxIcon(cur.icon + ' ' + cur.description, night)} size={big ? '4.2em' : '3em'} stroke={1.4} style={{ opacity: 0.8 }} />
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontSize: big ? '3.4em' : '2.5em', fontWeight: 300 }}>{Math.round(cur.temp)}{deg}</div>
        <div style={{ fontSize: '0.9em', opacity: 0.5, whiteSpace: 'nowrap' }}>{today ? `H ${Math.round(today.high)}° · L ${Math.round(today.low)}°` : cur.description}</div>
      </div>
    </div>
  );

  const popup = canPop && wxOpen && (
    <Overlay onClose={closeWx} style={style}>
      <WeatherPopup hourly={hourly} forecast={fc} now={now} tz={tz} tf={tf} deg={deg} accent={accent} style={style} onClose={closeWx} />
    </Overlay>
  );

  if (slim) {
    return (
      <div ref={box} style={frame(style, { flexDirection: 'row', alignItems: 'center', gap: '1.2em' })}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2em', lineHeight: 0.95, flexShrink: 0 }}>
          <span style={{ fontSize: '4.4em', fontWeight: 300, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{hm}</span>
          {ampm && <span style={{ fontSize: '1.3em', fontWeight: 400, opacity: 0.45 }}>{ampm}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
          <div style={{ fontSize: '1.55em', fontWeight: 500, color: accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{greeting}</div>
          {chip || <div style={{ fontSize: '1.05em', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{date}</div>}
        </div>
        {weather(false)}
        {popup}
      </div>
    );
  }
  return (
    <div ref={box} style={frame(style, { justifyContent: 'center', gap: '0.5em' })}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1em' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25em', lineHeight: 0.95 }}>
            <span style={{ fontSize: '6em', fontWeight: 300, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{hm}</span>
            {ampm && <span style={{ fontSize: '1.6em', fontWeight: 400, opacity: 0.45 }}>{ampm}</span>}
          </div>
          <div style={{ fontSize: '1.3em', opacity: 0.6, marginTop: '0.35em' }}>{date}</div>
        </div>
        {weather(true)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1em', marginTop: '0.3em' }}>
        <div style={{ fontSize: '1.9em', fontWeight: 500, color: accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{greeting}</div>
        {chip}
      </div>
      {popup}
    </div>
  );
}
