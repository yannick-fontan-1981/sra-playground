# Browser architecture and the SRA integration

## Current release: 100 local game engines

The Playground executes the original Python engines for 100 games: 25 official
games and 75 custom games across three waves. Pyodide runs CPython in WebAssembly
inside a dedicated browser worker. TypeScript owns the interface, translates
input into game actions, and renders the observations returned by that worker.

This is a browser execution bridge for the original engines. It is not a claim
that all 100 games have been translated into TypeScript. The earlier TypeScript
PIPE implementation remains in the repository as a tested reference port.

The real SRA is a separate next milestone. The game worker contains game
mechanics; it does not run the agent's knowledge, composition, or action-selection
system. The SRA tab remains marked unavailable. No puzzle solver, prerecorded
trajectory, or remote agent endpoint substitutes for the actual SRA.

The pinned Python SRA and custom-game reference is
[ARC-AGI-3-Yannick-Fontan at 212d8d4](https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan/tree/212d8d426f07eea2b6797c2bb647545767488a96).
The visitor-facing `/architecture.html` page explains its Logos, DRM, SRC,
runtime, and behavior-tree-loop concepts. This document describes how the
browser application executes games and what remains for agent integration.

## Current boundaries

| Component | Responsibility |
| --- | --- |
| `src/main.ts`, `src/styles.css` | Minimal manual interface, input, rendering, game selection, and history navigation |
| `src/games/catalog.ts` | The 100 source games, four-character codes, groups, and provenance |
| `src/runtime/browser-games.ts` | Typed game requests, response correlation, worker creation, timeout, and disposal |
| `src/runtime/game-worker.ts` | Local Python initialization and serialized dispatch of game operations |
| `public/python/custom-games.zip` | The custom Python game sources required by the runtime |
| `public/python/official-games.zip` | The exact official Python engines and required ARC engine sources |
| `public/python/game_bridge.py` | Shared game loading, action dispatch, observations, session cache, Undo, and Reset |
| `public/python/official_adapter.py` | Official engine adaptation, frame handling, and deterministic replay for restoration |
| `scripts/prepare-python.mjs` | Download and integrity-check pinned runtime files before development or build |
| `scripts/python-runtime-assets.json` | Runtime versions, asset URLs, byte lengths, and SHA-256 hashes |
| `public/vendor/pyodide/` | Prepared runtime and dependency files served from the same origin |
| `src/runtime/contracts.ts` | Earlier prepared PIPE agent protocol; no real SRA is connected |
| `src/games/pipes.ts`, `reference/python/pipes.py`, `tests/` | The independent PIPE TypeScript reference and development parity checks |
| `architecture.html`, `src/architecture.ts`, `src/architecture.css` | Public explanation of the SRA architecture and current browser status |

## Loading and local execution

The worker loads Pyodide from `/vendor/pyodide/`, initializes the pinned Python
runtime, and loads NumPy, Pydantic, and their required dependencies. It retrieves
the custom and official game archives plus their adapters from `/python/`,
extracts them into the worker's virtual filesystem, and imports the shared
dispatcher. All of these browser requests use the site's own origin.

The worker then accepts serialized requests to load a game, act, undo, reset,
or select a level where supported. Each request has an ID; the TypeScript
bridge resolves the matching response. Operations execute in order. The worker
returns the public frame sequence, final frame, game state, available actions,
progress metadata, and the flags needed to enable manual controls.

The main thread paints palette-indexed frames, preserves the returned animation
timing, and validates input against the currently available action IDs. A click
is mapped to coordinates in the game's rendered frame. The selected game and
presentation generation are checked before showing an asynchronous result, so
an old response cannot replace the newly selected game's display.

Game actions run entirely on the user's device. No game action is sent to an
external server. Hosting is still used to serve the initial page, worker,
runtime, and game files. There is no service worker or guaranteed offline cold
start; normal HTTP caching may reuse previously downloaded assets.

### Pinned runtime assets

The manifest specifies **Pyodide 314.0.7**, **CPython 3.14.2**, and exact package
versions. Its listed files total **18,339,702 bytes** (18.34 MB), excluding game
archives and before any hosting compression. This is the manifest's asset
size, not a fixed network-transfer or performance claim.

`npm run dev` and `npm run build` run the preparation script first. The script
reuses files with matching hashes, fetches missing or mismatched files from the
pinned source URLs, verifies both byte length and SHA-256, and writes them under
`public/vendor/pyodide/`. Those upstream downloads are a preparation step; the
deployed application serves its copies locally. The script fails rather than
accepting an unexpected asset.

## Undo, Reset, and game sessions

The browser runtime keeps up to **eight game sessions** in memory. Switching
to a cached game resumes its state and history. Selecting games updates the
`?game=CODE` query, and Back/Forward navigation uses that selection mechanism.
The URL identifies a game; it does not encode a save file. Sessions are lost
when evicted, when the worker is terminated, or when the page is reloaded.

Undo is bounded to **64 steps**, with an **8 MiB per-session history budget**.
Older snapshots are evicted when the step or byte budget is exceeded. The most
recent snapshot is retained even if that single snapshot exceeds the byte budget.
Custom games use retained state snapshots.
The official adapter restores earlier states by re-creating the seeded game
and deterministically replaying its action history. This accommodates engine
objects that contain closures and cannot be restored reliably through ordinary
pickling. Replay costs can grow with a session's history; it is not a promise
of constant-time Undo.

Reset restarts the current level and clears its Undo history; direct level
selection also clears that history. A game's original action availability and terminal states drive
the controls. The manual interface presents no puzzle-specific instructions or
derived diagnostic counters. Level selection is shown only when the runtime
supports it for that game.

The game worker is isolated from rendering work so Python execution does not
run in the interface's event loop. The bridge rejects failed operations and
provides a timeout/termination path. A Web Worker is an application boundary
and responsiveness mechanism, not a security sandbox against someone who edits
the application or controls the browser.

## Verification and provenance

The original sources remain the behavioral reference. Browser validation must
exercise each catalog entry's initialization, frame shape, advertised actions,
Undo restoration, and Reset. Successful initialization or an action trace does
not establish that every level is solvable or completed. Preserve source
identities, exact official game versions, license headers, and package versions
when updating the bundled archives.

The retained PIPE suite compares the TypeScript reference port against Python
fixtures. Its 22 tests include 11 scenarios, 618 commands, 610 observations,
644 complete 64 × 64 frames, six individual level wins, and a full campaign.
Those checks provide focused reference-port evidence. They do not stand in for
the 100-game runtime checks, agent parity, or SRA solve-rate evaluations.

The fixture generator's solver and recorded solutions remain development-only
tools. Neither is exposed as the SRA agent. Likewise, running the original game
engine locally gives the application access to its implementation; the future
agent must still consume only an explicit public observation projection.

## Next milestone: the genuine SRA in the browser

1. **Pin the active SRA entry point and dependencies.** Inventory observation
   input, output actions, persistence, randomness, and Python/native packages.
   Preserve the algorithm before attempting performance changes.
2. **Choose a faithful execution path.** The game runtime proves that Python
   engines can execute locally; it does not prove that the full agent's
   dependencies, memory demands, or resumable state already work in this
   environment. A TypeScript port or local Python integration must each be
   validated on the actual SRA components.
3. **Define a cross-game public contract.** Project pixels, available actions,
   public progression, and terminal state field by field. Keep hidden engine
   variables, source objects, diagnostics, fixtures, and solutions outside the
   agent boundary. Resolve whether the Python agent consumes every animation
   frame or only transition endpoints before changing that behavior.
4. **Record small reference traces.** Compare observations, decisions, internal
   invariants, and resumable reasoning state against the Python reference.
   Follow the actual dependency graph through representation, discovery,
   composition, goals, and action release. Preserve the behavior-tree-loop
   semantics where implemented.
5. **Implement the agent lifecycle.** Support initialization, stepping, pause,
   resume, and termination independently of the game worker. Bind actions to
   the current session and observation sequence. Invalidate stale reasoning
   after Undo, Reset, game change, or manual intervention.
6. **Budget and measure real browser work.** Use cooperative yielding and a
   host-side termination path. Measure memory, initialization, and decision
   latency on real devices. The presence of WebAssembly or a worker alone
   establishes no speed advantage over the original Python setup.
7. **Validate before enabling Agent mode.** Check interrupted plans, stale
   premises, transferred knowledge, and parent-goal resumption as well as level
   results. Track new successes, regressions, and resource costs separately.
   Keep manually assisted runs distinct from agent evaluations.

The existing `src/runtime/contracts.ts` protocol is preparatory work from the
PIPE release. Its agent session, sequence, budget, and cancellation fields do
not imply an implemented SRA lifecycle across these 100 games. The operational
game worker and the future reasoning worker have different responsibilities.

## Deployment and licensing

Vite produces a static `dist/` directory containing the application and prepared
same-origin assets. No application backend is required for play. The GitHub
repository is the maintainable source; Sites has a separate versioned deployment
identified by `.openai/hosting.json`. Releases must align the intended commit
with the verified build published to the existing Site. No automatic
GitHub-to-Sites synchronization is configured.

The Playground's own code uses the repository's MIT license. Game sources,
Pyodide, CPython, and dependencies retain their respective licenses and notices;
the repository license does not replace those terms. Preserve and update
`THIRD_PARTY_NOTICES.md` alongside any runtime or game-source change.

User-submitted HTML games, uploads, account features, and a submissions backend
remain outside this implementation.
