# Lot 2B performance results

The predeclared matched-work comparison **passed**: all **16 STCK/SMLP median metrics** remain within the original **+10%** allowance, with `unresolved: []`. The largest observed rise is **+8.72%**, SMLP new-decision time (529.392 to 575.578 ms). The original cases, work counts, policy and common timing runner were retained. No retry, threshold adjustment or noise waiver was used. See the [strict comparison](comparison.json).

Passing this median budget does not mean every cost or tail decreased. STCK persistence and restoration p95 both increased; STCK inspection service also increased outside the budget. The full distributions and these increases are retained below. Lower complete-session medians do not establish a causal optimization.

## Source and execution identity

| Item | Baseline | After |
| --- | --- | --- |
| Source at measurement | Published Site V61 / native 0.33.0 | Working native 0.34.0 |
| Git base | `b288fef0f6ec7898e6e6ea6de56c3e2af2d5cf19` | `b288fef0f6ec7898e6e6ea6de56c3e2af2d5cf19` |
| Native inventory | 239 | 240 |
| Native SHA-256 | `cc4bcea77e0099dc035afa5d6ae03e0d5a7a00082633b8e2332691f34b769ad3` | `17252e294212a1563b75037a0b0dd782c2ecbc8cc4e1997a4f2bb2103bdf4e8b` |
| Native source unchanged during run | Yes | Yes |
| Measured sessions per case | 3 | 3 |
| Measured actions | 222 | 222 |
| Warmup actions | 9 | 9 |
| Reserved project window, UTC | 18:54:35–19:04:12 | 19:42:11–19:51:27 |

The unchanged common runner SHA-256 is `47686d5c3294cf9fde70b9699a0ea184b8b978257d8c45a0f36945f8beb37c59`. The comparator verifies identical manifest/declaration/public-trace inputs, harness, environment description, commands, action and level counts, planning counts, acquisition counts and measured-stage counts. Every archived return is supplied only after the native command was computed and matched. Each measured session has one initialization, one advance per action, no reset and an acquired-transition count equal to its action count.

Git HEAD still identifies the published base while measuring the changed checkout. The native digest identifies the changed source actually executed; final delivery integrity must match that digest. The separate component run uses the same 240-file digest and verifies its script, protocol, fixtures and source expectation inputs unchanged. The reports, attempt records and stdout/stderr journals are retained losslessly. No failed measurement attempt occurred.

## Complete controller sessions

| Case | Actions / levels per session | Before median (s) | After median (s) | Observed change | Scope |
| --- | --- | --- | --- | --- | --- |
| STCK | 10 / 2 | 13.044 | 11.821 | -9.38% | Predeclared control |
| SMLP | 15 / 3 | 28.682 | 28.098 | -2.04% | Predeclared control |
| LIFE | 49 / 3 | 131.956 | 128.367 | -2.72% | Finite longer session |

There are three measured sessions per row, so no session p95 is reported. Each dedicated Node worker receives three warmup actions, then fresh acquired knowledge for each measured session. Imports and the worker remain warm. The real `BrowserV6Agent`, `V6AgentService` and full native runtime execute the protocol, including its fixed pause/resume points. Post-run inspection is separate.

The replay host reports `executionMs=0`. Its archived lookup/frame-copy cost is separate from live game execution. These measurements exclude animation, browser layout/painting, network and hosting. They are not evidence of a new game solved or a live-game speedup.

## Common agent stages

All stage times are milliseconds. Pooled samples within sessions are correlated. Empirical nearest-rank p95 is reported only at 20 or more samples; the exact reports also retain ranges and every raw value.

### STCK

| Stage | Count per version | Before median | After median | Change | Before p95 | After p95 |
| --- | --- | --- | --- | --- | --- | --- |
| New decision | 18 | 318.192 | 313.548 | -1.46% | Not reported (<20) | Not reported (<20) |
| Complete continuation service | 12 | 28.032 | 21.687 | -22.63% | Not reported (<20) | Not reported (<20) |
| Continuation request including transport | 12 | 30.246 | 23.652 | -21.80% | Not reported (<20) | Not reported (<20) |
| Continuation guard | 12 | 0.327 | 0.240 | -26.65% | Not reported (<20) | Not reported (<20) |
| Acquisition including persistence | 18 | 1,031.903 | 1,015.817 | -1.56% | Not reported (<20) | Not reported (<20) |
| Persistence | 39 | 179.800 | 192.292 | +6.95% | 395.986 | 427.666 |
| Family restoration | 36 | 11.816 | 11.278 | -4.55% | 69.959 | 81.991 |

### SMLP

| Stage | Count per version | Before median | After median | Change | Before p95 | After p95 |
| --- | --- | --- | --- | --- | --- | --- |
| New decision | 27 | 529.392 | 575.578 | +8.72% | 3,706.881 | 3,360.154 |
| Complete continuation service | 18 | 26.955 | 26.316 | -2.37% | Not reported (<20) | Not reported (<20) |
| Continuation request including transport | 18 | 29.591 | 29.435 | -0.53% | Not reported (<20) | Not reported (<20) |
| Continuation guard | 18 | 0.400 | 0.414 | +3.39% | Not reported (<20) | Not reported (<20) |
| Acquisition including persistence | 27 | 2,144.169 | 1,918.406 | -10.53% | 3,717.535 | 3,665.463 |
| Persistence | 57 | 182.960 | 177.865 | -2.78% | 307.055 | 286.727 |
| Family restoration | 54 | 5.705 | 5.513 | -3.36% | 47.652 | 29.346 |

### LIFE

| Stage | Count per version | Before median | After median | Change | Before p95 | After p95 |
| --- | --- | --- | --- | --- | --- | --- |
| New decision | 141 | 573.578 | 564.668 | -1.55% | 986.660 | 934.531 |
| Complete continuation service | 6 | 62.228 | 61.319 | -1.46% | Not reported (<20) | Not reported (<20) |
| Continuation request including transport | 6 | 68.078 | 67.280 | -1.17% | Not reported (<20) | Not reported (<20) |
| Continuation guard | 6 | 28.526 | 28.710 | +0.64% | Not reported (<20) | Not reported (<20) |
| Acquisition including persistence | 141 | 2,039.131 | 1,957.330 | -4.01% | 3,695.943 | 3,375.247 |
| Persistence | 285 | 356.142 | 353.027 | -0.87% | 724.019 | 679.916 |
| Family restoration | 282 | 8.591 | 7.896 | -8.09% | 108.277 | 101.228 |

Stage durations are nested. Acquisition includes persistence; new decisions include restoration and authorization. Complete continuation service includes observation, reconciliation, guard and snapshot work; the request also includes worker transport/scheduling before controller acceptance. These durations must not be added. The isolated restoration metric covers family restoration; caller and authority restoration remain inside decision time.

### Increases and tails retained

| Case | Median stage | Absolute rise | Relative rise | Scope |
| --- | --- | --- | --- | --- |
| STCK | Persistence | 12.492 ms | +6.95% | Budgeted control |
| SMLP | New decision | 46.185 ms | +8.72% | Budgeted control |
| SMLP | Continuation guard | 0.014 ms | +3.39% | Budgeted control |
| LIFE | Continuation guard | 0.183 ms | +0.64% | Unbudgeted LIFE diagnostic |

| Case | Material p95 increase | Before (ms) | After (ms) | Change |
| --- | --- | --- | --- | --- |
| STCK | Persistence | 395.986 | 427.666 | +8.00% |
| STCK | Family restoration | 69.959 | 81.991 | +17.20% |

These are the two p95 increases among the reported common stages. SMLP new-decision median rises while its p95 falls; STCK restoration median falls while its p95 rises. The median budget is therefore not a tail-latency guarantee. The observed changes are not attributed to a particular source edit.

## Inspection and Pause

Inspection occurs three times after each session, for nine samples per case, outside replay/decision timings. No inspection p95 is reported at this count.

| Case | Service before → after (ms) | Service + transport before → after (ms) | Service change |
| --- | --- | --- | --- |
| STCK | 199.672 → 225.448 | 377.470 → 386.440 | +12.91% |
| SMLP | 233.130 → 231.568 | 416.255 → 405.539 | -0.67% |
| LIFE | 1,409.698 → 1,202.774 | 2,603.497 → 2,225.930 | -14.68% |

STCK inspection service rises by 12.91% (25.776 ms); service plus transport rises by 2.38%. Inspection is outside the predeclared 16-metric budget. It excludes controller acceptance, the additional `inspectKnowledge()` copying/deepFreeze and the rendered inspector.

| Case / Pause point | Acknowledgement after (ms) | Safe boundary before (s) | Safe boundary after (s) |
| --- | --- | --- | --- |
| STCK / initial planning | 0.012568 | 1.155 | 1.168 |
| STCK / engaged action | 0.011948 | 0.981 | 1.001 |
| SMLP / initial planning | 0.011287 | 4.425 | 4.077 |
| SMLP / engaged action | 0.013910 | 2.534 | 2.195 |
| LIFE / initial planning | 0.005118 | 1.071 | 1.087 |
| LIFE / engaged action | 0.005408 | 1.001 | 0.988 |

Each cell is a median of three observations. Pause during initial planning retained the pending ticket and executed zero actions; Pause during the first engaged action acquired exactly that one action. All checks passed. Acknowledgement is the synchronous Node controller response, not browser paint or completion of in-flight computation. Safe-boundary latency includes that pending work. Two fixed pause points do not establish arbitrary mid-search preemption or a bound for every computation.

## Absolute cost of the new control and attention paths

The [component protocol](component-protocol.md) was fixed before execution. The real native runtime and service start with empty acquired memory and a public raster from the original-verified morphology fixture, padded to 64 × 64. A finite synthetic protocol moves its four color-9 pixels two columns right for each released input. The agent receives pixels and public inputs, without injected roles, history, decision, route or method.

The real producer first retains a current pair and chooses an unused ACTION1; after one acquired translation it proposes ACTION1 replication; after the second acquired translation it retains the pair and proposes unused ACTION2. Only the first two actions are executed. This setup took 3.076 s once, providing provenance rather than a repeated latency estimate. It completed **zero game levels**.

Each component case then creates fresh reasoning-memory and caller owners and restores the appropriate actual checkpoint. The current morphology decisions were produced by the real setup, not copied from source expected output. There are 3 warmups, 20 measured calls and one separate copy-census call per case: **120 measured component operations**, 18 warmups and 6 census calls. Semantic results agree across each case’s fresh restorations. The six cases all passed.

| Component | Operation median / p95 (ms) | Restoration median (ms) | Preparation median (ms) | Observed result |
| --- | --- | --- | --- | --- |
| Replication inspection | 0.515 / 8.311 | 31.011 | 0.662 | Current replication question; no proposal |
| Replication proposal | 19.401 / 30.105 | 30.600 | 0.672 | ACTION1 replication proposed |
| Unrelated unbound information | 0.742 / 5.411 | 29.134 | 0.643 | Question deferred; attention opened |
| Same-action information | 18.993 / 24.560 | 28.208 | 0.534 | Information proposal also tests control |
| Focused replication proposal | 13.248 / 18.378 | 27.627 | 4.211 | Replication with matching attention_ref |
| Parent return | 1.769 / 2.628 | 28.459 | 0.987 | Matched return; ACTION2 unused-control proposal |

The information cases supply one explicit `additionalOffers` contract input, using the question/prediction/relation shape of the source consumer fixture and rebinding its public scope, evidence and action to the actual current context. The real point/display producers still run and are not suppressed. This does not claim that the display producer naturally offered that question in this raster. Actual morphology measurements, acquired history, frontier decisions and attention methods are used; there are no method/acceptance doubles.

The parent-return case is positive: real attention opening and observation produce `matched`, `prepare` consumes the return, and `attentionParentReturnOffer` proposes ACTION2 under the actual retained current decision. Opening, observation and `takeParentReturn` belong to **preparation**, not its 1.769 ms operation median. The operation interval includes the subsequent actual control and frontier calls.

### Method work and copy census

| Case | Selected actual method calls during 20 measured operations | Additional preparation work |
| --- | --- | --- |
| Replication inspection | 20 control inspections; 20 canProbeHere | 20 ordinary prepares |
| Replication proposal | 20 control calls; 20 frontier proposals | 20 ordinary prepares |
| Unrelated unbound information | 20 information calls; 20 control inspections; 20 canProbeHere; 20 attention openings | 20 ordinary prepares |
| Same-action information | 20 information calls; 20 control inspections; 20 canProbeHere; 20 frontier proposals | 20 ordinary prepares |
| Focused replication proposal | 20 control calls; 20 frontier proposals | 20 information admissions and attention openings |
| Parent return | 20 parent-return calls; 20 control calls; 20 frontier proposals | 20 openings, 20 observations, 20 takeParentReturn calls |

These are method-call counts, not normalized reasoning-opcode counts. The receipt records every wrapped caller/frontier/attention call by phase. Selected nested medians illustrate the real work: replication frontier proposal 19.222 ms; same-action frontier proposal 15.075 ms; attention opening during unbound-information admission 0.183 ms; parent preparation attention observation 0.061 ms and return consumption 0.0167 ms. Nested times overlap with the outer intervals and must not be added to them.

| Case | structuredClone calls: restoration | Preparation | Named operation |
| --- | --- | --- | --- |
| Replication inspection | 30 | 1 | 0 |
| Replication proposal | 30 | 1 | 155 |
| Unrelated unbound information | 30 | 1 | 1 |
| Same-action information | 30 | 1 | 155 |
| Focused replication proposal | 30 | 2 | 155 |
| Parent return | 30 | 4 | 7 |

This is one separate fresh-state census per case. Clone interception is disabled for the twenty timing samples. Counts are calls, not bytes or object counts, and exclude array slices, spread syntax, JSON encoding and unobserved copying. Zero counted clones does not mean zero allocation or zero copying. No time-per-copy or time-per-reasoning-operation is inferred.

Restoration here rebuilds complete reasoning/caller snapshots for isolation; it is not the optimized incremental restoration cost of the common runtime. Component intervals exclude the initial acquisition, repeated morphology production, full family selection, WHY/ACT authorization, worker transport, browser rendering and live game execution. Proposals from these component calls are not dispatched. The synthetic setup separately used the real common runtime and acquisition.

Operation p95 values and ranges remain visible, including the inspection 0.515 ms median / 8.311 ms p95 and the unbound-information 0.742 / 5.411 ms. Three warmups and twenty correlated calls in a fixed-order warm process do not establish independent confidence bounds or causal differences between cases. In particular, focused and ordinary proposals have different preparation and cannot be ranked as an attention optimization. Positive contextual-block replication, recalled-method cases and all attention-return outcomes are not isolated by this six-case timing diagnostic. No V61 zero baseline or artificial speed ratio is constructed for the newly connected consumers.

## Noise and remaining limits

| Case | Spread of round decision medians before | Spread after | Session spread before / after |
| --- | --- | --- | --- |
| STCK | 14.02% | 12.54% | 5.87% / 5.99% |
| SMLP | 10.02% | 9.83% | 6.70% / 7.22% |
| LIFE | 7.02% | 9.64% | 5.88% / 4.52% |

Spread is (maximum minus minimum) of the three round medians divided by their median. It describes observed variation, not a confidence interval. Some small or mixed stages vary much more: after-run STCK guard round medians span 80.56%; SMLP family restoration 57.43%; LIFE family restoration 91.30%. Those observations remain in the evidence even though their pooled medians meet the applicable budget. Noise is never added to the +10% allowance.

Both common runs and the component diagnostic used reserved project windows. Other agents were restricted to small reads/text edits; campaigns, builds, tests, exporters and browser exercise were closed before the after run. No deliberate heavy project overlap was reported or observed, including no fixture-generation overlap during this baseline. The [window record](measurement-windows.json) preserves that coordination. Host CPU utilization and external activity were not independently logged, so project scheduling is not machine isolation. The two versions were measured sequentially; apparent reductions cannot be attributed causally to the source change.

LIFE remains a finite 49-action retained-session comparison. Different decisions address different scenes; the timings and memory samples do not prove constant-time scaling, hours-long stability or absence of a memory leak. The absolute component diagnostic uses only two acquired transitions and six explicit situations. It does not establish large-history scaling, a complete morphology transfer or whole-game performance.

## Retained evidence and reproduction

- [Fixed common protocol and commands](README.md), [cases](cases.json), [unchanged comparison policy](comparison-policy.json), [component protocol](component-protocol.md).
- [Baseline exact report](baseline.json.gz) and [lossless transport receipt](baseline-relocation.json).
- [After exact report](after.json.gz) and [lossless transport receipt](after-relocation.json).
- [Strict comparison](comparison.json): `status: passed`, `unresolved: []`.
- [Absolute component report](component-costs.json.gz) and [lossless transport receipt](component-costs-relocation.json).
- [After attempt](after-attempt-01.json), [exact stdout/stderr journal](after-attempt-01.log.gz) and [journal transport](after-attempt-01-log-transport.json).
- [Component attempt](component-attempt-01.json), [exact stdout/stderr journal](component-attempt-01.log.gz) and [journal transport](component-attempt-01-log-transport.json).
- [Reserved-window record and its limits](measurement-windows.json).
