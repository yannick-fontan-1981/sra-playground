# Memory validation and cache accounting, v37

## New real-game result: ELAS

Logos Engine native implementation `0.7.1` completes **ELAS's first three
levels** through the actual common TypeScript agent, starting with a fresh
level-1 session. The [saved campaign](native-campaigns-v37/elas-three-levels.json)
records every physical command, the public packet hashes, prefix acquisition,
natural boundaries and the unchanged native source manifest.

| Completed level | Physical actions | Active seconds in this run |
| --- | ---: | ---: |
| 1 | 2 | 1.632 |
| 2 | 9 | 6.371 |
| 3 | 22 | 10.281 |
| Total | 33 | 18.284 |

The run stops at its declared three-level target, on entry to level 4 with
state `NOT_FINISHED`. It establishes the first three levels, not a complete-game
`WIN`. All 33 actions are acquired through nine sealed prefixes in one retained
session, with two natural boundary replays. All nine prefixes use the previously
transferred `metric_composition_access` family through the common decision,
WHY/ACT, per-primitive guard and acquisition chain.

The campaign does not prime the agent with a route or learned state. It loads
no Python agent module; Python hosts only the game environment. No transition
requires the v35 dense-domain robustness extension. The independent TU93
regression and this ELAS run share native source digest
`ce6dc999f3723d67970cbed433f40289f9f3b62fa785bc1dba9e1e3fd1a23607`
across the same 120 native source files, unchanged throughout both runs.

## Scope of the implementation change

This step targets two costs identified in the [v36 TU93 profile](native-campaigns-v36/tu93-cpu-summary.json):
computed-cache accounting and repeated property validation during canonical
encoding. The behavioral policy, source search limits, acquisition boundaries
and knowledge-retention rules are unchanged. The runtime implementation identity
advances from `0.7.0` to `0.7.1` to identify the new implementation in evidence.

### Bounded weak LRU accounting

[`BoundedWeakCache`](../../src/logos-engine/bounded-weak-cache.ts) now maintains
its least-recently-used order with a doubly linked list. A hit relinks its
existing accounting node, and eviction removes the oldest node directly.
This eliminates the insertion-order `Map` deletion/reinsertion path and the
oldest-entry iterator from these operations.

The accounting nodes contain only a `WeakRef` to the key, a numeric weight and
links to other accounting nodes. Computed values remain exclusively in the
`WeakMap`. The list cannot keep a key or its computed value alive. If a key is
collected, its conservative accounting node can remain until eviction without
retaining the computed result. Removing a node clears both links.

The public contract retains both bounds, exact LRU promotion, weighted
replacement, `undefined` values, validation before mutation and the rule that
an oversized replacement removes the old cached value but is not retained.
The canonical-text cache keeps its existing 16 MiB accounted-weight and 4,096
entry limits; the native state-graph text cache keeps 4 MiB and 2,048 entries.
These are computed-text accounting bounds, not a bound on the complete agent's
heap. Knowledge facts, journals, revisions and counterexamples are never
evicted by this cache.

### Reuse of validated owned properties

[`canonical.ts`](../../src/logos-engine/canonical.ts) reuses the existing private
`immutableObjects` ownership set. Objects constructed and deeply frozen by
`immutableJson` have already passed the enumerable-data-property, array-shape,
key and Unicode checks at ingress. When their canonical text has been evicted,
`jsonEntries` can read their own entries without reconstructing another set of
property descriptors for every unchanged member.

The shortcut applies only to identities in that private set. A foreign frozen
object, a shallowly frozen parent, a new mutable object or an accessor still
passes through the complete descriptor validation. `Object.isFrozen` alone
does not grant trusted ownership. Portable scalar checks, Unicode ordering,
cycle rejection and the existing node/depth limits still apply to canonical
encoding. Metadata accepted by `immutableJson`, such as a finite fractional
number, remains inadmissible to the stricter canonical scalar domain.

The canonical bytes and SHA256 formulas are unchanged. This optimization
reuses property validation; it does not replace the source digest with a new
hash scheme, discard historical evidence or assume that every old subtree
will stay in the bounded text cache.

## Verification

The final full repository batch has **3,056 passing tests across 66 test
files**. The [validation record](native-campaigns-v37/validation.json) records
the final source and artifact checks. The focused tests cover:

- **LRU behavior:** 150,000 deterministic operations against an independent
  ordered-array specification, including hits, weighted replacements,
  oversized results, `undefined` values and entry/weight bounds.
- **Validation boundaries:** trusted owned values skip redundant descriptor
  acquisition, while foreign objects, mutable descendants, accessors, symbols
  and sparse arrays retain their original validation behavior.
- **Canonical equivalence:** exact bytes, Unicode code-point ordering, hashes,
  portable-number refusals and structural limits survive reuse and eviction.
- **Integrated reasoning:** the full common caller, WHY/ACT, sealed-prefix
  acquisition, shared-state restoration, rollback and existing family
  regressions remain covered by the repository tests and real campaigns.

The [isolated cache benchmark](../../scripts/benchmark-bounded-weak-cache.ts)
loads the exact cache source from v36 commit
`f55f3b514658c5228f118bb5891f0bebf52c8832` and verifies its SHA256. Five rounds
alternate implementation order after warm-up. The
[saved measurements](native-campaigns-v37/cache-accounting-benchmark.json)
contain 120,000 operations per scenario and matching public outcomes:

| Synthetic accounting workload | Old median | New median |
| --- | ---: | ---: |
| Promote consulted live entries | 17.521 ms | 5.451 ms |
| Evict oldest live entries | 241.092 ms | 40.224 ms |
| Mixed weighted replacements | 140.700 ms | 46.559 ms |

The benchmark retains live keys and uses numeric values with modeled weights.
It uses neither forced GC nor a timing threshold as a test assertion. These
are measurements of cache accounting, not a prediction of game speed.

## TU93: matched behavior and observed timing

The [new TU93 campaign](native-campaigns-v37/tu93-three-levels.json) repeats the
same first-three-level target as v36. The
[comparison](native-campaigns-v37/tu93-comparison.json) passes all eleven checks:
the 67 commands, 68 complete public observation packets including animation
packets, 25 selected prefixes, primitive boundaries, acquisition counters,
reported retained-series projections and request outcomes match. Both runs
complete three levels in one session under the same budgets and game assets.

Observation-scope identifiers are normalized only where explicitly reported
by the comparison. Implementation identities and session scopes differ, so
this does not claim equality of complete graph-chain digests or every internal
node identity. Both campaigns keep their source unchanged and load zero
Python agent modules.

| Measurement | v36 | v37 |
| --- | ---: | ---: |
| Active time | 47.537 s | 41.411 s |
| Complete campaign wall time | 67.828 s | 54.774 s |
| Physical actions | 67 | 67 |
| Sealed prefixes | 25 | 25 |
| Natural boundary replays | 2 | 2 |

The observed active time is **12.886% lower** in this before/after pair.
Wall time is 19.246% lower, but it includes the outer test's proof inspections,
game hosting and initialization. This is one before/after observation, not a
repeated benchmark or a guarantee for another game, browser or machine. The
two optimizations were applied together; these campaigns do not isolate each
change's independent causal contribution.

The request timing distinguishes where the active work remains:

| Service stage | Count | v36 total | v37 total |
| --- | ---: | ---: | ---: |
| Initial selection | 1 | 1.178 s | 1.011 s |
| Advance without closing the prefix | 42 | 0.878 s | 0.980 s |
| Sealed-prefix acquisition | 25 | 35.060 s | 30.747 s |
| Resume and plan | 24 | 10.073 s | 8.263 s |

Intermediate advances remain inexpensive, with a median of 20.784 ms before
and 21.700 ms after. This measurement does not show improvement in every
operation. The main observed reduction is in acquisition and planning.

## Sampled profile and remaining cost

The [new CPU summary](native-campaigns-v37/tu93-cpu-summary.json),
[profile comparison](native-campaigns-v37/tu93-profile-comparison.json) and
[compressed raw profile](native-campaigns-v37/tu93.cpuprofile.gz) retain the
evidence. The same read-only analyzer is used for both profiles. The raw v37
profile SHA256 is
`73bc4bdaf2e925f8eed5cf045198a4098d2e043c40ffdeafb94145d6e5741c0a`.

| Module | v36 self samples | v37 self samples | v36 excluding explicit inspection | v37 excluding explicit inspection |
| --- | ---: | ---: | ---: | ---: |
| `canonical.ts` | 26.579 s | 23.276 s | 20.262 s | 19.623 s |
| `bounded-weak-cache.ts` | 16.799 s | 6.138 s | 10.032 s | 3.708 s |
| `v6-native-state-graph.ts` | 5.433 s | 5.934 s | 4.742 s | 5.175 s |

The explicit full-graph inspections made by the test helper account for
14.268 sampled seconds before and 7.369 after, outside the service-request
durations. They are not automatic UI inspections. Module totals and inspection
contexts overlap and must not be added together. Removing the explicit
inspection samples is useful but does not yield exact production-only costs:
async stack ancestry and some proof work remain partially unattributed.

The cache cost falls markedly in this pair. Canonical work remains the largest
of these measured costs, particularly outside explicit inspection, and the
state-graph sample total does not fall. Acquisition still depends on journal
growth and current evidence. This step does not establish constant-cost long
sessions or eliminate all accumulation effects. Further work should target
the remaining repeated encoding and validation paths while preserving the
current ownership, revision and corruption checks.

## Migration progress

The [declared-entry audit](v6-entry-point-progress.json) remains at **29 of
76 entries connected, 38.2%**. This performance step and the new ELAS
campaign exercise existing connected capabilities; they do not add a source
entry. The metric counts equally weighted DRM subquestion connections,
not code volume, a game score or complete V6 behavioral parity. Full migration
and full inherited-caller parity remain incomplete.

## Next transfer step

Resume the pending **`cell_patch_composition`** capability in the shared owner,
following the original `CellPlacementAccess` and `common_cell_placement`
contracts immediately below the alternating-graph layer. Preserve the local
and remote packet evidence bound to its observed context, acquisition order
and original refusals, then validate the integrated chain on a fresh game.
TICT is a candidate for that validation, not an established future success.
The remaining encoding costs above stay documented as a performance limit
while capability transfer resumes.
