# Browser architecture and the SRA port

## Release 0.1: a real game, a prepared agent boundary

The first release contains one faithful TypeScript game port: PIPE, with six
levels. The interface and game execute in the browser. Vite produces static
HTML, CSS and JavaScript; no application backend, remote inference or external
asset service is required to play after the assets have loaded.

The SRA tab is deliberately marked unavailable. No part of the Python reasoning
agent has been substituted with a puzzle-specific solver, prerecorded actions,
or a server endpoint. A functioning SRA worker is a separate next milestone.

The original Python project remains the reference:
[ARC-AGI-3-Yannick-Fontan at 212d8d4](https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan/tree/212d8d426f07eea2b6797c2bb647545767488a96).

## Current boundaries

| Component | Responsibility | Status |
| --- | --- | --- |
| `src/games/pipes.ts` | Deterministic game state, actions, transitions and pixel rendering | Implemented |
| `src/main.ts`, `src/styles.css` | Manual interaction, presentation, campaign and practice controls | Implemented |
| `src/runtime/contracts.ts` | Explicit public observation projection and typed worker messages | Defined; no worker is connected |
| `reference/python/pipes.py` | Pinned upstream parity reference | Development only |
| `scripts/generate-pipe-fixtures.py`, `tests/` | Independent Python traces and TypeScript parity checks | Development only |

Engine diagnostics such as leaks and connection counts are useful in the human
interface. They are **not** sent by the prepared agent observation adapter.
The adapter allows only public image data, available action IDs, level progress
and terminal state. It constructs the message field by field and copies pixels.

Images use the original 64 × 64 raster, with row-major unsigned palette indices
0–15. They are not RGB byte arrays. The palette used to display those indices is
exported as `PALETTE` by the game module. The current adapter projects the final
frame of a transition. Before connecting SRA, compare its Python input handling
and decide whether every animation frame must also be observed, without silently
changing the Python agent's perception contract.

The main thread owns the game. The proposed worker must import the reasoning
port and public protocol types, never game fixtures, hidden board masks, source
coordinates, engine analysis functions or test solutions. A Web Worker provides
responsiveness and an explicit module boundary, not a security sandbox against
someone who controls the browser or edits the application.

## Next milestone: the genuine SRA in a Web Worker

1. **Pin the exact active Python SRA revision and entrypoint.** Inventory its
   inputs, outputs, persistence, random choices and Python/native dependencies.
   Preserve the actual algorithm before attempting performance improvements.
2. **Record small reference traces.** Use public observations and seeds to
   compare Python and TypeScript decisions, internal invariants and resumable
   state. Separate semantic parity from acceptable numerical differences.
3. **Port coherent components.** Follow the real dependency graph: observation
   processing, knowledge representation, discovery, composition, goal handling,
   and action selection. Preserve the behavior-tree-loop where it exists; do not
   add game-specific rules to make the first demo succeed.
4. **Implement the worker host.** Support initialize, step, pause, resume and
   terminate. Reject replies from previous session IDs or observation sequences;
   rotate the session on reset, game change and mode change. Validate every
   action against the current available actions and coordinate bounds.
5. **Apply resource budgets.** Use deterministic work budgets where practical,
   cooperative yielding and a host-side termination path. Keep rendering and
   manual controls responsive. Measure memory and decision time in real browsers.
6. **Run the original agent against the same observations.** Establish behavior
   parity before claiming that SRA solves a level. A lower solve rate must remain
   visible; a specialized solver cannot stand in for the port.
7. **Enable the Agent controls only after integration.** Show the actual active
   goal, step state and observations that the agent chooses to expose. Keep
   manual and agent runs separate so human actions cannot contaminate an agent
   evaluation.

`sessionId`, `sequence`, budget and cancellation fields are prepared protocol
fields today. Their enforcement, pause/resume behavior, worker lifecycle and
memory accounting are **not implemented in release 0.1**.

## Scaling the playground

Add game engines through a common action/observation adapter, with one provenance
entry and independent parity checks per port. Keep reusable UI controls separate
from game mechanics. A catalogue of 100 games is the product direction; this
release exposes one game, not 100 converted engines.

After each coherent SRA porting increment, rerun the relevant component traces
and an expanding cross-game regression set. Keep a pinned baseline and compare
new successes, regressions and resource costs separately. Optimizations belong
after equivalence checks, especially changes to ordering, caches, numeric types,
or the scheduling of discovery and goal resumption.

## Deployment and persistence

The GitHub repository is the maintainable source of this project. Sites has its
own versioned deployment source, identified by `.openai/hosting.json`. A release
must update the intended GitHub source and publish the corresponding verified
build to the existing Site. This first release does not configure automatic
GitHub-to-Sites synchronization or a GitHub Actions workflow.

The game stores state in memory. Reloading the page starts again. There is no
service worker or guaranteed offline cold start; browser execution means no
server round trips for game actions once the page is loaded. User-submitted HTML
games, file uploads, account features and a submissions backend are outside this
first release.
