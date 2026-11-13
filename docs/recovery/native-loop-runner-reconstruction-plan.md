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
