import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, Icon, I, useNow, dayKey, Fit, useBox, clampLines } from './ui';

export function nextOccurrences(spec: string, todayKey: string): { name: string; date: string; days: number }[] {
  const today = new Date(todayKey + 'T12:00:00');
  return String(spec || '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p[0] && p[1]).map(([name, d]) => {
    let date: string;
    if (/^\d{2}-\d{2}$/.test(d)) { date = `${todayKey.slice(0, 4)}-${d}`; if (date < todayKey) date = `${Number(todayKey.slice(0, 4)) + 1}-${d}`; }
    else date = d;
    const days = Math.round((new Date(date + 'T12:00:00').getTime() - today.getTime()) / 86400000);
    return { name, date, days };
  }).filter((x) => x.days >= 0 && !isNaN(x.days)).sort((a, b) => a.days - b.days);
}

export default function Countdowns({ config, style, timezone: tz }: PluginComponentProps) {
  const now = useNow(300000);
  const accent = String(config.accentColor || '#b45309');
  const [box, size] = useBox<HTMLDivElement>();
  const fs = Number(style?.fontSize) || 18;
  // Only as many tiles as fit comfortably side by side (≥ ~5.5em each).
  const low = size.h > 0 && size.h < fs * 6.5;
  const fitCount = size.w ? Math.max(1, Math.floor((size.w + fs * 0.6) / Math.max(low ? 190 : 120, fs * (low ? 10 : 6.2)))) : 4;
  const list = nextOccurrences(String(config.items ?? ''), dayKey(now, tz)).slice(0, Math.min(Number(config.max ?? 3), fitCount));
  // Short blocks: number beside the name instead of above it.

  if (!list.length) return <div ref={box} style={frame(style, { alignItems: 'center', justifyContent: 'center', opacity: 0.4 })}><Icon d={I.gift} size="1.6em" stroke={1.5} /><div style={{ fontSize: '0.8em', marginTop: '0.3em' }}>Add countdowns in the module settings</div></div>;
  const date = (d: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(d + 'T12:00:00'));
  return (
    <div ref={box} style={frame(style)}>
      <Fit max={1.6} min={0.5}>
        <div style={{ display: 'flex', gap: '0.6em' }}>
          {list.map((x, i) => (
            <div key={x.name + x.date} style={{ flex: 1, minWidth: 0, borderRadius: '0.7em', padding: low ? '0.45em 0.7em' : '0.7em 0.9em', background: i === 0 ? `color-mix(in srgb, ${accent} 12%, transparent)` : ink(style, 0.05), display: 'flex', flexDirection: low ? 'row' : 'column', alignItems: low ? 'center' : 'stretch', gap: low ? '0.5em' : 0 }}>
              <div style={{ fontSize: low ? '2em' : '2.8em', fontWeight: 300, lineHeight: 1, color: i === 0 ? accent : 'inherit', letterSpacing: '-0.02em', flexShrink: 0 }}>{x.days === 0 ? '🎉' : x.days}</div>
              <div style={{ minWidth: 0, marginTop: low ? 0 : '0.25em' }}>
                <div style={{ fontSize: '0.9em', fontWeight: 600, lineHeight: 1.15, ...clampLines(2), overflowWrap: 'normal' }}>{x.days === 0 ? `${x.name} is today!` : x.name}</div>
                <div style={{ fontSize: '0.62em', opacity: 0.5, marginTop: '0.15em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.days === 0 ? '' : `${x.days === 1 ? 'day' : 'days'} · ${date(x.date)}`}</div>
              </div>
            </div>
          ))}
        </div>
      </Fit>
    </div>
  );
}
