# SNAR handoff — 2026-11-27

## Actual status

SNAR remains **5/6**. Do not count it as corrected or qualified. CGWL was completed separately and handed to the parent for main integration; its delivered cloud-browser replay was subsequently reported WIN6/6,167 actions. Root took ownership of SK48. This branch's remaining task is SNAR.

The latest SNAR production commit is `8fa6ad2b35a26c68bc42578773eb04a75ab2a1db`, durably represented by GitHub commit `5e022c09af1ef459b3f62edced87d5288611eafe`, exact tree `375d84c101b49f326ae52f72a729611e6946e532`. Local and API-created remote histories differ; their trees are identical. Do not reset a useful local checkout merely to equate their SHAs.

Repository: `yannick-fontan-1981/sra-playground`. Work branch: `fix/sic-10-continuity-20261127`. The final documentary checkpoint is the tip of this same remote branch. The temporary checkout used here was `/workspace/scratch/8b7740e8a750/continuity`; durable evidence is entirely under this directory in Git. No new correction or campaign was started after the handoff request.

## Required constraints

Read repository `AGENTS.md`. Production uses public observations only, without game IDs, level constants, fixed colors/coordinates or archived routes. Preserve evidence for acquired effects and invalidate only contradicted associations. Native prefixes are bounded by16 and the remaining budget, require each actual preceding return, stop on ambiguity/contradiction/boundary, and reconcile actual commands once in order. Use two distinct native transfer scenarios. Before integration, retain all existing global continuity cohorts and physical thresholds, and add qualified new ones.

Qualification must start at L1 in one chronological session/worker. The unchanged SNAR per-level action ceilings are `[21,29,28,44,42,35]`; active budgets are `[16000,24000,15000,24000,28000,17000]` ms. Do not raise these or shorten reasoning horizons. Serialize timed replays and large local tests with other owners. GitHub remains canonical; root handles integration on main and Site publication.

## Frozen results

All first-five wins reproduce the historical cumulative command trajectories, with16,24,23,36,35 actions,134 total. The historical final level won in29 actions,163 cumulative, but the current source has not achieved that within its17 s budget.

| Frozen production | L6 actual actions before timeout | Status |
|---|---:|---|
| `c137a9d5` |22|5/6|
| `d5ff51c4` |25|5/6|
| `81084152` |27|5/6|
| `8fa6ad2b` first run |26|5/6|
| `8fa6ad2b` isolated control |25|5/6|

The isolated control was a single specifically authorized repetition to test the concrete possibility of contention from other owners' tests. Every owner suspended tests/builds/collectors/planning. It did not improve the result. Keep both failed receipts distinct; neither is a qualification. Their `.freeze.json.gz` files prove production and budget hashes stayed unchanged.

The two latest results are `snar-strict-8fa6ad2b*.jsonl.gz`, their level files and freeze receipts. `snar-l6-decisions-compact.json` combines public decisions135–161 with these checkpoints. `run-snar-strict.py` and `run-snar-isolated.py` preserve the wrapper; run from a checkout root and set `SIC_CHECKPOINT_OUTPUT` to a new directory. They refuse to overwrite an existing receipt. No replay is currently running.

## Code and confirmed improvements

Production changes are in `src/sic/navigate-revealed-grid.ts`; `src/sic/standalone-families.ts` also adds navigation to the early observed-role recovery group. Root has independent SPOR changes in that group, so reconcile the additions when integrating.

1. An actual winning ordinary navigation step retains a completed-role witness with its exact public before/after references. A compatible next board can reuse this navigation role in the early group. Inputs, session, score, current carrier and surface must agree. Other explorers remain available.
2. Known timed ordinary walks expose bounded native prefixes. Each returned public raster updates only private per-prefix state until the single ordered reconciliation. The next guard requires the exact actual preceding reference. Each leg uses its own action and target.
3. An independently measured moving patrol occludes underlying terrain; it is no longer simultaneously learned as a static wall. True terrain contradictions still close the prefix.
4. An actually established stationary directional control is reused at the same site while a measured rail blocks the required passage. Commands144–146 form one acquired three-hold prefix after command143 establishes the effect. Charges, unique carrier, wall and current hazard premises are checked at every return.
5. A remembered rail cell may belong to a future known walk only when exactly one measured track binds it, its cadence is known, two full spatial cycles agree and all admissible cycles predict the same clear arrival. The immediate step still requires current and next-step clearance. Contradictory actual motion closes the prefix. This yields real ordinary movement150–157 under one decision.
6. Hazard avoidance already selected a safe known detour at158, but the prefix builder kept the discarded initial path. `selectedNavigationPath` now retains the path whose first action, target and optional entry match the actual selected access. Commands158–159 form one real two-step prefix, stopping before the unknown marker landing160. Priority and command choice are unchanged.

All69 targeted tests and `npx tsc --noEmit` passed at8fa6ad2b. Relevant tests are `sic-grid-completion-role`, `sic-timed-grid-continuity`, `sic-patrol-terrain-continuity`, `sic-navigate-revealed-grid`, `sic-revealed-grid-continuity`, `sic-grid-reassociation`, and `sic-grid-mechanism-reassociation`. Two native transfer variants reflect positions, remap colors, change the carrier shape and reverse horizontal commands. Native duplicate-carrier and changed-next-cell runs close after exactly one actual detour command and retain unrelated completed-navigation evidence.

## Public evidence and next diagnosis

`first-loss.full-horizon.json.gz` captures the earlier lost navigation role. `snar-level6-full-horizon-c137a9d5.json.gz` contains the134 real winning L1–5 commands and public L6 returns135–156. `snar-observed-tail-161.json.gz` replays all156 already recorded commands from L1, verifies every raster/archived animation, and obtains only the five missing public returns157–161 from commands already executed by the strict run. It does not instantiate an agent or choose new commands. `snar-tail-native-81084152.json.gz` then reconciles those observations through the native navigation family; its proposals/tickets/seals are diagnostic, not a fresh qualification.

The real tail is:157 finishes the eight-step ordinary prefix;158 moves to the first known detour cell;159 moves to the second;160 enters a previously unmeasured directional marker and is ejected to an unexpected landing;161 probes an unknown ordinary cell. The next native proposal would probe another unknown cell before the visible goal, but that proposal is not a retained actual backend return.

One rejected hypothesis must stay rejected unless new evidence changes it: earlier blocked moves at L2/L3/L4 reveal previously unknown walls only after the contact. `snar-blocked-actual-signatures.json` shows no static wall signature before them. They cannot support the proposed before-and-after visible-wall control transfer to143. No code was written for this transfer. The actual first same-site control remains143.

Root suggested examining earlier directional-marker returns for a transferable relative landing relation. This has **not** been proven or implemented. `last.landings` currently retains only current-board entry→landing coordinates. Any replacement must learn a relation from actual marker trajectories/landings, retain their proof, independently remeasure a compatible marker and require every necessary path/stop cell to be visible. Do not infer an unobserved bounce or a universal slide rule from a single outcome. Public inspection indicates marker136's landing path is unknown before entry, so it must remain an experiment. At141, the cells beyond marker110 are already visible and a rail occupies the next cell; this is a possible evidence-backed association to investigate. At160, the actual landing cell is not already known, so do not declare it predictable merely to extend the prefix.

Another unimplemented possibility is a bounded experiment followed by an already justified known suffix, with native guards requiring the actual first return before any continuation. This would require explicit first-loss evidence and native counterexamples; no authorization to replace unknown path cells with assumed free cells follows from this note.

## Physical gate drafts

`collector-drafts/` preserves the passive public-raster observer, its five tested evidence cases and an unintegrated physical contract. They do not affect production. The contract has not been validated on a full collected campaign and no SNAR physical minima are qualified. Once a frozen source really wins6/6, wire the hooks, collect a full chronological campaign, bind the effect frames/tickets, verify stationary holds and known walks separately, and add the cohort without relaxing old thresholds. The draft README calls out remaining contract work.

Keep all failed receipts and public counterexamples. Do not describe progress as completion until strict6/6, the shared gate, main integration, Site publication and the requested delivered-UI replay are actually verified.
