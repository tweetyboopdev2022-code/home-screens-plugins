# Home Screens plugins

25 plugins for [Home Screens](https://homescreens.dev), the open-source smart display for a
Raspberry Pi. They run a real family wall display: a portrait touchscreen in the kitchen that
shows the calendar, the school day, dinner, chores and the house at a glance.

Each plugin is a small React + TypeScript app built with Vite into a single `dist/bundle.js`,
configured through its `manifest.json` and the Home Screens editor. They pull from Todoist,
calendars, Open-Meteo, Open Library, Hydro-Québec open data, the NHL schedule, SmartThings and
Home Assistant, and several have Vitest suites for their date and rotation logic.

### Family & planning

| Plugin | What it does |
|---|---|
| [Family Calendar](plugins/family-calendar/) | Day columns or a month grid where event titles wrap. Weather on each date; tap a date to see the whole day with the weather where each event happens. 'Day N' school badges, icons, per-person colours and filter buttons. |
| [Week Ahead](plugins/week-ahead/) | The coming week at a glance for Sunday planning: each day's weather, everyone's events colour-coded by person, the school cycle day and the dinner planned. |
| [Heads-up](plugins/heads-up/) | Only what needs attention right now: bins going out, overdue chores per person, Souper Cubes running low, tomorrow's dinner not planned. Says All clear otherwise. |
| [Bedtime Turn](plugins/bedtime-turn/) | Whose turn it is to do bedtime: a 2-nights-each rotation with the next few nights, and tap to swap tonight. |
| [Stars](plugins/chore-stars/) | Stars for jobs ticked off in a Todoist project this week, a daily streak and a goal/reward — or a kid routine view (Morning / After school / Bedtime) where each tick earns a star. |
| [Countdowns](plugins/countdowns/) | Big 'days until' tiles for holidays, birthdays and trips. |
| [Wall Notes](plugins/wall-notes/) | Sticky notes from a Todoist project — post a note from your phone, tap it on the wall to take it down. |
| [What We're Reading](plugins/reading-now/) | Book covers of what each person is reading, from their own Grimmory — the books on each person's “Currently Reading” magic shelf, read through Grimmory's OPDS feed. |

### School mornings

| Plugin | What it does |
|---|---|
| [School Day](plugins/school-day/) | Today's or tomorrow's school cycle day (Day 1–5), the classes on it, what to bring, upcoming tests and library returns from the calendar, and storm-closure alerts. |
| [School Lunch](plugins/school-lunch/) | Today's school lunch from calendar events (e.g. 'School Lunch: Taco Bowl'); shows tomorrow's in the afternoon. |
| [Leave for School](plugins/leave-for-school/) | Weekday-morning countdown to the bus or school departure, turning amber then red as time runs out. |
| [What to Wear](plugins/what-to-wear/) | One school-day plan: what to put on in the morning and what goes in the backpack for later: winter gear, rain gear, sweater, sunscreen — from today's forecast. Switches to tomorrow in the evening. |

### Food

| Plugin | What it does |
|---|---|
| [Dinner Tonight](plugins/dinner-tonight/) | Tonight's dinner from the Home Screens meal planner, big, with tomorrow underneath. |
| [Grocery List](plugins/grocery-list/) | A Todoist project as a touch grocery list: tap to check off, × to remove, add with the on-screen keyboard or 'Add again' chips. Filter by label to make one block per store (Grocery, Warehouse…). |
| [Souper Cubes](plugins/souper-cubes/) | Freezer tally of ready-made meals: tap a meal to take one cube out, + to add cubes after a batch. Meals at zero move to 'To batch make'. Reminds you to take a cube out to thaw when a planned meal matches. Stored in a Todoist project so phones can update it too. |

### Weather & outside

| Plugin | What it does |
|---|---|
| [Hero Header](plugins/hero-header/) | Big time, date and greeting with today's weather and the next event — one card for the top of a screen. |
| [Day Ahead](plugins/day-ahead/) | The weather for your next calendar event and when your last one ends, hour by hour through the day — with heads-ups for umbrella, frost on the windshield, slippery roads and wind. |
| [Event Trips](plugins/event-trips/) | Upcoming calendar events that have a location, with the forecast there at that time and the drive time from home (live traffic via TomTom). |
| [Hydro-Québec Peaks](plugins/hydro-peak/) | Hydro-Québec peak status at a glance — green off-peak, amber peak hours or an announced event, red during a peak event — with today's peak windows, prices and upcoming events. |
| [Next Game](plugins/next-game/) | When your NHL team plays next where to watch it in Canada, live score during the game, and the last result. |

### Home

| Plugin | What it does |
|---|---|
| [SmartThings](plugins/smartthings/) | Your SmartThings devices on the wall, grouped by room: lights and plugs, locks, doors and windows, motion and presence, temperature and thermostats, washer and dryer. Tap lights and plugs to switch them. |
| [Home Assistant](plugins/home-assistant/) | Beautiful entity cards, area grouping, and interactive controls for your Home Assistant instance. Lights, climate, media, covers, locks — no code, no templates. |
| [Pet Care](plugins/pet-care/) | Tap-to-log daily pet jobs (fed, walked, litter) with the time they were done; resets every morning. Optional monthly reminders. |

### Wall helpers

| Plugin | What it does |
|---|---|
| [Screen Tabs](plugins/screen-tabs/) | A row of big buttons to jump between screens — Home, each person, Planning, Shopping, News. |
| [Return to Home](plugins/return-home/) | Invisible helper: after a few minutes untouched, go back to Home — or in lock mode, keep guests on one screen (touching the wall bounces back) while a resident changing screens from their phone ends guest mode. |

## Setup wizard

The plugins ship with placeholder names and dates. Run the wizard once to fill in your own:

```sh
npm run setup            # asks about your family, school, stores, pets and team
npm run setup -- --build # same, then builds every plugin
npm run setup -- --from family.config.example.json   # no questions, use a saved file
```

It asks each question once (adults, kids, whose commute, the bedtime rotation, school dates and
closures page, stores, pets, bin pickups, NHL team) and writes the answers into the default
settings of every plugin that uses them, so the names and colours match across the wall. Answers
are saved to `family.config.json` (ignored by git) and offered as defaults next time. API tokens
and logins are never asked for here: enter those in the Home Screens editor.

Prefer a form? `setup/index.html` is the same wizard as a web page with a live preview of the
wall. Serve the folder (`npx serve setup`, or GitHub Pages) since it loads `apply.mjs` as a module,
fill it in, download `family.config.json`, then run `npm run setup -- --from family.config.json`.

The mapping lives in `setup/apply.mjs` and is tested with `npm test` (Node 18+, no dependencies).

## Building

Every plugin builds on its own:

```sh
cd plugins/<plugin>
npm install
npm run build      # → dist/bundle.js
npm test           # where the plugin has tests
```

Install a built plugin from the Home Screens editor: Plugins → Install from URL, or side-load
the package.

## Notes

- The names in default settings (Sam, Alex, Jordan) and URLs such as `homebase.example.com` are
  placeholders. Replace them with `npm run setup`, or per plugin in the Home Screens editor.
- `home-assistant` is a fork of
  [home-screens/home-screens-plugin-home-assistant](https://github.com/home-screens/home-screens-plugin-home-assistant)
  v1.9.0 (MIT) with a reworked Buttons view. See its README.
- Some plugins (Homebase tasks, meals and meds) talk to a self-hosted family app and are not
  included here.

## License

MIT
