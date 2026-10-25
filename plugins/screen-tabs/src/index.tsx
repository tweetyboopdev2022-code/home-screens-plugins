// Screen Tabs — a row of big tap targets to jump between screens (Home · Alex · Sam · …).
import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, Icon, I, sdk, Shape } from './ui';

const C = (x: number, y: number, r: number): Shape => ({ c: [x, y, r] });
const ICONS: Record<string, Shape[]> = {
  home: ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  planning: I.calendar,
  shopping: [C(8, 21, 1), C(19, 21, 1), 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'],
  news: ['M15 18h-5', 'M18 14h-8', 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2', 'M10 6h8v4h-8z'],
  guests: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', C(9, 7, 4), 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
};
export const clean = (s: string) => s.replace(/[☾☀️🌙]/gu, '').trim().toLowerCase();
export function parseMap(s: string): Record<string, string> {
  const o: Record<string, string> = {};
  s.split(',').forEach((p) => { const i = p.lastIndexOf(':'); if (i > 0) o[clean(p.slice(0, i))] = p.slice(i + 1).trim(); });
  return o;
}

const DOTS_CSS = 'div[style*="view-transition-name"][style*="pagination"]{display:none!important}';
// Built-in Todoist blocks clip long lists; let them scroll with a finger (title stays put, fade hints there's more).
const SCROLL_CSS = '[data-module-type="todoist"] .flex.flex-col.gap-3.overflow-hidden.h-full{overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:none;touch-action:pan-y;'
  + '-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 2.5em),transparent);mask-image:linear-gradient(to bottom,#000 calc(100% - 2.5em),transparent);padding-bottom:2em}'
  + '[data-module-type="todoist"] .flex.flex-col.gap-3.overflow-hidden.h-full::-webkit-scrollbar{display:none}';
function addCss(id: string, css: string) {
  if (typeof document === 'undefined' || /\/editor/.test(location.pathname) || document.getElementById(id)) return;
  const st = document.createElement('style'); st.id = id; st.textContent = css; document.head.appendChild(st);
}
function hideDots() { addCss('hs-hide-dots', DOTS_CSS); }

type Screen = { id: string; name: string; enabled?: boolean };
let cache: { at: number; screens: Screen[] } | null = null;

export default function ScreenTabs({ config, style }: PluginComponentProps) {
  const wanted = String(config.tabs ?? 'Home, Alex, Sam, Jordan, Planning, Shopping, News').split(',').map((s) => s.trim()).filter(Boolean);
  const current = clean(String(config.current ?? ''));
  const colors = parseMap(String(config.colors ?? ''));
  const accent = String(config.accentColor || '#f5c37e');
  const [screens, setScreens] = React.useState<Screen[]>(cache?.screens ?? []);
  // The host's page dots duplicate these tabs (and let anyone jump to any screen) — hide them.
  React.useEffect(() => { if (config.hideDots !== false) hideDots(); }, [config.hideDots]);
  React.useEffect(() => { if (config.scrollLists !== false) addCss('hs-scroll-lists', SCROLL_CSS); }, [config.scrollLists]);

  React.useEffect(() => {
    let dead = false;
    const load = async () => {
      if (cache && Date.now() - cache.at < 300000) { setScreens(cache.screens); return; }
      try {
        const c = await fetch('/api/config').then((r) => r.json());
        const list: Screen[] = (c.screens ?? []).filter((s: Screen) => s.enabled !== false).map((s: Screen) => ({ id: s.id, name: s.name }));
        cache = { at: Date.now(), screens: list }; if (!dead) setScreens(list);
      } catch { /* keep last */ }
    };
    load(); const id = setInterval(load, 300000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  const tabs = wanted.map((label) => {
    const key = clean(label);
    const index = screens.findIndex((s) => clean(s.name) === key || clean(s.name).startsWith(key));
    return { label, key, index };
  }).filter((t) => t.index >= 0 || !screens.length);

  if (!wanted.length) return null;   // an empty instance just keeps the dots hidden
  const go = (i: number) => { if (i >= 0) sdk()?.emit?.({ type: 'navigate', direction: 'screen', screenIndex: i }); };

  return (
    <div style={frame(style, { flexDirection: 'row', alignItems: 'stretch', gap: '0.45em', padding: style.padding ?? 6 })}>
      {tabs.map((t) => {
        const on = t.key === current;
        const col = colors[t.key] || accent;
        const icon = ICONS[t.key];
        return (
          <button key={t.label} onClick={() => go(t.index)} aria-label={t.label} aria-current={on ? 'page' : undefined}
            style={{ appearance: 'none', font: 'inherit', cursor: 'pointer', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45em',
              borderRadius: '999px', border: `0.1em solid ${on ? col : 'transparent'}`, color: on ? col : ink(style, 0.7),
              background: on ? `color-mix(in srgb, ${col} 16%, transparent)` : ink(style, 0.05), fontSize: '1em', fontWeight: on ? 600 : 500, padding: '0 0.6em' }}>
            {icon ? <Icon d={icon} size="1.15em" stroke={on ? 2.2 : 1.8} />
              : <span style={{ width: '1.35em', height: '1.35em', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75em', fontWeight: 700,
                  background: on ? col : `color-mix(in srgb, ${col} 30%, transparent)`, color: on ? '#111' : col }}>{t.label[0].toUpperCase()}</span>}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
