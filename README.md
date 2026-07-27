# Creator Engine

A personal-brand content operating system that takes a raw thought from
**idea generation → strategic selection → concept development → packaging → script → production plan → publishing → performance learning**.

The central object is a **Content Project**. Every idea, script beat, thumbnail concept, B-roll note,
production task and performance result belongs to exactly one.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 74 tests covering the doctrine, the scanner and the generators
npm run build
```

Everything is stored in your browser's local storage. Nothing is uploaded. Export from Settings.

---

## The one thing this app refuses to do

It does not treat the four channels equally, and it does not leave that distinction to memory.
The asymmetry lives in [`src/domain/channels.ts`](src/domain/channels.ts) as data, and every other
part of the app reads it from there.

| | Corey Williams | Core Workshop | CDogg | World's Finest |
|---|---|---|---|---|
| Rigor | maximum | high | moderate | **minimal** |
| Virality policy | secondary | secondary | primary | **advisory — never ranks** |
| Weighted hardest on | personal connection, brand value, credibility | credibility, visual potential, searchability | share potential, feasibility, audience relevance | genuine interest, emotional connection, ease |
| Blocks scripting on a vague core argument | **yes, unskippable** | yes | no | no |
| Requires evidence | yes | yes | no | no |
| Requires a safety note | — | **yes** | — | — |
| Script requirement | full script | structured script | **editing script** | **reaction card** |
| Cadence target | 10 days | 10 days | 5 days | **none** |
| Consistency warnings | on | on | on | **off** |
| Overdue indicators | on | on | on | **off** |

**World's Finest is protected from the machine.** Its virality score is computed and displayed, and
`rankingScore()` strips it out entirely so a high-virality idea can never outrank a genuinely wanted
one. It has no cadence target, no overdue badges and no consistency warnings — and the app watches
*itself* for turning the channel into an obligation (`wf-obligation` in the brand warning system
fires when a World's Finest project acquires a full production load or a deadline).

These properties are enforced by tests, not by convention — see
[`src/domain/doctrine.test.ts`](src/domain/doctrine.test.ts).

---

## Each channel is its own workspace

Switching channel changes the home screen, not just the accent colour. The panels, the vocabulary and
the quick actions all come from that channel's definition:

| | Home panels | Calls a project | Quick actions |
|---|---|---|---|
| Corey Williams | body of work · story bank · claim checker · lessons | an **essay** | start from a story, argue with myself |
| Core Workshop | build queue · shopping and shot list · safety check | a **build** | buildable with what I own, import POV footage |
| CDogg | clip bin · unused footage · Shorts queue | a **video** | cut from last session, find Shorts |
| World's Finest | seen something? · watchlist | a **reaction** | just react to something |

World's Finest gets three panels and no counters — no queue, no legacy tracker, no lessons panel,
nothing that accumulates or nags.

## Workflow

**0. A seed** — one word or short phrase is the primary input: "the third week", "the burnt neutral",
"the clutch I do not deserve". Type one, or roll a random seed from that channel's own bank (the banks
never overlap between channels). Generation puts the seed in every title and varies the *angle*, so ten
ideas are ten takes on your thing rather than ten unrelated topics. The full direction form is still
there, collapsed, for when you want to narrow further.

**1. Direction (optional)** — channel, series, goals, audience state, available time, materials, energy,
timeliness, personal experience. Generating ideas without constraints produces generic sludge, so
this comes first.

**2. Idea generation** — 3 focused, 10 broad, one developed deeply, from personal experience, from
the library, from external sources, follow-ups, counterarguments, series continuations. Every idea
card carries an **originality warning**: the engine criticises derivative ideas instead of praising
everything. Rejection reasons feed back and down-weight the patterns you keep turning down.

**3. Selection Room** — up to four ideas side by side, with a blunt recommendation that says which
one is weaker and why. On advisory channels it explicitly refuses to let virality decide.

**4. Concept canvas** — core argument, viewer transformation, starting and ending belief, personal
stake, evidence, tension, counterargument, honest limitation, memorable line. Scripting is **blocked
while the core argument is vague**; the detector flags topic phrases, questions, abstraction soup and
"this video is about…" openers.

**5. Virality Workshop** — ten title directions across search / browse / contrarian / personal-story
/ authority angles, five hooks, three thumbnail concepts with image-generation prompts. Every title
gets the seven quality checks, including *does the video actually deliver it* once a script exists.

**6. Script Studio** — four levels, deliberately: argument map → beat sheet → section drafts →
full script. Thirteen rewrite actions per section, including *preserve my wording*. The channel's own
structure drives the beats.

**7. Timeline & B-roll** — every beat split into dialogue, A-roll, B-roll, on-screen text, graphics,
music, sound FX, source and editing-note tracks. B-roll suggestions distinguish existing footage,
easy-to-record, archival, screen recordings, gameplay, project closeups, generated images, diagrams,
stock, text-only — and **no-B-roll**, because constant coverage is not automatically good editing.

**7b. Script doc and the scanner** — keep the script here, paste it in, or store a Google Docs link
beside it. The scanner reads the script and pulls out everything it asks you to produce:
`[IMAGE: …]`, `[B-ROLL: …]`, `[GRAPHIC: …]`, `[SCREEN: …]`, `[GAMEPLAY: …]`, `[SOURCE: …]`,
`[TODO: …]`, or a whole line written as `B-ROLL: something`. Each becomes a tracked shot you cycle
through needed → have → done, with an image prompt generated for image and graphic kinds. Re-scanning
never loses what you have already ticked.

**8. Production board** — generated from the actual script and timeline, not a static checklist. Each
task shows what it derives from. No gameplay beat, no gameplay task. Scanned assets become tasks too,
labelled with the script line they came from.

**8b. Video status** — recorded / edited / uploaded, tracked separately from the pipeline stage,
because where the work *is* and what physically *exists* are different questions. The Pipeline's Video
board lanes projects by what is in the can. Marking a step advances the stage automatically.

**9. Review** — four separate results kept apart on purpose: packaging (did they click), content (did
they keep watching), brand (did it strengthen the intended identity), creator (were you proud, was
the process sustainable). Lessons flow back into the library and into future generation.

---

## Architecture

```
src/
  domain/          Pure logic, no React
    channels.ts    ← the doctrine. Weights, gates, script modes, pressure policy
    scoring.ts     weighted scores, ranking, the blunt recommendation
    readiness.ts   the vague-argument gate, safety gate, next-action
    production.ts  task generation from script + timeline
    brand.ts       coverage map, 11 warning types, channel health
    review.ts      the four results
  ai/
    localEngine.ts doctrine-driven generator — no key, no network, fully offline
    anthropicEngine.ts  Claude via the official SDK, with per-method fallback to local
    prompts.ts     channel doctrine sent with every request
  store/store.ts   zustand + localStorage
  views/           Command Center, Ideas, Selection Room, Pipeline, Calendar,
                   Library, Brand, Analytics, Settings, and the project workspace
```

### Two engines

The **local engine** runs with no API key and no network. It is not a language model — it is a
doctrine-driven generator that builds ideas, packaging, beat sheets, B-roll plans and reviews from
the channel definition, your direction inputs and your library. It is honest about its limits and it
works on a plane.

The **Claude engine** (Settings → provider) uses `claude-opus-5` with adaptive thinking and structured
outputs. Every method falls back to the local engine if a call fails, so the app never dead-ends.

> The Claude engine calls the API directly from the browser, which puts the key in the page. That is
> fine for a personal tool on your own machine and wrong for anything hosted publicly. If this ever
> goes on the open web, move the calls behind a small server first.

---

## Design principle

Deep without feeling bureaucratic. Every stage has a recommended next action, one primary button,
optional deeper controls behind `.optional-controls`, AI assistance, a visible reason why the step
matters, and — except for the one gate above — the ability to skip.

> Capture quickly. Think deeply. Package honestly. Produce deliberately. Learn continuously.
