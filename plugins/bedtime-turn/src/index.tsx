import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, caps, useNow, dayKey, localHM, Fit, useBox } from './ui';
import { parseRotation, whoOn, toggleSwap, eveningOf, addDays, nextTurns } from './rotation';
import { useRotationSettings, saveSwaps } from './store';

const MOON = 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z';
const Moon = ({ size = '1em' }: { size?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={MOON} /></svg>
);

function colorMap(spec: string): Record<string, string> {
  const m: Record<string, string> = {};
  String(spec || '').split(',').forEach((p) => { const [n, c] = p.split(':').map((x) => x.trim()); if (n && c) m[n.toLowerCase()] = c; });
  return m;
}
const isLightText = (c?: string) => { const h = String(c || '').replace('#', ''); if (h.length < 6) return false; const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return (0.299 * r + 0.587 * g + 0.114 * b) > 150; };
const wd = (d: string, long = false) => new Intl.DateTimeFormat(undefined, { weekday: long ? 'long' : 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

export default function BedtimeTurn({ config, style, timezone: tz }: PluginComponentProps) {
  const now = useNow(60000);
  const settings = useRotationSettings();
  const r = parseRotation(settings);
  const [busy, setBusy] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [box, size] = useBox<HTMLDivElement>();
  const fs = Number(style?.fontSize) || 18;
  const narrow = size.w > 0 && size.w < fs * 20;
  const dark = isLightText(style?.textColor);
  const colors = colorMap(String(settings?.colors ?? ''));
  const col = (p: string) => { const c = colors[p.toLowerCase()] || String(config.accentColor || '#7c3aed'); return dark ? `color-mix(in srgb, ${c} 55%, white)` : c; };
  const view = String(config.view || 'tonight');
  const me = String(config.me || '').trim().toLowerCase();
  const child = String(config.child || '').trim();
  const allowSwap = config.allowSwap !== false;

  if (!r) {
    return <div ref={box} style={frame(style, { alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0.55, gap: '0.4em' })}>
      <Moon size="1.8em" /><div style={{ fontSize: '0.8em' }}>Set up the rotation in Plugins → bedtime-turn → Settings</div></div>;
  }

  const today = dayKey(now, tz);
  const evening = eveningOf(today, localHM(now, tz), 5);
  const t = whoOn(r, evening);
  const coming = nextTurns(r, addDays(evening, 1), 7);
  const nextChange = coming.find((x) => x.person !== t.person);
  const changeRun = nextChange ? coming.filter((x, i) => i >= coming.indexOf(nextChange) && x.person === nextChange.person).slice(0, r.nightsEach) : [];

  const swap = async () => {
    if (!allowSwap || busy) return;
    setBusy(true);
    await saveSwaps(toggleSwap(r, evening, today));
    setBusy(false);
  };
  const tapProps = allowSwap ? {
    onClick: swap, onPointerDown: () => setPressed(true), onPointerUp: () => setPressed(false), onPointerLeave: () => setPressed(false),
    style: { cursor: 'pointer' as const },
  } : {};

  const headline = child ? `${t.person} is putting you to bed`
    : me && me === t.person.toLowerCase() ? "You're on bedtime tonight"
    : me ? `${t.person}'s on bedtime — you're off`
    : t.person;
  const sub = t.swapped ? `Swapped with ${t.scheduled} tonight` : `Night ${t.night} of ${r.nightsEach}`;
  const nextLine = nextChange ? `${nextChange.person}: ${changeRun.map((x) => wd(x.date)).join(' & ')}` : '';

  const avatar = (p: string, size: string) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `color-mix(in srgb, ${col(p)} 18%, transparent)`, color: col(p), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
      <span style={{ fontSize: `calc(${size} * 0.45)` }}>{p.charAt(0).toUpperCase()}</span>
    </div>
  );

  if (view === 'compact') {
    return (
      <div ref={box} {...tapProps} style={{ ...frame(style, { justifyContent: 'center' }), ...(tapProps.style ?? {}), transform: pressed ? 'scale(0.98)' : undefined, transition: 'transform .1s' }}>
        <Fit max={1.8}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7em' }}>
            <span style={{ color: col(t.person), display: 'flex' }}><Moon size="1.4em" /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{child || me ? headline : <>Bedtime: <span style={{ color: col(t.person) }}>{t.person}</span></>}</div>
              <div style={{ fontSize: '0.7em', opacity: 0.55 }}>{sub}{nextLine ? ` · Next ${nextLine}` : ''}</div>
            </div>
            {t.swapped && <span style={{ fontSize: '0.6em', fontWeight: 600, padding: '0.2em 0.6em', borderRadius: 99, background: ink(style, 0.08) }}>SWAPPED</span>}
          </div>
        </Fit>
      </div>
    );
  }

  return (
    <div ref={box} {...tapProps} style={{ ...frame(style), ...(tapProps.style ?? {}), transform: pressed ? 'scale(0.985)' : undefined, transition: 'transform .1s' }}>
      <Fit max={1.9} min={0.55}>
        <div style={{ ...caps, display: 'flex', alignItems: 'center', gap: '0.5em', color: col(t.person), opacity: 1 }}><Moon size="1.3em" />Bedtime tonight</div>
        <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'flex-start' : 'center', gap: narrow ? '0.5em' : '0.8em', marginTop: '0.5em' }}>
          {avatar(t.person, '3.2em')}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: child || me ? '1.35em' : '1.9em', fontWeight: 650, lineHeight: 1.1, color: child || me ? undefined : col(t.person) }}>{headline}</div>
            <div style={{ fontSize: '0.78em', opacity: 0.6, marginTop: '0.2em' }}>
              {sub}{t.swapped && allowSwap ? ' · tap to undo' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.35em', marginTop: '0.9em' }}>
          {coming.slice(0, narrow ? 4 : 6).map((x) => (
            <div key={x.date} style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '0.35em 0.1em', borderRadius: '0.6em', background: `color-mix(in srgb, ${col(x.person)} ${x.swapped ? 22 : 11}%, transparent)` }}>
              <div style={{ fontSize: '0.6em', opacity: 0.6, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{wd(x.date)}</div>
              <div style={{ fontSize: '0.8em', fontWeight: 600, color: col(x.person), whiteSpace: 'nowrap' }}>{x.person}</div>
            </div>
          ))}
        </div>
        {allowSwap && !t.swapped && <div style={{ fontSize: '0.62em', opacity: 0.4, marginTop: '0.6em' }}>Tap to swap tonight</div>}
      </Fit>
    </div>
  );
}
