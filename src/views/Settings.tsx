import { useState } from 'react';

import { CHANNELS, CHANNEL_IDS, DIMENSION_LABELS, topWeightedDimensions } from '../domain/channels';
import { DIMENSIONS } from '../domain/channels';
import { useStore } from '../store/store';
import { Card, Chip, Field, Modal, ScoreBar, Why } from '../ui/components';

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetAll = useStore((s) => s.resetAll);
  const projects = useStore((s) => s.projects);
  const ideas = useStore((s) => s.ideas);
  const library = useStore((s) => s.library);

  const [confirmReset, setConfirmReset] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ projects, ideas, library, settings }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creator-engine-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card title="AI provider" sub="The app works fully offline. Claude makes the writing better, not the workflow possible.">
        <Field label="Provider">
          <select
            value={settings.aiProvider}
            onChange={(e) => updateSettings({ aiProvider: e.target.value as 'local' | 'anthropic' })}
          >
            <option value="local">Local doctrine engine — no key, no network</option>
            <option value="anthropic">Claude — real generation</option>
          </select>
        </Field>

        {settings.aiProvider === 'local' && (
          <Why>
            The local engine is not a language model. It builds ideas, packaging, beat sheets, B-roll plans and
            reviews from the channel doctrine, your direction inputs and your library. It is honest about its
            limits and it works on a plane.
          </Why>
        )}

        {settings.aiProvider === 'anthropic' && (
          <>
            <Field label="Anthropic API key" hint="Stored in this browser's local storage only. Never sent anywhere except api.anthropic.com.">
              <div className="row">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.anthropicApiKey}
                  placeholder="sk-ant-…"
                  onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
                />
                <button className="btn small ghost" onClick={() => setShowKey(!showKey)}>
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <Field label="Model">
              <select value={settings.anthropicModel} onChange={(e) => updateSettings({ anthropicModel: e.target.value })}>
                <option value="claude-opus-5">Claude Opus 5 — best reasoning and criticism</option>
                <option value="claude-sonnet-5">Claude Sonnet 5 — faster, cheaper</option>
                <option value="claude-haiku-4-5">Claude Haiku 4.5 — fastest</option>
              </select>
            </Field>
            <div className="notice">
              This app calls the API directly from your browser, which means your key is present in the page. That
              is fine for a personal tool on your own machine and wrong for anything you host publicly. If you ever
              put this on the open web, move the calls behind a small server first.
            </div>
            {!settings.anthropicApiKey.trim() && (
              <div className="blocker" style={{ marginTop: 10 }}>
                No key set — the app is still using the local engine.
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Channel doctrine" sub="Read-only. This is the asymmetry the whole product is built on.">
        <div className="grid two">
          {CHANNEL_IDS.map((cid) => {
            const ch = CHANNELS[cid];
            return (
              <div key={cid} className="card" style={{ margin: 0, borderLeft: `2px solid ${ch.accent}` }}>
                <h3>{ch.name}</h3>
                <div className="card-sub">{ch.tagline}</div>
                <p className="small">{ch.doctrine}</p>
                <div className="row" style={{ gap: 5, marginBottom: 10 }}>
                  <Chip>rigor: {ch.rigor}</Chip>
                  <Chip tone={ch.viralityPolicy === 'advisory' ? 'good' : undefined}>
                    virality: {ch.viralityPolicy}
                  </Chip>
                  <Chip>priority {ch.strategicPriority}</Chip>
                </div>
                <div className="small dim" style={{ marginBottom: 6 }}>Scoring weights:</div>
                <div className="col" style={{ gap: 4 }}>
                  {DIMENSIONS.slice()
                    .sort((a, b) => ch.weights[b] - ch.weights[a])
                    .map((d) => (
                      <ScoreBar
                        key={d}
                        dimension={d}
                        value={(ch.weights[d] / 10) * 100}
                        dim={ch.deprioritised.includes(d)}
                      />
                    ))}
                </div>
                <div className="small dim" style={{ marginTop: 10 }}>
                  Weighted hardest on {topWeightedDimensions(cid, 3).map((d) => DIMENSION_LABELS[d].toLowerCase()).join(', ')}.
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Your data" sub="Everything lives in this browser. Nothing is uploaded.">
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          <Chip>{projects.length} projects</Chip>
          <Chip>{ideas.length} ideas</Chip>
          <Chip>{library.length} library entries</Chip>
        </div>
        <div className="row">
          <button className="btn" onClick={exportData}>
            Export as JSON
          </button>
          <button className="btn ghost danger" onClick={() => setConfirmReset(true)}>
            Reset everything
          </button>
        </div>
      </Card>

      {confirmReset && (
        <Modal title="Reset everything?" onClose={() => setConfirmReset(false)}>
          <div className="blocker">
            This deletes all {projects.length} projects, {ideas.length} ideas and your library, and cannot be
            undone. Export first if you want a copy.
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={() => {
                resetAll();
                setConfirmReset(false);
              }}
            >
              Delete everything
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
