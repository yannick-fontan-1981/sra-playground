# Lot 2A performance results

The predeclared matched-work comparison **passed**: all **16 STCK/SMLP median metrics** remain within the original **+10%** allowance, with no unresolved excess. The largest observed rise is **+3.90%**, the STCK continuation guard (0.259 ms to 0.270 ms). The policy, cases, action limits and timing harness were unchanged after results were known. No follow-up benchmark or threshold change was needed.

The retained LIFE session and the new morphology producer are reported separately. Passing the median budget does not mean every individual sample or p95 became lower. These measurements support the bounded observed-cost claim; they do not establish a causal speedup or performance on other machines.

## Source and execution identity

| Item | Baseline | After |
| --- | --- | --- |
| Source at measurement | Published V60, commit `9be3d0434f6f8ff91236d61a51eafa4017c3a082` | Native engine `0.33.0`, working source based on the same commit |
| Native file inventory | 237 | 239 |
| Native SHA-256 | `8a67b57947364dab988c7081e35eb6a923beee2305eb4b8a8a89c2fc86ebea57` | `cc4bcea77e0099dc035afa5d6ae03e0d5a7a00082633b8e2332691f34b769ad3` |
| Native source unchanged during its run | Yes | Yes |
| Measured sessions per case | 3 | 3 |
| Measured actions | 222 | 222 |
| Warmup actions | 9 | 9 |

The common timing runner is byte-identical on both sides: SHA-256 `47686d5c3294cf9fde70b9699a0ea184b8b978257d8c45a0f36945f8beb37c59`. The six manifest/declaration/public-trace inputs, environment descriptions, commands, action counts, level counts, plan counts, acquisition counts and measured stage counts match. Every public return is supplied only after the native command was computed and checked. Each session has one initialization, one advance per action and no reset. The final acquired transition count equals the action count.

Git HEAD still names the published base at measurement time; the native digest binds the changed source actually executed. The final delivery integrity check must match that digest. Lossless compressed reports and their transport receipts retain the exact original JSON bytes.

## Complete controller sessions

| Case | Actions / levels per session | Before median (s) | After median (s) | Observed change | Scope |
| --- | ---: | ---: | ---: | ---: | --- |
| STCK | 10 / 2 | 12.325 | 12.314 | -0.09% | Predeclared control |
| SMLP | 15 / 3 | 29.464 | 27.837 | -5.52% | Predeclared control |
| LIFE | 49 / 3 | 134.203 | 131.589 | -1.95% | Finite longer-session diagnostic |

Each row has three measured sessions, so no session p95 is reported. Each case uses a dedicated worker, three warmup actions and then fresh acquired knowledge for every measured session. The worker and imports remain warm. Complete controller time includes the tested pause/resume protocol; explicit post-run inspection is excluded.

These are archived-public-return measurements. The replay host declares game `executionMs=0`; its lookup and frame-copy time is recorded separately. They exclude actual game execution, animation, browser layout/painting, network and hosting. The actual TR87 game campaign and browser result are separate evidence and are not inferred from these timings.

## Common agent stages

All times below are milliseconds. Pooled samples within a session are correlated. The empirical nearest-rank p95 is reported only when the count reaches 20. The full reports retain every sample, minimum, maximum and per-session distribution.

### STCK

| Stage | Count per version | Before median | After median | Change | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| New decision | 18 | 375.830 | 322.888 | -14.09% | Not reported (<20) | Not reported (<20) |
| Complete continuation service | 12 | 24.932 | 22.151 | -11.15% | Not reported (<20) | Not reported (<20) |
| Continuation request including transport | 12 | 27.214 | 23.867 | -12.30% | Not reported (<20) | Not reported (<20) |
| Continuation guard | 12 | 0.259 | 0.270 | +3.90% | Not reported (<20) | Not reported (<20) |
| Acquisition including persistence | 18 | 1,169.611 | 995.028 | -14.93% | Not reported (<20) | Not reported (<20) |
| Persistence | 39 | 200.444 | 198.041 | -1.20% | 402.399 | 372.949 |
| Family restoration | 36 | 11.563 | 10.916 | -5.60% | 78.999 | 78.917 |

### SMLP

| Stage | Count per version | Before median | After median | Change | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| New decision | 27 | 542.592 | 470.864 | -13.22% | 3,855.219 | 3,636.994 |
| Complete continuation service | 18 | 27.092 | 23.880 | -11.86% | Not reported (<20) | Not reported (<20) |
| Continuation request including transport | 18 | 29.872 | 26.484 | -11.34% | Not reported (<20) | Not reported (<20) |
| Continuation guard | 18 | 0.462 | 0.453 | -1.91% | Not reported (<20) | Not reported (<20) |
| Acquisition including persistence | 27 | 2,157.444 | 2,126.653 | -1.43% | 3,562.453 | 3,457.790 |
| Persistence | 57 | 171.973 | 177.068 | +2.96% | 365.242 | 295.834 |
| Family restoration | 54 | 6.598 | 5.639 | -14.54% | 36.372 | 47.752 |

### LIFE

| Stage | Count per version | Before median | After median | Change | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| New decision | 141 | 591.348 | 612.882 | +3.64% | 965.513 | 1,129.279 |
| Complete continuation service | 6 | 64.942 | 62.107 | -4.37% | Not reported (<20) | Not reported (<20) |
| Continuation request including transport | 6 | 71.153 | 67.245 | -5.49% | Not reported (<20) | Not reported (<20) |
| Continuation guard | 6 | 25.813 | 27.046 | +4.78% | Not reported (<20) | Not reported (<20) |
| Acquisition including persistence | 141 | 2,091.300 | 2,106.101 | +0.71% | 3,548.861 | 3,526.106 |
| Persistence | 285 | 371.664 | 376.132 | +1.20% | 693.916 | 657.291 |
| Family restoration | 282 | 8.695 | 7.243 | -16.70% | 110.285 | 102.117 |

The stage durations are nested. Acquisition includes persistence; new decision includes restoration and authorization. Complete continuation service includes observation, reconciliation, guard and snapshot work; continuation request additionally includes worker transport/scheduling before controller acceptance. They must not be added. Family restoration is isolated; caller/authority restoration remains included in decision time.

Observed increases are retained in the report. On the controls, STCK guard median rises by 0.010 ms (+3.90%) and SMLP persistence by 5.096 ms (+2.96%). SMLP restoration median falls while its p95 rises from 36.372 to 47.752 ms (+31.29%). STCK complete continuation has a larger maximum sample (29.827 to 56.493 ms), despite a lower median; only 12 samples exist, so there is no p95 claim for that path.

On LIFE, new-decision median rises by 21.533 ms (+3.64%) and its p95 by 163.767 ms (+16.96%). Guard median rises by 1.234 ms (+4.78%, six samples), acquisition including persistence by 14.800 ms (+0.71%), and persistence by 4.467 ms (+1.20%). These increases are not erased by the slightly lower complete-session median. LIFE stays outside the predeclared unchanged-path budget and does not isolate a morphology-positive decision.

## Inspection and Pause

Inspection runs three times after each of the three sessions, for nine samples per case. It is outside session and decision timings. No p95 is reported at that count.

| Case | Service median before → after (ms) | Service + worker transport before → after (ms) |
| --- | ---: | ---: |
| STCK | 199.717 → 186.198 | 357.754 → 350.006 |
| SMLP | 250.350 → 234.777 | 430.188 → 401.749 |
| LIFE | 1,311.359 → 1,410.494 | 2,400.979 → 2,531.770 |

LIFE inspection service increases by 7.56%, and service plus transport by 5.45%. This is a separate observed cost, without evidence that the new producer caused the difference. These measurements exclude `BrowserV6Agent.inspectKnowledge()` acceptance, its extra copying/deepFreeze work and the rendered inspection panel.

Pause is requested at two fixed points: initial planning before any game action, and the first action already engaged with the host. The first must retain its pending ticket with zero actions executed; the second must acquire exactly that one action. Both checks passed for every measured session.

| Case / pause point | Acknowledgement after (ms) | Safe boundary before (s) | Safe boundary after (s) |
| --- | ---: | ---: | ---: |
| STCK / initial planning | 0.013149 | 1.163 | 1.118 |
| STCK / engaged action | 0.014401 | 1.196 | 0.979 |
| SMLP / initial planning | 0.013890 | 4.815 | 4.379 |
| SMLP / engaged action | 0.014422 | 2.312 | 2.335 |
| LIFE / initial planning | 0.003956 | 1.405 | 1.051 |
| LIFE / engaged action | 0.004907 | 1.007 | 0.911 |

Acknowledgement is the synchronous controller response measured in Node; it is not a browser paint or a promise that in-flight computation has already ended. The safe-boundary measurement includes that pending worker/protocol work. Each cell is the median of three observations. These two fixed points do not establish arbitrary mid-search preemption or an upper latency bound for every computation.

## Absolute cost of the new morphology producers

The separate diagnostic executes five synthetic public-raster component cases verified against the unchanged original Python. It provides the producer only with public snapshots, explicit primitive histories and scoped contacts; expected decisions are checked afterward. Policy and snapshot creation occur before measurement. Every case has three warmups then 20 measured calls on the same inputs. Inputs remain unchanged, and all results match the original. The fixture generator, original-source hashes and native source remain stable during the run.

| Component case | Producer median / p95 (ms) | Policy median / p95 (ms) | Combined median / p95 (ms) | Result |
| --- | ---: | ---: | ---: | --- |
| Current modifier access | 9.205 / 13.123 | 1.191 / 1.645 | 10.474 / 14.381 | `modifier` |
| Peer route after selective alignment | 8.414 / 10.428 | 1.013 / 1.396 | 9.464 / 12.086 | `peer` |
| Full route exceeds observed reserve | 8.999 / 10.537 | 1.209 / 1.325 | 10.261 / 11.822 | `access_exceeds_observed_meter_seek_affordable_effect` |
| No acquired control | 5.556 / 6.103 | 1.079 / 1.332 | 6.698 / 7.476 | `control_not_currently_attested` |
| Multiple pairs remain ambiguous | 1.714 / 2.753 | 0.940 / 1.220 | 2.661 / 3.995 | `insufficient_correspondence` |

The combined interval includes route admission and result preparation, so it is not an additional stage to add to the others. These are warm component calls on synthetic data, with correlated observations and empirical p95 values. They do not measure cold-game acquisition of the supplied history, the full family adapter, common authorization/acquisition/persistence/restoration, worker transport, browser rendering or game execution. V60 had no native current-measurement producer; no zero baseline or speed ratio is invented for this added work.

## Noise and remaining limits

| Case | Spread of round decision medians before | Spread after | Spread of complete session medians before / after |
| --- | ---: | ---: | ---: |
| STCK | 33.66% | 22.87% | 16.06% / 4.75% |
| SMLP | 16.21% | 10.12% | 8.48% / 10.89% |
| LIFE | 11.91% | 16.55% | 6.05% / 9.58% |

The spread is (maximum minus minimum) of the three round medians, divided by their median. It describes observed variation and is not a confidence interval. Some individual stages vary more: LIFE family-restoration round medians span 67.15% before and 9.72% after. There is no noise adjustment to the +10% budget.

Both runs used the shared host. Source-fixture generation may have overlapped early baseline measurements; concurrent CPU utilization was not separately logged. The after run used a reserved window without other deliberate heavy project jobs. This difference limits causal interpretation of apparent reductions. Median budget compliance is an observed result under this protocol, not a general performance guarantee.

Forty-nine LIFE actions provide a finite retained-session comparison. Earlier and later decisions address different scenes. These timing and memory observations do not establish hours-long stability, constant-time scaling or absence of a memory leak. The new producer diagnostic has only five explicit component situations, and no whole-game speedup is inferred from them.

## Evidence and reproduction

- [Fixed protocol and commands](README.md), [cases](cases.json), [initial comparison policy](comparison-policy.json).
- [Baseline exact report](baseline.json.gz) and [lossless transport receipt](baseline-relocation.json).
- [After exact report](after.json.gz) and [lossless transport receipt](after-relocation.json).
- [Strict comparison](comparison.json), with `status: passed` and `unresolved: []`.
- [Absolute producer diagnostic](producer-costs.json).
