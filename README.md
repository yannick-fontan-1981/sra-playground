# SRA Playground

<!-- LOT6A_README_CURRENT_START -->

## Current migration: lot 6A PreviewPacking / native 0.60.0

The reconstructed `preview_packing` owner is connected in the original strategy order, with selected-return acquisition, guarded commands and exact source-state restoration. Private publication is still pending; the actual published baseline is Site 95 / native 0.58.

The final freeze contains **306 native files**, digest `ea2b52283409971cf6ce73b8b7970576651bfb3c78a681fc741a13f432050229`, and 322 archived native/execution inputs. This is a new reconstruction from immutable original source; lost earlier 6A results are historical only.

| Actual proof | Result |
| --- | --- |
| Final declared tests | **4795/4795 in 126 files**, no failures, skips, cancellations or TODOs |
| Release checks | **5/5**, including the production build |
| Independent component oracle | **1,288 checks**, including 724 consumed-file hashes; all 1,786 original files unchanged |
| Cold KATA and actual browser | **3 levels / 33 actions / 14 plans**, Pause at 9 then exactly one action to 10 |
| Cold original parity | **174 events, 113 calls, 61 restores, zero differences**; 56 ablations, 17 action/refusal changes |
| Recorded returns | **187/187 scoped checks**: 10 historical traces plus one same-candidate KATA repeatability check. |
| [Owner presence](docs/migration/lot6a-evidence/integrated-final-02/regressions-final/preview-owner-presence.json) | **11/11 cases**, 289 prefixes (14 selected / 275 foreign), 390 returns (33 selected / 357 foreign), **33 selected acquisitions / 0 passive**, 611 restores (578 native / 33 source) |
| [Final integrity](docs/migration/lot6a-evidence/integrated-final-02/delivery-integrity.json) | **`passed`**, 703 source/test files, 371 build inputs, 13 regression execution inputs, 12 byte-identical restored reports |
| [Pre-measurement readiness](docs/migration/lot6a-evidence/performance-integrated/readiness.json) | **`ready`**, actual evidence and prerequisites bound before measurement |
| [Publication inputs](docs/migration/lot6a-evidence/integrated-final-02/publication-inputs.json) | **`passed`**, accepted cost and validated bytes bound; this receipt performs no publication |

The register now has **63/76 connected entries (82.9%), 13 remaining**. Coverage retains 195 component-verified modules, 148 partial transfers and 1,026 pending; no module is fully verified and all six full-migration gates remain false.

Global complete-session median results: **STCK +6.094357%**; **SMLP +3.262812%** Both cases are accepted. The predeclared rule is strictly below +10% for each case; phase overruns remain visible and may be accepted only when that global rule passes. No measured sample is removed.

The [independent review](docs/migration/lot6a-evidence/performance-integrated/owner-growth-review.json) performed **17,890 checks** across **32 measured sessions / 400 actions**. **11/16 aggregate timing diagnostics** remain within the observed budget; the eight metrics per case include `session_elapsed`. The [complete cost report](docs/migration/lot6a-evidence/performance-integrated/results.md) retains all five pooled phase overruns, both cohorts, dispersion and available p95. The historical strict metadata failure remains failed; the separate predeclared owner contract qualifies only the captured structural deltas.

The 126-file scope explicitly excludes three inherited modules that execute the closed-budget LKEY case. The first **4,793/4,795** run remains failed; the complete successful rerun and all five final checks are retained under `docs/migration/lot6a-evidence/integrated-final-02/validation-final/validation`. Two failed replays in the first batch and a further WEAV retry ended with three retained `-9` exits (SIGKILL); the exit code alone does not establish a memory cause. The subsequent **1,024 MiB** WEAV replay failed with **`-6` after 73 actions** and an [explicit V8 heap-exhaustion diagnostic](docs/migration/lot6a-evidence/recovery/weav-memory/diagnostic.json); this does not establish the cause of the earlier SIGKILLs. The [final exclusive 1,536 MiB replay](docs/migration/lot6a-evidence/integrated-final-02/released-weav-exclusive-1536/regressions/regression-summary.json) passed **81 actions and 17/17 checks**. The checked **9 + 1 + 1** composition binds each retained result to its real invocation in the [final summary](docs/migration/lot6a-evidence/integrated-final-02/regressions-final/regression-summary.json). The [first failed consolidation](docs/migration/lot6a-evidence/recovery/consolidation-attempt-01.json) remains retained; `actual_retained_child_execution_inputs` binds the actual child execution inputs without inventing a parent inventory recorded before launch. No replay was repeated for that provenance correction. The native bounds return blocking unknowns; they do not prove impossibility or guarantee instantaneous Pause. Long-session history compaction and full-original-caller parity remain open.

The [cumulative KATA clock](docs/migration/lot6a-evidence/case-clock.json) is closed within budget at **2256.934540 / 2,400 seconds**, leaving **143.065460 seconds unused**; earlier charges and attempts remain included.

**Next in this lane after 6A closure: 6B `selected_rigid`**, followed by `observed_rigid_cargo` and `shared_settlement`. See the [updated roadmap](docs/migration/v6-delivery-roadmap.md), [6A report](docs/migration/lot6a-preview-packing.md), [source lineage](docs/migration/lot6a-preview-packing-lineage.md) and [evidence index](docs/migration/lot6a-evidence/README.md).

<!-- LOT6A_README_CURRENT_END -->

An English-language playground for **100 interactive games** and Yannick
Fontan's **Symbolic Reasoning Agent** research.

<!-- LOT5B_README_HISTORICAL_START -->

## Historical publication: Site 94 / lot 5B / native 0.58.0

**AddressedMaterial / lot 5B is functionally validated and its global cost is
accepted. Its private publication is confirmed in
[Site 94](docs/migration/lot5b-evidence/publication/native-publication.json).**
Commit `fbd968f7c194575777965219f64fa78d3460b08e` reached terminal deployment
`succeeded` on **11 November 2026 at 02:52:58.534517 UTC**, preserving the
owner-only audience, revision **3**, and existing URL.
The release integrates the actual Site 92 / native 0.57.0 predecessor and its
[Site 93 documentation closure](docs/migration/lot5b-evidence/coordination/published-4c-documentation-closure-reconciliation.json).
The closure preserves the native and build inputs; Site 92 remains the declared
cost reference. The [candidate freeze](docs/migration/lot5b-evidence/integrated-final/source-manifest.json)
contains **302 native files**, digest
`099444085f0579ce60e226c9dece42110c577538f5f337579305a2e5f65483c4`, and its
[source archive](docs/migration/lot5b-evidence/integrated-final/source-archive.json)
binds **313 files**.

One `public_addressed_material` owner transfers the consumed
`AddressedMaterial → AddressedField → FieldStock` chain. It learns from actual
selected and passive returns, binds each addressed click to the current observed
object and guards every step of a bounded path. Retained hypotheses must be
revalidated across boundaries. Stock preservation obligations also constrain
proposals from other families.

| Completed evidence on the 0.58 freeze | Result |
| --- | --- |
| [Final tests](docs/migration/lot5b-evidence/integrated-final/validation/delta-tests-run.json) | **4,900/4,900 tests in 125 files**, no failures, cancellations, skips or TODOs |
| [Project checks](docs/migration/lot5b-evidence/integrated-final/validation/checks-run.json) | **5/5 passed**, including both audits and the production build |
| [Ten recorded regressions](docs/migration/lot5b-evidence/integrated-final/regressions/regression-summary.json) | **170/170 checks**; 357 actions, 275 prefixes, 632 requests, 30 natural boundaries, 367 complete public packets and 1,676 animation frames |
| [Independent component oracle](docs/migration/lot5b-evidence/diagnostic/source-oracle-export.json) | **14 helpers, 19 cold chains, 522 operations**; 1,786 immutable original files verified before and after |
| Original comparisons of actual common-loop journals | [Positive **169/169**](docs/migration/lot5b-evidence/integrated-final/common-positive/original-comparison.json), [negative **164/164**](docs/migration/lot5b-evidence/integrated-final/common-negative/original-comparison.json), [bounded stock **199/199**](docs/migration/lot5b-evidence/integrated-final/common-stock/original-comparison.json) |
| [Original stock preservation](docs/migration/lot5b-evidence/integrated-final/common-stock/original-preservation-comparison.json) | **835/835 checks**; independently recomputed provider and two identical preservation refusals |
| [Actual browser QA](docs/migration/lot5b-evidence/integrated-final/browser/browser-qa.json) | **Three TRIA levels, 17 actions and 17 plans**; Pause at two actions, then exactly one action to reach three, followed by natural progression |

The stock common-loop proof is deliberately bounded: **8/17 stages, one fusion
and one move**, followed by the original preservation refusal. Its three earlier
failed attempts remain failed. Neither this proof nor the component oracle
establishes complete stock traversal or complete-original-caller parity. The
recorded regressions and TRIA interface check do not add a new game success or
establish AddressedMaterial's own contribution in a live game.

The [current register](docs/migration/v6-entry-point-progress.json) has
**62/76 connected entries (81.6%), zero partial entries and 14 remaining**.
The [coverage inventory](docs/migration/v6-coverage.json) retains
**192 component-verified modules, 147 partial transfers, 1,030 pending and zero
fully verified modules**. **All six full-migration gates remain false.**

The [official ABBA window](docs/migration/lot5b-evidence/performance-integrated/window.json)
retains all **32 measured sessions / 400 actions**, with eight warmups / 24
actions separated. Its [independent review](docs/migration/lot5b-evidence/performance-integrated/owner-growth-review.json)
passes **11,865/11,865 checks** and accepts both complete-session medians:
**STCK +3.780905%**, **SMLP −1.556219%**, each strictly below a 10% increase.
Phase diagnostics remain **14/16**, including **STCK restoration +13.032972%**
and **SMLP known-prefix guard +11.650805%**; the cohorts retain **11/16** and
**14/16**. The [full report](docs/migration/lot5b-evidence/performance-integrated/results.md)
retains all sessions, adverse p95 values and scope limitations. A phase over
10% is accepted under the authorized per-game global rule without hiding its
diagnostic.

The historical strict aggregator remains failed with **exit 1**. The separate
predeclared rule qualifies **432 structural counter differences**, backed by
**64/64 structural checks** and **68/68 static preflight checks**; these are
not 432 additional Kernel deltas. No measured duration is corrected or removed.
This accepted budget does not establish general acceleration, constant
long-session latency or a solution to **WEAV level 6**. Its exhausted cumulative
clock remains unchanged, with no new live WEAV attempt or reset.

The [five source pushes](docs/migration/lot5b-evidence/publication/lot5b-source-push-plan.json)
and [successful final verification](docs/migration/lot5b-evidence/publication/final-source-build-verification-02.json)
preserve **755 frozen inputs per checkout** and **75 application members in each
of five local archives**, for **375 exact comparisons**, without rebuilding.
The [first check](docs/migration/lot5b-evidence/publication/final-source-build-verification.json)
remains failed with [exit 1](docs/migration/lot5b-evidence/publication/verifier-attempt01-execution.json):
the Git-ignored raw strict-failure log was absent from the publication checkout.
Its [byte-identical restoration](docs/migration/lot5b-evidence/publication/ignored-proof-restoration.json)
allowed the second check to pass without changing source, tests, build or cost
inputs. The server-stored tar is identified by Sites and was not independently
downloaded for member comparison. A later documentation-closure publication,
if completed, will have its own actual receipt.

The next step in this conversation is **5C / `observed_object_binding`**;
**lot 5 has one registry entry remaining**.
Lot 4 is closed within its delivered scopes. Lot 7's transfers are closed, with
the **LKEY level-3 follow-up** handled separately. Other conversations have
started **6A / `preview_packing`** and **10B / `window_question`** after completed
10A; lots **8, 9 and 11** remain planned. See the
[5B report](docs/migration/lot5b-addressed-material.md),
[evidence index](docs/migration/lot5b-evidence/README.md) and
[current roadmap](docs/migration/v6-delivery-roadmap.md).

<!-- LOT5B_README_HISTORICAL_END -->

<!-- LOT4C_README_CURRENT_START -->

## Published predecessor: Site 92 / native 0.57.0, FacetExamples delivered

The following section preserves the 4C publication milestone. Its documentation
closure is now published in Site 93 and reconciled by the current 5B release
above; the results and next-step statements below retain their historical scope.

**Lot 4C is delivered, with functional validation, accepted global cost and actual
private publication in [Site 92](docs/migration/lot4c-evidence/publication/native-publication.json).**
Source commit `d06620d1e4ca2c9758cc693b1ced9eeeddccb7e6` reached terminal deployment
`succeeded` on **10 November 2026 at 22:45:49 UTC−03**. The
[existing URL](https://sra-playground.yannick-fontan.chatgpt.site) and owner-only
private audience, revision **3**, are unchanged. The published freeze integrates
the actual **10A / Site 91 / native
0.56.0** predecessor, commit `5659ddc9420c7624df4865f0afc628782296a186`, deployed
on **10 November 2026 at 21:42:39 UTC−03**. The
[Site 90–91 closure](docs/migration/lot4c-evidence/planning/published-predecessor-source-closure.json)
retains identical application inputs. The
[0.57 source manifest](docs/migration/lot4c-evidence/integrated-final/source-manifest.json)
contains **298 native files**, digest
`eebd099808672be934389020c8f9061df4fdacab28cd7d60c00cd1b080464c04`, with a
309-file execution archive.

The [source transport](docs/migration/lot4c-evidence/publication/lot4c-source-push-plan.json)
uses **five ordinary pushes, without force or intermediate publication**. Its
[final verification](docs/migration/lot4c-evidence/publication/final-source-build-verification.json)
confirms **75 identical application members in each of five archives**, and
**746 frozen inputs per checkout** across both checkouts. Native source, tests,
build inputs and worker remain unchanged. The 375 member comparisons cover the five local gzip archives against the
validated build. The server-stored tar is identified separately by the publication
receipt; it was not downloaded or compared member by member.

The single `facet_examples` owner connects the first `surface` entry,
`facet_example`, through `v6.facet_examples.choose`. It measures visible examples,
acquires a seed and an upward face movement from selected public returns, and
revalidates the resulting portable method before compound continuation. A
visually complete composition without official progress remains refuted. Foreign
selected returns continue to reach existing passive owners, including Axial,
without creating Facet acquisition.

The [final declared suite](docs/migration/lot4c-evidence/integrated-final/validation/delta-tests-run.json)
passes **4,838/4,838 tests in 121 files** and
[five project checks](docs/migration/lot4c-evidence/integrated-final/validation/checks-run.json).
The [ten strict recorded regressions](docs/migration/lot4c-evidence/integrated-final/regressions/regression-summary.json)
pass **170/170 checks** over **357 actions, 275 prefixes, 367 complete public
packets, 1,676 animation frames, 632 requests and 30 natural boundaries**, with
source and execution inputs unchanged. The separate
[LKEY preservation](docs/migration/lot4c-evidence/integrated-final/lkey-partial/qualification.json)
passes **157/157 checks** while retaining its raw failed result: two levels,
25 actions and `frontier_unknown` at the third level.

The [cold original-component comparison](docs/migration/lot4c-evidence/integrated-final/isos-facet-source-parity-diagnostic.json)
matches **48 calls, 24 guards, 12 selected records, 36 actually observed native
restorations, 12 prefixes and 13 public observations**, with zero differences.
Its **60 memory ablations** retain nine changed actions/refusals, four metadata-only
changes and 47 unchanged proposals, including 41 empty interventions. These are
component counterfactuals on the final replay capture, not additional live games
or complete-caller parity.

The [actual 0.57 browser session](docs/migration/lot4c-evidence/integrated-final/browser/browser-qa.json)
completes **three ISOS levels in 12 actions and 12 plans**, with Pause at one
action, exactly one further action, and natural boundaries at 3/7/12. The
[final screenshot](docs/migration/lot4c-evidence/integrated-final/browser/isos-three-levels.png)
retains that result. ISOS has six levels; full-game victory is not claimed. The
published 0.56 reference remains a bounded eight-action, zero-level observation.
The [cumulative clock](docs/migration/lot4c-evidence/case-clock.json) retains
**1,259.938444409 of 2,400 seconds** through interval 04, without reset.

Published coverage is **61/76 connected entries (80.3%), with 15 remaining**. The audit
retains **189 component-verified modules, 147 partial transfers, 1,033 pending
and zero fully verified modules**; all six full-migration gates remain false.

The [official ABBA window](docs/migration/lot4c-evidence/performance-integrated/window.json)
ran on **10 November 2026, 22:11:49–22:20:32 UTC−03**, preserving all **32 measured
sessions / 400 actions**, with only eight warmups / 24 actions excluded. The
[independent review](docs/migration/lot4c-evidence/performance-integrated/owner-growth-review.json)
passes **7,630/7,630 checks** and accepts **2/2 games**: complete-session medians
are **11,253.251434999998 → 11,046.9208325 ms for STCK (−1.833520%)** and
**16,297.509763000002 → 16,272.070031000007 ms for SMLP (−0.156096%)**.
Each game stays **strictly below a 10% increase**, without cross-game compensation,
removed measured sessions or an average of cohort ratios.

Phase diagnostics remain **15/16**, including **SMLP restoration +25.066387%**;
each cohort also retains 15/16, with STCK new decision **+10.782328%** in the first
and SMLP restoration **+42.839691%** in the second. STCK restoration p95 increases
**+13.878385%** overall and **+22.824004%** in cohort 2. The
[complete cost report](docs/migration/lot4c-evidence/performance-integrated/results.md)
retains all distributions, Pause, memory and scope limitations. A phase above
10% is accepted under the authorized per-game global rule; its diagnostic stays visible.

The historical strict aggregator remains failed with exit 1. The supplementary
decision qualifies **432 structural differences on four predeclared paths**, backed
by **37 attributed untimed deltas / 64 checks** and **65 static preflight checks**.
Public counts do not establish identity of private graph leaves. The
[delivery integrity](docs/migration/lot4c-evidence/integrated-final/delivery-integrity.json)
and [completed isolation](docs/migration/lot4c-evidence/performance-integrated/coordinated-isolation-completion.json)
pass. The [first post-window preparation failure](docs/migration/lot4c-evidence/performance-integrated/post-window-analysis/preparation-attempt-01.json)
is retained: cohort comparisons were requested before generation, then produced
by the declared tools without rerunning measurements or changing inputs.
These common-loop timings do not establish long Facet-composition cost, hours-long
stability, immediate interruption of any search or full-caller parity.

**Lots 4A, 4B and 4C are delivered; lot 4 is closed within its announced scopes.**
This documentation closure records the actual Site 92 publication and keeps
the same native and application inputs; its terminal publication receipt is
reported separately. The next concrete work outside lot 4 is final integration
of the separately prepared **5B / `observed_addressed_material` / native 0.58**,
including this documentation closure. This delivery adds no further 5B implementation.

See the [4C report](docs/migration/lot4c-facet-examples.md),
[source lineage](docs/migration/lot4c-facet-examples-lineage.md),
[evidence index](docs/migration/lot4c-evidence/README.md) and
[updated roadmap](docs/migration/v6-delivery-roadmap.md).

<!-- LOT4C_README_CURRENT_END -->

<!-- LOT10A_README_CURRENT_START -->

## Published predecessor native 0.56.0: AxialQuestion, Sites 90–91

**AxialQuestion / lot 10A** is integrated with the actual **Site 89 / native
0.55.0** predecessor and its unchanged Site 88 execution inputs. The distinct
`public_axial_question` owner now executes `v6.axial_question.choose` and
`axial.select` through the common runtime. It preserves the source priority,
quarter-turn distance, recalled-control preference, command and source-index
tie order, followed by a current one-action OP18 guard.

The first native publication is **Site 90**, deployed privately on
**10 November 2026 at 21:37:52.792934 UTC−03** from commit
`617d1f607d37a6bba1f7ae8ffe1826806e6749a0`. The
[terminal publication receipt](docs/migration/lot10a-evidence/publication/native-publication.json)
binds the validated source, build, cost and unchanged owner-only access. The
documentation closure keeps the same native and build inputs. That closure is
actually published in **Site 91**, commit
`5659ddc9420c7624df4865f0afc628782296a186`, confirmed at **21:42:39 UTC−03 on
10 November 2026** by the
[retained publication receipt](docs/migration/lot4c-evidence/planning/published-predecessor-site91.json).

Cold common-runtime scenarios acquire selection from another family's public
return, execute Axial once, acquire an observed rotation and change the next
choice to **ACTION4 instead of the ACTION3 ablation**. Attempts, ambiguous
boundaries, portable methods and restoration retain their separate contracts.
The final scope passes **1,538 tests in 45 files**, **five project checks** and
**seven recorded regressions / 119 comparisons**. Its source comparisons cover
122 original-reference cases and eight additional native contracts, with six
common-runtime scenarios included in the final suite.

The predeclared **A1/B1/B2/A2 cost window is accepted on both games** against
the actually published **Site 88 / native 0.55.0**: complete-session medians
change by **+0.387457% for STCK** and **+0.136584% for SMLP**, each strictly below
+10%. All **32 measured sessions / 400 actions** remain, with **7,688 independent
checks**. Aggregate phase diagnostics pass 16/16; each cohort retains its 15/16
status and the two adverse SMLP phase results. The historical strict metadata
failure remains failed alongside the owner qualification declared before timing.
See the [complete cost report](docs/migration/lot10a-evidence/performance-integrated/RESULTS.md).

The continuous browser check completes three TRIA levels in 17 actions and
confirms Pause followed by one action. It verifies the existing
RelativeArrangements path, not Axial's own live contribution. POLA's prior
94-action attempt has no recoverable elapsed-time receipt, so no new 40-minute
budget or new action is introduced. Axial's live-game contribution, long-history
cost and full V6 caller parity remain open. **60/76 source entries are connected,
with 16 remaining.** Only 10A is covered; **10B WindowQuestion** is the next
sub-lot.

See the [Axial delivery report](docs/migration/lot10a-axial-question.md),
[source lineage](docs/migration/lot10a-axial-question-lineage.md),
[evidence index](docs/migration/lot10a-evidence/README.md) and
[delivery roadmap](docs/migration/v6-delivery-roadmap.md).

<!-- LOT10A_README_CURRENT_END -->

<!-- LOT7B_README_CURRENT_START -->

## Published native 0.55.0: SymbolTransactions

The published **SymbolTransactions / lot 7B** release includes the actually
published **Site 87 / native 0.54.0** predecessor. It adds the source workflow
`v6.symbol_transactions.choose` and its distinct `public_symbol_transaction`
owner. Transactions bind the current frame, pixel owner, exact action and public
observation. Only the owner's selected returns become transaction evidence;
Workshop retains its separate active and passive acquisition paths.

The frozen release passes **4,327 tests in 112 files**, five project checks,
and **eight strict recorded regressions / 136 comparisons**. Its cold CRAF run
and managed browser check each complete **three levels in 36 actions**. The
original Python owner independently matches **144 calls / 432 exact checks**;
**36 acquired prefixes and actually observed native restorations** pass another
**252 checks**. Removing acquired methods removes the 27 later interface
proposals. LKEY retains its two-level result and the third-level
`frontier_unknown` limitation.

The predeclared **A1/B1/B2/A2 cost window passes the global budget** against
Site 87: pooled complete-session medians change by **−2.227459% for STCK** and
**+0.724394% for SMLP**. All **32 measured sessions / 400 actions** are retained,
with **3,927 independent arithmetic checks**. Aggregate phase diagnostics pass
16/16; both cohorts remain 15/16, and adverse SMLP p95 values remain visible in
the [full cost report](docs/migration/lot7b-evidence/performance-integrated/results.md).
The strict historical work-metadata failure is retained alongside the separate
qualification declared before measurement. The first native 7B publication is
**Site 88**, deployed privately on **10 November 2026 at 20:56:02 UTC−03** from
commit `43ee01ba5469fd4fbffe10eb6a786fe99b1c35a7`. Its
[terminal publication receipt](docs/migration/lot7b-evidence/publication/native-publication.json)
binds the exact validated source tree and compiled worker; the accompanying
documentation closure retains that same build.
These common cost paths do not select Symbols and do not establish active CRAF
transaction cost. Full V6 caller parity remains open: **59/76 source entries
are connected, with 17 remaining**, and no module is declared fully verified.

See the [delivery roadmap](docs/migration/v6-delivery-roadmap.md),
[Symbols report](docs/migration/lot7b-symbol-transactions.md),
[source lineage](docs/migration/lot7b-symbol-transactions-lineage.md) and
[retained evidence](docs/migration/lot7b-evidence/README.md).
The milestones below retain their historical results and limitations.

<!-- LOT7B_README_CURRENT_END -->

## The browser playground

- **100 original game engines:** 25 official games and 75 custom games from
  three waves, selected by their prominent four-character codes. CASC is the
  default; an explicit `?game=CODE` link selects that game instead.
- **Local execution:** the original Python engines run in WebAssembly through
  Pyodide inside a dedicated Web Worker. A TypeScript interface renders their
  observations and sends actions to that local worker.
- **Minimal manual controls:** arrows, a generic Space action, board clicks,
  Undo, current-level Reset, a level dropdown, and Restart from level 1.
  Enabled directions and utility buttons use a bright blue
  fill with white icons; unavailable actions are muted. The player leaves
  the game mechanics for you to discover.
- **SRA-first identity:** SRA Playground and Symbolic Reasoning Agent lead
  the hierarchy, with a prominent ARC AGI 3 heading above the player and the
  credit “75 new custom games created or compiled by Yannick Fontan.” The
  agent name is larger and brighter, with a smaller SRA Playground title and
  prominent custom-game count. Warm black surfaces, off-white text, blue and
  yellow accents retain the ARC-inspired appearance. The patchwork shows 18
  real initial levels from the latest Custom Wave 3, in their original colors
  at full opacity. `scripts/generate-game-mosaic.py` reproduces the asset.
- **SRA Agent:** the complete V6 capability transfer into native TypeScript and
  the V7 common reasoning architecture is in progress. The connected native
  path supports guarded coordinate actions, committed sequences, Pause and
  cross-level memory. Use **One action**, **Run 16 actions**, or **Run to next
  level**; opening the tab does not move the game.
  **Historical native revision `0.36.0` preserves the lot 2C behavior while reducing
  redundant common-runtime work.** Four generic changes share unchanged encoded
  values and their validated hydration, read current authorization identities
  without rebuilding diagnostics, share owned frozen trace entries inside
  snapshots, and serialize private measured-component signatures with exactly
  the original canonical bytes. Every proof, revision and acquisition remains
  with its existing owner; outgoing service snapshots keep their independent
  copy and validation. No new reasoning family or game-specific rule is added.
  The frozen 242-file native inventory is
  `ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b`.
  The [formal delta](docs/migration/lot2c-cost-evidence/final/validation/delta-tests-run.json)
  passes **947/947 tests in 26 files**.
  A fresh cold [LS20 regression](docs/migration/lot2c-cost-evidence/final/ls20-regression/results.md)
  preserves **three levels, 142 actions (17, 67, 58) and 58 prefixes**. All
  142 commands and 143 public packets match the published 0.35.0 campaign;
  the trace retains its changed source digest. The managed
  [STCK browser check](docs/migration/lot2c-cost-evidence/final/browser/stck-verification.json)
  completes **three levels in 35 actions and 15 plans**, using one continuous
  session. These are regression checks, not new game-capability claims.
  The separate [STCK10 semantic control](docs/migration/lot2c-cost-evidence/diagnostic/semantic-qualification.json)
  qualifies all 3,834 differing leaves with no unqualified business difference;
  24 trace timestamps and each version's provenance remain explicit. Its strict
  identity failure is retained, and it does not establish binary graph identity
  or behavior on every game. The [optimization report](docs/migration/lot2c-cost-closure.md)
  and [lineage](docs/migration/lot2c-cost-closure-lineage.md) separate these proofs.
  **Official 0.36.0 cost comparison: PASSED, 16/16 medians within +10%.**
  The [comparison](docs/migration/lot2c-cost-evidence/performance/comparison.json)
  uses a fresh V62 reference and the frozen 0.36.0 source in the recorded
  [measurement window](docs/migration/lot2c-cost-evidence/performance/window.json),
  with the unchanged runner and no unresolved budget metric. STCK session time
  decreases by **11.66%** and service continuation by **40.18%**; SMLP session time
  decreases by **0.99%** and service continuation by **56.81%**. SMLP restoration
  increases by **1.65%**, within the same limit. LIFE remains a separate diagnostic:
  its session median increases by **3.39%**, with its other increases and the
  measurement limits retained in the [results](docs/migration/lot2c-cost-evidence/performance/results.md).
  **Lot 2C closed within its declared delivery scope. Lot 3 was next**, starting
  with `observed_composition_services` for shared memory and composition services.
  Complete morphology-domain closure and full V6 parity remain open.
  **Previous functional lot 2C delivery, native `0.35.0`:** acquired station
  methods, entry continuation and managed capacity join the common agent.
  A method is acquired only at a verified natural level boundary and enriched
  from one uniquely acquired, peer-preserving station contact. Recalled methods
  are revalidated against current public geometry, witnessed motion and resource
  forecasts. The existing caller, GoalAccess, inventory, attention and morphology
  owners retain their respective evidence. Checkpoint v2 restores older v1
  morphology states with no invented entry return.
  That frozen `0.35.0` release passes **859/859 release-delta tests** across 17 files.
  Its cold LS20 campaign completes **the first three levels in 142 actions
  (17, 67 and 58)** and 58 acquired prefixes, in one continuous session. It stops
  naturally on entry to level 4. The managed browser independently reproduces
  142 actions, three solved levels and 58 completed plans, with the inspector
  closed and no session reset. V62 had completed only level 1 before its
  recorded level-2 game-over. The new session actually selects two entry-rebind
  prefixes, one acquired entry-return/probe chain and fourteen managed-access
  prefixes. A captured method with a uniquely acquired station is consumed in
  47 subsequent morphology calls.
  The unchanged original morphology adapter matches **312 actual calls and
  58 sealed checkpoints**, with 600 shared-context calls reconstructed from the
  public journal. Separate source contracts cover acquisition, refusals,
  transformations, restoration and managed projection/search. The bounded V62
  comparison matches 25 commands and stops before supplying the first differing
  return at action 26; it does not claim full original-caller parity.
  Decisions use public observations and acquired witnesses rather than game
  names, fixed colour roles or stored solutions. The [0.35.0 report](docs/migration/lot2c-method-continuation.md),
  [source lineage](docs/migration/lot2c-method-continuation-lineage.md) and
  [roadmap](docs/migration/v6-delivery-roadmap.md) retain the campaigns, browser
  verification, measured costs and limits. **Historical 0.35.0 cost result:**
  the initial comparison has 14/16 medians within +10%; its fresh paired STCK
  follow-up has five of eight medians above that unchanged limit. These failures
  remain retained in their original receipts. The passing 0.36.0 comparison
  closes this historical cost gate without reclassifying those failures. At that
  milestone, lot 3's shared memory and composition services were next. Complete morphology-domain
  closure and full V6 parity remain separate open migration goals.
  Previous [lot 2B](docs/migration/lot2b-control-attention.md) connected the current
  morphology decision to control acquisition and attention parent-return,
  including retained compositions without a route, source experiments and
  witness-preserving information questions. Its independent SYME demonstration
  completed three levels in 36 actions through the historical field provider.
  **Previous lot 1 retains a measured
  material request while its pose question is resolved**, then consumes the
  acquired return before the next delivery or control decision. The existing
  attention owner keeps the parent binding; the existing shared material owner
  keeps the models and counterexamples. Changed identity, stale proof, lost
  selection evidence or an unreachable request suspends the parent. This is an
  explicit native coordination extension, with ordinary source guards and
  WHY/ACT still required. The integrated LIFE campaign completes the first three
  levels in **49 actions (15, 15 and 19)**, with 47 acquired prefixes and one cold
  continuous session. The 241-check release delta passes against the frozen
  implementation. LIFE already succeeded before this change; the scoped-parent
  ablation supplies the separate contribution proof. The [delivery report](docs/migration/lot1-retained-material-parent.md),
  [source lineage](docs/migration/lot1-composition-return-lineage.md) and
  [eleven-lot roadmap](docs/migration/v6-delivery-roadmap.md) distinguish its
  contracts, integrated campaign and performance evidence. Lot 2A supplies the current morphology measurements and guarded probes;
  lot 2B now connects their current decision to the control and attention consumers.
  Lot 2C adds the revalidated station/entry consumers. **The previous v57 milestone completes
  SMLP's first three levels in 15 actions (3, 4 and 8)** through one cold
  continuous native common session, nine acquired prefixes and two natural
  boundary replays. The managed browser independently confirms 15 actions,
  three solved levels and nine completed plans, with the inspector closed.
  The target stops on entry to level 4 with `NOT_FINISHED`.
  This release connects the original `topological_recolor` entry, its six-field
  owner and the consumed V5 bounded pocket/flood logic. Only selected recolor
  returns become recolor evidence. It also recovers current motion contrasts
  in the common information caller, with source resource and preservation
  checks and an already acquired meter forecast. All measurements remain
  generic; no game identifier, fixed colour role, coordinate or stored route
  enters the agent. SMLP uses the existing `configured_arrivals`,
  `observed_frontier` and `public_occurrence_recall` providers. The unchanged
  V56 baseline also succeeds, with all 16 public packets, 579 animation frames,
  15 commands and nine prefix selections identical. The positive Recolor and
  Motion source contracts are separate evidence from this live success.
  The audit connects 50/76 source entries (65.8%), with 37 compiled programs;
  complete V6 parity remains unverified. All 13 recorded-public regressions
  pass their 221 comparison checks. The concurrent Motivation update is
  preserved; merged validation passes 252 checks with the same native worker.
  The milestone label and its evidence paths are retained independently of
  the later Site publication number. See the
  [v57 report](docs/migration/v57-topological-recolor-and-motion-questions.md).
  **The previous v56 milestone completes
  GLOB's first three levels in 20 actions (5, 11 and 4)** through one cold
  continuous native common session, 17 acquired prefixes and two natural
  boundary replays. The managed browser independently confirms 20 actions,
  three solved levels and 17 completed plans with the inspector closed.
  The target stops on entry to level 4 with `NOT_FINISHED`.
  This release connects the original `observed_inventory_composition` entry
  and its eight-field owner, current cell/material measurements, conditional
  dependency routes, contact and context reconciliation, and source meter /
  collection acquisition. Generic helpers retain current guards and bounded
  source uncertainty. No game identifier, fixed colour role, coordinate or
  stored route enters the agent. GLOB uses the existing `observed_frontier`,
  `fixed_origin` and `information_goal` providers and also succeeds on the
  unchanged V55 baseline. Its new cold common result is separate from the
  positive inventory component tests. Original Python matches all 90 actual
  inventory/context calls and all 17 complete prefix checkpoints on GLOB.
  The audit connects 49/76 source entries (64.5%); complete V6 parity remains
  unverified. See the [v56 report](docs/migration/v56-observed-inventory-and-current-context.md).
  **The previous v55 milestone completes
  AS66's first three levels in 19 actions (5, 6 and 8)** through one cold
  continuous native common session, 11 acquired prefixes and two natural
  boundary replays. The managed browser independently confirms 19 actions,
  three solved levels and 11 completed plans with the inspector closed.
  The target stops on entry to level 4 with `NOT_FINISHED`.
  This release connects the original `ordered_reaction` entry to one owner,
  recovering V5 ordered cell changes and V6 conditional reaction policies.
  Ordered public animation frames retain their actual sequence, with current
  control, cover and continuation guards. All measurements remain generic;
  no game identifier, fixed colour role, coordinate or stored action route
  enters the agent. AS66 uses the existing `observed_frontier` and
  `sliding_cavity` providers and also succeeds on the unchanged v54 baseline;
  its new cold common result is separate from OrderedReaction's source proof.
  The audit connects 48/76 source entries (63.2%), with complete V6 parity
  still unverified. See the [v55 report](docs/migration/v55-ordered-reactions-and-public-animations.md).
  **The previous v54 milestone completes
  RE86's first three levels in 134 actions (26, 47 and 61)** through one cold
  continuous native common session, 46 acquired prefixes and two natural
  boundary replays. The existing generic `constellation_cover` provider supplies
  every input. The target stops on entry to level 4 with `NOT_FINISHED`.
  This release connects the original `reactive_contact_continuation` and
  `reactive_contact` entries to one acquired owner, with the consumed V5
  geometry, parent return, escape, stationary return and Source81 logic.
  Generic SRC `SELECT` now evaluates declared policies, admits complete
  requests and preserves unresolved ambiguity through the common interpreter.
  Four unchanged-source Source81 workflows join its existing program registry.
  The implementation adds no game identifier, palette convention, fixed
  coordinate or stored action route. RE86 validates the existing constellation
  service; the new reactive component has separate original-source evidence.
  The audit connects 47/76 source entries (61.8%), with complete V6 parity
  still unverified. See the [v54 report](docs/migration/v54-reactive-contact-and-declared-selection.md).
  **The previous v53 milestone completes
  CN04's first three levels in 73 actions (18, 31 and 24)** through one cold
  continuous native common session, 29 acquired prefixes and two natural
  boundary replays. All 73 inputs come from the already connected generic
  `rigid_port_assembly` service; no game-specific selector, imported solution
  or level jump supplies the trajectory. The target stops at entry to level 4
  with `NOT_FINISHED`, without claiming a full victory.
  This release connects `observed_outline_service` using the pinned V6 owner,
  DRM/SRC workflows and V5 geometry/recovery helpers. Explicit native
  compositions separately revalidate recalled control, retain one actual
  visual relation when a marker disappears, and ask a conditional local
  question at an observed access arrival. They add no game identifier,
  palette convention, fixed coordinate or stored action route. CN04 validates
  existing port assembly; it is not evidence that Outline solves three levels
  of ESCT. The audit connects 45/76 source entries (59.2%), with complete V6
  parity still unverified. See the [v53 report](docs/migration/v53-outline-service-and-current-relations.md).
  **The previous v52 milestone completes
  GARE's first three levels in 53 actions (7, 9 and 37)** through one cold
  continuous native common session, 53 acquired prefixes and two natural
  boundary replays. The source-declared `observed_framed_transfer` and
  `observed_framed_analogy` entries share one knowledge owner. Explicit native
  extensions retain real receptions from public animation frames, revalidate
  current controls, and ask one directed question at a time about an
  intermediate receiver. Conflicting control offsets remain hypotheses.
  There is no game identifier, level branch or stored action route in these
  helpers. The target stops on entry to level 4 with `NOT_FINISHED`;
  no complete GARE victory is claimed. The browser independently confirms
  53 actions and three levels, with seven unchanged 442 px board-height
  samples and the same compact UI as v51. Its connection audit was
  44/76 source entries (57.9%); complete V6 parity remains unverified.
  See the [v52 report](docs/migration/v52-framed-transfer-and-public-packet-acquisition.md).
  **The previous v51 milestone completes
  VALV's first three levels in 28 actions (10, 10 and 8)** through one cold
  continuous native common session, 28 acquired prefixes and two natural
  boundary replays. The newly connected `field_service_composition` measures
  current controls, acquires actual repetition and restoration, tests isolation
  and service, and rebinds learned roles after an official boundary. Its four
  own layers retain 63 events in the existing common knowledge owner. The
  independent original component produces the same 28 commands and 29 complete
  public packets (238 frames). Own envelopes, events, states and 240 numerical
  identity recipes match exactly on the checked safe-integer domain; complete
  original-caller or inherited-graph parity is not claimed. The target stops on
  entry to level 4 with `NOT_FINISHED`. The browser confirms 28 actions and
  three levels, with seven unchanged 442 px board-height samples. No new native
  priority rule is added. See the [v51 report](docs/migration/v51-field-service-composition.md).
  **The previous v50 milestone completes
  LIFE's first three levels in 49 actions (15, 15 and 19)** through one cold
  native common session, 47 prefixes and 49 actual Kernel acquisitions. The
  connected `typed_material_flow` acquires marked supports, replacements,
  typed descendants, request associations and conditional pose changes from
  real public returns. Its 68 own events join the existing common memory.
  Three actual contact invitations remain in the trajectory. A generic native
  coordination extension bounds their unresolved transient-return refusal
  using complete public packets and a current independent relation or acquired
  context; ordinary guards and WHY/ACT still authorize every action. The
  independent source component uses 46 actions, while replay on actual native
  returns verifies all 44 material proposals, 68 own events and 49 own states
  under explicit numeric-identity qualifications. The target stops on entry
  to level 4 with `NOT_FINISHED`, without a complete LIFE victory claim.
  The compact panel and stable board layout are preserved. A browser run
  confirms the same 49 actions and three levels; seven desktop layout samples
  show no position or dimension change, with the board column held at 442 px.
  See the [v50 report](docs/migration/v50-typed-material-and-returned-inquiries.md).
  **The previous v49 milestone completes
  GRIL's first three levels in 19 actions (5, 5 and 9)** through one cold
  native common session, 19 prefixes and 19 actual Kernel acquisitions. The
  connected `occluded_catalogue_composition` preserves unknown pixels,
  acquires reciprocal substrate evidence and compares current catalogue poses.
  Another view can be requested only from an actually observed field-changing
  input; other common providers supply the initial experiments. The 34 own
  catalogue events share the existing memory owner. A separate original
  subset coordinator uses 18 actions; the native caller's different choices,
  including one extra occurrence-recall question, are retained explicitly.
  The target stops on entry to level 4 with `NOT_FINISHED`, without a complete
  GRIL victory claim. The compact panel and stable board layout are preserved.
  See the [v49 report](docs/migration/v49-occluded-catalogues-and-acquired-views.md).
  **The previous v48 milestone completes
  COLM's first three levels in 45 actions (17, 17 and 11)** through one cold
  native common session, 21 prefixes and 45 actual Kernel acquisitions. It
  connects `queued_field_composition`: current scalar control effects are
  acquired, ordered public animation packets distinguish reception from
  automatic changes, and compatible closure models support bounded conditional
  preparation. The three-level target stops on entry to level 4 with
  `NOT_FINISHED`. **ZIPP is now completely solved: six levels with official
  `WIN` in 101 actions**, through one cold session and 40 prefixes. Its first
  77 commands and 78 full public packets remain exact. One generic arbitration
  at action 78 corroborates the prior program's actual Kernel score increase,
  exact provider entry and current guard before preferring its fresh inquiry.
  Neither a game name nor a level number selects that rule. The compact panel
  and independent board height introduced in v47 are preserved.
  See the [v48 report](docs/migration/v48-queued-fields-and-acquired-continuation.md).
  **The previous v47 milestone completes
  SELE's first three levels in 44 actions (8, 10 and 26)** in one cold native
  common session, with 44 actual acquired prefixes. It connects the generic
  `linked_packet_composition` entry: current control selection is observed,
  dated public animation frames provide output directions, and conditional
  angular relations prepare explicitly guarded experiments. **ZIPP also reaches
  five completed levels in 77 actions**; the six-level attempt stops after one
  further action at `frontier_unknown`, so no full-game victory is claimed.
  The "Solve with SRA." panel now keeps only its useful controls, counters and
  concise status; technical detail stays in the closed inspection. The board
  column has independent height and no longer recenters when status text changes.
  See the [v47 report](docs/migration/v47-linked-packets-and-stable-board.md).
  **The previous v46 milestone completes
  ZIPP's first four levels in 53 actions (8, 15, 15 and 15)** through one cold
  native common session and 12 acquired prefixes. Its first three levels use
  38 actions. The declared four-level target stops on entry to level 5 with
  `NOT_FINISHED`; this is not a complete-game `WIN`. The generic
  `trace_field_composition` transfer measures a cell graph and an ordered
  trace from current public pixels, acquires actual extension effects, and
  revalidates each proposed point through the common Kernel and WHY/ACT gates.
  See the [v46 report](docs/migration/v46-trace-fields.md) for source parity,
  complete public evidence, targeted regressions and the unresolved concentric
  ring ambiguity in the next public scene.
  **The previous v45 milestone completes all
  six CATL levels with official `WIN` in 48 actions (eight per level)** through
  one cold native common session and 48 acquired prefixes. Its first three
  levels use 24 actions. A generic, bounded AND/OR composition extends the
  measured atomic predicates when the original finite grammar is completely
  refuted. The sixth level retains every compatible expression and requires
  agreement on each current query. The [v45 report](docs/migration/v45-composed-predicates-and-reduction.md)
  separates this native extension from unchanged-source evaluator parity.
  **LF52 also completes its first three levels in 104 actions (8, 40 and 56)**
  through one cold common session and 71 acquired prefixes, stopping at the
  declared target on entry to level 4 with `NOT_FINISHED`. The report records
  the ReductionTransport transfer, its 106 passing component checks, and the
  explicit native coordination of an acquired continuation before an
  unacquired exploration. The isolated original component uses 102 actions;
  the native common caller also performs two observed-effect access actions,
  so complete trajectory equivalence is not claimed.
  The [v44 labeled-sequence report](docs/migration/v44-labeled-sequences.md)
  retains the previous five-level source-compatible milestone and its exact
  bounded component trajectory comparison.
  **Previous v43 milestone: COMB completes all
  six levels with official `WIN` in 104 actions (3, 7, 14, 19, 30 and 31)**,
  through one cold common Logos Engine session and 45 acquired prefixes.
  **THER also completes all six levels with official `WIN` in 26 actions
  (4, 3, 4, 4, 5 and 6)**, through a separate cold session and eight prefixes.
  The [v43 product-panel and mark-support report](docs/migration/v43-product-panels-mark-support.md)
  documents the faithful transfer of conditional factor composition, the native
  extension of complete visible mark support, exact original-component
  comparisons, actual Kernel acquisition and limits. Neither the game name nor
  a level number chooses a reasoning rule. Official success remains distinct
  from a universal control or terminal law. Observation, search and guard
  algorithms still run as native TypeScript callbacks.
  **Previous v42 milestone: STCK completes its first four levels in 45 actions
  (3, 7, 25 and 10)** through conditional return preparation and a measured
  relation. See the [v42 report](docs/migration/v42-rooted-quota-program-relations.md).
  **Previous v41 milestone: PIPE completes its first three levels in 23 actions
  (4, 8 and 11)**; see the [v41 report](docs/migration/v41-radial-ports-control-discovery.md).
  **Previous v40 milestone: MEMO completes its first three levels in 30 actions
  (10 per level)**; see the [v40 report](docs/migration/v40-acquired-preparation.md).
  **Previous v39 milestone: STCK completed its first three levels in 35 actions**;
  see the [v39 report](docs/migration/v39-observed-program.md).
  **Previous v38 milestone: TICT completes all six levels with official `WIN`
  in 55 actions**, using the transferred cell-patch composition. See the
  [v38 report](docs/migration/v38-cell-placement.md).
  The current entry audit connects **50 of 76 explicit DRM subquestions
  (65.8%)** in implementation `logos-engine.typescript.v6.native-migration/0.36.0`.
  Lot 1's retained material parent is native coordination outside this entry count.
  The compiled original workflow inventory remains 37. This counts
  connected entries, not full behavioral parity or a percentage of all code.
  The `topological_recolor` entry records only selected returns and retains its
  six-field state before FramedTransfer acquisition. Current motion information
  questions reuse acquired Goal history and read the existing meter forecast.
  Lot 2B connects the current parent/control admissions, and lot 2C extends
  acquired methods and continuation. Complete morphology-domain coverage still
  requires further source transfer and independent validation. The completed
  0.36.0 cost check closes the declared 2C delivery scope, as detailed above.
  No future game outcome is assumed.
  Complete V6 migration remains in progress.
  HANO, SYME and DNOI reproduce
  three original V6 level completions each, with 30, 36 and 17 actions. These
  checks do not establish complete V6 coverage. See [the transfer requirements
  and measured status](docs/migration/v6-native-transfer.md).
- **Logos Engine Reasoning Lab:** `/reasoning-lab.html` runs the first native
  TypeScript V7 kernel on controlled observations. Inspect the executed program,
  hypotheses, compositions, revisions and counterexamples. See
  [the implementation notes](docs/logos-engine-typescript.md) for the supported
  SRC subset, Python reference checks and next steps toward editable nodes.
- **75 New Games:** click the homepage patchwork or 75 New Games in the navigation.
  `/gallery.html` shows 75 custom games in three alphabetic groups of 25, then
  the 25 official games. Each card previews any of its levels and launches
  exactly the game and level shown. All 636 native level images are stored in
  four small lossless atlases; browsing the gallery does not load the game runtime.
- **Architecture chapters:** `/architecture.html` is a short introduction.
  Four separate pages cover representations, reasoning and the
  **behavior-tree-loop**, memory and reuse, and implementation. They use
  concrete examples, source excerpts, and pinned code links.
- **Video series:** `/videos.html` lists all six public Yanik_AI episodes
  verified on 24 October 2026. Each has a separate page, original thumbnail,
  click-to-load YouTube player, the full original English text published in its
  description, and related architecture/game links.
- **Contact:** `/contact.html` presents Yannick Fontan and a direct email link.
  Its short biography and contact details are maintained in `content/contact.json`.

The 100 games use their original Python engines. They have not all been rewritten
in TypeScript. The independent TypeScript PIPE implementation is retained for
parity tests and future porting work.

The Python game runtime, dependencies, and game bundles are loaded from the site's
own origin. After initialization, game actions require no server round trip,
remote inference, or external CDN request. Static hosting serves the initial
files; the game worker performs the computation on the user's device. The agent
has its own native TypeScript worker and loads no Python agent or model server.

### Controls and session state

| Input | Action |
| --- | --- |
| Arrow keys or arrow buttons | Directional action, when available |
| Space or the button below the arrows | Primary action, when available |
| Click or tap the board | Coordinate action, when available |
| Z, Ctrl+Z, or Undo | Undo the last action, when history is available |
| R or Reset | Restart the current level |
| Restart from level 1 | Start the selected game over, clearing its progress and Undo history |
| Level dropdown in Manual mode | Start any authored level of the selected game |
| Game selector | Load or resume the selected game |

Keyboard shortcuts act while the game board is focused. Unsupported actions are
disabled. Undo retains up to 64 steps, with older snapshots evicted when its
memory budget is reached; up to eight game sessions are cached in memory.
Switching games, including browser Back/Forward navigation,
resumes a cached session. Eviction or reloading the page clears that session.
The `?game=CODE&level=N` URL starts the chosen level from its initial state;
`?game=CODE` chooses the game. The URL follows the current displayed level,
including manual selection, progress and Undo. It does not serialize moves or
the full board state. Ordinary game-selector changes still resume cached sessions.

The level dropdown follows the current observation, including natural level
advancement and Undo. Selecting a level starts a fresh practice session for
that level and clears Undo history. The navigation adapter supplies authored
entry prerequisites for games that carry items or knowledge between levels.
Skipped levels are not evidence of solved puzzles or benchmark results.
Reset stays on the current level; Restart from level 1 creates a fresh game.
Games that stop after a selected level show a completion panel with Next level,
or Restart from level 1 when the final level is complete.

### Reading pages and game collection

| Route | Content |
| --- | --- |
| `/motivation.html` | Ten sections linking human participation and Erasmus to the author's faith, ethical and technical commitments, alignment, and a six-stage golden path |
| `/gallery.html` | 75 custom and 25 official game cards, native level previews, and exact game/level launch links |
| `/reasoning-lab.html` | Native TypeScript V7 experiment, actual program tree, knowledge inspector and execution trace |
| `/symbolic-reasoning.html` | Definition, interactive key-and-door example, history, comparison with neural networks, and the SRA design premise |
| `/arc-agi-3.html` | What the interactive benchmark is, how it works, and how the Playground relates to it |
| `/architecture.html` | Introduction and chapter directory |
| `/architecture/representations.html` | Terms, claims, relation families, roles, mechanisms, and spaces |
| `/architecture/reasoning.html` | Goals, composition, the behavior-tree-loop, and parent continuation |
| `/architecture/memory.html` | Portable activity schemas, current evidence, and reuse |
| `/architecture/implementation.html` | Logos Engine, DRM, SRC, Python, and the browser integration boundary |
| `/videos.html` | The six-episode video index |
| `/videos/<slug>.html` | One episode, its player, full original text, and related links |

Edit `content/motivation.json`, `content/architecture.json`, `content/arc-agi-3.json`,
`content/symbolic-reasoning.json`, or `content/videos.json`, then run
`npm run content:generate`. `scripts/generate-content-pages.mjs` writes complete
HTML documents and shares the same header as the Playground. The generated
HTML is tracked for review; the build regenerates it deterministically.
`src/reading.css` controls the reading layout, and `src/reading.ts` handles
click-to-load video embeds and redirects useful old Architecture section links.

The Symbolic Reasoning introduction links primary sources beside its claims
and historical milestones. Its separate entry point, `src/symbolic-reasoning.ts`,
loads a small local teaching example from `src/symbolic-example.ts`.
The example searches explicit action preconditions and effects for a plan.
Four starting scenarios distinguish a reachable key, an already held key,
unknown compatibility, and an unreachable key. It is independent of the actual
SRA agent and game worker. The complete default example is readable without
JavaScript; its selector becomes active after initialization.

The video catalogue is an explicitly verified snapshot, not an automatic
channel feed. Add newly verified uploads to its data file and keep each
thumbnail's source attribution. Each `fullText` stores the exact original
English description with its author, source URL, and retrieval date. The
episode page renders all of it, including the original paragraph and line
breaks, without a collapsed section or a separate visible text heading. The
short `summary` is used only in page
metadata. The text is attributed to the video description rather than labelled
as an audio transcription. Videos stream from YouTube after Play is
clicked; original thumbnails are served locally from `public/videos/`.
The game runtime is unchanged by this media integration.

The gallery is generated by `scripts/generate-game-gallery.mjs` from the game
catalogue and `content/game-gallery-assets.json`. Its four atlas images live in
`public/gallery/`; each row is a game and each column is a level. Regenerate
the native frames with `python scripts/generate-game-gallery-assets.py` after
changing the pinned game sources, then run `npm run content:generate`. Frame
and image hashes are recorded; the gallery build checks catalogue agreement
and atlas integrity. `src/gallery.ts` updates the preview and launch link
without starting Python or making a game action request.

## Run locally

Use Node.js **22.18 or newer** (Node 24 is used for validation).

```sh
npm ci
npm run dev
```

```sh
python scripts/restore-v52-evidence.py
npm run typecheck
npm test
npm run build
npm run preview
```

Large v52 evidence reports are stored as lossless gzip files to keep source
repository transfers within their memory limit. Before tests or proof
verification in a fresh checkout, the restore command reconstructs the exact
original report paths and checks their recorded sizes and SHA-256 hashes.
`python scripts/restore-v52-evidence.py --verify` checks the stored compressed
streams without creating reports. The mapping is retained in
`docs/migration/native-campaigns-v52/evidence-storage.json`; original execution
receipts and their byte-level claims remain unchanged.

`dev` and `build` first run `scripts/prepare-python.mjs`. It downloads any missing
runtime assets specified in `scripts/python-runtime-assets.json`, checks their
sizes and SHA-256 hashes, and places them in `public/vendor/pyodide/` for
same-origin delivery. Already verified files are reused. A clean preparation
requires network access; browser play does not fetch those assets from the
upstream CDN.

The pinned runtime is **Pyodide 314.0.7 / CPython 3.14.2**. The asset manifest
totals approximately **18.34 MB**, before hosting compression and excluding the
game archives. Browser download size and cold-start time depend on caching,
compression, device, and connection.

The static build is written to `dist/`. Deploy that directory to a static host.
The `.openai/hosting.json` manifest identifies the existing Sites project; do
not create a second project when updating it. Sites deployment history and
GitHub commits are separate; releases must keep their intended source snapshots
aligned. No automatic GitHub-to-Sites deployment workflow is configured.

## Game sources and the PIPE reference port

The [public source reference snapshot](reference/sra/212d8d426f07/README.md)
contains the resources cited by the architecture pages, the complete reasoning
and composition trees, and individually browsable copies of all 75 custom
engines. They originate from source revision
`212d8d426f07eea2b6797c2bb647545767488a96`.
The official engines retain their source versions and license headers. Runtime
bundles live under `public/python/`; the official adapter supplies the local
ARC engine interface used by those sources.

### Validate the 100 original engines

The shipped engines and adapters passed **439 advertised action checks**,
**636 level starts and resets**, **100 full restarts**, and **2,799 complete
observation comparisons** between native Python and self-hosted Pyodide.
A separate official
engine suite covers all **183 official levels** and **874 matching observations**.
These checks include animation frames, state, Undo, and deterministic continuation;
they do not establish that every puzzle has been solved.

With Python 3.12+ and NumPy, Pydantic, and typing_extensions installed:

```sh
node scripts/prepare-python.mjs
python scripts/test-level-navigation.py
python scripts/test-python-games.py --output /tmp/sra-native.json
node scripts/test-python-games.mjs --native-report /tmp/sra-native.json
python scripts/test-official-runtime.py --output /tmp/sra-official-native.json
node scripts/test-official-runtime.mjs --native-report /tmp/sra-official-native.json
```

Both WebAssembly runners reject HTTP requests, so a missing local dependency
cannot silently fall back to a CDN. See [release validation](docs/release-validation.md)
for the check scope and remaining limits.

### PIPE TypeScript reference

`src/games/pipes.ts` and
[`reference/python/pipes.py`](reference/python/pipes.py) preserve the original
Python-to-TypeScript parity work. Its **22-test suite** includes 11 scenarios,
618 commands, 610 observations, 644 complete 64 × 64 frames, six independent level
wins, and a full campaign. These results describe the PIPE reference port,
not solve coverage for the 100-game browser runtime or the SRA agent.

To regenerate those deterministic fixtures using Python 3:

```sh
python3 scripts/generate-pipe-fixtures.py
npm test
```

The fixture generator's constraint solver and fixtures are development tools.
They are not bundled as a playing agent. The browser games execute their own
Python mechanics through `game_bridge.py` and `official_adapter.py`.
`custom_level_navigation.py` adapts direct manual entry to the custom engines'
level loaders without changing their source archives or puzzle mechanics.

## Transferring the complete SRA into native TypeScript

`src/runtime/browser-games.ts` and `src/runtime/game-worker.ts` implement the
separate game worker. `v6-agent.ts`, `v6-agent-service.ts` and
`v6-agent-worker.ts` connect native TypeScript reasoning to the real games.
All game actions pass through a current, immutable proposal ticket. Public
outcomes are acquired before a prefix is reconciled. Pause retains its pending
command; manual intervention closes that reasoning session.

The 33 exported V6 SRC entry programs execute in the same TypeScript interpreter
as V7. Their original source and semantic hashes are checked, and a missing
native callback is refused. The initial family ports preserve observations,
geometry, hypotheses, bounds, guards and counterexamples. Python reference
scripts are development tools only.

**Full migration is not complete.** The target includes every V6 reasoning family,
its inherited V5 primitives, full WHY/ACT authority, composition/evidence memory,
parent continuations and cross-level transfer. A working subset is not accepted
as that target. `migration/v6-transfer-map.json` and
`docs/migration/v6-coverage.json` track the remaining work; the explicit
`--require-complete` audit cannot pass while required capabilities are missing.

See [the browser architecture notes](docs/architecture.md) for runtime boundaries,
Undo and Reset semantics and session limits. The [current native migration
document](docs/migration/v6-native-transfer.md) takes precedence for the agent
implementation and completion requirements.

## License

The Playground's own code is MIT licensed; see [LICENSE](LICENSE). Bundled
game sources, Pyodide, CPython, and dependencies retain their own licenses and
copyright notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the
corresponding attributions and preserved license references.

