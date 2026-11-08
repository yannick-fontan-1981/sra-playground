# Coupled-pair observation and response acquisition, v34

## Bounded scope

Logos Engine native implementation `0.5.2` extends the
[v33 epoch-anchor checkpoint](v33-shared-series-anchor.md) with public pair
measurement, correspondence and `coupled_pair_evidence` acquisition. The
reference remains the unchanged V6 source at
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

This lot transfers `pairs`, `match_pair`, the `CoupledPairAccess.record`
acquisition body and its pair-plan `after` check. It does not transfer
`joint_route`, `propose_graph` or the pair-plan `before` admission guard.
No new coupled-pair planning entry is registered. The
[declared-entry audit](v6-entry-point-progress.json) remains **27/76, 35.5%**;
complete V6 behavioral parity remains false.

## Public measurements and identity

[`v6-coupled-pair-observation.ts`](../../src/logos-engine/v6-coupled-pair-observation.ts)
retains the source geometry: exactly two solid square components with the same
palette value and side length, from 2 through 16 pixels. Border components and
palette zero are not silently excluded. Group encounter order is retained;
only the two boxes within each measured pair are sorted. Coordinates are
inclusive `[top, left, bottom, right]`, with displacements `[row, column]`.

Correspondence considers the possible member assignments. Each member may
stay still or move along one axis by at most the square's side length. A
correspondence is accepted only if there is a unique minimum total displacement.
Equal-cost alternatives remain ambiguous. Tracked member identity is not
re-sorted after crossing or spatial reordering.

The measurement reuses the existing eight-entry component cache, keyed by
exact validated public raster content. A caller-owned mutable raster cannot
make an old cached measurement authoritative.

## Response acquisition

[`v6-coupled-pair-evidence.ts`](../../src/logos-engine/v6-coupled-pair-evidence.ts)
keeps the source acquisition distinctions:

- A new pair state needs exactly one candidate pair with an observed nonzero
  displacement. Ambiguous or absent matches do not create a guessed model.
- Once a pair is retained, a measured no-effect response is recorded too.
- Samples are unique by their complete content, including both evidence
  references. The separate evidence history retains the original concatenation
  semantics; repeated references are not removed.
- A floor value is recorded only when the newly uncovered pixels have one
  value. Pixels occupied by either current member are excluded from this
  measurement. The recorded value alone does not prove a universal motion law.
- A new epoch acquires its before-epoch anchor at the source position in the
  chain. The prior pair state is retained until a suitable new state is acquired.

For a supplied pair plan, `coupledPairAfter` distinguishes a matched predicted
displacement from extra interior effects. Its extra-effect count excludes the
outer border and the union of the predicted old/new member boxes. An official
score/epoch boundary or terminal state produces `matched: null`, not a false
prediction.

A refuted prediction with an already retained pair is recorded before any new
member assignment. It preserves the tracked pair and samples, appends the
refused trial and retains an unresolved causal question. The unresolved state
compares the resulting public image with the epoch anchor in two independent
ways: exact whole-frame equality and interior-only equality. It does not infer
a teleportation or reset law from either result. On the very first acquisition,
the source's later refutation check records the refused trial without inventing
an unresolved state; that distinction is retained.

## Common V7 chain and integrity

The same registered `public_occurrence_recall` provider owns the supported
shared journal. Its acquisition order is now:

1. Occurrence-recall events.
2. Coupled-pair anchor and response events.
3. Public animation-packet events.

The runtime continues to acquire these events only when an action prefix seals.
Selected and passive paths do not acquire the same transition twice. The
`family_state:public_occurrence_recall` node and `repeated_series_state` fact
retain the actual combined journal; working memories are reconstructed from
these authoritative nodes.

Reconstruction checks a fresh pair projection and the combined retained digest
before publishing the replacement state. Invalid state cannot partially replace
the active recall or pair memories. The pair layer's digest keeps the exact
source formula:

```text
identity([parent_digest, pair_state, pair_events, pair_initials])
```

The production parent remains the transferred recall closure. The reported
scope is `native_recall_ancestors_and_coupled_pair_acquisition_v2`, not the full
original `ObservedCompositionConstraint` inheritance digest. The additional
`coupled_pair_evidence` producer in `AuxiliarySupportAccess` remains unported;
supporting an event reducer does not certify all producers of that event.

The agent still executes only TypeScript. Python is used for the unchanged
development oracle; the Python game environment remains separate. Existing
V7 delta storage, bounded caches, revisions and counterexamples are preserved.
No full-history pruning or general performance improvement is claimed by this
lot.

## Verification

The observation and acquisition oracles call the pinned Python implementation
without modifying its source. They retain exact returned events, projected
state and the pair-layer digest with its actual original parent digest.
Contract fixtures with supplied pair plans test the reconciliation branches;
they are not solver-generated trajectories or solved-game evidence.

**199 distinct focused tests pass**, including 47 observation/matching tests,
76 acquisition/outcome tests, the 37 retained anchor tests and the common/V7
integration checks. The acquisition oracle contains 18 journals, 44 operations,
9 outcome cases and 56 verified source hashes. Shared-state tests compare
complete common-adapter results, then rebuild the pair model from the actual
V7 node. Corrupt reconstruction is rejected atomically, and restoring an
earlier node then reacquiring the later response reproduces the same journal
and digest.

| Fresh native campaign | Result | Actions | Acquired prefixes | Pair-evidence events |
| --- | --- | ---: | ---: | ---: |
| [ONDE, all 6 levels](native-campaigns-v34/onde.json) | `WIN`, 6/6 | 48 | 9 | 11 |
| [HANO, 2-level regression](native-campaigns-v34/hano-two-levels.json) | Target reached, 2/2; full game not replayed in this lot | 16 | 8 | 0 |

ONDE exercises the newly connected pair acquisition during a complete game.
Its 48 commands and 49 full public packet hashes match v33. HANO likewise
matches its previous 16 commands and 17 public packets. Both runs preserve one
session, use normal time/action budgets, load no Python agent module and use
the same unchanged 111-file native source manifest. These are regression
results for the current connected capabilities, not new pair-planning wins.

Exact batches, provenance and report links are retained in
[validation.json](native-campaigns-v34/validation.json). Historical v32 and v33
evidence is kept unchanged.

### Bounded accumulation check

An independent diagnostic completed 100 synthetic responses through the real
shared acquisition, V7 commits, hydration and restoration: one initial movement
of a pair, then 99 unchanged images with new observation references. It retained
both the family node and its `repeated_series_state` fact projection. At the
last response it held 101 events, 79 current graph nodes, 77 shared fragments
and 278 deltas, with no history pruning.

The current raw shared journal serialized to 1,207,700 bytes. The sum of the 100
raw journal versions would be 41,514,248 bytes; the measured values of all
historical V7 nodes serialized to 7,695,195 bytes, including the shared-fragment
representation. These overlapping representations must not be summed. The
figures describe JSON data volumes, not exact retained browser heap or a timing
benchmark. They establish sharing within this bounded case, not a guarantee
that cumulative source journals remain bounded on arbitrarily long episodes.

The [complete output and qualifications](native-campaigns-v34/pair-storage-diagnostic.json)
and [exact diagnostic script](native-campaigns-v34/pair-storage-diagnostic.mjs)
are retained. The script was copied from the executed diagnostic without a
second run. To reproduce its relative imports from the checkout root:

```sh
node --expose-gc --input-type=module - evidence < docs/migration/native-campaigns-v34/pair-storage-diagnostic.mjs
```

## Next bounded step

Transfer the bounded joint-route search and the pair-plan admission guards,
then connect the original coupled-pair proposal entry in the common policy
order. Its action predictions must be reconciled through the acquisition
implemented here before expanding game-resolution claims.
