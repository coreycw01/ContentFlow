import { useMemo, useState } from 'react';

import { ALL_BRAND_ASSOCIATIONS, CHANNELS, CHANNEL_IDS } from '../domain/channels';
import type { ChannelId, LibraryEntry, LibraryType } from '../domain/types';
import { useStore } from '../store/store';
import { Card, Chip, Empty, Field, LazyText, Modal, Why, relativeDays } from '../ui/components';
import { navigate } from '../ui/router';

const TYPES: { id: LibraryType; label: string }[] = [
  { id: 'raw-idea', label: 'Raw ideas' },
  { id: 'personal-story', label: 'Personal stories' },
  { id: 'lesson', label: 'Lessons learned' },
  { id: 'quote', label: 'Quotes' },
  { id: 'research', label: 'Research' },
  { id: 'book', label: 'Books' },
  { id: 'framework', label: 'Frameworks' },
  { id: 'build-project', label: 'Build projects' },
  { id: 'technical-explanation', label: 'Technical explanations' },
  { id: 'gameplay-moment', label: 'Gameplay moments' },
  { id: 'movie-reaction', label: 'Movie reactions' },
  { id: 'b-roll', label: 'B-roll' },
  { id: 'thumbnail-photo', label: 'Thumbnail photos' },
  { id: 'hook-pattern', label: 'Hook patterns' },
  { id: 'successful-title', label: 'Successful titles' },
  { id: 'rejected-idea', label: 'Rejected ideas' },
  { id: 'unfinished-script', label: 'Unfinished scripts' },
];

/** Saved queries from the spec — each one is a real filter plus a generation call. */
const QUERIES: {
  label: string;
  channelId: ChannelId;
  filter: (e: LibraryEntry) => boolean;
}[] = [
  {
    label: 'Corey Williams ideas from unresolved personal stories',
    channelId: 'corey-williams',
    filter: (e) => e.type === 'personal-story' && !!e.unresolved && !e.used,
  },
  {
    label: 'Core Workshop projects I can do with what I own',
    channelId: 'core-workshop',
    filter: (e) => e.type === 'build-project' && e.materialsOnHand === true,
  },
  {
    label: 'Unused gameplay moments with strong reactions',
    channelId: 'cdogg',
    filter: (e) => e.type === 'gameplay-moment' && !e.used,
  },
  {
    label: "World's Finest reactions I actually want to make",
    channelId: 'worlds-finest',
    filter: (e) => e.type === 'movie-reaction' && !e.used,
  },
];

export function LibraryView() {
  const library = useStore((s) => s.library);
  const addLibraryEntry = useStore((s) => s.addLibraryEntry);
  const updateLibraryEntry = useStore((s) => s.updateLibraryEntry);
  const deleteLibraryEntry = useStore((s) => s.deleteLibraryEntry);
  const generateIdeas = useStore((s) => s.generateIdeas);
  const setDirection = useStore((s) => s.setDirection);
  const busy = useStore((s) => s.busy);

  const [filterType, setFilterType] = useState<LibraryType | 'all'>('all');
  const [filterChannel, setFilterChannel] = useState<ChannelId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      library.filter((e) => {
        if (filterType !== 'all' && e.type !== filterType) return false;
        if (filterChannel !== 'all' && e.channelIds.length > 0 && !e.channelIds.includes(filterChannel)) return false;
        if (search && !`${e.title} ${e.body} ${e.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      }),
    [library, filterType, filterChannel, search],
  );

  const runQuery = (q: (typeof QUERIES)[number]) => {
    const matches = library.filter(q.filter);
    if (matches.length === 0) return;
    setDirection({ channelId: q.channelId });
    generateIdeas({ origin: 'library', count: Math.min(5, matches.length + 2), sourceEntryIds: matches.map((m) => m.id) });
    navigate('/ideas');
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card title="Generate from the library" sub="Turn material you already have into ideas.">
        <Why>
          The most defensible content you have is usually already written down and unspent. These queries find it.
        </Why>
        <div className="grid two">
          {QUERIES.map((q) => {
            const count = library.filter(q.filter).length;
            return (
              <button
                key={q.label}
                className="btn"
                disabled={count === 0 || !!busy}
                style={{ textAlign: 'left', padding: '10px 12px' }}
                onClick={() => runQuery(q)}
              >
                <div style={{ fontWeight: 600 }}>{q.label}</div>
                <div className="small dim">
                  {count} matching item{count === 1 ? '' : 's'}
                  {count === 0 && ' — nothing to work with yet'}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title={`Content library — ${filtered.length} of ${library.length}`}
        right={
          <button className="btn primary" onClick={() => setAdding(true)}>
            Add entry
          </button>
        }
      >
        <div className="row" style={{ gap: 8 }}>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as LibraryType | 'all')} style={{ width: 200 }}>
            <option value="all">All types</option>
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value as ChannelId | 'all')}
            style={{ width: 190 }}
          >
            <option value="all">All channels</option>
            {CHANNEL_IDS.map((c) => (
              <option key={c} value={c}>
                {CHANNELS[c].name}
              </option>
            ))}
          </select>
          <input style={{ flex: 1 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Empty>Nothing matches. Try a wider filter, or add an entry.</Empty>
      ) : (
        <div className="grid two">
          {filtered.map((e) => (
            <div key={e.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ flex: 1 }}>{e.title}</h3>
                <Chip>{TYPES.find((t) => t.id === e.type)?.label ?? e.type}</Chip>
              </div>
              <p className="small" style={{ margin: '8px 0' }}>{e.body}</p>
              <div className="row" style={{ gap: 4 }}>
                {e.channelIds.map((c) => (
                  <Chip key={c}>{CHANNELS[c].name}</Chip>
                ))}
                {e.tags.map((t) => (
                  <Chip key={t}>#{t}</Chip>
                ))}
                {e.unresolved && <Chip tone="warn">unresolved</Chip>}
                {e.materialsOnHand && <Chip tone="good">materials on hand</Chip>}
                <Chip tone={e.used ? undefined : 'good'}>{e.used ? 'used' : 'unused'}</Chip>
              </div>
              <div className="row optional-controls" style={{ marginTop: 10 }}>
                <button
                  className="btn small ghost"
                  onClick={() => updateLibraryEntry(e.id, { used: !e.used })}
                >
                  Mark {e.used ? 'unused' : 'used'}
                </button>
                <button className="btn small ghost" onClick={() => setEditing(e.id)}>
                  Edit
                </button>
                <button
                  className="btn small ghost"
                  disabled={!!busy}
                  onClick={() => {
                    setDirection({ channelId: e.channelIds[0] ?? 'corey-williams', topic: e.title });
                    generateIdeas({ origin: 'library', count: 3, sourceEntryIds: [e.id] });
                    navigate('/ideas');
                  }}
                >
                  Turn into ideas
                </button>
                <button className="btn small ghost danger" onClick={() => deleteLibraryEntry(e.id)}>
                  Delete
                </button>
              </div>
              <div className="small dim" style={{ marginTop: 8 }}>Added {relativeDays(e.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <EntryModal
          title="Add library entry"
          onClose={() => setAdding(false)}
          onSave={(entry) => {
            addLibraryEntry(entry);
            setAdding(false);
          }}
        />
      )}

      {editing && (
        <EntryModal
          title="Edit entry"
          initial={library.find((e) => e.id === editing)}
          onClose={() => setEditing(null)}
          onSave={(entry) => {
            updateLibraryEntry(editing, entry);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EntryModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial?: LibraryEntry;
  onClose: () => void;
  onSave: (e: Omit<LibraryEntry, 'id' | 'createdAt' | 'usedByProjectIds'>) => void;
}) {
  const [type, setType] = useState<LibraryType>(initial?.type ?? 'personal-story');
  const [name, setName] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [channelIds, setChannelIds] = useState<ChannelId[]>(initial?.channelIds ?? []);
  const [associations, setAssociations] = useState<string[]>(initial?.brandAssociations ?? []);
  const [unresolved, setUnresolved] = useState(!!initial?.unresolved);
  const [materialsOnHand, setMaterialsOnHand] = useState(!!initial?.materialsOnHand);
  const [source, setSource] = useState(initial?.source ?? '');

  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Type">
        <select value={type} onChange={(e) => setType(e.target.value as LibraryType)}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Body">
        <LazyText rows={5} value={body} onCommit={setBody} />
      </Field>
      <Field label="Tags" hint="Comma separated.">
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </Field>
      <Field label="Channels" hint="Leave empty if it serves any channel.">
        <div className="row" style={{ gap: 5 }}>
          {CHANNEL_IDS.map((c) => (
            <button
              key={c}
              className={`btn small${channelIds.includes(c) ? ' primary' : ''}`}
              onClick={() =>
                setChannelIds(channelIds.includes(c) ? channelIds.filter((x) => x !== c) : [...channelIds, c])
              }
            >
              {CHANNELS[c].name}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Brand associations">
        <div className="row" style={{ gap: 5 }}>
          {ALL_BRAND_ASSOCIATIONS.map((a) => (
            <button
              key={a}
              className={`btn small${associations.includes(a) ? ' primary' : ''}`}
              onClick={() =>
                setAssociations(associations.includes(a) ? associations.filter((x) => x !== a) : [...associations, a])
              }
            >
              {a}
            </button>
          ))}
        </div>
      </Field>
      {type === 'personal-story' && (
        <label className="row small" style={{ gap: 6, marginBottom: 10 }}>
          <input type="checkbox" checked={unresolved} onChange={(e) => setUnresolved(e.target.checked)} />
          Still unresolved — the story has no tidy ending yet
        </label>
      )}
      {type === 'build-project' && (
        <label className="row small" style={{ gap: 6, marginBottom: 10 }}>
          <input type="checkbox" checked={materialsOnHand} onChange={(e) => setMaterialsOnHand(e.target.checked)} />
          Can be completed with tools and materials I already own
        </label>
      )}
      {(type === 'gameplay-moment' || type === 'b-roll') && (
        <Field label="Source">
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Session, game or shoot" />
        </Field>
      )}
      <button
        className="btn primary"
        disabled={!name.trim()}
        onClick={() =>
          onSave({
            type,
            title: name.trim(),
            body,
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
            channelIds,
            brandAssociations: associations,
            used: initial?.used ?? false,
            unresolved: type === 'personal-story' ? unresolved : undefined,
            materialsOnHand: type === 'build-project' ? materialsOnHand : undefined,
            source: source || undefined,
          })
        }
      >
        Save
      </button>
    </Modal>
  );
}
