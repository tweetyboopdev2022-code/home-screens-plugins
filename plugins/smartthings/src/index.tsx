import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, caps as capsStyle, Icon, Shape, sdk, useNow } from './ui';
import { StDevice, Status, kindOf, pick, tile, lowBattery, val, Kind } from './logic';

const API = 'https://api.smartthings.com/v1';
const C = (x: number, y: number, r: number): Shape => ({ c: [x, y, r] });
const ICONS: Record<Kind, Shape[]> = {
  lock: ['M5 11h14v10H5z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  contact: ['M13 4h3a2 2 0 0 1 2 2v14', 'M2 20h3', 'M13 20h9', 'M10 12v.01', 'M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z'],
  motion: [C(13, 4, 1), 'm9 20 3-6 3 3v6', 'm6 8 3-2 4 1 3 4 3 1', 'M6 15l2-4'],
  presence: [C(12, 8, 4), 'M20 21a8 8 0 0 0-16 0'],
  washer: ['M3 6h3', 'M17 6h.01', 'M3 2h18v20H3z', C(12, 13, 5), 'M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5'],
  dryer: ['M3 6h3', 'M17 6h.01', 'M3 2h18v20H3z', C(12, 13, 5)],
  thermostat: ['M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z'],
  temperature: ['M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z'],
  switch: ['M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5', 'M9 18h6', 'M10 22h4'],
  other: [C(12, 12, 9)],
};

async function st(path: string, method = 'GET', body?: unknown, ttl = 0) {
  const res: Response = await sdk().pluginFetch('smartthings', {
    url: `${API}${path}`, method, cacheTtlMs: method === 'GET' ? ttl : 0,
    ...(body ? { payload: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const t = await res.text(); return t ? JSON.parse(t) : null;
}
async function allPages(path: string, ttl = 0): Promise<any[]> {
  const out: any[] = []; let next: string | null = path;
  for (let i = 0; next && i < 10; i++) {
    const j: any = await st(next, 'GET', undefined, ttl);
    out.push(...(j?.items ?? []));
    const href: string | undefined = j?._links?.next?.href;
    next = href ? href.replace(/^https:\/\/api\.smartthings\.com\/v1/, '') : null;
  }
  return out;
}

export default function SmartThings({ config, style, ...rest }: PluginComponentProps & { units?: string }) {
  const now = useNow(1000 * Math.max(20, Number(config.pollSeconds ?? 45)));
  const accent = String(config.accentColor || '#0ea5e9');
  const allowControl = config.allowControl !== false;
  const tempUnit = (rest as any).units === 'imperial' ? 'F' : 'C';
  const [devices, setDevices] = React.useState<StDevice[] | null>(null);
  const [rooms, setRooms] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<Record<string, Status>>({});
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const tick = now.getTime();

  // ONE request per poll for every device + its status (includeStatus), cached on the hub so every
  // copy of this block (day, night, editor preview) shares it. Rooms are cached for 10 minutes.
  const pollMs = 1000 * Math.max(20, Number(config.pollSeconds ?? 45));
  const tapped = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [devs, locs] = await Promise.all([allPages('/devices?includeStatus=true', pollMs - 2000), allPages('/locations', 600000)]);
        if (!alive) return;
        const rm: Record<string, string> = {};
        await Promise.all(locs.map(async (l: any) => { (await allPages(`/locations/${l.locationId}/rooms`, 600000)).forEach((r: any) => { rm[r.roomId] = r.name; }); }));
        const st2: Record<string, Status> = {};
        devs.forEach((d: any) => {
          const main = (d.components ?? []).find((c: any) => c.id === 'main') ?? d.components?.[0];
          if (!main) return;
          if (main.status) { st2[d.deviceId] = main.status; return; }
          const caps = main.capabilities ?? [];
          if (caps.some((c: any) => c.status)) { const o: Status = {}; caps.forEach((c: any) => { if (c.status) o[c.id] = c.status; }); st2[d.deviceId] = o; }
        });
        if (!alive) return;
        setRooms(rm); setDevices(devs); setErr(null);
        Object.keys(st2).forEach((id) => { if (Date.now() - (tapped.current[id] ?? 0) < pollMs + 5000) delete st2[id]; });
        setStatus((old) => ({ ...old, ...st2 }));
      } catch (e) {
        const m = String((e as Error).message);
        if (/429/.test(m)) return; // busy: keep showing the last good data
        setErr(/401|403/.test(m) || /HTTP 500/.test(m) ? 'Connect SmartThings: open this block’s settings → Connection → Connect.' : 'Can’t reach SmartThings right now.');
      }
    })();
    return () => { alive = false; };
  }, [tick, pollMs]);

  const shown = React.useMemo(() => (devices ? pick(devices, rooms, String(config.devices || '')).filter((d) => config.showOther !== false || kindOf(d) !== 'other').slice(0, 80) : []), [devices, rooms, config.devices]);

  // fallback if SmartThings didn't include statuses: fetch the missing ones slowly (max 8 per poll, shared cache)
  React.useEffect(() => {
    const missing = shown.filter((d) => !status[d.deviceId]).slice(0, 8);
    if (!missing.length) return;
    let alive = true;
    (async () => {
      for (const d of missing) {
        try { const j = await st(`/devices/${d.deviceId}/status`, 'GET', undefined, pollMs * 2); if (alive) setStatus((o) => ({ ...o, [d.deviceId]: (j?.components?.main ?? {}) as Status })); }
        catch (e) { if (/429/.test(String((e as Error).message))) break; }
      }
    })();
    return () => { alive = false; };
  }, [tick, shown]);  // eslint-disable-line react-hooks/exhaustive-deps

  // shared state for display rules (wake on motion, etc.)
  const kinds = shown.map((d) => [kindOf(d), status[d.deviceId]] as const);
  const anyMotion = kinds.some(([k, s]) => k === 'motion' && val(s, 'motionSensor', 'motion') === 'active');
  const anyOpen = kinds.some(([k, s]) => k === 'contact' && val(s, 'contactSensor', 'contact') === 'open');
  const anyoneHome = kinds.some(([k, s]) => k === 'presence' && val(s, 'presenceSensor', 'presence') === 'present');
  const laundryDone = kinds.some(([k, s]) => (k === 'washer' || k === 'dryer') && val(s, `${k}OperatingState`, `${k}JobState`) === 'finish');
  React.useEffect(() => {
    const p = sdk()?.publishState; if (!p) return;
    p('smartthings', 'any-motion', anyMotion ? 'yes' : 'no'); p('smartthings', 'any-open', anyOpen ? 'yes' : 'no');
    p('smartthings', 'anyone-home', anyoneHome ? 'yes' : 'no'); p('smartthings', 'laundry-done', laundryDone ? 'yes' : 'no');
  }, [anyMotion, anyOpen, anyoneHome, laundryDone]);

  const act = async (d: StDevice, capability: string, command: string) => {
    setBusy(d.deviceId); tapped.current[d.deviceId] = Date.now();
    try {
      await st(`/devices/${d.deviceId}/commands`, 'POST', { commands: [{ component: 'main', capability, command }] });
      setTimeout(async () => { try { const j = await st(`/devices/${d.deviceId}/status`); setStatus((o) => ({ ...o, [d.deviceId]: j?.components?.main ?? {} })); } catch { /* next poll */ } setBusy(null); }, 1500);
    } catch { setBusy(null); }
  };

  // group by room, keeping the user's order
  const groups: { room: string; devs: StDevice[] }[] = [];
  shown.forEach((d) => { const r = rooms[d.roomId ?? ''] ?? 'Other'; const g = groups.find((x) => x.room === r); g ? g.devs.push(d) : groups.push({ room: r, devs: [d] }); });
  const batteries = config.showBattery !== false ? shown.map((d) => ({ d, b: lowBattery(status[d.deviceId]) })).filter((x) => x.b != null) : [];
  const toneBg = (t: string) => t === 'on' ? `color-mix(in srgb, ${accent} 16%, transparent)` : t === 'alert' ? 'color-mix(in srgb, #f59e0b 18%, transparent)' : ink(style, 0.05);
  const toneFg = (t: string) => t === 'on' ? accent : t === 'alert' ? '#d97706' : t === 'ok' ? '#16a34a' : undefined;

  return (
    <div style={frame(style, { gap: '0.6em' })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
        <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600 }}>{String(config.title || 'Home')}</h2>
        {devices && <span style={{ fontSize: '0.65em', opacity: 0.35 }}>{shown.length}{devices.length !== shown.length ? ` of ${devices.length}` : ''} device{shown.length === 1 ? '' : 's'}</span>}
        {batteries.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '0.65em', fontWeight: 600, color: '#d97706' }}>Low battery: {batteries.map((x) => `${x.d.label || x.d.name} ${x.b}%`).join(', ')}</span>}
      </div>
      {err ? <div style={{ margin: 'auto', fontSize: '0.8em', opacity: 0.6, textAlign: 'center', maxWidth: '24em' }}>{err}</div>
        : !devices ? <div style={{ margin: 'auto', fontSize: '0.8em', opacity: 0.4 }}>Loading devices…</div>
        : !shown.length ? <div style={{ margin: 'auto', fontSize: '0.8em', opacity: 0.5 }}>No matching devices — check “Show these devices” in the settings.</div>
        : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: '0.7em' } as React.CSSProperties}>
            {groups.map((g) => (
              <div key={g.room} style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
                {groups.length > 1 && <div style={capsStyle}>{g.room}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(9.5em, 1fr))', gap: '0.5em' }}>
                  {g.devs.map((d) => {
                    const t = tile(d, status[d.deviceId], allowControl, tempUnit);
                    const k = kindOf(d);
                    const clickable = !!t.action && busy !== d.deviceId;
                    return (
                      <button key={d.deviceId} disabled={!clickable} onClick={() => t.action && act(d, t.action.capability, t.action.command)} aria-label={t.action ? `${t.action.label} ${t.title}` : t.title}
                        style={{ appearance: 'none', border: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: clickable ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', gap: '0.6em', padding: '0.6em 0.7em', borderRadius: '0.8em', background: toneBg(t.tone), opacity: busy === d.deviceId ? 0.5 : 1, minWidth: 0 }}>
                        <span style={{ color: toneFg(t.tone), opacity: t.tone === 'off' ? 0.4 : 1, flexShrink: 0 }}><Icon d={ICONS[k]} size="1.5em" stroke={1.7} /></span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.2 }}>
                          <span style={{ fontSize: '0.75em', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                          <span style={{ fontSize: '0.95em', fontWeight: 600, color: toneFg(t.tone) }}>{status[d.deviceId] ? t.value : '…'}</span>
                          {t.sub && <span style={{ fontSize: '0.6em', opacity: 0.5 }}>{t.sub}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
