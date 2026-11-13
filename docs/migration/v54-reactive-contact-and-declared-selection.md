# V54: Reactive contact and declared selection

## Release status

**The final frozen v54 runtime completes RE86 levels 1–3 in 134 actions.**
The three levels take **26, 47 and 61 actions** in one cold continuous session,
with 46 sealed prefixes, 134 acquired transitions and two caller boundary
replays. It stops at its declared target on entry to level 4 with
`NOT_FINISHED`, not a full-game victory. The
[campaign](native-campaigns-v54/final/re86-campaign.json.gz) and
[execution receipt](native-campaigns-v54/final/execution-re86.json) retain the
actual result and confirm that native source and execution code stayed unchanged.

The native implementation is `logos-engine.typescript.v6.native-migration/0.28.0`.
It connects both original material entries, `reactive_contact_continuation` and
`reactive_contact`, to one `public_reactive_contact` owner. The
[declared-entry audit](v6-entry-point-progress.json) advances from 45/76 to
**47/76, or 61.8%**. This measures connected declarations in the four ordered
source lists; it does not measure whole-code completion or game score.

The [final source manifest](native-campaigns-v54/final/source-manifest.json)
retains 210 native files with digest
`059d6204097fae6749138b9afc650ccc54867886bda3887ef6f978f6afdf393a`.
The isolated, unchanged published v53 baseline independently reaches the same
three level boundaries with the same action counts. It remains separately
retained. Both runs use the existing generic `constellation_cover` provider;
this release's game result is integrated runtime evidence, not evidence that
ReactiveContact solved RE86.

| Completed level | Actions in level | Cumulative actions | Cumulative sealed prefixes |
| --- | ---: | ---: | ---: |
| 1 | 26 | 26 | 12 |
| 2 | 47 | 73 | 28 |
| 3 | 61 | 134 | 46 |

The independent unchanged-Python ReactiveContact replay also passes: all 134
real returns, the exact source state and native checkpoint at all 46 prefixes,
and the complete 135-packet public journal are checked. This campaign does not
select a reactive proposal; its comparison specifically verifies passive source
acquisition and three natural source epoch resets.

## Recovered V5 and V6 logic

All source references remain pinned to commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. No reference implementation is
executed as a production agent. The native family derives its current control,
contact subjects, possible rigid binding and continuation questions from
actual public observations and selected inputs.

| Source responsibility | Native files under `src/logos-engine/` | Verification scope |
| --- | --- | --- |
| V6 ReactiveContact family, acquisition and source entry adapter | `v6-reactive-contact.ts` | Original proposals, guards, outcomes and all 13 source state fields; common Kernel integration |
| V6 contact policy and six original SRC workflows | `v6-reactive-contact-policy.ts`, `v6/reactive-contact-policy.json` | Complete local policy and its two consumed V5 projections |
| V6 contact geometry, relative movement and current member binding | `v6-reactive-contact-geometry.ts` | Complete local wrapper and its exact consumed inherited helper domain |
| Parent return, escape projection and stationary return | `v6-reactive-contact-parent.ts`, `v6-reactive-contact-escape.ts`, `v6-reactive-contact-stationary.ts` | Current subject, scope, support, ambiguity, inverse and independent-return conditions |
| V5 reactive pursuit and rigid geometry | `v6-reactive-contact-measurements.ts` | Consumed measurement and four rigid geometry functions; inherited modules remain partial |
| V6 Source81 policy, context, projection, independent member binding and execution | `v6-reactive-contact-source81-policy.ts`, `v6-reactive-contact-source81-context.ts`, `v6-reactive-contact-source81-projection.ts`, `v6-reactive-contact-source81-execution.ts` | Source proposals, candidate identities, workflows, current guards, retained continuation and actual return reconciliation |
| Source81 finite cell support, peer access and independent geometry | `v6-reactive-contact-source81-measurements.ts` | Exact query closure consumed by `source81_project`; broader inherited branches remain partial |
| V5 declared selection and SRC `SELECT` execution | `v6-drm-selection.ts`, `v6-selection-contracts.ts`, `interpreter.ts` | Pure declared evaluation, explicit ambiguity and operator request admission on the documented native scalar domain |

The six ContactPolicy workflows were already present in the compiled program
bundle. This release adds four Source81 workflows compiled from the unchanged
original `source81.src`, preserving all 33 existing program entries. The
bundle now has 37 entries. Both policies attach to the normal common native
program registry and execute the presented SRC through the common interpreter.

The ContactPolicy subset retains these two exact V5 `interaction.drm`
projections:

- `projection.exploration.current_contact_opens_local_mechanism_question`;
- `projection.exploration.reactive_escape_opens_contact_manipulation_question`.

These are declaration 217, projections 1015 and 1016. The subset does not
replace the production V5 DRM registry. Its conditions
retain the distinction between a measured current contact and an experimental
question about the effect of a local operator. A possible future binding or
changed escape domain is not recorded as an acquired fact before a real return.

## One owner, two declared entries

The first entry is the original early material continuation. It is inert unless
the owner already retains a `pending`, `recipe`, `source81_plan` or
`prepared_source81` dependency. The adapter preserves that pre-call gate; it
does not even invoke the source proposal method for an empty owner.

When an early proposal exists, its kind must belong to the original continuation
list and all four declared conditions must hold:

- `retained_contact_dependency`;
- `current_control_bound`;
- `subject_current_unique`;
- `current_scope_and_input`.

The later `reactive_contact` entry uses the same owner at its original position
after `ordered_recruitment` and before `ordered_reaction`. Each entry retains
its exact material annotation; only the early entry adds the source retained
dependency annotation. There is no duplicate learning owner and no new native
priority rule in this integration.

The original 13 fields are retained without renaming:

`epoch`, `control`, `peer`, `floor`, `observations`, `question`, `trials`,
`pending`, `recipe`, `last`, `input_trials`, `source81_plan` and
`prepared_source81`.

The current family state lives in the existing revisioned common graph. Its
native immutable checkpoint has format `native.public_reactive_contact.v1`
and contains exactly the original source state. Public state views are detached;
an invalid checkpoint is rejected before any field is changed. Restoring a
previously retained checkpoint also checks whether the mutable owner has
changed since that checkpoint was produced. Reusing an identical checkpoint
object cannot leave speculative mutable state active.

## Acquisition and physical execution

Reactive acquisition runs once per real transition after the prefix is sealed,
following the existing OutlineService acquisition. The selected family uses
the normal selected-return route. When another family chose the input, the
reactive owner receives that actual public transition as a passive observation
with no selected reactive proposal. It cannot invent a reactive experiment
attribution for a foreign input.

The exact source event is retained when one is produced. If the source has
current control or a question, its raw 13-field state is also retained as the
`reactive_state` reasoning fact and round-tripped through source restore. The
full immutable native checkpoint remains separate from this source fact.

Selected proposals still use current per-primitive guards, ordinary WHY/ACT
authorization and the common OP29/OP30/OP31 execution and reconciliation path.
The common runtime test covers an actual selected binding follow-up, compares
its acquired event and full state to independent Python expectations, and
checks that the authoritative graph restores the real refusal after a mutable
working copy has been changed. Passive prefix tests confirm that acquisition
does not happen before sealing, is not duplicated on resume, and preserves
the existing selection of an earlier family.

## Declared selection

The Source81 preparation workflow uses original `SELECT` semantics. The generic
native implementation evaluates the declared eligibility, precedence, tiers,
tie breakers and symbolic partial order, retaining explicit comparison reasons
and preserved alternatives. Unresolved equality remains blocked. A lexical
hash identifier cannot silently resolve an identity tie that the source leaves
unresolved.

`SELECT` is a pure symbolic choice, not authority to issue a physical command.
Its operator payload has its own admission checks. The source distinction
between `SelectionInput` and the stricter `SelectRequest` is retained: general
evaluator input and an admitted operator request are not interchangeable.
The workflow still requires the normal physical execution route before any
game input occurs.

Scalar comparisons are qualified to same-type exact JSON scalars and the
native safe-integer domain. Arbitrary Python numeric representation and the
whole Python source compiler are not claimed. The source selection operator's
durable Logos lineage is outside this native payload transport; the full common
graph editing gate therefore remains independent of these tests.

## Receipt identity is preserved

The original policies place workflow receipts inside control records, recipes
and offers that can contribute to later hashes. A native receipt contains
additional execution metadata. Inserting those extra fields into original
source state would change source identities even when the selected behavior
was otherwise identical.

The source-facing policy return therefore preserves exactly the original four
receipt fields: `workflow`, `src_hash`, `src_status` and
`executed_statements`. The underlying native program handle still executes
normally and produces its native receipt. Comparisons do not substitute source
identifiers or remove arbitrary fields to conceal a mismatch. The family tests
compare literal source proposals, receipts, events and state; only JavaScript
sets are serialized into their source JSON representation.

## Independent reference evidence

The existing oriented-coupling search also avoids comparing unchanged terrain
on every search edge. Its transferred V5 move preserves every field except
the complete actor and cargo records, so comparing those records preserves the
same changed-state condition. Search order, movement semantics, budgets and
guards are unchanged. The final delta includes the existing coupling/mechanics
reference tests. This is a generic implementation optimization; no measured
speedup or additional WA30 success is claimed.

Expected values are computed by unchanged original Python from synthetic
public rasters and explicit component state. They are not copied from native
outputs. Hash checks bind the imported sources to the pinned reference. The
synthetic post-operator fixture used to isolate a selected Kernel follow-up is
not a live-campaign initialization or a stored winning route.

| Contract group | Independent original cases | Current checks | Main covered behavior |
| --- | ---: | ---: | --- |
| ContactPolicy and geometry | 272 | 274 passed | Six source workflows, current and stale geometry, relative pursuit, ambiguity, transformed rasters, support collisions and bounded candidate roots |
| Family, parent, escape and stationary return | 53 | 56 passed | Full state, initial abstention, follow-up proposal, scope changes, stale/unavailable input guards, binding confirmation/refutation, topology and stationary contrasts |
| Common Kernel integration | Separate original controlled fixture | 3 passed | One owner/two entries, passive acquisition order, selected WHY/ACT and authoritative checkpoint restoration |
| Source81 | 193 | 194 passed | Prepare/project/revise/continue, candidate materialization, positive offers, current guards, loaded returns, independent geometry and literal identifiers |
| Generic declared selection | 68 evaluator cases and 25 builder cases | 114 passed | Original evaluator/output projection, explicitly synthetic alternative declarations, original builder preflight and native admission guards |

The three reactive suites account for **527 passed checks**, including the
three common Kernel tests. The release-wide delta, production build and actual
browser verification have separate receipts below. Recorded-trajectory
regressions remain pending their final comparison receipt. Component counts do
not establish a completed game or full original caller parity.

The main reproducible evidence is:

- [Contact/geometry exporter](../../scripts/export-v6-reactive-contact-reference.py),
  [fixture](../../tests/fixtures/v6-reactive-contact-reference.json.gz) and
  [tests](../../tests/v6-reactive-contact-reference.test.ts);
- [family/return exporter](../../scripts/export-v6-reactive-contact-family-reference.py),
  [fixture](../../tests/fixtures/v6-reactive-contact-family-reference.json.gz),
  [reference tests](../../tests/v6-reactive-contact-family-reference.test.ts) and
  [Kernel tests](../../tests/v6-reactive-contact-kernel.test.ts);
- [Source81 exporter](../../scripts/export-v6-reactive-contact-source81-reference.py),
  [fixture](../../tests/fixtures/v6-reactive-contact-source81-reference.json.gz),
  [tests](../../tests/v6-reactive-contact-source81-reference.test.ts) and
  [original workflow exporter](../../scripts/export-v6-reactive-contact-source81-programs.py);
- [SELECT exporter](../../scripts/export-v6-select-reference.py),
  [fixture](../../tests/fixtures/v6-select-reference.json.gz) and
  [tests](../../tests/v6-select-reference.test.ts), with the separate
  [builder exporter](../../scripts/export-v6-select-builder-reference.py) and
  [builder fixture](../../tests/fixtures/v6-select-builder-reference.json.gz).

## Inherited-domain limits

The V6 `geometry.scene` call supplies one current canonical control box, known
translations, current last motion and retained geometry. It leaves periodic
grids, recount, retained grid references, interface deltas, fill-growth and
cell-role inputs empty. The transferred V5 grid closure therefore covers the
single action-centered zero-gap grid that can be produced by those actual
inputs. Other branches abstain at that source call. This is not a claim to have
ported all of V5 `interaction.py`.

The geometry helper's mask intentionally fills its entity bounding rectangle,
as the source does. Escape-domain projection separately uses the actual occupied
entity mask. Those two definitions are not interchangeable. Escape topology
preserves complete, incomplete and unknown-successor distinctions; it cannot
turn a bounded conditional support model into a proof of capture.

The Source81 `prospective_grasp.py` transfer covers `_bound_pair_peer_inventory`,
the peer-access inventory and selected route materialization reached by the
fixed `source81_project` query. That query does not enable optional pending
motion recall, current clearance, preserved effects or generic support-delivery
branches. `operator_cell_support.py` contributes the consumed cell-support model
and normalized pattern calculation, not all cell-contact and body-pattern
capabilities. Peer-constraint geometry and the unbound projection are qualified
to their consumed finite wrapper inputs.

V5 rigid geometry, reactive pursuit, finite reachability, consumption-path
helpers and escape-topology contracts keep their own partial mappings. This
release does not replace the general inherited model/validation system or
claim unused arbitrary Python input semantics. The
[transfer map](../../migration/v6-transfer-map.json) records these limits per
source, without duplicate mappings.

## Candidate history and 40-minute limit

The [candidate-selection record](native-campaigns-v54/candidate-selection.json)
retains both cold baseline attempts on unchanged v53:

| Candidate | Observed result | Time and disposition |
| --- | --- | --- |
| WA30 | First level completed in 31 actions; natural `GAME_OVER` on level 2 after 101 total actions | Candidate closed after about 8 minutes 20 seconds and changed before the 40-minute limit |
| RE86 | First three levels completed in 26/47/61 actions, 134 total and 46 prefixes | Baseline execution took about 122 seconds; the separate final frozen v54 campaign also passes its three-level target |

The baseline campaign uses the existing generic `constellation_cover` provider.
Its result does not establish ReactiveContact efficacy. Neither candidate
selection nor the final campaign may supply a learned checkpoint, an authored
input sequence, a direct level jump or a Python agent module. The first three
levels are a bounded target; entry to level 4 with `NOT_FINISHED` is not reported
as a full-game victory.

## Public source replay: passed

[`compare-v54-reactive-public-evidence.py`](../../scripts/compare-v54-reactive-public-evidence.py)
independently replays the final saved actual public trajectory through the
unchanged original ReactiveContact component. The
[comparison receipt](native-campaigns-v54/final/reactive-original-comparison.json.gz)
records a successful comparison against the
[complete public trace](native-campaigns-v54/final/re86-public-trace.json.gz) and
[actual public journal](native-campaigns-v54/final/re86-actual-public-journal.jsonl.gz).
It verifies the frozen native manifest, execution receipts, complete command
journal and public packet bytes before comparison. It reconstructs the original
neutral observations with the actual retained namespace and revision references
and starts with empty original source state.

For each sealed prefix, the comparator uses the actual retained selection
receipt to determine which reactive source entries were evaluated. It records
each real return once, compares the source event and all 13 fields, and checks
the full native checkpoint. Selected reactive proposals, when present, are
compared after excluding only the explicitly named outer common-caller wrapper
fields. Unknown native coordination is rejected rather than inferred. Source
identifier and receipt-field normalization is not used.

The retained results are:

- **134** original source records, using each actual component command shape;
- **46** exact comparisons of all 13 source fields and full native checkpoints;
- **135** complete public packets containing **138** animation frames, including
  the initial observation;
- **3** exact official-boundary events and **3** source epoch resets;
- **1,786** pinned source files hash-verified before and after execution, with
  **736** original files actually imported;
- **0** reactive selections or reactive planning calls on this trajectory.

All 46 prefixes select `constellation_cover`, which occurs before the material
entries in the original group order. The reactive owner passively records the
actual inputs and resets its current state at each official boundary. The two
caller boundary replays count resumed levels; the third source reset occurs on
the final target-reaching return, before the campaign stops. Positive reactive
offers and selected primitive execution are supported by the separate original
component and Kernel tests, not by RE86.

This replay therefore establishes exact passive source acquisition on the
retained trajectory. It does not certify the complete original strategic
caller, transfer another provider's game result to ReactiveContact, or establish
all-game parity.

## Release verification

### Build, audits and delta tests

The [final checks receipt](native-campaigns-v54/final/validation/checks-run.json)
records successful TypeScript checking, declared-entry audit, migration audit,
`git diff --check` and production build on the unchanged 210-file native source.
The migration audit has no missing evidence or duplicate mappings; its full-port
completion result remains false by design while the documented capabilities
and completion gates remain pending.

**1,125 distinct delta checks are resolved through the retained initial run and
one bounded correction.** The
[initial 27-file delta run](native-campaigns-v54/final/validation/delta-tests-run.json)
ran 1,125 checks: 1,124 passed and one failed. The failure was an existing
inventory assertion in `tests/v6-src-program.test.ts` that still expected 33
compiled programs after the four original Source81 workflows had been added.
That failed execution remains retained as failed evidence.

Only the expected inventory literal changed from 33 to 37, with an explanatory
comment. The [corrected-file rerun](native-campaigns-v54/final/inventory-correction/validation/delta-tests-run.json)
passes both tests in that file, including the complete per-program source,
semantic, transitive and callback-admission checks. The
[immutable resolution receipt](native-campaigns-v54/final/validation/delta-tests-resolution.json)
verifies that only this test file changed, all 33 prior program entries remained
identical by value, and the four additions are exactly:

- `v6.source81.continue_target`;
- `v6.source81.prepare`;
- `v6.source81.project`;
- `v6.source81.revise_target`.

The native implementation is unchanged across these receipts, the successful
campaign and the production build. No second complete 1,125-test run is claimed.
This is a targeted release delta, not the entire historical test suite.
The reused campaign and replay helpers retain their historical `v53` filenames
and receipt schema labels; the frozen source digest and implementation `0.28.0`
identify this v54 execution.

### Actual browser verification

The [browser receipt](native-campaigns-v54/final/re86-browser-verification.json)
records three real **Run to next level** clicks from level 1 in one retained
browser reasoning session. It observes these counters in the actual UI:

| Completed level | Cumulative actions | Completed plans |
| --- | ---: | ---: |
| 1 | 26 | 12 |
| 2 | 73 | 28 |
| 3 | 134 | 46 |

The final browser is on level 4, with three levels solved and the inspector
closed. The [retained screenshot](native-campaigns-v54/final/re86-browser-final.png)
shows the result on a 384 × 384 canvas at a 1363 × 936 viewport. This is one
bounded browser sample; it does not establish a responsive-layout campaign,
a performance improvement or a full-game victory. No level jump or source-state
injection was used.

### Recorded-trajectory regressions

All **10/10 recorded-public replays pass**, with **170/170 comparison checks**
and no failed check. The
[regression summary](native-campaigns-v54/final/regressions/regression-summary.json)
retains individual execution, report and comparison artifacts, and the
[comparison runner](../../scripts/compare-v54-regressions.py) declares the exact
scope. The total covers 495 commands, 505 complete public packets, 1,723
animation frames, 344 acquired prefixes, 839 requests and 36 official level
boundaries.

| Recorded game | Commands | Completed levels | Comparison checks |
| --- | ---: | ---: | ---: |
| STCK | 35 | 3 | 17/17 |
| CATL | 48 | 6 | 17/17 |
| SELE | 44 | 3 | 17/17 |
| COLM | 45 | 3 | 17/17 |
| ZIPP | 101 | 6 | 17/17 |
| GRIL | 19 | 3 | 17/17 |
| LIFE | 49 | 3 | 17/17 |
| VALV | 28 | 3 | 17/17 |
| GARE | 53 | 3 | 17/17 |
| CN04 | 73 | 3 | 17/17 |

Each fresh native session computes its own command before the replay host
supplies the corresponding archived public return. The comparison covers
commands, complete packet hashes and animation lengths, primitive boundaries,
selected provider/group/proposal kind/subquestion, named coordination fields,
prefix and epoch counters, natural level boundaries and the final public result.
Only the fresh observation-session prefix is normalized in those selected
fields. Timings, implementation labels and migration-status labels are excluded.

New ReactiveContact state remains in the raw reports, but is outside comparison
with a baseline that did not contain that owner. Complete provider payloads,
derived identities, graph chains and full original-caller parity are also
outside this check. Existing LIFE recipe identities and GARE FieldService
payloads are retained unchanged in the evidence, without inheriting the older
comparators' unsupported assumptions. These are ten regressions using recorded
returns, not ten new live games or a speed comparison.

## Completion gates

All six complete-migration gates remain false: all required capabilities,
complete common-caller differential parity, all declared families, common graph
editing of every executed program, Python numeric semantics and full campaign
regression. This release adds bounded source evidence and two real source entry
connections; those broader requirements remain separately auditable.
