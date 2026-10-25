import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, caps, sdk, useNow, dayKey, fmtTime, Fit, useBox } from './ui';
import { pickGames, channels, teamName, isLive, type Game, type Team } from './logic';

const PID = 'next-game';
const lightText = (c?: string) => { const h = String(c || '').replace('#', ''); if (h.length < 6) return false; const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b > 150; };

export default function NextGame({ config, style, timezone: tz, timeFormat }: PluginComponentProps & { timeFormat?: string }) {
  const team = String(config.team || '').trim().toUpperCase();
  const lang = (String(config.language || 'en') as 'fr' | 'en' | 'both');
  const accent = String(config.accentColor || '#2563eb');
  const now = useNow(30000);
  const [games, setGames] = React.useState<Game[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [box, size] = useBox<HTMLDivElement>();
  const dark = lightText(style?.textColor);

  const picked = games ? pickGames(games, now.getTime()) : null;
  // After a game, keep the final score up until an hour before the next game starts.
  const showFinal = !!(picked && !picked.live && picked.last && (!picked.next || Date.parse(picked.next.startTimeUTC) - now.getTime() > 60 * 60e3));
  const focus = picked?.live ?? (showFinal ? picked?.last : picked?.next);
  const soon = focus ? Math.abs(Date.parse(focus.startTimeUTC) - now.getTime()) < 45 * 60e3 || isLive(focus) : false;
  const tick = Math.floor(now.getTime() / (soon ? 60e3 : 600e3));

  React.useEffect(() => { (async () => {
    if (!team) return;
      try {
      const res: Response = await sdk().pluginFetch(PID, { url: `https://api-web.nhle.com/v1/club-schedule-season/${team}/now`, cacheTtlMs: soon ? 50e3 : 540e3 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json(); setGames(j.games ?? []); setErr(null);
    } catch { setErr('Can’t reach the NHL schedule right now.'); }
  })(); }, [team, tick]);  // eslint-disable-line react-hooks/exhaustive-deps

  const logo = (t: Team, s: string) => {
    const src = (dark ? t.darkLogo : t.logo) || t.logo;
    return src ? <img src={src} alt={teamName(t)} style={{ width: s, height: s, objectFit: 'contain' }} /> : <div style={{ width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{t.abbrev}</div>;
  };
  const when = (g: Game) => {
    const d = new Date(g.startTimeUTC); const today = dayKey(now, tz); const day = dayKey(d, tz);
    const tomorrow = dayKey(new Date(now.getTime() + 86400e3), tz);
    const label = day === today ? (d.getTime() - now.getTime() < 0 ? 'Started' : 'Tonight') : day === tomorrow ? 'Tomorrow'
      : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }).format(d);
    return `${label} · ${fmtTime(d, tz, timeFormat)}`;
  };
  const inDays = (g: Game) => { const n = Math.round((Date.parse(`${dayKey(new Date(g.startTimeUTC), tz)}T12:00:00Z`) - Date.parse(`${dayKey(now, tz)}T12:00:00Z`)) / 86400e3); return n <= 0 ? '' : n === 1 ? '' : `in ${n} days`; };
  const opp = (g: Game) => (g.homeTeam.abbrev === team ? g.awayTeam : g.homeTeam);
  const home = (g: Game) => g.homeTeam.abbrev === team;
  const narrow = size.w > 0 && size.w < 26 * (Number(style?.fontSize) || 18);

  if (!team) return <div ref={box} style={frame(style, { alignItems: 'center', justifyContent: 'center', opacity: 0.55, fontSize: '0.85em' })}>Pick your team in Plugins → next-game.</div>;
  if (err && !games) return <div ref={box} style={frame(style, { alignItems: 'center', justifyContent: 'center', opacity: 0.55, fontSize: '0.85em' })}>{err}</div>;
  if (!picked || !focus) return <div ref={box} style={frame(style, { alignItems: 'center', justifyContent: 'center', opacity: 0.5, fontSize: '0.85em' })}>{games ? 'No upcoming games on the schedule.' : 'Loading the schedule…'}</div>;

  const live = isLive(focus);
  const final = showFinal && focus === picked.last;
  const nextG = final ? picked.next : undefined;
  const tv = channels(nextG ?? focus, lang);
  const last = picked.last;
  const lastLine = last ? (() => {
    const us = last.homeTeam.abbrev === team ? last.homeTeam : last.awayTeam; const them = last.homeTeam.abbrev === team ? last.awayTeam : last.homeTeam;
    const win = (us.score ?? 0) > (them.score ?? 0); const ot = last.gameOutcome?.lastPeriodType && last.gameOutcome.lastPeriodType !== 'REG' ? ` ${last.gameOutcome.lastPeriodType}` : '';
    return { win, text: `${win ? 'W' : 'L'} ${us.score}–${them.score}${ot} ${last.homeTeam.abbrev === team ? 'vs' : '@'} ${them.abbrev}` };
  })() : null;
  const preseason = focus.gameType === 1 ? 'Preseason · ' : focus.gameType === 3 ? 'Playoffs · ' : '';

  return (
    <div ref={box} style={frame(style)}>
      <Fit max={1.9} min={0.55}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
          <span style={{ ...caps, color: live ? '#dc2626' : final ? (((home(focus) ? focus.homeTeam.score : focus.awayTeam.score) ?? 0) > ((home(focus) ? focus.awayTeam.score : focus.homeTeam.score) ?? 0) ? '#16a34a' : '#dc2626') : accent, opacity: 1 }}>{live ? '● Live now' : final ? `Final · ${new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }).format(new Date(focus.startTimeUTC))}` : `Next game`}</span>
          <span style={{ fontSize: '0.65em', opacity: 0.5 }}>{preseason}{focus.venue?.default ?? ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9em', marginTop: '0.5em' }}>
          {logo(focus.awayTeam, '3.4em')}
          <div style={{ textAlign: 'center', minWidth: '3.5em' }}>
            {live || final ? <div style={{ fontSize: '1.9em', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{focus.awayTeam.score ?? 0}–{focus.homeTeam.score ?? 0}</div>
              : <div style={{ fontSize: '1.1em', fontWeight: 600, opacity: 0.55 }}>{home(focus) ? 'vs' : '@'}</div>}
            {final ? <div style={{ fontSize: '0.65em', opacity: 0.6 }}>{focus.gameOutcome?.lastPeriodType && focus.gameOutcome.lastPeriodType !== 'REG' ? `Final/${focus.gameOutcome.lastPeriodType}` : 'Final'}</div> : null}
            {live && focus.periodDescriptor?.number ? <div style={{ fontSize: '0.65em', opacity: 0.6 }}>{focus.periodDescriptor.periodType === 'REG' ? `Period ${focus.periodDescriptor.number}` : focus.periodDescriptor.periodType}</div> : null}
          </div>
          {logo(focus.homeTeam, '3.4em')}
          {!narrow && (
            <div style={{ minWidth: 0, marginLeft: '0.4em' }}>
              <div style={{ fontSize: '1.25em', fontWeight: 650, lineHeight: 1.15 }}>{home(focus) ? 'vs ' : '@ '}{teamName(opp(focus))}</div>
              <div style={{ fontSize: '0.9em', opacity: 0.75, marginTop: '0.15em' }}>{final && lastLine ? (lastLine.win ? 'Win' : 'Loss') : <>{when(focus)} <span style={{ opacity: 0.6 }}>{inDays(focus)}</span></>}</div>
            </div>
          )}
        </div>
        {narrow && (
          <div style={{ marginTop: '0.5em' }}>
            <div style={{ fontSize: '1.15em', fontWeight: 650, lineHeight: 1.15 }}>{home(focus) ? 'vs ' : '@ '}{teamName(opp(focus))}</div>
            <div style={{ fontSize: '0.85em', opacity: 0.75 }}>{final && lastLine ? (lastLine.win ? 'Win' : 'Loss') : <>{when(focus)} <span style={{ opacity: 0.6 }}>{inDays(focus)}</span></>}</div>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35em', marginTop: '0.7em' }}>
          <span style={{ fontSize: '0.7em', fontWeight: 600, opacity: 0.55, marginRight: '0.2em' }}>{nextG ? `NEXT: ${home(nextG) ? 'vs' : '@'} ${opp(nextG).abbrev} · ${when(nextG).toUpperCase()} ·` : ''} 📺 WATCH ON</span>
          {tv.length ? tv.map((c) => <span key={c} style={{ fontSize: '0.8em', fontWeight: 600, padding: '0.2em 0.65em', borderRadius: '0.45em', background: `color-mix(in srgb, ${accent} ${dark ? 30 : 14}%, transparent)` }}>{c}</span>)
            : <span style={{ fontSize: '0.8em', opacity: 0.5 }}>Not announced yet</span>}
        </div>
        {(lastLine || picked.upcoming.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em 1em', marginTop: '0.7em', paddingTop: '0.5em', borderTop: `1px solid ${ink(style, 0.1)}`, fontSize: '0.7em' }}>
            {lastLine && !final && <span><span style={{ opacity: 0.5 }}>Last </span><b style={{ color: lastLine.win ? '#16a34a' : '#dc2626' }}>{lastLine.text}</b></span>}
            {picked.upcoming.map((g) => <span key={g.id} style={{ opacity: 0.7 }}>{new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: tz }).format(new Date(g.startTimeUTC))} {home(g) ? 'vs' : '@'} {opp(g).abbrev}</span>)}
          </div>
        )}
      </Fit>
    </div>
  );
}
