# Native STCK/SMLP runner reconstruction plan

## Purpose

This document defines only the evidence-backed inputs for reconstructing a new
native STCK/SMLP cost corpus. It is not the lost historical corpus and does not
create `docs/recovery/native-loop-runner-manifest.json`.

## Durable game identities

### STCK

- code: `STCK`
- id: `stck-c0000001`
- name: Card Stack
- family: `isometric_card_stack_combat`
- levels: 6
- source path: `custom_games/engines/stack_iso.py`
- durable reference source:
  `reference/sra/212d8d426f07/custom_games/engines/stack_iso.py`
- Git blob at audit: `d325acce6f1e059a1905c077560b17e3eca2786f`

Public engine contract:
- non-terminal actions: ACTION5, ACTION6, ACTION7
- terminal action: ACTION7

### SMLP

- code: `SMLP`
- id: `smlp-c3000001`
- name: Same Length Path
- family: `same_length_path`
- levels: 6
- source path: `custom_games/engines/same_length_path.py`
- durable reference source:
  `reference/sra/212d8d426f07/custom_games/engines/same_length_path.py`
- Git blob at audit: `c9db51d5089bdd79759088dcd53fb5b27aada1d2`

Public engine contract:
- non-terminal actions: ACTION5, ACTION6, ACTION7
- terminal action: ACTION7

## Durable runtime asset

The browser/native custom source bundle is durably present as:

`public/python/custom-games.zip`

Git blob at audit:

`a43147ebf7c6915caf634fc5f56610290c91acae`

Size:

899,593 bytes.

`public/python/game_bridge.py` constructs custom games with:

`build_seeded_engine(info.game_id, instance_seed=0)`.

Therefore seed 0 is supported by durable runtime evidence.

## Recovered cost protocol

The reconstructed protocol requires:

- A1 → B1 → B2 → A2
- STCK warmup 3 actions
- STCK measured 10 actions
- SMLP warmup 3 actions
- SMLP measured 15 actions
- four measured sessions per game/series
- 32 measured sessions / 400 measured actions
- strict global median increase <10% per game

## Historical corpus status

No historical STCK/SMLP action sequence or four native runner implementations
have been recovered from any GitHub branch currently accessible.

The recovery branches for the cost harness and native session adapter are fully
behind the canonical reconstruction and contain no additional runner source.

Therefore no historical action corpus may be claimed.

## Candidate public-only corpus V1

A new candidate policy is implemented in:

`scripts/native-loop-public-action-corpus.mjs`

Policy:
1. seed = 0
2. start at level 1
3. choose ACTION5 when it is publicly available
4. otherwise choose the first public directional action in 1,2,3,4 order
5. use ACTION7 only as a public fallback
6. never invent ACTION6 coordinates

This policy uses only `availableActionIds`.

It is deliberately non-solving and non-oracular.

## Why ACTION6 is excluded

ACTION6 requires coordinates. A generic corpus policy cannot derive justified
coordinates from the action ID alone without introducing an additional
perception/selection contract.

Excluding automatic ACTION6 prevents the benchmark corpus from smuggling in a
hidden solver or arbitrary click coordinates.

## What remains before creating the official runner manifest

The candidate policy is not yet a qualified native corpus.

Required next proofs:

1. execute STCK and SMLP from the durable custom-games archive on a full GitHub checkout;
2. prove the policy can provide exactly 3/10/15 actions under the recovered protocol;
3. record every public observation/action pair for all measured sessions;
4. freeze the resulting corpus identity;
5. define the complete-session timing scope;
6. pin A and B `sourceRef` values;
7. verify seed = 0 for all sessions;
8. implement and test all four explicit native runners;
9. only then create `docs/recovery/native-loop-runner-manifest.json`.

Until then:

**fonctionnellement qualifié, performance officielle à confirmer**.


## Generic session runner candidate

A candidate runner factory is now implemented in:

`scripts/native-loop-public-corpus-runner.mjs`

It owns:
- exact requested action count;
- public-only corpus policy;
- explicit A/B `sourceRef`;
- integer seed;
- timing scope;
- per-phase timings for policy, candidate hook and game action;
- metadata containing the executed action sequence.

It does **not** own:
- native game construction;
- extraction of `custom-games.zip`;
- historical corpus identity;
- perception or solving.

The measured timing scope is:

`after initial public observation, through policy/hook/action loops, ending after the returned observation of the requested final action`.

Validation on fake game ports:
- exact 10-action STCK-style session;
- ACTION7 fallback after terminal public state;
- refusal of click-only ACTION6 state;
- A/B and game mismatch rejection;
- candidate hook exactly once per action;
- full 40-invocation / 400-action ABBA schedule through the restored session adapter.

Tests:
**6/6 runner tests**, plus **5/5 corpus policy tests**.

Remaining blocker:
a native `createSession` implementation bound to the durable custom-games
archive, followed by execution/recording on real STCK and SMLP.


## Reconstruction progress — A/STCK explicit runner

The first explicit runner path has now been reconstructed at the durable
`game_bridge` contract boundary.

Files:
- `scripts/native-loop-game-bridge-session.mjs`
- `scripts/native-loop-explicit-runners.mjs`
- `tests/native-loop-explicit-runners.test.mjs`

A/STCK identity enforced by the runner:
- variant: `A`
- game code: `STCK`
- game id: `stck-c0000001`
- backend: `python-wasm`
- corpus: `native-public-action-corpus-v1`
- seed: `0`
- start level: `1`
- sourceRef: required explicitly from the caller

The session adapter uses only the durable `game_bridge` request contract:
- initial request: `{ type: "load", code: "STCK", level: 1 }`
- actions: `{ type: "action", actionId, data? }`
- every returned public observation is revalidated against STCK/gameId/backend;
- no alternate backend or runner fallback exists.

Targeted contract tests executed in a minimal Node environment:
**4/4 passed**.

What this proves:
- the explicit A/STCK runner wiring is deterministic and identity-checked;
- the public corpus can drive the exact requested STCK action count through
  the recovered bridge boundary;
- backend/game identity drift fails closed.

What this does not yet prove:
- actual Pyodide loading of `public/python/custom-games.zip`;
- real STCK engine execution through the browser worker;
- historical corpus identity;
- timing validity on the native runtime.

Therefore A/STCK is currently:

**reconstructed contract, pending real native execution qualification**.

No official ABBA benchmark is authorized yet.


## Reconstruction progress — A/SMLP explicit runner

The second explicit reference runner is reconstructed on the same durable
`game_bridge` boundary as A/STCK.

A/SMLP identity:
- variant: `A`
- game code: `SMLP`
- game id: `smlp-c3000001`
- backend: `python-wasm`
- corpus: `native-public-action-corpus-v1`
- seed: `0`
- start level: `1`
- measured action count: `15`

The runner rejects STCK identity drift and does not provide a fallback backend.

Combined explicit reference-runner contract suite:
**7/7 passed** for A/STCK + A/SMLP.

A/SMLP status:
**reconstructed contract, pending real native execution qualification**.

Reference side A is now structurally complete at the bridge-contract level.
The next reconstruction target is B/STCK, where the candidate-only
`region_intervention` hook must be made explicit without changing the
transport, corpus, seed or game session configuration.


## Reconstruction progress — B/STCK and B/SMLP explicit runner contracts

The two candidate runner contracts are now explicit.

They preserve the A-side session configuration:
- same `game_bridge` boundary;
- same game ids;
- same `python-wasm` backend;
- same seed 0;
- same start level 1;
- same public corpus;
- same requested action counts.

The only structural B-side addition is a mandatory candidate hook with identity:

`region_intervention`

The hook is inside the measured action loop and is called exactly once before
each game action. Missing, malformed or differently labelled hooks fail closed.

Combined explicit-runner suite:
**12/12 passed**.

The suite proves:
- A/STCK starts through the STCK bridge contract;
- A/SMLP starts through the SMLP bridge contract;
- B/STCK uses the same STCK transport/corpus plus the explicit candidate hook;
- B/SMLP uses the same SMLP transport/corpus plus the explicit candidate hook;
- A/B game ids and backends remain identical;
- `createNativeLoopRunSession` routes descriptors to all four explicit runners;
- there is no silent runner substitution.

Important remaining limitation:

The current public corpus selects ACTION5 while available and never invents
ACTION6 coordinates. The reconstructed Region evidence/proposal path is
ACTION6-specific. Therefore these B runner contracts do **not** yet prove that
the real `region_intervention` implementation executes meaningful Region
work during STCK/SMLP sessions.

B/STCK and B/SMLP status:

**runner contract reconstructed; real Region hook binding and real native
execution still required**.

Consequently the four runner identities are now structurally present, but
official ABBA remains blocked until:
1. the bridge is executed against the real Pyodide/custom-games archive;
2. the B hook is bound to the actual candidate implementation rather than a
   contract stub;
3. the measured corpus is shown to exercise the candidate perimeter or an
   evidence-backed alternative corpus is reconstructed;
4. sourceRef identities for A and B are pinned.

Status remains:

**fonctionnellement qualifié, performance officielle à confirmer**.


## Reconstruction progress — real `region_intervention` candidate hook binding

The B-side benchmark hook is now bound to the actual reconstructed Region path:

`public observation before/after ACTION6 → regionPublicEffectEvidence() → bindRegionMethod() → RegionInterventionOwner.acquire()`

Implementation:
- `scripts/native-loop-region-candidate-hook.mjs`;
- `scripts/native-loop-public-corpus-runner.mjs` now supports a measured post-action hook;
- B explicit runners require both `beforeAction()` and `afterAction()`.

Important invariants:
- non-ACTION6 actions are a strict Region no-op;
- ACTION6 evidence is derived only from public 64×64 palette observations;
- useful ACTION6 evidence is not admitted without an external `methodRef`;
- the benchmark hook never infers or invents `methodRef`;
- malformed `methodRef` output fails closed;
- the hook uses the real `RegionInterventionOwner`, not a benchmark-only model;
- post-action Region work is included in the measured candidate-hook phase.

Tests added:
- non-ACTION6 no-op;
- useful ACTION6 delta is acquired by Region when an explicit methodRef producer exists;
- useful ACTION6 delta stays unbound without a methodRef producer;
- malformed methodRef fails;
- B runners require post-action hook support;
- public corpus runner forwards before/after public observations to the measured post-action hook.

Execution status in this recovery environment:
**tests written on GitHub, local execution not yet confirmed**, because this
environment cannot clone/fetch the repository through Git networking and the
repository currently has no GitHub Actions workflow available for this suite.

### Corpus exercise result

The real hook binding exposes the remaining blocker more precisely:

`native-public-action-corpus-v1` prefers ACTION5 whenever it is available.

The Region evidence path is ACTION6-specific.

Therefore, under the currently reconstructed public corpus, the real Region
hook is expected to execute only its non-ACTION6 no-op path on the documented
STCK/SMLP public states `[5, 6, 7]`.

No official performance run is valid yet, because it would not prove the cost
of meaningful Region evidence processing.

Next required evidence:
1. execute the new tests in a full checkout;
2. inspect real STCK/SMLP public observations from `custom-games.zip`;
3. establish whether any naturally reached corpus state removes ACTION5 or
   otherwise justifies ACTION6 with public coordinates;
4. if no such state exists, recover an evidence-backed historical ACTION6
   corpus or define a new public coordinate-selection contract before timing;
5. only then pin A/B source refs and run ABBA.

Status remains:

**fonctionnellement qualifié dans les reconstructed contracts; performance officielle à confirmer**.


## Source audit — ACTION5 availability blocks Region in corpus V1

Durable engine source now proves the issue is structural, not incidental.

STCK `public_state()`:
- non-terminal: `ACTION5, ACTION6, ACTION7`;
- terminal WIN: `ACTION7`.

SMLP `_envelope()`:
- non-terminal: `ACTION5, ACTION6, ACTION7`;
- terminal WIN: `ACTION7`.

Because `native-public-action-corpus-v1` always prefers ACTION5, it cannot
select ACTION6 on either benchmark game while the game is non-terminal.

No historical commit carrying a durable STCK/SMLP ACTION6 benchmark corpus was
found by commit search.

Therefore corpus V1 is formally unsuitable for measuring meaningful
`region_intervention` ACTION6 work.

## Candidate public ACTION6 probe contract

A new non-official candidate is added in:

`scripts/native-loop-region-public-action6-probe.mjs`

Identity:

`region-public-action6-probe-v1`

It reads only:
- the public 64×64 palette frame;
- public `availableActionIds`;
- the benchmark game code.

It does not read engine objects, level fixtures, hidden geometry, `view()`,
`inspect()`, shop state, control ids or prepared trajectories.

### SMLP

The engine source proves a closed gate is rendered as a 3×3 same-color block
with a black horizontal or vertical center line.

The public probe scans row-major for that visible glyph and returns its center
as ACTION6 coordinates.

### STCK

The engine source proves the shop-button bar is rendered in public rows 54–58.
The probe scans those public rows for the first sufficiently wide visible
non-black button run and returns its visible center.

The probe does not assume that the player is currently at a shop. Therefore a
STCK click may legitimately have no effect; useful-effect qualification remains
a real-runtime requirement.

### Tests

Autonomous selector tests executed locally:
**4/4 passed**.

Covered:
- SMLP closed-gate center selection;
- STCK visible bottom-button center selection;
- fail closed when ACTION6 is unavailable;
- return `undefined` when no public target glyph is visible.

This candidate is not yet an official corpus and is not wired into ABBA.

Next qualification:
1. run it against genuine STCK/SMLP observations from `custom-games.zip`;
2. confirm selected coordinates are reproducible from public frames;
3. confirm SMLP produces a useful public delta;
4. determine whether STCK produces useful deltas at session start or requires
   a different public-only target detector;
5. only after both games are qualified, consider a Region-specific corpus
   identity shared identically by A and B.
