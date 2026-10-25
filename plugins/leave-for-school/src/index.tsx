import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, caps, Icon, I, useNow, localHM, weekday, parseHM, hour12Of } from './ui';

export default function LeaveForSchool({ config, style, timezone: tz, ...rest }: PluginComponentProps & { timeFormat?: string }) {
  const now = useNow(10000);
  const label = String(config.label || 'Bus');
  const depart = parseHM(String(config.departTime || '08:05'));
  const from = parseHM(String(config.showFrom || '06:30'));
  const days = String(config.days ?? '1,2,3,4,5').split(',').map((x) => Number(x.trim())).filter((x) => !isNaN(x));
  const warn = Number(config.warnMinutes ?? 10);
  const accent = String(config.accentColor || '#db2777');
  const tf = (rest as any).timeFormat;
  const hm = (m: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: hour12Of(tf) }).format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60));

  const cur = localHM(now, tz) + now.getSeconds() / 60;
  const wd = weekday(now, tz);
  const schoolDay = days.includes(wd);
  const active = schoolDay && cur >= from && cur < depart + 15;
  const left = depart - cur;
  const color = left <= 0 ? '#dc2626' : left <= warn ? '#dc2626' : left <= warn * 2 ? '#d97706' : accent;
  const pct = Math.max(0, Math.min(1, (cur - from) / Math.max(1, depart - from)));

  let nextDay = '';
  if (!active) {
    for (let i = 0; i < 8; i++) { const d = (wd + i) % 7; if (days.includes(d) && (i > 0 || cur < from)) { nextDay = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]; break; } }
  }

  if (!active) {
    return (
      <div style={frame(style, { flexDirection: 'row', alignItems: 'center', gap: '0.8em' })}>
        <Icon d={I.bus} size="2.2em" stroke={1.6} style={{ opacity: 0.45 }} />
        <div>
          <div style={caps}>{label}</div>
          <div style={{ fontSize: '1.3em', fontWeight: 500 }}>{nextDay ? `${nextDay} at ${hm(depart)}` : 'No school days set'}</div>
        </div>
      </div>
    );
  }
  const mins = Math.ceil(left);
  return (
    <div style={frame(style, { justifyContent: 'center', gap: '0.6em' })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9em' }}>
        <div style={{ width: '3.4em', height: '3.4em', borderRadius: '50%', background: `color-mix(in srgb, ${color} 14%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon d={I.bus} size="1.9em" stroke={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={caps}>{label} at {hm(depart)}</div>
          <div style={{ fontSize: '3.2em', fontWeight: 600, lineHeight: 1.05, color, letterSpacing: '-0.02em' }}>
            {left <= 0 ? 'Time to go!' : mins === 1 ? '1 minute' : `${mins} minutes`}
          </div>
        </div>
      </div>
      <div style={{ height: '0.35em', borderRadius: 999, background: ink(style, 0.08), overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, transition: 'width 1s' }} />
      </div>
    </div>
  );
}
