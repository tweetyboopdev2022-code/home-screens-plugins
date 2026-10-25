#!/usr/bin/env node
// Setup wizard: asks for your family's details once and writes them into every plugin's defaults.
//   npm run setup                         ask, save family.config.json, update the manifests
//   npm run setup -- --from my.json       no questions, use a saved config
//   npm run setup -- --build              also build every plugin afterwards
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv } from 'node:process';
import { plan, applyToManifest, rewrite } from './apply.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pluginsDir = join(root, 'plugins');
const savedPath = join(root, 'family.config.json');
const arg = (name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1] ?? true; };

async function ask() {
  const prev = existsSync(savedPath) ? JSON.parse(readFileSync(savedPath, 'utf8')) : {};
  const rl = createInterface({ input: stdin, output: stdout });
  // Piped answers (one per line, for scripting) are read up front; readline drops lines that
  // arrive before a question is asked.
  const piped = stdin.isTTY ? null : await (async () => { const lines = []; for await (const l of rl) lines.push(l); return lines; })();
  const q = async (label, current, hint = '') => {
    const shown = current ? ` [${current}]` : hint ? ` (${hint})` : '';
    const prompt = `  ${label}${shown}: `;
    const a = (piped ? (stdout.write(prompt + '\n'), piped.shift() ?? '') : await rl.question(prompt)).trim();
    return a === '-' ? '' : a || current || '';
  };
  console.log('\nHome Screens plugins setup. Press Enter to keep the value in [brackets], or type - to clear it.\n');
  const c = { ...prev, school: { ...prev.school }, bedtime: { ...prev.bedtime } };

  console.log('Family');
  c.adults = await q('Adults, comma-separated', c.adults, 'e.g. Jordan, Alex');
  c.kids = await q('Kids, comma-separated', c.kids, 'e.g. Sam');
  c.colors = await q('Custom colours (optional)', c.colors, 'e.g. Sam:#f472b6');
  c.commuter = await q('Whose calendar and commute for the weather and trip plugins', c.commuter, c.adults.split(',')[0]?.trim());
  c.homeAddress = await q('Home address for drive times (optional)', c.homeAddress);

  console.log('\nBedtime rotation');
  c.bedtime.people = await q('Who takes turns', c.bedtime.people, c.adults);
  c.bedtime.nightsEach = await q('Nights each', c.bedtime.nightsEach, '2');
  c.bedtime.startDate = await q('Rotation start date (YYYY-MM-DD)', c.bedtime.startDate || new Date().toISOString().slice(0, 10));
  c.bedtime.startsWith = await q('Whose turn on that date', c.bedtime.startsWith, c.bedtime.people.split(',')[0]?.trim());

  console.log('\nSchool');
  c.schoolChild = await q('Which kid the school plugins follow', c.schoolChild, c.kids.split(',')[0]?.trim());
  c.school.name = await q('School name (used to spot closures)', c.school.name);
  c.school.firstDay = await q('First day of school (YYYY-MM-DD)', c.school.firstDay);
  c.school.lastDay = await q('Last day of school (YYYY-MM-DD)', c.school.lastDay);
  c.school.offDays = await q('Days off (dates or ranges, comma-separated)', c.school.offDays, '2026-12-21..2027-01-04');
  c.school.cycleLength = await q('Days in the class cycle (5 for Day 1-5)', c.school.cycleLength, '5');
  c.school.leaveLabel = await q('What you leave for in the morning', c.school.leaveLabel, 'Bus');
  c.school.leaveTime = await q('Leave at (HH:MM)', c.school.leaveTime, '08:05');
  c.school.closureUrl = await q("School board's closures page (optional)", c.school.closureUrl);

  console.log('\nHome');
  c.stores = await q('Stores you shop at, comma-separated', c.stores, 'e.g. Grocery, Warehouse, Pharmacy');
  c.pets = await q('Pets, comma-separated (Dog, Cat, Rabbit, Fish, Bird)', c.pets);
  c.pickups = await q('Bin pickups (optional)', c.pickups, 'Trash: Wed every 2 weeks from 2026-09-16, Compost: Thu weekly');
  c.choreReward = await q('Reward for reaching the chore goal', c.choreReward, 'Movie night');
  c.grimmoryUrl = await q('Grimmory address for What We\'re Reading (optional)', c.grimmoryUrl);
  c.nhlTeam = await q('NHL team, 3-letter code (optional)', c.nhlTeam, 'e.g. TOR');
  c.language = await q('Language for game info (en, fr or both)', c.language, 'en');
  rl.close();
  return c;
}

const cfg = arg('--from') ? JSON.parse(readFileSync(arg('--from'), 'utf8')) : await ask();
writeFileSync(savedPath, JSON.stringify(cfg, null, 2) + '\n');

const p = plan(cfg);
const changed = [];
for (const id of readdirSync(pluginsDir)) {
  const file = join(pluginsDir, id, 'manifest.json');
  if (!existsSync(file) || !p[id]) continue;
  const before = readFileSync(file, 'utf8');
  const after = rewrite(before, applyToManifest(JSON.parse(before), p[id]));
  if (after !== before) { writeFileSync(file, after); changed.push(id); }
}
console.log(`\nSaved your answers to family.config.json and updated ${changed.length} plugins: ${changed.join(', ') || 'none'}.`);
console.log('Secrets (Todoist token, Grimmory logins) are still entered in the Home Screens editor, never here.');

if (arg('--build')) {
  for (const id of readdirSync(pluginsDir)) {
    const dir = join(pluginsDir, id);
    if (!existsSync(join(dir, 'package.json'))) continue;
    console.log(`\nBuilding ${id}…`);
    execSync(existsSync(join(dir, 'package-lock.json')) ? 'npm ci && npm run build' : 'npm install && npm run build', { cwd: dir, stdio: 'inherit' });
  }
} else {
  console.log('Build them with: npm run build');
}
