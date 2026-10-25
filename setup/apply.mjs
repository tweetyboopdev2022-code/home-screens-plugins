// Turns one family.config.json into the default settings of every plugin's manifest.json.
// Pure functions only, so the mapping can be tested without touching files.

const PALETTE = ['#fbbf24', '#34d399', '#f472b6', '#60a5fa', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171'];
const PET_JOBS = {
  dog: 'Breakfast, Walk, Dinner, Evening walk',
  cat: 'Breakfast, Dinner, Litter',
  rabbit: 'Pellets, Hay, Water',
  fish: 'Feed',
  bird: 'Seed, Water',
};

const list = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** Everyone, adults first, each with a colour (custom "Name:#hex" wins over the palette). */
export function people(cfg) {
  const names = [...list(cfg.adults), ...list(cfg.kids)];
  const custom = Object.fromEntries(list(cfg.colors).map((p) => p.split(':').map((x) => x.trim())));
  return names.map((name, i) => ({ name, color: custom[name] || PALETTE[i % PALETTE.length] }));
}

const pairs = (ps) => ps.map((p) => `${p.name}:${p.color}`).join(', ');

export function petLines(pets) {
  return list(pets).map((p) => `${p}: ${PET_JOBS[p.toLowerCase()] ?? 'Feed, Water'}`).join('\n');
}

export function domainOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

/**
 * Settings for each plugin id, as { defaults, schema, allowedDomains }.
 * defaults → manifest.defaultConfig, schema → defaults in settingsSchema/configSchema properties.
 * Answers left empty are skipped, so the manifest keeps what it had.
 */
export function plan(cfg) {
  const ps = people(cfg);
  const adults = list(cfg.adults);
  const kids = list(cfg.kids);
  const child = cfg.schoolChild || kids[0] || '';
  const commuter = cfg.commuter || adults[0] || '';
  const rotation = list(cfg.bedtime?.people).length ? list(cfg.bedtime.people) : adults;
  const stores = list(cfg.stores);
  const out = {};
  const set = (id, key, value, where = 'defaults') => {
    if (value === undefined || value === null || value === '') return;
    out[id] ??= { defaults: {}, schema: {} };
    out[id][where][key] = value;
  };

  if (ps.length) {
    set('screen-tabs', 'tabs', ['Home', ...ps.map((p) => p.name), 'Planning', 'Shopping', 'News'].join(', '));
    set('screen-tabs', 'colors', `Home:#f5c37e, ${pairs(ps)}, Planning:#60a5fa, Shopping:#4ade80, News:#fb923c`);
    set('heads-up', 'people', ps.map((p) => p.name).join(', '));
    set('heads-up', 'colors', pairs(ps));
  }
  if (rotation.length) {
    set('bedtime-turn', 'people', rotation.join(', '), 'schema');
    set('bedtime-turn', 'anchorPerson', cfg.bedtime?.startsWith || rotation[0], 'schema');
    set('bedtime-turn', 'colors', pairs(ps.filter((p) => rotation.includes(p.name))), 'schema');
    set('bedtime-turn', 'anchorDate', cfg.bedtime?.startDate, 'schema');
    set('bedtime-turn', 'nightsEach', Number(cfg.bedtime?.nightsEach) || undefined, 'schema');
  }
  set('event-trips', 'personName', commuter);
  set('event-trips', 'personName', commuter, 'schema');
  set('day-ahead', 'personName', commuter);
  set('event-trips', 'originAddress', cfg.homeAddress);

  set('school-day', 'personName', child);
  set('school-lunch', 'personName', child);
  if (child) { set('chore-stars', 'name', child); set('chore-stars', 'projectName', child); }
  set('chore-stars', 'reward', cfg.choreReward);

  const s = cfg.school ?? {};
  set('school-day', 'schoolName', s.name);
  set('school-day', 'firstDay', s.firstDay);
  set('school-day', 'anchorDate', s.firstDay);
  set('school-day', 'lastDay', s.lastDay);
  set('school-day', 'offDays', s.offDays);
  set('school-day', 'cycleLength', Number(s.cycleLength) || undefined);
  if (s.closureUrl) {
    set('school-day', 'closureUrl', s.closureUrl);
    set('school-day', 'checkClosures', true);
    out['school-day'].allowedDomains = [domainOf(s.closureUrl)].filter(Boolean);
  }
  set('leave-for-school', 'label', s.leaveLabel);
  set('leave-for-school', 'departTime', s.leaveTime);

  set('next-game', 'team', cfg.nhlTeam && String(cfg.nhlTeam).trim().toUpperCase());
  set('next-game', 'language', cfg.language);

  if (stores.length) {
    set('grocery-list', 'storeLabels', [...stores, 'Other'].join(', '));
    set('grocery-list', 'storeColors', [...stores.map((st, i) => `${st}:${PALETTE[i % PALETTE.length]}`), 'Other:#78716c'].join(', '));
    set('grocery-list', 'featuredStore', stores[0]);
    set('souper-cubes', 'groceryStore', stores[0]);
  }
  set('pet-care', 'pets', petLines(cfg.pets));
  set('heads-up', 'pickups', cfg.pickups);

  if (cfg.grimmoryUrl && ps.length) {
    set('reading-now', 'readers', ps.slice(0, 3).map((p) => `${p.name} | ${cfg.grimmoryUrl}`).join('\n'));
  }
  return out;
}

/** Applies one plugin's planned settings to its parsed manifest. Returns a new object. */
export function applyToManifest(manifest, p) {
  const m = structuredClone(manifest);
  if (!p) return m;
  m.defaultConfig = { ...(m.defaultConfig ?? {}), ...p.defaults };
  for (const [key, value] of Object.entries(p.schema ?? {})) {
    for (const s of ['settingsSchema', 'configSchema']) {
      const prop = m[s]?.properties?.[key];
      if (prop && 'default' in prop) prop.default = value;
    }
  }
  if (p.allowedDomains?.length) m.allowedDomains = [...new Set([...(m.allowedDomains ?? []).filter((d) => d !== 'www.example.org'), ...p.allowedDomains])];
  return m;
}

/** JSON with 2-space indent; ascii writes non-ASCII as \uXXXX, like most of the manifests. */
export function stringify(obj, { ascii = true } = {}) {
  const s = JSON.stringify(obj, null, 2);
  return ascii ? s.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`) : s;
}

/** Writes a manifest back the way the original file was written (escaping, final newline). */
export function rewrite(before, obj) {
  return stringify(obj, { ascii: !/[^\x00-\x7f]/.test(before) }) + (before.endsWith('\n') ? '\n' : '');
}
