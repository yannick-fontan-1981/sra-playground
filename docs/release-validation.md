# 100-game browser runtime validation

Validated on 23 October 2026 with Node 24.19.0, TypeScript 5.9.3,
Vite 8.0.13, and self-hosted Pyodide 314.0.7 / CPython 3.14.2.

This release replaces the catalogue placeholders with the **100 original game
engines**: 25 official games and 75 custom games. The TypeScript interface sends
actions to a local Python WebAssembly worker. It does not depend on a remote
game API or a server-side Python process during play.

## Original sources

- All 529 custom source and level files match their recorded SHA-256 and Git
  blob hashes from upstream commit
  `212d8d426f07eea2b6797c2bb647545767488a96`.
- All 25 official source files match their recorded SHA-256 hashes. The exact
  game versions, acquisition URLs, metadata, and license headers are preserved
  in `public/python/official-games.zip`.
- The seven required ARCEngine modules match pinned commit
  `b495c6acaf253c9681cd7b75c4299d352e9ce6f8` (0.9.3).
- Original engine source bytes remain unchanged. Adaptation lives in the
  separate `game_bridge.py` and `official_adapter.py` files.
- The packaged runtime has no solution oracle or recorded solving agent.

## Complete JSON bridge comparison

`scripts/test-python-games.py` exercises the same archives and JSON boundary
that the browser worker uses. `scripts/test-python-games.mjs` runs the same
checks in the pinned Pyodide runtime and compares its observations against the
native Python report.

| Check | Result |
| --- | ---: |
| Games loaded and exercised | 100 / 100 |
| Advertised action combinations | 439 |
| Accessible level starts and current-level Reset checks | 373 |
| Complete matching observations | 2,163 |
| HTTP requests in the WebAssembly validation | 0 |
| Failures | 0 |

Observation signatures include every returned animation frame, timing data,
palette, state, level information, available actions, and Undo availability.
For each tested action, Undo restores the preceding observation and repeating
the action reproduces the same result. Invalid inputs leave the state unchanged.
History and session-cache limits are also exercised.

The suite covers every level exposed by native direct selection: all 25 official
adapters and 23 custom engines support that operation. The other 52 custom
engines retain their authored progression and are tested from level 1 here.
This count must not be presented as all 636 catalogue levels having been solved
or exhaustively tested.

A separate gameplay check completed all six SKBN levels, then reset the final
WIN state. Reset restored the exact starting frame of level 6, retained five
completed levels, and cleared Undo history. No solving code or solution trace
from that check is shipped in the site.

## Official engine comparison

`scripts/test-official-runtime.py` and `scripts/test-official-runtime.mjs`
add native/Pyodide checks focused on the original ARC engines:

| Check | Result |
| --- | ---: |
| Official games | 25 / 25 |
| Authored levels initialized and exercised | 183 / 183 |
| Advertised game/action-ID combinations | 100 |
| Matching frame, animation, and state observations | 874 |
| HTTP requests in the WebAssembly validation | 0 |

These checks include current-level Reset, full Reset, repeated observations,
pickle/deepcopy restoration, and deterministic continuation after Undo.
The adapter isolates Python and NumPy RNG state and reconstructs engine
closures from the seed and actual command history when restoring an official
game.

Both WebAssembly runners explicitly reject HTTP requests. Missing local runtime
assets fail the checks instead of falling back to a CDN. This verifies the
self-contained asset set; the real website must still download its initial
static assets from its own origin.

## Interface, build, and browser scope

- Strict TypeScript type checking and the production build pass.
- The retained TypeScript PIPE parity test file passes. Its 22 cases cover
  11 scenarios, 618 commands, 610 observations, 644 complete frame hashes,
  six isolated level wins, and an entire six-level campaign.
- The 100-game selector keeps four groups of 25, each sorted alphabetically by
  its four-character game code.
- The compiled interface contains compact directional
  actions, neutral Space action, a separate Undo button, and a separate Reset
  button. It removes the prior level title, instructions, connected-cell
  counter, rotations, leaks, and loops panels.
- The production bundle contains the Python sources, WebAssembly runtime,
  local dependency wheels, and preserved notices. Development tests and PIPE
  fixtures remain outside `dist/`.
- Source review checks stale-selection guards, serial worker requests, action
  availability, terminal-state Undo/Reset, and local-only asset paths.
- **Initial 100-game release:** fresh Chrome UI verification could not be completed. The managed preview
  reported running, but two browser-control calls timed out. Browser rendering,
  actual Web Worker integration in Chrome, responsive appearance, touch input,
  and a new screenshot were therefore unverified for that release. The
  native/WebAssembly checks above passed independently of that infrastructure.

## ARC visual identity update

The following interface update uses ARC AGI 3 as the prominent shared header
and homepage title, with SRA Playground identified as independent research.
The warm black, off-white, mono navigation, and pixel framing were informed
by live inspection of the official ARC-AGI-3 overview and task player. Blue
interface accents follow the user’s explicit preference, with yellow retained
for key controls. The 405 × 204 hero mosaic is rendered from initial public frames of
18 bundled games, including nine official and nine custom games. Its generator
is kept in `scripts/generate-game-mosaic.py`.

The same identity is used on the Architecture page. The four alphabetically
sorted groups of 25 games, compact controls, Undo, and Reset remain in place.
The Python engines and worker protocol are unchanged by this visual update.
Strict TypeScript checking and the production build pass.

Fresh Chrome verification now succeeds for the updated interface:

- The local Web Worker loads PIPE and reaches Ready with its actual board.
- Space changes the board; Undo visibly restores it and clears the available
  history. A second action followed by Reset restores the starting board and
  leaves Undo disabled.
- LS20 loads its actual board, seven level buttons, and native action availability.
- The selector contains 100 options in four groups of 25, each sorted by code.
- The removed instructions and statistics panels remain absent.
- The shared ARC AGI 3 header and Architecture page render correctly. Both pages
  have no horizontal document overflow at the checked 1348-pixel desktop width.
- No game/runtime error surfaced during these checks. A separate mobile-device
  or touch-hardware session was not performed.

![ARC-inspired Playground with blue accents](arc-playground-20261023.jpg)

![Architecture with the shared ARC AGI 3 identity](arc-architecture-20261023.jpg)

## SRA identity and architecture narrative update

SRA Playground is now the primary shared identity and homepage heading.
Symbolic Reasoning Agent is a large blue subtitle on the homepage and the
Architecture page's main heading. ARC AGI 3 remains a smaller research-context
label. The original game mosaic, blue interface accents, compact controls,
and four sorted groups are retained.

The Architecture page now develops a case for symbolic reasoning, the
artificial cortex ambition, an explicitly qualified binary/assembly analogy,
relational meaning, a behavior-tree-loop, current implementation mechanisms,
and behavioral evidence to seek. Current upstream main was verified as
`212d8d426f07eea2b6797c2bb647545767488a96`, matching the pinned code links.
An independent content review checked the claims against that source. The
copy distinguishes informative progress from physical completion, authored
structures from acquired knowledge, and architectural mechanisms from
demonstrated transfer.

The two Google Docs supplied with the request were inaccessible in this
session (HTTP 401 / Google sign-in). No text or ideas are attributed to their
unread contents. The narrative uses the inspected repository, the explicit
project brief, and the cited primary research context.

The new interactive example is an authored presentation of three mechanisms,
separate from the game runtime. It does not execute SRA or report a game run.
Fresh Chrome checks confirmed:

- The homepage's primary heading is 72 px at the checked desktop width;
  Symbolic Reasoning Agent is 34 px and the ARC AGI 3 context label is 9 px.
- PIPE reaches Ready. Space changes its board; Undo reports restoration;
  Reset restores the level and leaves Undo disabled.
- The selector still has 100 options in four groups of 25, all alphabetically
  sorted by code within their original groups.
- All three illustration buttons change the relation, prerequisite, plan,
  and progress criterion; exactly one button has `aria-pressed="true"`.
- All local Architecture fragment links resolve. The hero, research sections,
  mechanism illustration, behavior-tree-loop, and evidence table fit the
  checked 1348 px document width without horizontal overflow.
- No application failure surfaced; unrelated extension metadata entries were
  excluded from the app-error assessment.

Strict TypeScript checking, production build, and `git diff --check` pass.
The engine sources and worker protocol were not changed, so the earlier
engine parity suites were not rerun for this presentation update. Responsive
CSS was reviewed, but a mobile-sized browser or touch-device session was not
available through the exposed browser API.

![SRA Playground and Symbolic Reasoning Agent lead the homepage](sra-identity-20261023.jpg)

![Architecture introduces the symbolic reasoning and artificial cortex thesis](sra-architecture-20261023.jpg)

![A pressure mechanism changes the prerequisites and continuation plan](sra-meaning-20261023.jpg)

## Reproduce

With Node 22.18+ and Python 3.12+ with NumPy, Pydantic, and typing_extensions:

```sh
node scripts/prepare-python.mjs
python scripts/test-python-games.py --output /tmp/sra-native.json
node scripts/test-python-games.mjs --native-report /tmp/sra-native.json
python scripts/test-official-runtime.py --output /tmp/sra-official-native.json
node scripts/test-official-runtime.mjs --native-report /tmp/sra-official-native.json
npm test
npm run build
```

## Limits

These results validate engine transport and the tested deterministic behavior.
They do not establish every possible play sequence, solve every puzzle, test a
complete TypeScript rewrite, or validate SRA reasoning. The real SRA agent is
not connected to the browser interface yet. Cold loading without network access,
persistent progress across reloads, and game submissions are outside this
release's scope.
