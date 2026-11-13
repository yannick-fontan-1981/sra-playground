# Lot 1 cost measurements

The completed comparison and its numerical limits are in [results.md](results.md).

The reusable runner is `scripts/measure-native-loop-costs.mjs`. The case manifest
fixes the recorded public observations, action limits, warmup and three measured
sessions before the changed implementation is measured. The baseline runs from
a detached checkout of published V59, `f7b9a56af5488c8d4cebd5d912262a541f4fe403`.
Its native source inventory is checked before and after execution.

## Measured work

| Case | Public actions per measured session | Purpose |
| --- | ---: | --- |
| STCK | 10 | Two natural levels, ordinary decisions and guarded prefix continuations |
| SMLP | 15 | An unchanged ordinary three-level trajectory |
| LIFE | 49 | Three levels of retained material knowledge, including actual `typed_pose_dependency` selections and a multi-action pose prefix |

Each case uses a separate Node worker. Three public actions warm that worker's
imports and execution machinery. Every measured session then creates a new
common native runtime with empty acquired knowledge. The same worker remains
available for those sessions, so these are cold-knowledge sessions in a warmed
worker, not measurements of a fresh browser process.

The real `BrowserV6Agent` controller calls the real `V6AgentService` in that
worker. The service creates the full common runtime. Expected commands stay in
the replay host: a public result is returned only after the native command has
been computed and checked against its archived command. No game implementation,
oracle, prepared route or learned state enters the native solver.

Instance method wrappers record the elapsed time of `plan`, continuation-only
`authorize`, `seal`, `persistFamilies` and `restoreFamilies`. They preserve
arguments, results, exceptions and ordering. These timings are nested. In
particular, acquisition includes persistence and a new decision includes its
restoration and authorization; adding the rows would double-count work.
`restoreFamilies` isolates the family owners' restoration. The common caller
and composition authority restore inside `plan`; their costs are included in
the decision time but are not isolated by this probe.

The complete service `advance` calls that return another action in the committed
prefix supply `known_prefix_service`: observation, reconciliation, following
guard and snapshot work are included. `known_prefix_request` also includes
worker transport and scheduling up to response delivery, before controller
acceptance. The comparator derives both from the already recorded request
samples. The complete controller replay time (`session_elapsed`) also belongs
to the unchanged-path budget, so a smaller isolated guard cannot hide a slower
whole session.

The replay host reports `executionMs=0`. The separately measured public lookup
and frame-copy cost is not live game execution time. The service's request time
and transport/scheduling time are also recorded. Three explicit inspections run
after each measured replay; their graph cloning and transport costs are excluded
from replay and decision times. This benchmark does not measure browser layout,
painting, game animation, networking or hosting.
The inspection call goes directly to the service through the measurement
transport. It does not invoke `BrowserV6Agent.inspectKnowledge()`, so its
additional controller acceptance, copying and `deepFreeze` work are excluded.

## Pause contract

Each measured session requests Pause twice through the real controller:

1. While its first native initialization/planning request is outstanding. The
   command remains unexecuted, with its authorization retained.
2. Once the first action has entered the public host. Exactly that action's
   actual return is acquired before the controller settles at a safe boundary.

The receipt separates immediate controller acknowledgement from time until the
in-flight operation reaches that boundary. It checks zero actions in the first
case and exactly one acquired action in the second, with no reset and one
initialization for the whole session. Node worker scheduling is an execution
test of this controller contract, not a claim about a rendered browser's latency.
These two fixed pause points do not establish arbitrary mid-search preemption
or a bound for every possible long computation.

## Statistics and working budget

The runner retains raw samples, per-session medians, pooled medians and empirical
nearest-rank p95 only when there are at least twenty samples. Smaller samples
retain their count, median and range; a p95 is not invented. Observations inside
one session are correlated. The spread between the three session medians is an
observed noise diagnostic, not a confidence interval.

`comparison-policy.json` predeclares STCK and SMLP as unchanged controls. The
working budget is a maximum 10% rise in the observed median for each measured
agent stage and the complete controller session. The comparator requires identical harness, declarations, public
traces, settings, environment descriptions, replay work counts and stage counts.
The changed typed-pose samples and finite longer LIFE session are reported
separately. A noisy over-budget result remains unresolved; noise is not added
to the allowance to manufacture a pass.

LIFE's early and late operations solve different observed situations. Its timing
and memory observations reveal the cost of that finite retained session; they
do not prove constant-time scaling, a memory leak or hours-long stability.

## Reproduction

Use an unused output path. Receipts are never overwritten:

```bash
node scripts/measure-native-loop-costs.mjs \
  docs/migration/lot1-evidence/performance/cases.json \
  docs/migration/lot1-evidence/performance/new-run.json

node scripts/compare-native-loop-costs.mjs \
  docs/migration/lot1-evidence/performance/comparison-policy.json \
  docs/migration/lot1-evidence/performance/baseline.json.gz \
  docs/migration/lot1-evidence/performance/after.json.gz \
  docs/migration/lot1-evidence/performance/new-comparison.json
```

The original baseline is retained in its detached checkout. Gzip delivery uses
the exact original JSON bytes, with deterministic gzip metadata. The native
digest identifies the measured source; Git HEAD can still be the base commit
while the working tree contains the pending change.
