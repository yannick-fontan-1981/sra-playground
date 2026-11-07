# Complete V6 capability transfer into the V7 architecture

## Required outcome

The accepted target is **100% of the published V6 common symbolic agent's
capabilities transferred from Python to TypeScript**, executed through the
common reasoning architecture developed in V7. A smaller demonstration agent,
a Python worker, a Python service and a game-specific replacement solver do
not satisfy this target.

The migration is **in progress**. The completion flag remains false. The native
modules and verified trajectories below establish progress, not completion.

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

## Evidence already collected

The unchanged **complete Python common caller** was executed in a separate
process against a host that exposed only public game packets. The native
family implementations and the native controller were compared to those runs.

| Game | Levels completed | Actions by level | Total actions |
| --- | ---: | --- | ---: |
| HANO | 3 | 6, 10, 14 | 30 |
| SYME | 3 | 9, 12, 15 | 36 |
| DNOI | 3 | 3, 6, 8 | 17 |

Commands, coordinates, returned public images and animation packets, states,
level transitions and completed-level counts match the original runs.
HANO's 15 complete family proposals also match the common caller's proposals
at equal source scope, revision and budget. The detailed evidence and explicit
normalization limits are in `v6-baseline-parity.json`.

The native TypeScript agent also completed HANO's three levels against the
real game in a separate Pyodide game runtime, with 30 actions and 15 prefixes.
No Python agent module was loaded. This is an executable smoke test rather than
only a replay of stored frames.

This nine-level baseline was obtained before the full native WHY/ACT and
empirical-acquisition integration. The integrated caller must repeat those
campaigns before the baseline is treated as validation of the completed agent.
The full-game replays are deliberately separate from the component suite.

After the incremental memory and independent-leaf revision corrections, the
integrated runtime was tested again against the real HANO game with
`node tests/v6-agent-native.smoke.ts HANO 1`. It completed the first level in six
actions and three prefixes, reached the second level, and loaded zero Python
agent modules. This current one-level smoke result includes WHY/ACT and
transition acquisition; it does not extend to the entire earlier nine-level
baseline or to the still-disconnected autonomous caller coordinator.

These nine solved levels **do not establish parity on all games**. They do
not establish identical global WHY/ACT, parent-tree or complete StrategyRouter
state on every alternative. Family-level differential fixtures are labelled
separately from complete-caller evidence.

Visual sequence fixtures include real-scene refusals and explicit synthetic
positive, ambiguous and counterexample cases. Synthetic tests are not counted
as solved game levels. The original visual-sequence family does not propose an
action on the initial SEQN scene used in this fixture; the native port preserves
that refusal rather than substituting a new solver.

### Common-caller acquisition checkpoint

Two additional oracles execute the unchanged original common caller and retain
its acquired component states, frontier deltas, reasoning facts and assessment
results. The HANO case covers its first two-action prefix. The controlled View
case supplies only coherent public viewport packets; the original caller itself
selects its view experiment. Together they provide 44 passing comparisons,
including physical transition guards. The fixture exports, scope and explicit
limitations are documented in `v6-common-caller-oracle.md`.

These comparisons exercise the autonomous `NativeCallerCoordinator`. It is not
yet connected to the browser runtime. Its six missing acquisition stores and
the remaining provider integration are still required work. A matching bounded
acquisition scenario is not a complete-caller campaign result.

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
| Slot, word, port and constellation families | Complete family modules and their called parser/pose primitives, 235 operations with restoration after every step; registration remains pending |
| Prospective contact closure | Effect access, factored returns, scored rewrites and passage options, including score-qualified terminal learning and next-epoch reuse |
| Remaining geometry and target methods | Framed alignment, occlusion, lattice paths, ambiguous component matches and scored-boundary method recall |
| Autonomous caller coordinator | Two unchanged-main acquisition scenarios, retained component state, frontier deltas and physical guards; product-runtime connection remains pending |
| Native persistence | Atomic revisions, real program replacement, immutable fragments, integrity and lossless episodes larger than a single V7 value |

Unit fixtures deliberately include positive proposals and state-changing
sequences, alongside refusals. A component marked `component_verified` has
recorded differential evidence within the described domain. It is not marked
as a completely integrated V6 capability solely because its isolated tests pass.

The checkpoint component run used:

```sh
node --test --test-concurrency=2 --test-skip-pattern='native SRC/service/controller replays' tests/*.test.ts
```

It passed 1,418 tests, including the caller oracles and independent fact/trace
revision regressions. The four full-caller game replay cases were excluded from
that run and remain a separate integration gate. This result is not reported as
an unqualified full-suite or complete-campaign success.

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
```

The `--require-complete` gate must continue to fail while required capabilities
are missing or unverified. The ordinary test suite can pass during development
without making the migration complete.

## Remaining work before the target is met

1. Transfer and verify the remaining V6 families and every inherited V5
   primitive they call, retaining their original alternatives and ordering.
2. Complete the common-caller orchestration: goal access, curiosity, attention,
   parent returns, view continuity, source-bound WHY/ACT and operation contracts.
3. Migrate the full composition/knowledge/evidence memory into the common V7
   representation, with faithful replay, counterexamples and cross-level reuse.
4. Reconcile the native program/knowledge editing model with execution identity,
   scope, type checks and current authorizations.
5. Extend complete-caller differential campaigns over the entire available
   game set and reported edge cases with identical diagnostic budgets.
6. Resolve or explicitly reproduce Python semantic domains used by those
   capabilities, including tuple/set structural equality and numeric identity.
   Current portable fixtures do not prove arbitrary Python integer/float parity.

The completion criterion is functional coverage and comparison with the
original agent, not a renamed prototype or a score claim. Reproducing all V6
capabilities also does not imply solving every ARC-AGI-3 game: the original
agent's own limitations remain part of the reference behavior.
