# SRA Playground

An English-language playground for **100 interactive games** and Yannick
Fontan's **Symbolic Reasoning Agent** research.

## The browser playground

- **100 original game engines:** 25 official games and 75 custom games from
  three waves, selected by their prominent four-character codes. CASC is the
  default; an explicit `?game=CODE` link selects that game instead.
- **Local execution:** the original Python engines run in WebAssembly through
  Pyodide inside a dedicated Web Worker. A TypeScript interface renders their
  observations and sends actions to that local worker.
- **Minimal manual controls:** arrows, a generic Space action, board clicks,
  Undo, current-level Reset, a level dropdown, and Restart from level 1.
  Enabled directions and utility buttons use a bright blue
  fill with white icons; unavailable actions are muted. The player leaves
  the game mechanics for you to discover.
- **SRA-first identity:** SRA Playground and Symbolic Reasoning Agent lead
  the hierarchy, with a prominent ARC AGI 3 heading above the player and the
  credit “75 new custom games created or compiled by Yannick Fontan.” The
  agent name is larger and brighter, with a smaller SRA Playground title and
  prominent custom-game count. Warm black surfaces, off-white text, blue and
  yellow accents retain the ARC-inspired appearance. The patchwork shows 18
  real initial levels from the latest Custom Wave 3, in their original colors
  at full opacity. `scripts/generate-game-mosaic.py` reproduces the asset.
- **SRA Agent:** an upcoming mode. The genuine reasoning agent is not connected
  yet; playable games are not a claim that SRA solves them.
- **Architecture chapters:** `/architecture.html` is a short introduction.
  Four separate pages cover representations, reasoning and the
  **behavior-tree-loop**, memory and reuse, and implementation. They use
  concrete examples, source excerpts, and pinned code links.
- **Video series:** `/videos.html` lists all six public Yanik_AI episodes
  verified on 24 October 2026. Each has a separate page, original thumbnail,
  click-to-load YouTube player, the full original English text published in its
  description, and related architecture/game links.

The 100 games use their original Python engines. They have not all been rewritten
in TypeScript. The independent TypeScript PIPE implementation is retained for
parity tests and future porting work.

The Python runtime, dependencies, and game bundles are loaded from the site's
own origin. After initialization, game actions require no server round trip,
remote inference, or external CDN request. Static hosting serves the initial
files; the game worker performs the computation on the user's device.

### Controls and session state

| Input | Action |
| --- | --- |
| Arrow keys or arrow buttons | Directional action, when available |
| Space or the button below the arrows | Primary action, when available |
| Click or tap the board | Coordinate action, when available |
| Z, Ctrl+Z, or Undo | Undo the last action, when history is available |
| R or Reset | Restart the current level |
| Restart from level 1 | Start the selected game over, clearing its progress and Undo history |
| Level dropdown in Manual mode | Start any authored level of the selected game |
| Game selector | Load or resume the selected game |

Keyboard shortcuts act while the game board is focused. Unsupported actions are
disabled. Undo retains up to 64 steps, with older snapshots evicted when its
memory budget is reached; up to eight game sessions are cached in memory.
Switching games, including browser Back/Forward navigation,
resumes a cached session. Eviction or reloading the page clears that session.
The `?game=CODE` URL selects a game; it does not serialize its progress.

The level dropdown follows the current observation, including natural level
advancement and Undo. Selecting a level starts a fresh practice session for
that level and clears Undo history. The navigation adapter supplies authored
entry prerequisites for games that carry items or knowledge between levels.
Skipped levels are not evidence of solved puzzles or benchmark results.
Reset stays on the current level; Restart from level 1 creates a fresh game.
Games that stop after a selected level show a completion panel with Next level,
or Restart from level 1 when the final level is complete.

### Architecture and video pages

| Route | Content |
| --- | --- |
| `/architecture.html` | Introduction and chapter directory |
| `/architecture/representations.html` | Terms, claims, relation families, roles, mechanisms, and spaces |
| `/architecture/reasoning.html` | Goals, composition, the behavior-tree-loop, and parent continuation |
| `/architecture/memory.html` | Portable activity schemas, current evidence, and reuse |
| `/architecture/implementation.html` | Logos, DRM, SRC, Python, and the browser integration boundary |
| `/videos.html` | The six-episode video index |
| `/videos/<slug>.html` | One episode, its player, full original text, and related links |

Edit `content/architecture.json` and `content/videos.json`, then run
`npm run content:generate`. `scripts/generate-content-pages.mjs` writes complete
HTML documents and shares the same header as the Playground. The generated
HTML is tracked for review; the build regenerates it deterministically.
`src/reading.css` controls the reading layout, and `src/reading.ts` handles
click-to-load video embeds and redirects useful old Architecture section links.

The video catalogue is an explicitly verified snapshot, not an automatic
channel feed. Add newly verified uploads to its data file and keep each
thumbnail's source attribution. Each `fullText` stores the exact original
English description with its author, source URL, and retrieval date. The
episode page renders all of it, including the original paragraph and line
breaks, without a collapsed section or a separate visible text heading. The
short `summary` is used only in page
metadata. The text is attributed to the video description rather than labelled
as an audio transcription. Videos stream from YouTube after Play is
clicked; original thumbnails are served locally from `public/videos/`.
The game runtime is unchanged by this media integration.

## Run locally

Use Node.js **22.18 or newer** (Node 24 is used for validation).

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`dev` and `build` first run `scripts/prepare-python.mjs`. It downloads any missing
runtime assets specified in `scripts/python-runtime-assets.json`, checks their
sizes and SHA-256 hashes, and places them in `public/vendor/pyodide/` for
same-origin delivery. Already verified files are reused. A clean preparation
requires network access; browser play does not fetch those assets from the
upstream CDN.

The pinned runtime is **Pyodide 314.0.7 / CPython 3.14.2**. The asset manifest
totals approximately **18.34 MB**, before hosting compression and excluding the
game archives. Browser download size and cold-start time depend on caching,
compression, device, and connection.

The static build is written to `dist/`. Deploy that directory to a static host.
The `.openai/hosting.json` manifest identifies the existing Sites project; do
not create a second project when updating it. Sites deployment history and
GitHub commits are separate; releases must keep their intended source snapshots
aligned. No automatic GitHub-to-Sites deployment workflow is configured.

## Game sources and the PIPE reference port

The custom source reference is
[ARC-AGI-3-Yannick-Fontan at `212d8d4`](https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan/tree/212d8d426f07eea2b6797c2bb647545767488a96).
The official engines retain their source versions and license headers. Runtime
bundles live under `public/python/`; the official adapter supplies the local
ARC engine interface used by those sources.

### Validate the 100 original engines

The shipped engines and adapters passed **439 advertised action checks**,
**636 level starts and resets**, **100 full restarts**, and **2,789 complete
observation comparisons** between native Python and self-hosted Pyodide.
A separate official
engine suite covers all **183 official levels** and **874 matching observations**.
These checks include animation frames, state, Undo, and deterministic continuation;
they do not establish that every puzzle has been solved.

With Python 3.12+ and NumPy, Pydantic, and typing_extensions installed:

```sh
node scripts/prepare-python.mjs
python scripts/test-level-navigation.py
python scripts/test-python-games.py --output /tmp/sra-native.json
node scripts/test-python-games.mjs --native-report /tmp/sra-native.json
python scripts/test-official-runtime.py --output /tmp/sra-official-native.json
node scripts/test-official-runtime.mjs --native-report /tmp/sra-official-native.json
```

Both WebAssembly runners reject HTTP requests, so a missing local dependency
cannot silently fall back to a CDN. See [release validation](docs/release-validation.md)
for the check scope and remaining limits.

### PIPE TypeScript reference

`src/games/pipes.ts` and
[`reference/python/pipes.py`](reference/python/pipes.py) preserve the original
Python-to-TypeScript parity work. Its **22-test suite** includes 11 scenarios,
618 commands, 610 observations, 644 complete 64 × 64 frames, six independent level
wins, and a full campaign. These results describe the PIPE reference port,
not solve coverage for the 100-game browser runtime or the SRA agent.

To regenerate those deterministic fixtures using Python 3:

```sh
python3 scripts/generate-pipe-fixtures.py
npm test
```

The fixture generator's constraint solver and fixtures are development tools.
They are not bundled as a playing agent. The browser games execute their own
Python mechanics through `game_bridge.py` and `official_adapter.py`.
`custom_level_navigation.py` adapts direct manual entry to the custom engines'
level loaders without changing their source archives or puzzle mechanics.

## Bringing the genuine SRA to the browser

`src/runtime/browser-games.ts` and `src/runtime/game-worker.ts` implement the
current game worker. This worker runs game engines, not SRA reasoning.

`src/runtime/contracts.ts` retains a prepared public observation/action contract
from the PIPE integration work. Connecting the actual SRA requires a complete
cross-game observation contract, an agent lifecycle, faithful reasoning
execution, and comparison against the pinned Python agent.

See [the browser architecture and integration plan](docs/architecture.md) for
runtime boundaries, Undo and Reset semantics, session limits, parity
requirements, and the next SRA milestones.

## License

The Playground's own code is MIT licensed; see [LICENSE](LICENSE). Bundled
game sources, Pyodide, CPython, and dependencies retain their own licenses and
copyright notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the
corresponding attributions and preserved license references.

