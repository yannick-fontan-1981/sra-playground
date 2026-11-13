# Lot 2B cost protocol

This protocol is fixed before measuring the changed implementation. The baseline is published Site V61, commit `b288fef0f6ec7898e6e6ea6de56c3e2af2d5cf19`, in a detached worktree. It is measured again in the present session; lot 2A timings are historical context, not substituted as the current baseline.

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

Both runs use a shared execution host, not an isolated machine. A reserved project window is requested for each run: other agents may read sources and edit text, but must not deliberately run heavy fixture generation, tests, builds or game campaigns. The root agent confirmed that restriction for this baseline. External process activity and CPU utilization are not separately recorded, so project scheduling does not establish machine isolation. Actual overlapping work, if detected, will be retained in the results. Observed between-round variation still limits causal interpretation of ratios. The budget evaluates observed matched-work costs; it is not a hardware-independent performance guarantee.

Morphology-positive contribution and any changed-path timing must retain their own scope. These controls alone cannot establish that the new producers improve a selected game.

## Added control and attention paths

The controls above do not isolate the new morph.last consumers, control acquisition or attention parent-return. The separate absolute diagnostic is declared in `component-protocol.md` before its first execution. It reconstructs its actual acquired state from the public-raster protocol of the kernel test, then restores fresh component owners for every call. V61 did not expose these consumers; no zero-cost baseline or artificial speed ratio is assumed for a newly connected path.

## Reproduction

Use unused receipt paths; the runners refuse to overwrite evidence.

```bash
node scripts/measure-native-loop-costs.mjs \
  docs/migration/lot2b-evidence/performance/cases.json \
  docs/migration/lot2b-evidence/performance/new-run.json

node scripts/compare-native-loop-costs.mjs \
  docs/migration/lot2b-evidence/performance/comparison-policy.json \
  docs/migration/lot2b-evidence/performance/baseline.json.gz \
  docs/migration/lot2b-evidence/performance/after.json.gz \
  docs/migration/lot2b-evidence/performance/new-comparison.json

```

Lossless compressed receipts retain the original JSON bytes. Native digests identify measured code even while the changed checkout has not yet been committed.
