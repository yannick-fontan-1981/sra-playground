# Shared-series epoch anchors, v33

## Scope

Logos Engine native implementation `0.5.1` adds the acquisition and restoration
of `coupled_pair_epoch_anchor` to the common series memory. The agent executes
in TypeScript. Its original Python implementation is an unchanged development
reference at `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

This is a deliberately bounded follow-up to the
[v32 checkpoint](v32-support-recall-delta.md). It transfers a missing memory
producer, not a new planner. The [declared-entry audit](v6-entry-point-progress.json)
therefore remains **27 of 76 connected entries, 35.5%**. Complete V6 behavioral
parity remains false.

## Source behavior retained

The original `CoupledPairAccess.record`, lines 55-59, acquires an anchor the
first time it records a transition whose **before epoch** has no anchor. It
records the before score, observation reference, whole-frame digest and
interior digest. The interior removes the first and last row and column.
The source returns early on an epoch change only after this acquisition.

No geometry match, coupled-pair proposal, action success, special input or game
identifier is required. The first witnessed transition can come from another
family. The adapter retains the source order:

1. Occurrence-recall acquisition, when applicable.
2. The epoch anchor, once for each previously unseen before epoch.
3. Public animation-packet observation, when applicable.

The common runtime still reconciles transitions only when their committed
prefix seals. A paused or unfinished prefix does not acquire its anchor early.
Selected and passive acquisition share the same registered provider and the
same journal; selected recall is not acquired again by passive observation.

## Native ownership and restoration

[`v6-coupled-pair-epoch-anchor.ts`](../../src/logos-engine/v6-coupled-pair-epoch-anchor.ts)
implements the anchor-only projection. It checks the epoch map before computing
frame or interior digests, so repeated records in an already anchored epoch
do not scan those matrices again. It retains compact source anchor events,
not an additional copy of each pixel frame. Replay preserves every source
event, including repeated anchors if they are explicitly present in a journal.

[`v6-shared-series.ts`](../../src/logos-engine/v6-shared-series.ts) composes this
projection with the existing recall memory. Production uses that closure
through the existing `public_occurrence_recall` provider. The actual
`family_state:public_occurrence_recall` node and `repeated_series_state` fact
retain the combined journal. Reconstruction validates the complete supported
state before replacing either working memory. Corrupt or unsupported events
cannot leave a partly restored live instance.

The isolated recall factory and its original oracle remain available and
unchanged in behavior. A recall-only v32 digest is deliberately rejected by
the new shared closure. Silently accepting it would lose the missing epoch
history or invent a past initial frame. Implementation `0.5.1` has a distinct
runtime manifest identity. No cross-version session conversion is claimed.

The new code leaves the v32 delta store and bounded caches intact. Histories,
counterexamples, revisions and public observations are retained. This lot
does not claim to remove all existing full-journal reconstruction costs.

## Digest qualification and remaining work

The anchor layer uses the exact original formula:

```text
identity([parent_digest, pair_state, pair_events, pair_initials])
```

In this closure `pair_state` is null and the parent is the transferred recall
closure. Its scope is explicitly reported as
`native_recall_ancestors_and_coupled_pair_epoch_anchors_v1`. The original full
`ObservedCompositionConstraint` inherits further layers that are not yet
ported. Empty substitute layers are not added to imitate its digest.

The full original first-prefix MEMO result and the HANO/ONDE shared event
journals can now match even though the full original series digest does not.
The [migration map](../../migration/v6-transfer-map.json) marks both
`coupled_pair_access.py` and `common_observed_compositions.py` as partial.
Pair evidence, paired-control planning, return/refutation logic and the other
series providers remain pending.

## Verification

The targeted evidence and real-game results for this lot are recorded in
[`native-campaigns-v33`](native-campaigns-v33/). The unchanged-source anchor
oracle includes selected recall, passive observation, program animation,
epoch boundaries, repeated epochs, interior/frame distinctions and replay.
The common integration checks compare whole source event envelopes where the
supported closure is complete, rather than filtering away the formerly
missing anchor.

The [shared-series tests](../../tests/v6-shared-series.test.ts) additionally
exercise authoritative V7 restoration, unchanged next recall decisions,
no duplicate acquisition and atomic rejection of corrupt or unsupported state.
The [HANO common-caller test](../../tests/v6-caller-integration.test.ts) checks
that the first unfinished primitive does not acquire memory before prefix seal.

**135 distinct focused tests pass**, including the final 41 anchor/shared-series
cases and the recorded recall, caller, graph-authority and service checks.
The exact batches and their scope are retained in
[validation.json](native-campaigns-v33/validation.json). The source oracle
contains 11 journals, 21 operations and 53 verified source hashes.
Restoring the actual V7 node from an earlier epoch, then reacquiring the later
epoch, reproduces the same event journal and digest without stale cache state.

| Fresh native campaign | Result | Physical actions | Acquired prefixes | Final anchor epochs |
| --- | --- | ---: | ---: | --- |
| [ONDE, all 6 levels](native-campaigns-v33/onde.json) | `WIN`, 6/6 | 48 | 9 | 1, 2, 3, 4, 5, 6 |
| [HANO, 2-level regression](native-campaigns-v33/hano-two-levels.json) | Target reached, 2/2; full game not replayed in this lot | 16 | 8 | 1, 2 |

Both campaigns retain one session, the normal active time/action budgets and
the same unchanged 109-file native source manifest. They load no Python agent
modules; Pyodide runs only the game environment. Each sealed prefix verifies
that anchors correspond exactly to the publicly witnessed **before** epochs.
ONDE reproduces all 48 commands and 49 complete public packet hashes of the
v32 native campaign. The HANO run also matches the original reference's first
16 commands and 17 public packets. These are bounded regression results,
not evidence that the unported coupled-pair planner is now available.

## Next bounded step

Port the public coupled-pair observation and response-evidence acquisition
needed to interpret these anchors. Verify the source correspondence and
return/refutation distinctions before connecting paired-control planning.
Keep each new provider explicit in the migration map and in the native digest
scope; expand game campaigns only when that provider is actually connected.
