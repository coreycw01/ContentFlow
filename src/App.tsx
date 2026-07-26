import { useMemo, useState } from 'react';

import { CHANNELS, CHANNEL_IDS } from './domain/channels';
import { useStore } from './store/store';
import { Modal } from './ui/components';
import { navigate, segments, useRoute } from './ui/router';
import { AnalyticsView } from './views/Analytics';
import { BrandView } from './views/Brand';
import { CalendarView } from './views/Calendar';
import { CommandCenter } from './views/CommandCenter';
import { IdeasView } from './views/Ideas';
import { LibraryView } from './views/Library';
import { PipelineView } from './views/Pipeline';
import { ProjectWorkspace } from './views/ProjectWorkspace';
import { SelectionRoom } from './views/SelectionRoom';
import { SettingsView } from './views/Settings';

const NAV = [
  { path: '/', label: 'Home' },
  { path: '/ideas', label: 'Ideas' },
  { path: '/selection', label: 'Selection Room' },
  { path: '/pipeline', label: 'Pipeline' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/library', label: 'Library' },
  { path: '/brand', label: 'Brand' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/settings', label: 'Settings' },
];

export default function App() {
  const route = useRoute();
  const seg = segments(route);
  const activeChannelId = useStore((s) => s.settings.activeChannelId);
  const setActiveChannel = useStore((s) => s.setActiveChannel);
  const busy = useStore((s) => s.busy);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  const projects = useStore((s) => s.projects);
  const runCommand = useStore((s) => s.runCommand);

  const [command, setCommand] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);

  const openProjectId = seg[0] === 'project' ? seg[1] : undefined;
  const channel = activeChannelId ? CHANNELS[activeChannelId] : null;

  // Channel mode: the entire app adjusts when a channel workspace is open.
  const themeVars = useMemo(
    () =>
      channel
        ? ({ '--accent': channel.accent, '--accent-soft': channel.accentSoft } as React.CSSProperties)
        : ({} as React.CSSProperties),
    [channel],
  );

  const view = () => {
    switch (seg[0]) {
      case undefined:
        return <CommandCenter />;
      case 'ideas':
        return <IdeasView />;
      case 'selection':
        return <SelectionRoom />;
      case 'pipeline':
        return <PipelineView />;
      case 'calendar':
        return <CalendarView />;
      case 'library':
        return <LibraryView />;
      case 'brand':
        return <BrandView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'settings':
        return <SettingsView />;
      case 'project':
        return <ProjectWorkspace projectId={seg[1]} tab={seg[2]} />;
      default:
        return <CommandCenter />;
    }
  };

  const title = () => {
    if (seg[0] === 'project') {
      const p = projects.find((x) => x.id === seg[1]);
      return p?.workingTitle ?? 'Project';
    }
    return NAV.find((n) => n.path === `/${seg[0] ?? ''}`)?.label ?? 'Creator Engine';
  };

  const submitCommand = async () => {
    if (!command.trim()) return;
    const text = command;
    setCommand('');
    const res = await runCommand(text, openProjectId);
    setAnswer(res);
  };

  return (
    <div className="app" style={themeVars} data-density={channel?.workspace.density ?? 'structured'}>
      <aside className="sidebar">
        <div className="brand">
          Creator Engine
          <small>Capture quickly. Think deeply.</small>
        </div>

        <div className="nav-label">Workspace</div>
        <div className="channel-switch">
          <button className={!activeChannelId ? 'active' : ''} onClick={() => setActiveChannel(null)}>
            <span className="swatch" style={{ background: 'var(--text-faint)' }} />
            All channels
          </button>
          {CHANNEL_IDS.map((id) => (
            <button
              key={id}
              className={activeChannelId === id ? 'active' : ''}
              onClick={() => setActiveChannel(id)}
            >
              <span className="swatch" style={{ background: CHANNELS[id].accent }} />
              {CHANNELS[id].name}
            </button>
          ))}
        </div>

        <div className="nav-label">Navigate</div>
        <nav className="nav">
          {NAV.map((n) => (
            <a
              key={n.path}
              href={`#${n.path}`}
              className={`/${seg[0] ?? ''}` === n.path ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.path);
              }}
            >
              <span className="dot" />
              {n.label}
            </a>
          ))}
        </nav>

        {channel && (
          <div style={{ marginTop: 'auto', padding: 16, fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--accent)' }}>{channel.name} mode</strong>
            <div style={{ marginTop: 6 }}>{channel.doctrine}</div>
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{title()}</h1>
          {channel && <span className="sub">{channel.tagline}</span>}
          <div className="spacer" />
          {!channel && <span className="sub">Cross-channel view</span>}
        </header>

        <div className="content">{view()}</div>

        <div className="ai-bar">
          <input
            value={command}
            placeholder={
              openProjectId
                ? 'Ask about this project — challenge the premise, cut repetition, find Shorts moments…'
                : 'Generate ideas for this channel, turn a story into three angles, tell me why an idea is weak…'
            }
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitCommand()}
          />
          <button className="btn" onClick={submitCommand} disabled={!command.trim() || !!busy}>
            Run
          </button>
        </div>
      </div>

      {busy && (
        <div className="busy">
          <span className="spin" />
          {busy.label}
        </div>
      )}

      {answer !== null && (
        <Modal title="AI response" onClose={() => setAnswer(null)}>
          <div className="prose">{answer}</div>
        </Modal>
      )}

      {error && (
        <Modal title="Something went wrong" onClose={() => setError(null)}>
          <div className="blocker">{error}</div>
        </Modal>
      )}
    </div>
  );
}
