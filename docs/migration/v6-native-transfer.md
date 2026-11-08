# Complete V6 capability transfer into the V7 architecture

## Required outcome

The accepted target is **100% of the published V6 common symbolic agent's
capabilities transferred from Python to TypeScript**, executed through the
common reasoning architecture developed in V7. A smaller demonstration agent,
a Python worker, a Python service and a game-specific replacement solver do
not satisfy this target.

The migration is **in progress**. The completion flag remains false. The native
modules and verified trajectories below establish progress, not completion.

**Current integrated milestone:** see [the v33 shared-series epoch-anchor
report](v33-shared-series-anchor.md), following [the v32 SupportNavigation,
occurrence recall and delta checkpoint](v32-support-recall-delta.md). The connected-entry audit
is [v6-entry-point-progress.json](v6-entry-point-progress.json): 27 of 76
explicit DRM subquestions are connected (35.5%). This is a connection metric,
not complete behavioral parity, a percentage of code translated, or a game score.

**Historical v31 checkpoint documented below:** the native common coordinator, shared WHY/ACT
memory and four newly registered interface families execute in the product
runtime. The first three levels of HANO, SYME and DNOI pass against the real
games: **nine levels, 83 actions, 46 acquired prefixes**. The three campaigns
used the same unchanged native source and real time budgets. Their scope and
reproducible evidence are recorded below.

The reference is `yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan` at
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. The complete conservative source
snapshot is retained under `reference/v6/<commit>/source`. Its original bytes
are never edited to make a differential comparison pass.

The V6 README distinguishes the published **common symbolic solver** from its
historical neural benchmark launcher. The latter's upstream harness and local
model weights are not in this source publication. This document does not claim
a transfer of those absent artifacts.

## Execution boundary

The agent's deployed path must contain only native TypeScript/JavaScript and
its declarative programs/data. Python is a development oracle. The existing
Python game engines remain a separate environment: the agent receives only
public pixel frames, complete public animation packets, state, available
commands, level and completed-level count. Game IDs, hidden state, undo history,
level definitions, oracle plans and free simulation are not agent inputs.

The abandoned Python-agent prototype is not part of the browser runtime. Its
archive, bridge and preparation script were removed from the application.

## V7 architecture requirement

The destination architecture has a common representation for programs,
observations, hypotheses, compositions, operations, execution evidence and
memory. It must preserve source identity, revisions, scope, causal links and
counterexamples. Inspection must show the program and knowledge that actually
execute. A node edit must affect a validated new revision used by the
engine and invalidate any authorization grounded in an older revision.

An inspector over unrelated display data is insufficient. So is retaining V6
planning in Python behind a TypeScript interface.

The current transfer reuses V7's real SRC IR and interpreter. The original
V5 compiler is used **only during development export**. The generated JSON
programs execute in TypeScript. This is a transfer of declarative programs,
not a Python interpreter embedded in JavaScript.

`src/logos-engine/v6/programs.json` contains 33 instantiated V6 entry programs,
including the main prototype router and composition-family selection. It also
retains the exact declaration source text and hashes. `NativeSrcProgram`
checks source, semantic and transitive hashes and requires every callback of
an executable program to be present as a native implementation. An exported
program with missing native capabilities is not counted as an implemented
capability.

V7's interpreter now preserves V6's `WHILE` contract: progress witness, stop
condition, maximum symbolic depth, and deferred limit result. A deferred result
cannot authorize a game action.

The native knowledge store now uses the actual V7 Kernel revisions and causal
delta chain. Registered program edits replace the IR read by the next execution;
family activation edits change actual selection. Transactions are atomic and
require the expected graph revision. Edits are rejected while an action prefix
is active, including a paused prefix, and a released action ticket is tied to
the execution digest and graph chain. The Playground now exposes this graph,
its current program trees and a revision editor for programs and activation
nodes. Coverage of every remaining provider is still pending.

Large empirical states use lossless, content-addressed fragments. Public pixel
matrices are retained in shared immutable nodes rather than copied into each
history record. A typed envelope distinguishes internal references from user
data, and hydration verifies every fragment digest. Fractional values and
negative zero preserve their Float64 bits. This representation keeps the V7
canonical integer contract and bounded individual values without discarding
episode observations.

Reasoning facts and trace records are individual authoritative nodes. An ordered
index reconstructs the full source memory snapshot; unchanged entries retain
their identity across checkpoints. Public memory reads remain independent
copies. Restoration checks each retained leaf as well as the ordered index,
so an independent fact or trace revision cannot be hidden by an unchanged
index. A checkpoint refuses a stale graph base; only a successfully committed
and verified prepared batch can update the read cache. Failed transactions and
unrelated commits do not mark unread revisions as acquired.

### Connected common coordinator at v31

The runtime now constructs `NativeCallerCoordinator` with the same
`ReasoningMemory` used by WHY/ACT. Its Goal, Frontier, View, Attention, Point,
Display, Control and Counter states are authoritative V7 nodes, with a separate
lifecycle node. The original 16 DRM groups retain their order. Thirteen
specific family adapters and ten common providers participate in the actual
selection path; unported providers remain explicitly listed as pending.

The slot, word, port and constellation adapters are registered in the
`surface` group according to the original `program_construction` subquestion
order. Their retained state, before/after observations and acquired events use
the same native family contract as the previously integrated families.

At a sealed committed prefix, each witnessed primitive is reconciled exactly
once: Attention/View, selected-family recording, Goal/Point/Control,
assessment, then Frontier. The runtime executes OP29, OP30 and OP31 and
reconstructs Goal and Frontier memory at natural, nonfinal level boundaries.
No intermediate action in an unfinished prefix is prematurely acquired.
Pause retains that prefix; the next level retains the same session.

Native checkpoints share only immutable public observations. Public state
reads still return independent copies. Hydration caches validate the actual
root and fragment identities, and immutable pixel-matrix fragments are emitted
into each destination store. These changes reduce repeated copying without
dropping observations, masking revised nodes or relaxing integrity checks.

## Behavioral invariants

The complete transfer must retain all of the following:

- Public observation and input-domain measurement, including component masks,
  identity ambiguity, source-bound point selection and full animation packets.
- Every declared family and its priority, eligibility, subquestions,
  alternatives, information goals and parent continuations.
- DRM projection, applicability, preservation, falsifiers and bounded search.
- WHY/ACT admission, symbolic operation authority and source provenance.
- An acquired outcome for every actually executed primitive; no fabricated
  outcome, free probe, reset or undo presented as ordinary agent experience.
- Current-source, session, observation, point, action and precondition guards.
- Retention of a committed prefix through Pause; reconciliation and learning
  at the correct sealed boundary, including a partial prefix interrupted by
  a real game outcome.
- Hypothesis support, counterexamples, invalidation and conservative reuse.
- Memory and transfer across natural level boundaries.
- Public score and terminal evidence as the authority for completed levels.
- Equivalent action/search budgets. Faster computation is not evidence that
  a missing method has been transferred.

The current browser defaults are diagnostic limits of 600 native actions and
360 seconds of active computation/native execution per level. Presentation
delay and user pauses do not consume that active budget. These limits are not
claimed to be the V6 campaign's physically qualified oracle caps.

## Historical v31 integrated real-game evidence

The v31 runtime, `logos-engine.typescript.v6.native-migration/0.4.0`, was
executed against each real game in a separate Pyodide environment. Only the
games run in Python. The agent executes TypeScript and receives public game
packets, without injected oracle state, proposals, plans or private game data.

| Game | Levels completed | Actions L1 / L2 / L3 | Total actions | Acquired prefixes | Active seconds L1 / L2 / L3 |
| --- | ---: | --- | ---: | ---: | --- |
| [HANO](native-campaigns/hano.json) | 3 | 6 / 10 / 14 | 30 | 15 | 13.65 / 56.34 / 189.43 |
| [SYME](native-campaigns/syme.json) | 3 | 9 / 12 / 15 | 36 | 14 | 63.17 / 80.99 / 168.17 |
| [DNOI](native-campaigns/dnoi.json) | 3 | 3 / 6 / 8 | 17 | 17 | 7.55 / 25.26 / 78.02 |
| **Total** | **9** | | **83** | **46** | **682.58 seconds across all games** |

Each campaign passes the following assertions in
`tests/helpers/v6-live-game-campaign.ts`:

- The requested three levels are completed in one continuous agent session.
- All 83 commands and 86 complete public packets, including animation frames,
  match trajectories previously checked against the unchanged complete
  original caller. Expected packets are used only by the external comparator.
- Every executed primitive has both `caller_acquisition` and
  `frontier_acquisition` in its actual `reasoning:transition` graph node.
- All 46 sealed prefixes execute OP29, OP30 and OP31: 138 post-analyses.
- Goal and Frontier memory are reconstructed at both nonfinal level boundaries
  in each run: six verified replays. Completing the requested third level stops
  the campaign without an unnecessary extra boundary replay.
- No reset, undo, hidden-state probe or free simulation is performed.
- No Python agent module is loaded.
- The 74-file native source manifest is unchanged before and after each run
  and is identical across all three campaigns.

The common source manifest digest is
`22300eccafb584692324b29a2b6d7a763d8748d591eb5facba95bdb68d20d7c7`.
Each report includes its complete file hashes, game-asset hashes, public packet
hashes, commands, request log, level metrics and graph acquisition evidence.
The aggregate and component-run qualification are in
[native-campaigns/summary.json](native-campaigns/summary.json).

These are real-clock runs using the product's 360-second active budget and
600-action cap per level. The longest observed level took 189.43 active
seconds. Acquisition can therefore take noticeable time after the board
changes. These measurements describe this execution environment, not a
performance guarantee for another computer. The recorded-frame unit replays
use an injected clock; the real-game campaigns above do not.

DNOI was also run through the actual browser interface with **Run to next
level** three times in the same session: three solved levels, 17 actions and
17 completed plans. The real graph inspector showed 427 nodes and 1,442
revisions, including the acquired `caller:counters` node. The browser session
used the interface's continuing target and therefore also replayed the third
boundary. Its measured 123.0 active seconds are a separate observation from
the headless campaign.

![DNOI: three solved levels, 17 actions and 17 completed plans](native-campaigns/dnoi-browser-three-levels.png)

### Relationship to the original baselines

The unchanged **complete Python common caller** was previously executed in a
separate development process against a host exposing only public packets.
Commands, coordinates, public images, animations, states and level counts were
compared. HANO's 15 complete family proposals also matched at equal source
scope, revision and budget. Detailed normalization limits remain in
`v6-baseline-parity.json`.

That historical baseline predates the full native acquisition integration.
The v31 nine-level campaigns repeat its public trajectories with the
connected coordinator and verify that native WHY/ACT, acquisition and boundary
replay actually execute. They **do not establish parity on all games**, nor do
they establish identical complete internal caller state on every alternative.

Visual-sequence fixtures retain real-scene refusals and synthetic positive,
ambiguous and counterexample cases. The original isolated family does not
propose an action on the initial SEQN fixture. That refusal remains tested;
it does not require the full common coordinator to stop, since Frontier can
select an exploratory action. Synthetic cases are not counted as solved levels.

### Common-caller acquisition checkpoint

Two additional oracles execute the unchanged original common caller and retain
its acquired component states, frontier deltas, reasoning facts and assessment
results. The HANO case covers its first two-action prefix. The controlled View
case supplies only coherent public viewport packets; the original caller itself
selects its view experiment. Together they provide 44 passing comparisons,
including physical transition guards. The fixture exports, scope and explicit
limitations are documented in `v6-common-caller-oracle.md`.

The coordinator is now connected to the browser runtime. The additional
`v6-caller-integration.test.ts` starts the actual runtime using only HANO's
original public initial observation. After its first two-action prefix, all
eight retained caller component states match the unchanged-original captures.
The test also verifies original selection order, no premature acquisition,
exactly two acquired transitions and OP29/OP30/OP31 execution. It does not
restore oracle memory into the runtime.

At the v31 checkpoint, the ordered-support state was retained as its source reasoning fact. The
selected support subcomposition event is acquired, but the complete
SupportNavigation wrapper and other source stores were pending. The wrapper and
all thirteen children are connected at v32; the remaining source stores and
scope limits are identified in the current report. A bounded
state comparison does not prove those absent capabilities.

### Component comparisons

The following source comparisons are separate from full-game campaigns. The
test names, fixtures, generators and exact source mapping are recorded in
`migration/v6-transfer-map.json`.

| Component | Evidence covered |
| --- | --- |
| Operations and reasoning memory | All 31 operations, the 5,102-node normative catalog, 11,212 edges, navigation windows and retained facts/traces |
| WHY/ACT composition engine | Original router SRC, operation admission, refused releases, prepare/persist boundaries and all operation selections |
| Target binding and derivation | Scoped targets, typed transitions, resource preservation, bounded derivation and negative contracts |
| Empirical transition learning | Acquired mechanisms, property rewrites, control dependencies, preservation and counterexamples |
| Goal access and attention | Complete base adapter, retained episodes, scoped attention lifecycle and information-goal election/reconciliation |
| Observed and view frontiers | Local/nonlocal access, closed-return contrasts, ledgers, view registration, obstruction and retest |
| Point contrasts and displays | Frozen witnesses, competing causal explanations, frame displays and score-qualified reuse |
| Orbit and containment | Full search/selection, point bounds, retained state, guards and NumPy integer wrapping |
| Surface/code programs and band transfer | All 48 routines, packet observations, wrong-outcome refutation and wide integer masks |
| Slot, word, port and constellation families | Registered in original subquestion order; 235 operations through the native adapter and V7 commit/restore path, plus positive Word selection, acquisition and activation editing through the actual runtime |
| Prospective contact closure | Effect access, factored returns, scored rewrites and passage options, including score-qualified terminal learning and next-epoch reuse |
| Remaining geometry and target methods | Framed alignment, occlusion, lattice paths, ambiguous component matches and scored-boundary method recall |
| Common caller coordinator | Two unchanged-main acquisition scenarios, actual runtime integration and eight-component state comparison, then nine real levels with transition acquisition and cross-level replay |
| Native persistence | Atomic revisions, real program replacement, immutable fragments, integrity, independent leaf revisions, cache invalidation and lossless episodes larger than a single V7 value |

Unit fixtures deliberately include positive proposals and state-changing
sequences, alongside refusals. A component marked `component_verified` has
recorded differential evidence within the described domain. It is not marked
as a completely integrated V6 capability solely because its isolated tests pass.

The checkpoint component run used:

```sh
node --test --test-concurrency=1 --test-skip-pattern='native SRC/service/controller replays' tests/*.test.ts
```

It passed **1,444 tests** with zero failures. The recorded full-caller replay
cases were filtered out of this component command. The three real-game
campaigns above were then independently checked as their own integration gate;
the result is not described as an unqualified `npm test` run.

The new interface-family checks include ten adapter tests covering 235 original
operations and one positive Word runtime integration test. The latter verifies
the selected proposal, actual WHY/ACT release, acquired source fact and a
subsequent family-activation revision without erasing learned evidence.
This controlled scene does not count as a solved game. In the standalone Slot
fixture, the original router's `public_occurrence_recall` provider preempts
Slot; that provider was not transferred at v31. The v32 runtime connects it
before Slot and adds a priority regression test. Isolated Slot parity by itself
must not be presented as full-router parity on that scene.

## Completion tracking

`migration/v6-transfer-map.json` binds reference files to native implementations
and differential evidence. `scripts/audit-v6-migration.py` regenerates
`v6-coverage.json`. Its conservative static inventory includes inherited V5
modules and therefore exceeds the minimum semantic dependency closure. This
upper bound must be refined through documented dependency analysis, not by
silently dropping unimplemented capabilities.

A copied reference file is not a transfer. An exported SRC tree is not an
implemented callback. A passing test on one scene is not complete campaign
parity. No completion percentage is inferred from copied file counts.

```sh
python3 scripts/audit-v6-migration.py
python3 scripts/audit-v6-migration.py --require-complete
npm run typecheck
npm test
node tests/v6-agent-native.smoke.ts HANO 3
node tests/v6-agent-native.smoke.ts SYME 3
node tests/v6-agent-native.smoke.ts DNOI 3
```

The `--require-complete` gate must continue to fail while required capabilities
are missing or unverified. The ordinary test suite can pass during development
without making the migration complete.

## Remaining work before the target is met

1. Transfer and verify the remaining V6 families and every inherited V5
   primitive they call, retaining their original alternatives and ordering.
2. Complete the remaining common providers, including Morphology,
   `acquire_control_for_target` and `attention_parent_return`, while retaining
   original priorities.
3. Complete the remaining ObservedCompositionConstraint providers and source
   acquisitions, including `addressed_material_event`, `framed_transfer_event`
   and `temporal_selection_state`. The v32 `repeated_series_state` includes the
   occurrence-recall ancestry only; it is not the complete original shared
   series memory. Preserve replay, counterexamples and cross-level reuse in the
   same V7 graph.
4. Extend the existing program/knowledge editing model and its provenance,
   scope, type and authorization checks to each newly transferred capability.
5. Extend complete-caller differential campaigns over the entire available
   game set and reported edge cases with identical diagnostic budgets.
6. Resolve or explicitly reproduce Python semantic domains used by those
   capabilities, including tuple/set structural equality and numeric identity.
   Current portable fixtures do not prove arbitrary Python integer/float parity.

The completion criterion is functional coverage and comparison with the
original agent, not a renamed prototype or a score claim. Reproducing all V6
capabilities also does not imply solving every ARC-AGI-3 game: the original
agent's own limitations remain part of the reference behavior.
