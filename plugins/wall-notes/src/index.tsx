import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, Icon, I, sdk, useNow } from './ui';

const API = 'https://api.todoist.com/api/v1';
const AUTH = { header: { Authorization: 'Bearer {{todoist_token}}' } };
type Task = { id: string; content: string; description?: string; added_at?: string; child_order?: number };
async function call(url: string, method = 'GET') {
  const res: Response = await sdk().pluginFetch('wall-notes', { url, method, secretInjections: AUTH, cacheTtlMs: method === 'GET' ? 30000 : 0 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`); return method === 'GET' ? res.json() : null;
}
const TINTS = ['#fde68a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa', '#ddd6fe'];
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '');

export default function WallNotes({ config, style }: PluginComponentProps) {
  const now = useNow(60000);
  const projectName = String(config.projectName || 'Wall notes');
  const max = Number(config.maxNotes ?? 6);
  const [notes, setNotes] = React.useState<Task[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [gone, setGone] = React.useState<Set<string>>(new Set());
  const tick = Math.floor(now.getTime() / 60000);
  React.useEffect(() => { (async () => {
    try {
      const pj = await call(`${API}/projects?limit=200`);
      const p = (pj.results ?? pj).find((x: any) => String(x.name).toLowerCase() === projectName.toLowerCase());
      if (!p) { setErr(`Make a Todoist project called “${projectName}”`); return; }
      const tj = await call(`${API}/tasks?project_id=${p.id}&limit=50`);
      setNotes((tj.results ?? tj).sort((a: Task, b: Task) => (b.added_at ?? '').localeCompare(a.added_at ?? ''))); setErr(null);
    } catch (e) { setErr(/HTTP (401|403|500)/.test(String((e as Error).message)) ? 'Add your Todoist API token in Plugins → wall-notes.' : 'Can’t reach Todoist right now.'); }
  })(); }, [tick, projectName]);

  const dismiss = async (t: Task) => {
    setGone((g) => new Set(g).add(t.id));
    try { await call(`${API}/tasks/${t.id}/close`, 'POST'); } catch { setGone((g) => { const n = new Set(g); n.delete(t.id); return n; }); }
  };
  const shown = (notes ?? []).filter((n) => !gone.has(n.id)).slice(0, max);
  const ago = (iso?: string) => { if (!iso) return ''; const m = (now.getTime() - Date.parse(iso)) / 60000; return m < 60 ? `${Math.max(1, Math.round(m))} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
  const dark = /^#(1|2|0)/.test(String(style.backgroundColor || ''));

  return (
    <div style={frame(style, { gap: '0.6em' })}>
      {err ? <div style={{ margin: 'auto', fontSize: '0.8em', opacity: 0.6 }}>{err}</div>
        : shown.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.4 }}>
            <Icon d={I.check} size="1.6em" stroke={1.6} style={{ margin: '0 auto 0.3em' }} />
            <div style={{ fontSize: '0.8em' }}>{notes ? `No notes — add one to “${projectName}” in Todoist` : 'Loading notes…'}</div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, shown.length)}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)', gap: '0.7em' }}>
            {shown.map((n, i) => {
              const tint = TINTS[i % TINTS.length];
              return (
                <button key={n.id} onClick={() => dismiss(n)} aria-label={`Take down note: ${plain(n.content)}`}
                  style={{ appearance: 'none', border: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.3em', minHeight: 0, overflow: 'hidden',
                    padding: '0.8em 0.9em', borderRadius: '0.5em 0.5em 1.2em 0.5em', transform: `rotate(${[-1.2, 0.8, -0.5, 1, -0.8, 0.5][i % 6]}deg)`,
                    background: dark ? `color-mix(in srgb, ${tint} 22%, #1a1918)` : tint, color: dark ? '#f5f5f4' : '#1c1917', boxShadow: dark ? 'none' : '0 2px 6px rgba(0,0,0,0.08)' }}>
                  <span style={{ fontSize: '1.05em', fontWeight: 500, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{plain(n.content)}</span>
                  {n.description && <span style={{ fontSize: '0.7em', opacity: 0.7, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{plain(n.description)}</span>}
                  <span style={{ marginTop: 'auto', fontSize: '0.6em', opacity: 0.5 }}>{ago(n.added_at)} · tap to take down</span>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}
