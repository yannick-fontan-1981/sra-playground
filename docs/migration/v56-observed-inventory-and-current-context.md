# V56: Observed inventory and current caller context

## Release evidence

**The frozen V56 runtime completes GLOB levels 1–3 in 20 actions: 5, 11 and 4.** The [actual campaign](native-campaigns-v56/final/glob-campaign.json.gz) and [execution receipt](native-campaigns-v56/final/execution-glob.json) retain one cold common session, 17 acquired prefixes, 20 real transitions and two natural boundary replays. It stops on entry to level 4 with `NOT_FINISHED` and `target_levels_completed`; full-game victory is not claimed.

The [source manifest](native-campaigns-v56/final/source-manifest.json) freezes 232 native files at digest `bade8fd58991e6a127abc84f373d539edeaa70d45ab0da94a84a6751fdc92de5`. Native source and execution inputs remain unchanged throughout the final run.

The unchanged V55 baseline independently completes the same three levels. Its 21 complete public packets equal the final V56 packets, including all actual commands and returned frame packets. Both sessions use 12 `observed_frontier` actions, seven `fixed_origin` actions and one `information_goal` action. Inventory is never selected on this trajectory; the successful game validates the integrated generic caller, while the new component's positive behavior is established separately by the original-source tests.

The [independent browser verification](native-campaigns-v56/final/glob-browser-verification.json) also passes. Ordinary controls start one cold session and run to the next level three times. Visible counters advance through 5/16/20 actions, 1/2/3 levels solved and 4/15/17 completed plans. The inspector stays closed; no manual game input or level jump is used. The [actual screenshot](native-campaigns-v56/final/glob-browser-three-levels.png) shows the final 20 / 3 / 17 counters on entry to level 4.

The new source entry is `observed_inventory_composition`. Its single native owner is `public_observed_inventory`; the runtime identity advances to `logos-engine.typescript.v6.native-migration/0.30.0`. The existing compiled `v6.observed_inventory.choose` program is attached to that same acquired owner. The compiled program inventory remains 37. The regenerated entry audit reaches **49/76 connections (64.5%)**, including **16/33 material entries**. All 19 original local inventory rules are retained. These counts measure source connections, not whole-V6 completion or game efficacy.

All original V5/V6 code is pinned to commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Source exports verify all 1,786 reference files before and after execution. Native production decisions use TypeScript. Python hosts the opaque game locally through Pyodide, and separately executes unchanged reference components for evidence generation.

## Recovered logic

ObservedInventory reasons about a currently observed body, its measured moves, the surface below it, and visual material that may move between a local cell and a peripheral display. It keeps these relations conditional until an actual public return reconciles them. Spatial repetition proposes a lattice; observed control and current image agreement are separate requirements.

| Source responsibility | Native implementation under `src/logos-engine/` | Scope |
| --- | --- | --- |
| `observed_inventory/family.py` | `v6-observed-inventory.ts` | Proposal construction, binding, current guards, preservation, real-return acquisition and all eight source fields |
| `policy.py`, `inventory.drm`, `inventory.src` | `v6-inventory-policy.ts`, `v6/inventory-policy.json`, existing program registry | Original interpretation, declared priority and literal four-field source workflow receipts |
| `project.py`, `initial.py`, `contrast.py` | `v6-inventory-project.ts`, `v6-inventory-initial.ts`, `v6-inventory-contrast.ts` | Current cell projection, provisional body/lattice hypotheses, transfer and reverse-transfer evidence |
| `material_layers.py`, `effect_scope.py`, `control_revalidation.py` | Corresponding `v6-inventory-*` modules | Retained surface layers, support-domain changes and scoped movement-quantum revalidation |
| `routing.py`, `dependencies.py`, `endpoints.py` | Corresponding `v6-inventory-*` modules | Conditional geometric paths, unique supplier dependencies and current endpoint measurements |
| `boundary.py`, `continuation.py` | Corresponding `v6-inventory-*` modules | Recalled boundary relations, current revalidation, access returns and measured capacity targets |
| `local_contact.py`, `context_intervention.py` | Corresponding `v6-inventory-*` modules | Arrival/contact reconciliation and bounded associations between visible regions |
| Consumed V5 measurements and shared V6 geometry | `v6-inventory-measurements.ts`, existing support/periodic-grid modules | Exact reachable probe defaults, current components, contours, underlays, grids and endpoint routes |
| `observed_meter.py`, `collection_evidence.py` | `v6-inventory-caller-context.ts` | Original observed strip dynamics and evidence-based collection history |

### Current scope and uncertainty

The port preserves source rejection and ambiguity. A recalled movement is a hypothesis until the current scope revalidates it. A supplier relation must be necessary and uniquely supported before it contributes to an access plan. An unchanged local contact is retained as an observed result; it is not converted into an invented interaction effect. Remote changes require the original support-domain and preservation checks.

Source bounds remain explicit: the local route limits, the endpoint breadth-first search bound of 24, and the 16-record retained histories come from the original components. They are not parameters chosen for GLOB. Original interface direction priors remain revisable interface hypotheses; no palette value establishes a semantic role.

The V5 `interaction.py` mapping is **partial**. Its large production probe accepts roles, assemblies, hostile catalogues, contact catalogues, viewport data and other options that ObservedInventory does not supply. The native endpoint closure implements the defaults actually constructed by `CellProjection` and `endpoints.py`: current canonical control, measured/current quantum, known and interface directions, visited cells, ordinary/hollow/display endpoints, route ordering and reduction. It does not assert parity for the unused production branches.

Component extraction now accepts an explicit optional connectivity of four or eight. Four-neighbour extraction remains the default and retains its existing identifiers and cache keys. Eight-neighbour zones receive distinct cache keys and source zone identifiers. The existing transient-packet caller uses an explicit one-argument callback so an array index cannot accidentally become the connectivity argument.

## One acquired owner and its context

The source state contains exactly:

`tracker`, `seen_pairs`, `failed`, `access_returns`, `endpoint_memory`, `boundary_memory`, `pending_access`, `retained_effect_scope`.

The immutable native envelope has format `native.public_observed_inventory.v1`. Its `source_state` contains those eight fields. A separate `caller_context` annex contains the original meter's nine explicitly serialized fields and the collection's original retained event history. Isolated component instances use a null context annex. Restoring an envelope validates it before replacing the owner.

The common caller acquires passive families in source order: Outline, ObservedInventory, OrderedReaction, then ReactiveContact. Selected inventory actions are acquired once; foreign actions carry no invented inventory proposal attribution. Source event facts use `observed_inventory_event:<revision>`.

The consumed context acquisition also retains source order: Attention, collection observation using the prior forecast, meter observation of the actual returned frame, then View and the subsequent family acquisitions. Original collection events are retained separately in common memory. Inventory reads the current meter forecast, the common goal models and the same collection owner.

**Planning scope remains bounded.** In the original strategy, the inventory branch reads `meter.forecast()`; it does not itself observe the current frame. Planning observation belongs to `MorphologyAdapter.propose`, whose provider remains pending in the native migration. This release does not insert an eager initial observation before inventory or claim that the complete original morphology/strategic caller has been transferred. The implemented meter and collection component contracts and their actual acquisition sequence are tested separately.

## Independent source evidence

Three original-Python exporters cover distinct responsibilities:

- `export-v6-inventory-observation-reference.py`: public projection, transfer/reverse transfer, retained material, support scope, current quantum and initial-grid/endpoint measurements.
- `export-v6-inventory-helpers-reference.py`: route/dependency/boundary/contact/context helpers, with both returned values and complete argument mutations retained.
- `export-v6-inventory-family-reference.py`: original family states, policy/SRC results, current guards and consumed meter/collection context.

The independently run groups pass **440 checks**: 85 observation checks from 82 original cases, 202 helper checks from 201 cases across 21 operations, and 150 family/context reference checks plus three Kernel tests. The family fixture covers 59 family cases, 58 policy cases, 11 meter sequences, 12 collection cases and five consumed V5 strip-predicate cases. Positive Kernel cases exercise the selected family through WHY/ACT, record it once, restore its checkpoint before a fresh proposal, and verify the passive acquisition order.

Inputs are synthetic public rasters and explicitly labelled isolated component checkpoints. They include translated scenes, palette permutations, genuine positive endpoint routes, counterexamples, scope changes and restoration. Original expectations come from unchanged Python, never from native output. The contract adapters only convert public model representations such as `FrameGrid.rows`, computed bounding-box dimensions and tuple-keyed maps.

### Actual public trajectory comparison

`compare-v56-inventory-public-evidence.py` is a post-run read-only comparison. It verifies the frozen native source, campaign receipt and full command/public-packet journal. It independently reconstructs neutral observations from the actual packets and starts fresh original Inventory, Meter and Collection objects.

The passive campaign observer records actual source-facing calls, their inputs/results and their complete before/after states. It supplies no decision, state or game return to the agent. The replay covers `proposeSource`, `preservation_obligations`, `recordSource` and the meter/collection facades in actual order. Losing proposals are included because source proposal evaluation can acquire memory even when another provider wins. Nested calls are executed through the outer original method once.

Every retained prefix checkpoint is compared to the corresponding original eight-field state plus context annex. Original events and current selected outcomes are checked where present. Foreign proposals and common goal models remain the actual supplied caller context: this is not a replay of the entire original strategic caller. No identity remapping, numeric tolerance, seeded learned state or expected native action is used.

The [GLOB original-source comparison](native-campaigns-v56/final/glob-inventory-original-comparison.json.gz) passes all **90 actual source calls** and **17 complete prefix checkpoints**, over 21 independently reconstructed public observations. The calls comprise 17 preservation queries, 13 inventory proposals that abstain, 20 collection records, 20 meter observations and 20 source records. Three official epoch changes are checked. Inventory acquires no core and emits no source event on this game; this live evidence establishes passive state/context and abstention equivalence. Positive inventory proposals, transfers, access and contact acquisition are supported by the separate source reference suites.

## New game and the 40-minute rule

The immutable GLOB selection receipt starts at `2026-11-09T13:59:36.727704+00:00`, with a deadline of `2026-11-09T14:39:36.727704+00:00`. The unchanged V55 baseline completed its three-level objective at `2026-11-09T14:00:28.767120+00:00`, 52.039416 seconds after selection. This candidate therefore did not remain blocked for 40 minutes. The selection clock is not restarted when retaining or relocating evidence.

The 11 baseline evidence files are copied byte-for-byte from an isolated checkout of published V55 commit `4e581c40bfed1d238515f6327758a8e9877ba837`. Their original execution paths and timestamps remain intact. The [relocation receipt](native-campaigns-v56/baseline-evidence-relocation.json), [selection](native-campaigns-v56/candidate-selection.json) and [baseline resolution](native-campaigns-v56/baseline-resolution.json) retain provenance.

The baseline's common providers are `observed_frontier`, `fixed_origin` and `information_goal`. Previous isolated GLOB level-one evidence used imposed probes; it did not establish a qualifying cold three-level common session. This release's new trajectory is assessed against that stronger requirement.

The final V56 run finishes at `2026-11-09T14:22:33.986620+00:00`, **22 minutes 57.258916 seconds after the original selection**, before that same 40-minute deadline. Its wall time is 60.225933 seconds; these timings are provenance, not a speed benchmark. The separate [final resolution](native-campaigns-v56/candidate-final-resolution.json) resolves the pending rerun in the immutable initial ledger without rewriting it.

## Regression and publication boundaries

The frozen [release delta](native-campaigns-v56/final/validation/delta-tests-run.json) passes **702/702 tests** across the 23 explicitly named files, with zero failures, skips, cancellations or pending tests. Source and test input fingerprints are unchanged. This set includes the new source comparisons, Kernel integration, the four/eight-connectivity observer, caller, registration, checkpoints, knowledge graph, SRC interpreter and existing acquisition/priority contracts; it is not represented as the entire historical test suite.

The [production validation](native-campaigns-v56/final/validation/checks-run.json) passes TypeScript checking, entry audit, migration audit, whitespace validation and the approved production build. Its 296 recorded build inputs and native worker SHA-256 `92df3c71f51ad1140e6a929527353198bc9c0530be248e656bb344c40810121d` identify the packaged implementation.

The [declared regression cases](native-campaigns-v56/regression-cases.json) retain 12 previous trajectories: STCK, CATL, SELE, COLM, ZIPP, GRIL, LIFE, VALV, GARE, CN04, RE86 and AS66. They contain 648 commands, 660 full public packets, 1,982 animation frames, 401 acquired prefixes and 42 natural level boundaries. Expected commands are visible only to the replay host after the current native command is produced. These are recorded-return regressions and are not counted as new live victories.

All **12/12 replays pass**, with **204/204 historical comparisons** in the [regression summary](native-campaigns-v56/final/regressions/regression-summary.json). Both required passive owners are present on each of the 401 current prefixes, giving 802/802 owner-presence checks and 1,296 retained transition references across those two owners. These duplicate references are not additional physical actions; the trajectories contain 648 actions in total.

The generic evidence-presence checker accepts declared checkpoint annex bindings, preserving the prior two-field checkpoint contract by default. Inventory adds a declared `caller_context` binding; it is compared to the same current report's retained context. Presence checks do not assert equality with old family state or original strategic-caller parity.

The entry audit, migration map and six complete-migration gates retain their distinct meanings. Connected source entries and passing bounded comparisons establish progress. All complete V6 migration/parity gates remain false.

The module inventory comprises 1,369 Python modules: 145 component-verified, 118 partially transferred, 1,106 pending, and zero fully verified. The inventory package mapping separates its 15 functional modules from its empty initializer. Imported Python files are evidence dependencies and are not automatically counted as transferred ownership.

## Reproduction

Large reports are retained as exact ordered 900,000-byte parts, with per-file manifests and original SHA-256 values. The [delivery integrity receipt](native-campaigns-v56/final/delivery-integrity.json) verifies all 13 large reports, 78 parts and 65,478,127 original bytes. Each report is restored through the CLI in an initially empty temporary root and compared byte for byte. The original reports, source-comparison generator and execution receipts remain unchanged. Restore the original report paths before following their links in a fresh checkout:

```bash
python scripts/evidence-byte-parts.py restore docs/migration/native-campaigns-v56/final
```

The same final receipt confirms 232 native files, 243 frozen archive inputs, 497 source/test inputs, 296 production build inputs and seven regression execution inputs unchanged. All 1,786 original reference files also retain their pinned hashes. The transport helper supplies no game data or state to native decisions.

After installing the repository's pinned dependencies and preparing the local Python assets, use a fresh ignored evidence directory. These commands execute another independent cold native session; none accepts an expected route or a learned checkpoint:

```bash
python scripts/freeze-v53-native-source.py freeze artifacts/inventory-reproduction
python scripts/run-v53-campaign-proof.py GLOB 3 artifacts/inventory-reproduction
python scripts/compare-v56-inventory-public-evidence.py GLOB artifacts/inventory-reproduction
```

The evidence writers refuse to overwrite an existing receipt. Historical `v53` names identify the reusable proof runners, while the source manifest and runtime identity identify the actual implementation. The V56 original comparator is validated here on a successful sealed target campaign. A failed attempt with an unsealed final planning-call suffix is outside the presently validated comparison shape.
