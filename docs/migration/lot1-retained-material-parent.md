# Lot 1: Retaining a material request through pose questions

Lot 1 adds an explicit parent obligation to the existing `typed_pose_dependency`
branch of `typed_material_flow`. The requested occurrence survives selection,
pose experiments, actual returns and restoration. Resolving the pose leaves the
delivery obligation pending; a fresh decision must consume the acquired return
before proposing delivery or another pose question.

The effective baseline is published V59, commit
`f7b9a56af5488c8d4cebd5d912262a541f4fe403`. The native candidate is **0.32.0**,
identified by the [frozen source manifest](lot1-evidence/final/source-manifest.json):
237 files, digest
`8a67b57947364dab988c7081e35eb6a923beee2305eb4b8a8a89c2fc86ebea57`.
The completed validation, live execution, browser checks and matched cost
comparison are recorded below. Hosting version numbers are separate from this
stable native milestone and its frozen implementation digest.

## The demonstrated baseline gap

The [V50 material report](v50-typed-material-and-returned-inquiries.md) already
established acquired pose rules, guarded continuation and three completed LIFE
levels. Those capabilities are the starting point. The missing contract concerns
**which request the selected child is still trying to satisfy**.

In the pinned source and baseline TypeScript, `pose_context` retains the child
and evidence. Each new pose question recomputes its request option. Composition
target binding accepts this path as `independent_current_contribution`, without
a retained parent. Historical selection evidence can therefore survive a change
to the requested occurrence.

The portable [parent scope ablation](lot1-evidence/ablation/parent-scope-gap.json.gz)
replays 34 component prefixes and 34 public actions from cold knowledge. It then
moves only the measured request raster into a measured empty area. The foreign
counterfactual packet uses `ACTION6` copied from an available, guarded control;
it supplies no selected material experiment. Baseline acquisition leaves the
material state unchanged and the pose-response count at one. Nevertheless, the
next pose proposal changes request identity from `da85…` to `5fba…`; its component
guard, acquired-context witness and composition binding all admit it.

The same receipt applies the native parent contract to the same acquired states
and foreign packet. It preserves the original parent and target, sets
`phase: suspended`, and refuses resumption with
`parent_request_changed_or_ambiguous`. The contract calls no material reducer.
This is a bounded component contribution proof, not a released common-runtime
action or a live-game failure. The [reproduction script](../../scripts/prove-native-parent-scope-gap.mjs)
records inputs and source fingerprints and verifies that they remain unchanged.

## Ownership and current evidence

The extension is named `retained_typed_material_request_parent`. Its
[coordination module](../../src/logos-engine/v6-typed-material-composition.ts)
owns no persistent state of its own.

| State or authority | Existing owner | Lot 1 use |
| --- | --- | --- |
| Material occurrences, associations, pose rules and counterexamples | `SharedSeries.material`, persisted through `family_state:public_occurrence_recall` | Read actual acquired state; leave all domain acquisition here |
| Pending request and current binding | `AttentionMemory.composition`, owner `native:typed_material_flow` | Retain request, child, control and model references; revise the open condition and returned evidence |
| Physical authorization | Family guards, current point binding, preservation and common WHY/ACT | Recheck each action; attention receipts always have `release_authority: false` |

The parent opens only when a pose-selection proposal is actually selected. Its
binding contains the measured request identity and descriptor, the child's
identity and anchor, the control's scope, the retained comparison model and the
last consumed return. It contains no copy of the material event journal or pose
model collection. Motion attention remains a separate channel with its existing
motion-specific scope and return rules.

Selection evidence also needs a current visible witness. After the actual
selection return, `selection_witness` stores its acquired event reference,
before/after evidence and changed public pixels outside the child. Subsequent
checks require those values to remain present. A foreign return that removes
the selection marking therefore suspends the parent even if its child marks,
request and control still match.

Revalidation checks unique current child identity, typed marks, request,
control, comparison proof and selected context. Ambiguous historical ancestry
remains legitimate when the current occurrence is uniquely bound; rejecting
that ancestry would break an existing valid LIFE case.

## One acquisition, then a revised decision

The common order remains attention/view observation, selected-family and passive
acquisition, goal/point/control processing, assessment, then frontier acquisition.
The new parent reducer runs immediately after the existing domain acquisitions.
It references their actual event and `reasoning:transition:<revision>` rather
than invoking `record` again.

The next decision restores the authoritative graph and revalidates the parent.
Source strategy still selects the family and entry. A native facade constrains
that entry's fresh question to the retained request and comparison model.
`strategy_receipt` and the source morphology result are preserved; an additional
receipt identifies the source and constrained proposals. No morphology route
is invented.

| Actual acquired result | Parent state | Permitted continuation |
| --- | --- | --- |
| Selection observed; pose unresolved | Pending, `needs_pose` | Current control question |
| Marks match the retained request | Pending, `ready_for_delivery` | Fresh delivery proposal |
| More observed turns can reach the request | Pending, `needs_pose` | Revised conditional pose prefix |
| Current binding is lost, ambiguous, or unreachable under the observed rule | Pending, `suspended` | Refuse resumption and retain the cause |
| Conditional pose rule is contradicted | `refuted` | Retain the source counterexample |
| Material consumption and request change are attested | `achieved` | Close the delivery obligation |
| Official scope changes | `boundary` | Invalidate the old obligation and authorization |

Delivery at a boundary closes with `boundary`, matching the existing attention
contract's epoch rule; its return receipt separately records
`request_achieved: true` when supported. Direct consumption of an old proposal
at that boundary returns a refusal instead of revising a closed parent.

Within a committed multi-action prefix, domain acquisition remains deferred
until sealing. Intermediate guards compare current public marks with the
existing `expected_before[index]`, retain the selection witness, and apply the
ordinary guards. A partial prefix can then acquire exactly its executed returns,
restore those owners, and propose only the remaining work.

## A bounded causal trace

The [common positive contract](lot1-evidence/final/contracts/common-positive.json)
provides an exact trace from a cold common runtime. `A` below abbreviates parent
`composition_attention:c9ea476c15d95600f6b9`; `B` abbreviates
`composition_attention:5264164c5749d011ead5`. Transition numbers are recorded
references, not inferred action-effect labels.

| After acquired action(s) | Actual return and retained state | Next decision consumes |
| --- | --- | --- |
| 37 | Selection return; A pending, `needs_pose` | Control proposal consumes `reasoning:transition:37` |
| 38 | Observed pose resolves A's comparison; A remains pending | Delivery consumes `reasoning:transition:38` |
| 39 | Consumption and request change; A achieved | Delivery obligation closes |
| 45 | Second selection; B pending, `needs_pose` | Three-action conditional prefix consumes `reasoning:transition:45` |
| 46–48 | Three real guarded returns; after sealing B is ready for delivery | Delivery consumes `reasoning:transition:48` |
| 49 | Official next-level boundary | B closes as `boundary` |

The receipt also checks restoration from retained graph nodes and one common
acquisition per supplied return. Repeated snapshots of the three-action prefix
do not represent three new parent decisions: the committed prefix retains its
original selection receipt until sealing.

### What the alternative returns establish

The [baseline ablations](lot1-evidence/ablation/README.md) prevent an exaggerated
causal claim. For a controlled 270-degree return, V59 already proposes the same
target and two additional control actions. Lot 1 supplies explicit retained
parent lineage and return consumption; this example does not demonstrate a new
action choice. For a controlled 180-degree return, V59 stops with
`frontier_unknown` and no next proposal. Its `currentTargetChanged` field reflects
the absent target, not selection of another target.

The new [contracts](../../tests/v6-composition-parent-loop.test.ts) distinguish
the ordinary 90-degree return, which permits delivery, from 270 degrees, which
requires more pose work, and 180 degrees, which suspends the same unreachable
parent. These controlled public returns are contract evidence. They are separate
from live game outcomes and from the relocated-request contribution proof.

## Source fidelity and operations actually consumed

The behavior reference remains commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. The default material API, observations,
reducers, source selection order and refusals are preserved. The optional
retained-request facade and parent coordination are explicitly native additions;
they are not presented as newly recovered Python behavior. The
[lineage note](lot1-composition-return-lineage.md) maps the V5/V6 contracts,
reasoning references and limitations.

`OP18` still participates in release of typed-pose experiments, including their
conditional prefixes. `OP29`, `OP30` and `OP31` consume actual common post-analysis
inputs; these descriptive receipts do not replace material acquisition or prove
that a later decision consumed it. `OP28` is available on other release paths,
but is not the operation emitted by this pose path. `OP03`, `OP08`, `OP12` and
`OP26` have implementations, but this path provides neither their required
generic dependency/access producers nor new calls or consumers. Lot 1 does not
simulate their use with labels.

## Validation

The frozen [release delta](lot1-evidence/final/validation/delta-tests-run.json)
passes **241 of 241 checks**, with no failure, cancellation or skipped test.
Its eight files cover the new parent loop, material source reference and kernel,
original attention contracts, common caller and authority, caller integration
and browser-controller protocol. Every source and test input remains unchanged
during execution. This is the affected release delta, not the entire historical
test suite. The test matrix includes
contradiction, stale evidence, ambiguous identities, foreign request/selection
changes, partial-prefix restoration, direct boundary consumption and duplicate
return reconciliation.

The [release checks](lot1-evidence/final/validation/checks-run.json) pass typecheck,
entry audit, migration audit, whitespace verification and the production build.
The audit remains 50 connected entries out of 76, 150 component-verified Python
modules, 120 partially transferred, 1,099 pending and zero globally verified.
The six complete-migration gates remain false. The build receipt fingerprints
the native worker and all production inputs.

## Live campaign

The [live execution receipt](lot1-evidence/final/execution-life.json) records one
cold continuous LIFE session against the opaque original game host. The native
agent chooses all commands from public observations. Neither recorded actions
nor learned state is supplied to it. The [actual public trace](lot1-evidence/final/life-public-trace.json.gz)
and [lossless campaign parts](lot1-evidence/final/life-campaign.json.gz.parts.json)
retain the returns and acquired composition evidence.

| Completed level | Actions on that level | Cumulative actions |
| --- | ---: | ---: |
| 1 | 15 | 15 |
| 2 | 15 | 30 |
| 3 | 19 | 49 |

There are 47 sealed prefixes, 49 common acquisitions and two natural boundary
replays. The final state is level 4, `NOT_FINISHED`, stopped for
`target_levels_completed`. The engine and passive execution harness are
unchanged throughout. The [candidate resolution](lot1-evidence/campaign-resolution.json)
closes after 231.440 seconds from the immutable selection timestamp, before
the original 40-minute deadline, with no retry or reset. A
reproduction of the already successful three-level trajectory demonstrates
integration and non-regression; it does not attribute that historical success
to the new parent contract or establish a complete-game `WIN`.

The [browser verification](lot1-evidence/final/life-browser-verification.json)
independently reaches 49 actions, three solved levels and 47 completed plans
through ordinary controls, with the inspector closed. Pause during initial
planning settles at zero actions. In the same session, a 16-action batch stops
at action 46 with 45 completed plans; One action reaches 47 without sealing a
new plan; Run to next level completes the remaining rotation and delivery at
49. This exercises interruption and continuation inside the actual conditional
prefix. The [unaltered screenshot](lot1-evidence/final/life-browser.png) shows the
final counters. This preview verification does not claim production sign-in or
precise browser latency measurements.

## Performance and measured limits

The [measurement protocol](lot1-evidence/performance/README.md) fixes independent
cold-knowledge runs of STCK, SMLP and LIFE, with raw samples and controller pause
checks. The [comparison](lot1-evidence/performance/comparison.json) passes with
identical harness, public inputs, declarations, environment descriptions and
replay work counts. Each version has three measured sessions per case and 222
measured actions in total. Native inputs remain unchanged within each run.

The predeclared 10% working budget applies to eight metrics on each of the two
unaffected controls, STCK and SMLP. **All 16 pass**, with no unresolved metric.
The largest observed increase is 6.43% on SMLP's isolated continuation guard,
from 0.432 to 0.460 milliseconds. This is not a claim that every measurement,
especially on the changed path or during inspection, stays below 10%.

| Complete controller replay | Before, median seconds | After, median seconds | Observed change |
| --- | ---: | ---: | ---: |
| STCK, 10 actions | 13.721 | 12.642 | -7.86% |
| SMLP, 15 actions | 30.941 | 29.066 | -6.06% |
| LIFE, 49 actions | 141.865 | 138.513 | -2.36% |

The changed path has additional measured work:

| LIFE metric | Before, median ms | After, median ms | Samples per version |
| --- | ---: | ---: | ---: |
| Selected pose decision | 828.978 | 873.207 | 12 |
| Selected pose acquisition and persistence | 3,266.263 | 3,400.513 | 12 |
| Conditional continuation guard | 13.641 | 30.489 | 6 |
| Complete service continuation | 60.033 | 67.511 | 6 |
| Family restoration, all LIFE phases | 8.781 | 10.761 | 282 |

The guard increase is 16.848 ms, or 123.52%; the complete service continuation
increases 12.46%, and all-phase family restoration increases 22.56%. These
costs remain explicit. The new guard checks the retained parent and the current
selection witness in addition to the source premises. The measurement establishes
the observed cost of the changed implementation, not a separate causal estimate
for each individual check. Nested timings must not be added together.

Empirical p95 values are reported only with at least 20 samples. After the
change, LIFE's 141 new decisions have median 616.113 ms and p95 945.098 ms;
its 141 acquisitions have median 2,076.232 ms and p95 3,774.438 ms. SMLP's 27
new decisions have median 563.959 ms and p95 3,809.789 ms. No p95 is invented
for the six conditional continuations or twelve selected pose decisions.
Round-to-round variation is material: baseline decision medians span 34.6% on
STCK and 12.4% on SMLP. Three sessions characterize observed noise rather than
establish confidence intervals or guaranteed speed gains.

Inspection is measured after each run and excluded from its replay time.
SMLP's inspection service median rises from 253.417 to 292.751 ms (+15.52%);
service plus worker transport rises from 453.638 to 491.089 ms (+8.26%), with
nine samples. This excludes the controller's additional acceptance/copying/
deep-freeze processing and the rendered panel. It is retained as a separate
diagnostic, not hidden by the passing agent-path budget.

Pause acknowledgement is immediate within the JavaScript controller probe:
after-run medians range from 0.004 to 0.017 ms across its two fixed pause points
and three cases. Reaching a safe boundary takes a median 1.054 to 4.579 seconds,
depending on the pending work. The probe confirms zero actions during initial
planning and exactly the one already engaged action in the second case. These
figures do not describe DOM paint latency or arbitrary search preemption.

The recorded host lookup/frame-copy time is separate; `executionMs=0` makes no
claim about live game, animation, network or hosting cost. The real live campaign
has its own receipt. Family restoration is isolated; caller/authority restoration
remains included in new-decision time. The finite 49-action LIFE session exercises
growing retained state, but establishes no hours-long stability or scaling claim.

## Publication and remaining scope

This delivery uses the existing [SRA Playground](https://sra-playground.yannick-fontan.chatgpt.site/)
and preserves its owner-only access. Its effective source base is published V59;
the frozen native result is version 0.32.0. The hosting service supplies the final
publication number and full pushed-commit provenance separately from the stable
lot name. The concurrent V59 editorial changes are preserved.
This lot adds no DRM entry or compiled workflow: coverage remains **50/76** and
the bundle remains **37 workflows**. It does not complete `morphology`,
`attention_parent_return`, `acquire_control_for_target`, or `morph.last`.
Implementation stops after this delivery. The next planned work is Lot 2A's
measured strategy inputs, as specified in the [reconciled roadmap](v6-delivery-roadmap.md).
