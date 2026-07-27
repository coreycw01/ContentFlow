import { useMemo, useState } from 'react';

import { CHANNELS } from '../../domain/channels';
import { countWords, normaliseGoogleDocUrl, spokenSeconds } from '../../domain/scriptScan';
import type { AssetKind, AssetStatus, ScannedAsset } from '../../domain/types';
import { useStore } from '../../store/store';
import { Card, Chip, Empty, LazyText, Modal, Why, fmtDuration } from '../../ui/components';

const KIND_LABEL: Record<AssetKind, string> = {
  image: 'Image',
  'b-roll': 'B-roll',
  graphic: 'Graphic',
  'screen-recording': 'Screen recording',
  gameplay: 'Gameplay',
  source: 'Source',
  placeholder: 'Placeholder',
};

const STATUS_NEXT: Record<AssetStatus, AssetStatus> = {
  needed: 'have',
  have: 'done',
  done: 'needed',
};

const STATUS_TONE: Record<AssetStatus, 'warn' | 'accent' | 'good'> = {
  needed: 'warn',
  have: 'accent',
  done: 'good',
};

export function ScriptDocTab({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))!;
  const setScriptDoc = useStore((s) => s.setScriptDoc);
  const importScriptFromBeats = useStore((s) => s.importScriptFromBeats);
  const scanScriptAssets = useStore((s) => s.scanScriptAssets);
  const updateAsset = useStore((s) => s.updateAsset);
  const assetToLibrary = useStore((s) => s.assetToLibrary);

  const [docUrlDraft, setDocUrlDraft] = useState(project.scriptDoc.googleDocUrl ?? '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [filter, setFilter] = useState<AssetKind | 'all'>('all');
  const [scanned, setScanned] = useState<number | null>(null);

  const ch = CHANNELS[project.channelId];
  const doc = project.scriptDoc;
  const words = countWords(doc.content);
  const spoken = spokenSeconds(words);

  const assets = useMemo(
    () => (filter === 'all' ? project.assets : project.assets.filter((a) => a.kind === filter)),
    [project.assets, filter],
  );

  const byKind = useMemo(() => {
    const m = new Map<AssetKind, number>();
    for (const a of project.assets) m.set(a.kind, (m.get(a.kind) ?? 0) + 1);
    return m;
  }, [project.assets]);

  const outstanding = project.assets.filter((a) => a.status === 'needed').length;

  const saveDocUrl = () => {
    const result = normaliseGoogleDocUrl(docUrlDraft);
    if ('error' in result) {
      setUrlError(result.error);
      return;
    }
    setUrlError(null);
    setDocUrlDraft(result.url);
    setScriptDoc(projectId, { googleDocUrl: result.url || undefined });
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title="Script"
        sub={
          doc.content
            ? `${words.toLocaleString()} words · about ${fmtDuration(spoken)} spoken · ${doc.source}`
            : 'Write it here, paste it in, or keep it in Google Docs and store the link.'
        }
        right={
          <div className="row">
            {project.script.beats.length > 0 && (
              <button className="btn small" onClick={() => importScriptFromBeats(projectId)}>
                Build from beat sheet
              </button>
            )}
            <button
              className="btn primary"
              disabled={!doc.content.trim()}
              onClick={() => setScanned(scanScriptAssets(projectId))}
            >
              Scan for images and B-roll
            </button>
          </div>
        }
      >
        <LazyText
          rows={18}
          value={doc.content}
          placeholder={`Paste or write the script.\n\nMark what you need as you go — the scanner reads all of these:\n[IMAGE: burnt breaker, macro]\n[B-ROLL: morning routine]\n[GRAPHIC: belief loop diagram]\n[SCREEN: meter reading]\n[GAMEPLAY: clutch at 4:12]\n[SOURCE: NEC 210.8]\n[TODO: find the date]`}
          onCommit={(v) => setScriptDoc(projectId, { content: v, source: doc.source === 'app' ? 'app' : 'pasted' })}
        />

        {ch.scriptMode.scriptRequirement === 'reaction-card' && (
          <Why>
            {ch.name} does not need a written script. Seven bullets on a card is a finished deliverable here.
          </Why>
        )}
      </Card>

      <Card title="Where it lives" sub="Keep the canonical copy wherever you actually write.">
        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              value={docUrlDraft}
              placeholder="https://docs.google.com/document/d/…"
              onChange={(e) => {
                setDocUrlDraft(e.target.value);
                setUrlError(null);
              }}
              onBlur={saveDocUrl}
            />
            {urlError && <div className="small" style={{ color: 'var(--bad)', marginTop: 5 }}>{urlError}</div>}
          </div>
          <button className="btn" onClick={saveDocUrl}>Save link</button>
          {doc.googleDocUrl && (
            <a className="btn" href={doc.googleDocUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              Open in Docs
            </a>
          )}
        </div>

        <Why>
          The link is stored, not synced. This app runs entirely in your browser with no server, so it cannot hold
          Google credentials — write in Docs, then paste the text back here when you want it scanned. If you want
          real two-way sync later, that needs a small backend to hold the OAuth token.
        </Why>
      </Card>

      <Card
        title="Images and B-roll the script asks for"
        sub={
          project.assets.length
            ? `${project.assets.length} found · ${outstanding} still needed`
            : 'Nothing scanned yet.'
        }
        right={
          project.assets.length > 0 && (
            <div className="row" style={{ gap: 4 }}>
              <button className={`btn small${filter === 'all' ? ' primary' : ''}`} onClick={() => setFilter('all')}>
                All
              </button>
              {Array.from(byKind.entries()).map(([k, n]) => (
                <button
                  key={k}
                  className={`btn small${filter === k ? ' primary' : ''}`}
                  onClick={() => setFilter(k)}
                >
                  {KIND_LABEL[k]} {n}
                </button>
              ))}
            </div>
          )
        }
      >
        {project.assets.length === 0 ? (
          <Empty>
            Write the script above with markers like <span className="mono">[IMAGE: …]</span> or{' '}
            <span className="mono">[B-ROLL: …]</span>, then scan. Every marker becomes a shot you can track.
          </Empty>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {assets.map((a) => (
              <AssetRow
                key={a.id}
                asset={a}
                onCycle={() => updateAsset(projectId, a.id, { status: STATUS_NEXT[a.status] })}
                onPrompt={() => a.imagePrompt && setPrompt(a.imagePrompt)}
                onLibrary={() => assetToLibrary(projectId, a.id)}
              />
            ))}
          </div>
        )}

        {project.assets.length > 0 && (
          <Why>
            Re-scanning keeps whatever you have already marked. Nothing you tick here gets lost when the script
            changes.
          </Why>
        )}
      </Card>

      {scanned !== null && (
        <Modal title="Scan complete" onClose={() => setScanned(null)}>
          {scanned === 0 ? (
            <div>
              <p>No markers found.</p>
              <p className="small dim">
                The scanner looks for bracketed tags — <span className="mono">[IMAGE: …]</span>,{' '}
                <span className="mono">[B-ROLL: …]</span>, <span className="mono">[GRAPHIC: …]</span>,{' '}
                <span className="mono">[SCREEN: …]</span>, <span className="mono">[GAMEPLAY: …]</span>,{' '}
                <span className="mono">[SOURCE: …]</span>, <span className="mono">[TODO: …]</span> — or a whole
                line written as <span className="mono">B-ROLL: something</span>.
              </p>
            </div>
          ) : (
            <p>
              Found {scanned} thing{scanned === 1 ? '' : 's'} the script asks for. They are listed below the
              script, and the production board will pick them up.
            </p>
          )}
        </Modal>
      )}

      {prompt && (
        <Modal title="Image generation prompt" onClose={() => setPrompt(null)}>
          <div className="mono prose" style={{ background: 'var(--bg-sunken)', padding: 12, borderRadius: 6 }}>
            {prompt}
          </div>
          <button className="btn small" style={{ marginTop: 12 }} onClick={() => navigator.clipboard?.writeText(prompt)}>
            Copy
          </button>
        </Modal>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  onCycle,
  onPrompt,
  onLibrary,
}: {
  asset: ScannedAsset;
  onCycle: () => void;
  onPrompt: () => void;
  onLibrary: () => void;
}) {
  return (
    <div
      className="row"
      style={{
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '8px 10px',
        background: 'var(--panel-2)',
        borderRadius: 'var(--radius-sm)',
        gap: 10,
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="row" style={{ gap: 6 }}>
          <Chip>{KIND_LABEL[asset.kind]}</Chip>
          <span className="small">{asset.description}</span>
        </div>
        <div className="small dim mono" style={{ marginTop: 3 }}>
          line {asset.line} · {asset.raw.slice(0, 60)}
        </div>
      </div>
      <div className="row" style={{ gap: 5 }}>
        {asset.imagePrompt && (
          <button className="btn small ghost" onClick={onPrompt}>
            Prompt
          </button>
        )}
        <button className="btn small ghost" onClick={onLibrary} title="Save to the content library">
          → Library
        </button>
        <button className="btn small" onClick={onCycle} title="Cycle: needed → have → done">
          <Chip tone={STATUS_TONE[asset.status]}>{asset.status}</Chip>
        </button>
      </div>
    </div>
  );
}
