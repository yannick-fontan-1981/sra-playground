# Lot 1: measured before/after costs

The predeclared unchanged-path budget passes: all 16 median comparisons across STCK and SMLP remain below a 10% increase. The largest increase is 6.43%, for isolated SMLP continuation authorization (0.432 to 0.460 ms). The changed LIFE path and explicit inspection have separate costs, including increases reported below; this is not a claim that every measured operation stayed below 10%.

The comparator verified identical harness bytes, declarations, recorded public inputs, case settings, environment descriptions, measured action/level/cycle counts and phase sample counts. Both source inventories stayed unchanged throughout their runs. Each build has three cold-knowledge sessions per case after a three-action warmup in that case’s worker: 222 measured actions and nine warmup actions. Every actual command matched before the next public return was supplied.

## Source and run identity

| Item | Baseline | After |
| --- | --- | --- |
| Native implementation | logos-engine.typescript.v6.native-migration/0.31.0 | logos-engine.typescript.v6.native-migration/0.32.0 |
| Native files | 236 | 237 |
| Native digest | `f2ec2ff8658290c510a58642612b4f9d4b07a04d8fa6434c91aadda997e6c23e` | `8a67b57947364dab988c7081e35eb6a923beee2305eb4b8a8a89c2fc86ebea57` |
| Run interval, UTC | 2026-11-09T16:21:45.827Z to 2026-11-09T16:31:56.192Z | 2026-11-09T16:53:13.543Z to 2026-11-09T17:03:04.485Z |

The baseline is the detached published V59 commit `f7b9a56af5488c8d4cebd5d912262a541f4fe403`. After measurements include the pending lot 1 working-tree changes on that same Git base; the native digest, not HEAD alone, identifies the measured implementation. The byte-identical harness SHA-256 is `47686d5c3294cf9fde70b9699a0ea184b8b978257d8c45a0f36945f8beb37c59`.

Environment: Node v24.22.1, linux kernel 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 logical CPUs reported by Node.

## Complete sessions

| Case | Actions / natural levels per session | Baseline median, s | After median, s | Observed median change |
| --- | ---: | ---: | ---: | ---: |
| STCK | 10 / 2 | 13.721 | 12.642 | -7.86% |
| SMLP | 15 / 3 | 30.941 | 29.066 | -6.06% |
| LIFE | 49 / 3 | 141.865 | 138.513 | -2.36% |

Three session totals do not support a p95. All session ranges are retained in `comparison.json`. Lower observed totals are not attributed to an optimization: the independent before/after runs have measurable scheduling and allocation variation.

## Unchanged paths: phase measurements

All values below are milliseconds; n is the sample count per build. Tails show empirical nearest-rank p95 only for n ≥ 20. Otherwise the observed maximum is shown and explicitly labeled. The 10% working budget applies to medians, not to maxima. Nested phases must not be added.

### STCK

| Metric | n | Baseline median | After median | Change | Baseline tail | After tail |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Complete controller session | 3 | 13,720.977 | 12,642.096 | -7.86% | max 14,253.015 | max 12,996.457 |
| New decision | 18 | 379.148 | 314.058 | -17.17% | max 589.462 | max 514.024 |
| Complete prefix continuation: service | 12 | 23.368 | 22.255 | -4.76% | max 32.548 | max 27.770 |
| Complete prefix continuation: service + transport | 12 | 25.198 | 24.224 | -3.86% | max 34.702 | max 29.904 |
| Isolated continuation authorization | 12 | 0.258 | 0.245 | -5.17% | max 0.439 | max 0.626 |
| Acquisition including persistence | 18 | 1,149.238 | 1,055.546 | -8.15% | max 5,152.641 | max 4,619.041 |
| Persistence | 39 | 205.073 | 194.175 | -5.31% | p95 475.734 | p95 364.871 |
| Family-owner restoration | 36 | 13.495 | 11.418 | -15.39% | p95 92.231 | p95 89.883 |

### SMLP

| Metric | n | Baseline median | After median | Change | Baseline tail | After tail |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Complete controller session | 3 | 30,940.959 | 29,066.411 | -6.06% | max 31,985.528 | max 30,110.342 |
| New decision | 27 | 539.854 | 563.959 | +4.47% | p95 3,907.795 | p95 3,809.789 |
| Complete prefix continuation: service | 18 | 26.736 | 28.070 | +4.99% | max 50.657 | max 36.224 |
| Complete prefix continuation: service + transport | 18 | 29.945 | 30.877 | +3.11% | max 53.688 | max 38.902 |
| Isolated continuation authorization | 18 | 0.432 | 0.460 | +6.43% | max 1.475 | max 7.761 |
| Acquisition including persistence | 27 | 1,925.547 | 2,020.165 | +4.91% | p95 3,730.395 | p95 3,766.009 |
| Persistence | 57 | 192.000 | 182.109 | -5.15% | p95 321.957 | p95 330.944 |
| Family-owner restoration | 54 | 5.824 | 5.880 | +0.97% | p95 32.194 | p95 27.433 |

SMLP’s isolated authorization maximum is 7.761 ms after versus 1.475 ms before, despite its median remaining within budget. With 18 observations, this tail is reported as a maximum rather than an invented p95.

The complete continuation service measurement includes observation, reconciliation, the following guard and snapshot work. The request measurement adds worker transport/scheduling until response delivery. The complete controller session also includes controller acceptance. Restoration isolates family owners; caller and authority restoration remain inside new-decision time.

## Observed noise; no relaxed threshold

The following diagnostic is `(largest round median − smallest round median) / median of round medians`. It is not a confidence interval or an allowance added to the 10% budget.

| Case | Metric | Baseline relative range | After relative range |
| --- | --- | ---: | ---: |
| STCK | Complete controller session | 10.12% | 5.92% |
| STCK | New decision | 34.59% | 24.10% |
| STCK | Complete prefix continuation: service | 32.47% | 13.64% |
| STCK | Complete prefix continuation: service + transport | 32.11% | 13.67% |
| STCK | Isolated continuation authorization | 28.67% | 33.89% |
| STCK | Acquisition including persistence | 17.53% | 13.61% |
| STCK | Persistence | 20.12% | 5.42% |
| STCK | Family-owner restoration | 13.16% | 27.44% |
| SMLP | Complete controller session | 12.32% | 6.36% |
| SMLP | New decision | 12.39% | 14.10% |
| SMLP | Complete prefix continuation: service | 33.44% | 14.78% |
| SMLP | Complete prefix continuation: service + transport | 34.76% | 14.82% |
| SMLP | Isolated continuation authorization | 87.59% | 9.85% |
| SMLP | Acquisition including persistence | 10.05% | 17.61% |
| SMLP | Persistence | 15.00% | 13.98% |
| SMLP | Family-owner restoration | 29.35% | 15.35% |

Variation remains material in several phases, particularly short guards. The result supports the stated observed-budget check under these matched inputs; it does not establish a hardware-independent improvement or a 10% upper confidence bound. No repeat was selected to replace an unfavorable first result. Both original runs are retained.

## Changed path and the finite longer session

LIFE traverses the actual material pose selections and their conditional continuation. Its 49-action, three-level session is a finite retained-history check, not an hours-long stability test. The case was declared diagnostic because its behavior now includes the new retained-parent work.

| LIFE metric | n | Baseline median, ms | After median, ms | Change | Baseline tail, ms | After tail, ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Complete controller session | 3 | 141,865.173 | 138,513.186 | -2.36% | max 146,685.248 | max 140,719.234 |
| New decision | 141 | 632.759 | 616.113 | -2.63% | p95 1,000.572 | p95 945.098 |
| Complete prefix continuation: service | 6 | 60.033 | 67.511 | +12.46% | max 70.649 | max 88.950 |
| Complete prefix continuation: service + transport | 6 | 67.189 | 73.670 | +9.65% | max 77.844 | max 95.716 |
| Isolated continuation authorization | 6 | 13.641 | 30.489 | +123.52% | max 16.292 | max 43.090 |
| Acquisition including persistence | 141 | 2,220.192 | 2,076.232 | -6.48% | p95 3,799.176 | p95 3,774.438 |
| Persistence | 285 | 385.743 | 373.604 | -3.15% | p95 739.748 | p95 718.210 |
| Family-owner restoration | 282 | 8.781 | 10.761 | +22.56% | p95 110.282 | p95 108.635 |

The changed-path authorization is more expensive: 13.641 to 30.489 ms, a 123.52% increase. Complete continuation service time rises from 60.033 to 67.511 ms, or 12.46%. Both have only six samples, so no p95 is reported. Their increases remain explicit even though the complete LIFE session median decreases. Across the complete LIFE path, family restoration rises from 8.781 to 10.761 ms (+22.56%); its empirical p95 changes from 110.282 to 108.635 ms over 282 samples per build.

Filtering by the actual selected `typed_pose_dependency` proposal gives:

| Selected pose metric | n | Baseline median, ms | After median, ms | Change | Baseline max, ms | After max, ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| New decision | 12 | 828.978 | 873.207 | +5.34% | 1,075.603 | 2,102.281 |
| Isolated continuation authorization | 6 | 13.641 | 30.489 | +123.52% | 16.292 | 43.090 |
| Acquisition including persistence | 12 | 3,266.263 | 3,400.513 | +4.11% | 6,146.784 | 6,606.765 |
| Persistence | 12 | 632.092 | 596.476 | -5.63% | 843.537 | 782.107 |
| Family-owner restoration | 12 | 111.827 | 91.621 | -18.07% | 135.162 | 134.290 |

This includes four selected pose decisions per session, twelve per build. Selected-pose decision time rises by 5.34% and acquisition including persistence by 4.11%. Their maxima remain visible; twelve correlated observations do not establish a p95.

At the final acquired boundary, LIFE has 1,310 graph nodes / 5,142 revisions before and 1,311 nodes / 5,172 revisions after, identically across each build’s three sessions. These counts describe the measured retained graph, not heap ownership.

| LIFE memory observations across the three measured sessions | Baseline, MiB | After, MiB |
| --- | ---: | ---: |
| Worker heap used: observed range | 98.0–1161.4 | 81.1–1150.8 |
| Node process RSS: observed range | 747.8–1965.8 | 758.7–1803.9 |

Heap observations include allocation/collection effects and the warmed worker; RSS includes the controller and worker process. No forced-GC retained-size assay was performed. These ranges prove neither a leak nor improved memory scaling.

## Agent, public host and inspection remain separate

The replay host reports `executionMs=0`. The following host costs are only archived-packet lookup, command verification and frame copying. No live game execution, animation, browser layout, painting, network or hosting time is measured.

| Public replay host lookup/copy | n per build | Baseline median, ms | After median, ms |
| --- | ---: | ---: | ---: |
| STCK | 30 | 0.084 | 0.092 |
| SMLP | 45 | 0.146 | 0.091 |
| LIFE | 147 | 0.084 | 0.084 |

Three explicit inspections follow each measured replay and are excluded from all replay/decision times. Each row below has nine samples per build, so no p95 is reported. This direct service probe includes service cloning and worker transport but excludes `BrowserV6Agent.inspectKnowledge()` acceptance, copying and `deepFreeze`, as well as rendered inspector work.

| Inspection | Baseline service median, ms | After service median, ms | Service change | Baseline service + transport median, ms | After service + transport median, ms | Total change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| STCK | 258.063 | 223.082 | -13.56% | 427.820 | 394.490 | -7.79% |
| SMLP | 253.417 | 292.751 | +15.52% | 453.638 | 491.089 | +8.26% |
| LIFE | 1,403.834 | 1,305.104 | -7.03% | 2,656.395 | 2,391.049 | -9.99% |

SMLP inspection service time rises 15.52%, while the service-plus-transport median rises 8.26%. Inspection was predeclared as a separate diagnostic, outside the hot-loop median budget; its service increase is not hidden by the passed loop result. Inspection min/max observations remain in the comparison receipt.

## Pause: controller acknowledgement and safe completion

The real controller receives Pause at two fixed points: its initial worker request is outstanding, or its first physical action has entered the public host. It dispatches zero actions in the first case and acquires exactly the one engaged return in the second. No second action is dispatched before pausing, and no reset or new initialization is needed.

Each row has three samples per build. All values are milliseconds. Acknowledgement is the Node controller method cost, not click-to-painted-UI latency. Safe completion includes the outstanding native work and protocol delivery.

| Case / pause point | Baseline acknowledgement | After acknowledgement | Baseline safe-boundary median | After safe-boundary median | After safe-boundary max |
| --- | ---: | ---: | ---: | ---: | ---: |
| STCK / initial planning | 0.011627 | 0.012418 | 1,240.140 | 1,185.338 | 1,192.874 |
| STCK / first engaged action | 0.014291 | 0.013169 | 1,128.414 | 1,053.673 | 1,111.957 |
| SMLP / initial planning | 0.013360 | 0.014552 | 4,745.187 | 4,578.782 | 4,701.237 |
| SMLP / first engaged action | 0.017105 | 0.016805 | 2,397.306 | 2,377.673 | 2,403.756 |
| LIFE / initial planning | 0.004457 | 0.003886 | 1,208.306 | 1,208.324 | 1,371.813 |
| LIFE / first engaged action | 0.005368 | 0.005669 | 1,059.638 | 1,136.180 | 1,166.504 |

These two points do not establish arbitrary mid-search preemption or a universal latency bound. Across the after-run cases, median acknowledgement ranges from 0.004 to 0.017 ms for the Node controller, while median safe completion ranges from 1.05 to 4.58 seconds. These are not rendered UI latencies.

## Reproducible evidence

- `baseline.json.gz` and `after.json.gz`: original complete JSON bytes, losslessly compressed with deterministic gzip metadata.
- `baseline-relocation.json` and `after-relocation.json`: raw/compressed hashes, sizes and exact decompression checks.
- `comparison-policy.json`: predeclared stages, unchanged controls and 10% relative median budget.
- `comparison.json`: machine-readable matched-input checks, distributions, round-median variation, diagnostics and empty `unresolved` list.
- `README.md`: method, scopes, qualifications and reproduction commands.
