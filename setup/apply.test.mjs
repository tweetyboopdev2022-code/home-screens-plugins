import { test } from 'node:test';
import assert from 'node:assert/strict';
import { people, petLines, plan, applyToManifest, stringify, rewrite } from './apply.mjs';

const cfg = {
  adults: 'Riley, Casey', kids: 'Mia', colors: 'Mia:#123456',
  bedtime: { nightsEach: '3' },
  school: { firstDay: '2027-08-30', closureUrl: 'https://board.example.ca/closures' },
  stores: 'Market, Bulk', pets: 'Dog, Hamster', nhlTeam: 'van',
};

test('people get palette colours unless a custom one is given', () => {
  assert.deepEqual(people(cfg).map((p) => p.name), ['Riley', 'Casey', 'Mia']);
  assert.equal(people(cfg)[2].color, '#123456');
});

test('pets get sensible jobs', () => {
  assert.equal(petLines('Dog, Hamster'), 'Dog: Breakfast, Walk, Dinner, Evening walk\nHamster: Feed, Water');
});

test('plan fans the answers out to the right plugins', () => {
  const p = plan(cfg);
  assert.equal(p['school-day'].defaults.personName, 'Mia');
  assert.equal(p['chore-stars'].defaults.name, 'Mia');
  assert.equal(p['day-ahead'].defaults.personName, 'Riley');
  assert.equal(p['bedtime-turn'].schema.people, 'Riley, Casey');
  assert.equal(p['bedtime-turn'].schema.nightsEach, 3);
  assert.equal(p['next-game'].defaults.team, 'VAN');
  assert.equal(p['grocery-list'].defaults.featuredStore, 'Market');
  assert.deepEqual(p['school-day'].allowedDomains, ['board.example.ca']);
  assert.equal(p['screen-tabs'].defaults.tabs, 'Home, Riley, Casey, Mia, Planning, Shopping, News');
});

test('empty answers leave a plugin alone', () => {
  assert.deepEqual(plan({}), {});
});

test('applyToManifest updates defaults, schema defaults and domains', () => {
  const m = { defaultConfig: { a: 1 }, settingsSchema: { properties: { people: { default: 'x' } } }, allowedDomains: ['www.example.org'] };
  const out = applyToManifest(m, { defaults: { b: 2 }, schema: { people: 'Riley' }, allowedDomains: ['board.example.ca'] });
  assert.deepEqual(out.defaultConfig, { a: 1, b: 2 });
  assert.equal(out.settingsSchema.properties.people.default, 'Riley');
  assert.deepEqual(out.allowedDomains, ['board.example.ca']);
  assert.equal(m.defaultConfig.b, undefined);
});

test('stringify keeps the manifests\' escaped style', () => {
  assert.equal(stringify({ d: 'Québec ×' }), '{\n  "d": "Qu\\u00e9bec \\u00d7"\n}');
});

test('rewrite reproduces every manifest exactly when nothing changes', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../plugins/', import.meta.url);
  for (const id of readdirSync(dir)) {
    const before = readFileSync(new URL(`${id}/manifest.json`, dir), 'utf8');
    assert.equal(rewrite(before, JSON.parse(before)), before, id);
  }
});
