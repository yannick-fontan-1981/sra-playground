# Lot 2A cost protocol

The completed comparison and its numerical limits are in [results.md](results.md).

This protocol is fixed before measuring the changed implementation. The baseline is published Site V60, commit `9be3d0434f6f8ff91236d61a51eafa4017c3a082`, in a detached worktree. It is measured again in the present session; lot 1 timings are historical context, not substituted as the current baseline.

## Matched common-runtime comparison

The existing `scripts/measure-native-loop-costs.mjs` runner and `scripts/compare-native-loop-costs.mjs` comparator are reused unchanged. Both runs must bind the same harness, declarations, trace bytes, case manifest, environment description and work counts. Native source inventories are recorded before and after each run and must be unchanged during measurement.

| Case | Actions per measured session | Role |
| --- | ---: | --- |
| STCK | 10 | Predeclared common-path control, two natural levels and known-prefix continuation |
| SMLP | 15 | Predeclared common-path control, three natural levels |
| LIFE | 49 | Finite longer retained session, three levels, lot 1 parent and pose path |

Each separate Node worker receives three warmup actions followed by three fresh-knowledge sessions. The worker remains warm between these sessions. Each version therefore executes 222 measured actions and nine warmup actions. This is not a fresh-browser benchmark.

The actual `BrowserV6Agent` controller calls the actual `V6AgentService` and full native runtime. Commands are computed before the replay host checks them against the archived commands. The host returns only recorded public observations. No expected action, game implementation, learned state or prepared solution is supplied to the decision engine. A changed trajectory must be reported separately rather than fed mismatched returns or forced into a speed ratio.

## Costs and interruption

Observed methods separate new decisions, continuation guards, acquisition including persistence, persistence alone, and family restoration. Complete service continuation includes observation, reconciliation, guard and snapshot work; request time additionally includes worker transport and scheduling before controller acceptance. These timings are nested and must not be added. Caller and authority restoration remain inside decision time.

Game execution is reported as zero by the replay host. Its separate lookup/copy timing is not live game execution. Browser rendering, animation, network and hosting time are outside this benchmark.

Three explicit inspections follow each replay. They measure service serialization plus worker transport, independently from agent replay time. They do not include controller acceptance, additional copying/deepFreeze or rendered inspection UI.

Each measured session requests Pause during initial planning and during the first already engaged action. Immediate controller acknowledgement and time to a safe boundary are distinct measurements. The first point must execute zero actions and retain the pending ticket; the second must acquire exactly one action. One initialization and one acquisition per returned action are required. These fixed pause points do not claim arbitrary mid-search preemption or bounds for every possible long computation.

## Statistics and budget

`comparison-policy.json` predeclares a maximum 10% increase in the observed median for eight metrics on STCK and SMLP: complete session, new decision, complete service continuation, continuation request, continuation guard, acquisition including persistence, persistence and family restoration. A noisy excess remains unresolved; noise is not added to this allowance. LIFE reports finite longer-session costs separately.

Raw measurements, counts, medians, ranges and observed between-round median spread are retained. The empirical nearest-rank p95 is reported only at 20 or more samples. Samples within sessions are correlated; three round medians are a noise diagnostic, not a confidence interval. Lower observed timings do not establish a general optimization. Different operations earlier and later in LIFE do not establish constant-time scaling, absence of a memory leak or hours-long stability.

Both runs use a shared execution host, not an isolated machine. Source-fixture generation may have overlapped the early baseline measurements; concurrent CPU utilization was not separately recorded. The changed run used a reserved window without other deliberate heavy project jobs. This scheduling difference and the observed between-round variation limit causal interpretation of the ratios. The budget evaluates observed matched-work costs; it is not a hardware-independent performance guarantee.

Morphology-positive contribution and any changed-path timing must retain their own scope. These controls alone cannot establish that the new producers improve a selected game.

## New producer component diagnostic

`scripts/measure-native-morphology-costs.mjs` measures the new producer and the existing morphology policy separately on five fixed synthetic public-raster component cases: current modifier access, peer access after selective alignment, a short prefix whose full route exceeds the measured reserve, absent control evidence, and ambiguous multiple pairs. Original Python outputs are used only to check the result after each measured call. They are never supplied to the producer or policy.

Each case has three warmups followed by twenty calls on the same inputs. Public snapshots and policy creation occur beforehand. This diagnostic measures absolute costs after the change. V60 lacked this native producer; inventing a zero baseline or a speed ratio would be misleading. These warm component samples are correlated, and their p95 is an empirical diagnostic. They do not measure full common planning, authorization, acquisition, persistence, restoration, transport, inspection, rendering or game execution.

The fixture supplies synthetic public observations, explicit displacement history and scoped contact witnesses. This is source-verified component work, not a claim that the component diagnostic acquired that history in a cold game session. Complete session evidence is kept separately. Native source, timing script and fixture hashes must remain stable during the diagnostic, and input knowledge must remain unchanged through repeated measurement.

## Reproduction

Use unused receipt paths; the runners refuse to overwrite evidence.

```bash
node scripts/measure-native-loop-costs.mjs \
  docs/migration/lot2a-evidence/performance/cases.json \
  docs/migration/lot2a-evidence/performance/new-run.json

node scripts/compare-native-loop-costs.mjs \
  docs/migration/lot2a-evidence/performance/comparison-policy.json \
  docs/migration/lot2a-evidence/performance/baseline.json.gz \
  docs/migration/lot2a-evidence/performance/after.json.gz \
  docs/migration/lot2a-evidence/performance/new-comparison.json

node scripts/measure-native-morphology-costs.mjs \
  docs/migration/lot2a-evidence/performance/new-producer-costs.json
```

Lossless compressed receipts retain the original JSON bytes. Native digests identify measured code even while the changed checkout has not yet been committed.
