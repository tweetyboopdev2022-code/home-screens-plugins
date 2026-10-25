// Pure helpers for the SmartThings plugin.

export interface StDevice { deviceId: string; label?: string; name?: string; roomId?: string; locationId?: string; components?: { id: string; capabilities: { id: string }[] }[] }
export type Status = Record<string, Record<string, { value?: unknown; unit?: string }>>; // capability → attribute → {value}
export type Kind = 'lock' | 'contact' | 'motion' | 'presence' | 'washer' | 'dryer' | 'thermostat' | 'switch' | 'temperature' | 'other';

export const caps = (d: StDevice) => new Set((d.components?.find((c) => c.id === 'main') ?? d.components?.[0])?.capabilities.map((c) => c.id) ?? []);

export function kindOf(d: StDevice): Kind {
  const c = caps(d);
  if (c.has('lock')) return 'lock';
  if (c.has('washerOperatingState') || c.has('samsungce.washerOperatingState')) return 'washer';
  if (c.has('dryerOperatingState') || c.has('samsungce.dryerOperatingState')) return 'dryer';
  if (c.has('thermostatHeatingSetpoint') || c.has('thermostatMode')) return 'thermostat';
  if (c.has('contactSensor')) return 'contact';
  if (c.has('motionSensor')) return 'motion';
  if (c.has('presenceSensor')) return 'presence';
  if (c.has('switch')) return 'switch';
  if (c.has('temperatureMeasurement')) return 'temperature';
  return 'other';
}

export const val = (s: Status | undefined, cap: string, attr: string) => s?.[cap]?.[attr]?.value;
export const unitOf = (s: Status | undefined, cap: string, attr: string) => s?.[cap]?.[attr]?.unit;

/** Filter lines/commas of device or room names; empty = keep all. Keeps the order the user typed. */
export function pick(devs: StDevice[], rooms: Record<string, string>, filter: string): StDevice[] {
  const wants = String(filter || '').split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!wants.length) return devs;
  const out: StDevice[] = [];
  for (const w of wants) for (const d of devs) {
    const label = (d.label || d.name || '').toLowerCase(), room = (rooms[d.roomId ?? ''] ?? '').toLowerCase();
    if ((label === w || room === w || label.includes(w)) && !out.includes(d)) out.push(d);
  }
  return out;
}

export interface Tile { title: string; value: string; sub?: string; tone: 'on' | 'off' | 'alert' | 'ok' | 'neutral'; action?: { capability: string; command: string; label: string } }

export function tile(d: StDevice, s: Status | undefined, allowControl: boolean, tempUnit: string): Tile {
  const title = d.label || d.name || 'Device';
  const k = kindOf(d);
  const temp = (v: unknown, u?: string) => (typeof v === 'number' ? `${Math.round(v)}°${u && u !== tempUnit ? u : ''}` : '—');
  switch (k) {
    case 'lock': {
      const v = String(val(s, 'lock', 'lock') ?? '');
      const locked = v === 'locked';
      return { title, value: locked ? 'Locked' : v ? 'Unlocked' : '—', tone: locked ? 'ok' : v ? 'alert' : 'neutral', action: allowControl && v && !locked ? { capability: 'lock', command: 'lock', label: 'Lock' } : undefined };
    }
    case 'contact': { const open = val(s, 'contactSensor', 'contact') === 'open'; return { title, value: open ? 'Open' : 'Closed', tone: open ? 'alert' : 'ok' }; }
    case 'motion': { const m = val(s, 'motionSensor', 'motion') === 'active'; return { title, value: m ? 'Motion' : 'Clear', tone: m ? 'on' : 'neutral' }; }
    case 'presence': { const p = val(s, 'presenceSensor', 'presence') === 'present'; return { title, value: p ? 'Home' : 'Away', tone: p ? 'on' : 'neutral' }; }
    case 'washer': case 'dryer': {
      const st = String(val(s, `${k}OperatingState`, 'machineState') ?? val(s, `samsungce.${k}OperatingState`, 'operatingState') ?? '');
      const job = String(val(s, `${k}OperatingState`, `${k}JobState`) ?? '');
      const running = st === 'run' || st === 'running';
      const end = val(s, `${k}OperatingState`, 'completionTime');
      const mins = typeof end === 'string' ? Math.max(0, Math.round((Date.parse(end) - Date.now()) / 60000)) : null;
      return { title, value: running ? (mins != null ? `${mins} min left` : 'Running') : job === 'finish' ? 'Done' : st === 'pause' ? 'Paused' : 'Idle', tone: running ? 'on' : job === 'finish' ? 'alert' : 'neutral' };
    }
    case 'thermostat': {
      const t = val(s, 'temperatureMeasurement', 'temperature'), u = unitOf(s, 'temperatureMeasurement', 'temperature');
      const sp = val(s, 'thermostatHeatingSetpoint', 'heatingSetpoint') ?? val(s, 'thermostatCoolingSetpoint', 'coolingSetpoint');
      const mode = String(val(s, 'thermostatMode', 'thermostatMode') ?? '');
      return { title, value: temp(t, u), sub: [typeof sp === 'number' ? `set ${Math.round(sp)}°` : '', mode].filter(Boolean).join(' · '), tone: 'neutral' };
    }
    case 'switch': {
      const on = val(s, 'switch', 'switch') === 'on';
      const lvl = val(s, 'switchLevel', 'level');
      return { title, value: on ? (typeof lvl === 'number' && lvl < 100 ? `On · ${lvl}%` : 'On') : 'Off', tone: on ? 'on' : 'off',
        action: allowControl ? { capability: 'switch', command: on ? 'off' : 'on', label: on ? 'Turn off' : 'Turn on' } : undefined };
    }
    case 'temperature': {
      const t = val(s, 'temperatureMeasurement', 'temperature'), u = unitOf(s, 'temperatureMeasurement', 'temperature');
      const h = val(s, 'relativeHumidityMeasurement', 'humidity');
      return { title, value: temp(t, u), sub: typeof h === 'number' ? `${Math.round(h)}% humidity` : undefined, tone: 'neutral' };
    }
    default: {
      // devices we don't have a special tile for: show the most useful thing we can find
      const c = caps(d);
      const pick1 = (cap: string, attr: string) => (c.has(cap) ? val(s, cap, attr) : undefined);
      const robot = pick1('robotCleanerMovement', 'robotCleanerMovement') ?? pick1('samsungce.robotCleanerOperatingState', 'operatingState');
      if (robot != null) return { title, value: String(robot).replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase()), tone: /clean|run/i.test(String(robot)) ? 'on' : 'neutral' };
      const play = pick1('mediaPlayback', 'playbackStatus');
      if (play != null) return { title, value: String(play) === 'playing' ? 'Playing' : String(play) === 'paused' ? 'Paused' : 'Stopped', tone: String(play) === 'playing' ? 'on' : 'neutral' };
      const mode = pick1('airConditionerMode', 'airConditionerMode') ?? pick1('airPurifierFanMode', 'airPurifierFanMode');
      if (mode != null) return { title, value: String(mode), tone: 'neutral' };
      const water = pick1('waterSensor', 'water');
      if (water != null) return { title, value: water === 'wet' ? 'Leak!' : 'Dry', tone: water === 'wet' ? 'alert' : 'ok' };
      const smoke = pick1('smokeDetector', 'smoke');
      if (smoke != null) return { title, value: smoke === 'detected' ? 'Smoke!' : 'Clear', tone: smoke === 'detected' ? 'alert' : 'ok' };
      const b = pick1('battery', 'battery');
      if (typeof b === 'number') return { title, value: `${b}% battery`, tone: 'neutral' };
      const first = [...c].find((x) => !/^(healthCheck|refresh|execute|ocf|custom\.|samsungce\.softwareUpdate|firmwareUpdate|configuration)/.test(x));
      return { title, value: 'Connected', sub: first ? first.replace(/^samsungce\./, '').replace(/([A-Z])/g, ' $1').toLowerCase() : undefined, tone: 'neutral' };
    }
  }
}

export const lowBattery = (s: Status | undefined) => { const b = val(s, 'battery', 'battery'); return typeof b === 'number' && b <= 15 ? b : null; };
