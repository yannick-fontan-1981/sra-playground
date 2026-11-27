# Acquired controls: matching edges and public panel continuation

This lot recovers two independently diagnosed fixes onto main `22e60471623fde25bde050ae633e54417f878a2b`. The production changes remain generic: neither game identifiers, level numbers, absolute palettes nor recorded command routes select an action.

## Reproduced strict result

The ordinary chronological runner starts each game at level 1 with SIC, one worker and the original per-level reference budgets. No passive collector is enabled in this qualification. Source commit `828a45a563986f63bbee410c57374931e4e2e937` stayed unchanged throughout the replay. Its identical GitHub tree is commit `066ce6ba167a59d639fddc9237667bead3113815`.

| Campaign | Official result | Commands by level | Total |
| --- | --- | --- | --- |
| GRAV | 6/6 | 11, 32, 6, 8, 13, 10 | 80 |
| DC22 | 6/6 | 22, 44, 45, 76, 185, 258 | 630 |

All six complete public-return prefixes, every command/effect record and the final trace hash match each recovered branch's earlier qualification exactly. All action and active-time ceilings remain unchanged. DC22's final official score arrives at 287,381 ms under its 455,000 ms ceiling. GRAV's final score arrives at 848 ms under its 8,000 ms ceiling. These numbers describe the strict replay only; collector instrumentation is separately identified.

`strict/summary.json` contains the per-level caps and times, local/durable source mapping and compressed-file hashes. The original first-failure evidence, native role-transfer cases and rejected priority counterexample remain in the existing `sic-edge-switch-transfer-20261127` and `sic-public-panel-priority-20261127` archives.

## Reused facts and limits

The matching-edge role accepts a newly observed attachment control in the current epoch after its public command/return pair. It continues only through already learned directions or toggle effects, and an unknown toggle remains unitary. Reuse in a later level still requires the established two-way attachment role and its prior official success.

The public-panel role preserves a reachable preparation following an observed panel effect when the same current actor, controls, panel context, epoch and scope are present. Its priority follows bound specialists and precedes unrelated probes. An earlier attempt that moved it before the specialist lost an existing remote-support composition; that rejected run is preserved in the earlier archive.

The passive collectors independently remeasure public pieces, obstacles, attachment state, actor positions and field/panel changes. They keep predictions and measured returns separate, retain original role references, and sample acquired state only after the actual native reconciliation. Missing and ambiguous observations remain missing. An official level boundary is recorded explicitly; a predicted old board is never substituted for the new public scene.

## Passive physical contract

The second immutable campaign uses collector source `f3de0a0646dbd7b26d3c0448da1573322441a90b`, saved with an identical tree on GitHub as `5d8f6ef5df0e5a862233e4e8ae7488913c15b8a8`. All production hashes equal the strict replay. Both complete public trajectory hashes equal the strict runs, including every returned animation frame. `continuity/` stores the raw native tickets, measured public pixels, manifests and checksums; its runtime is not used as timing qualification.

| Protected effect | Actual executed evidence |
| --- | --- |
| GRAV L3–4 role reuse | Every directional command retains its acquired reference pair; actual measured pieces and fixed obstacles agree with the native return. |
| GRAV L5 continuous settling | One seven-command prefix, six continued commands, one final reconciliation. The newly tested inverse attachment command is separately unitary before this prefix. |
| GRAV L6 acquired attachment composition | One ten-command prefix, nine continued commands, two attachment toggles already acquired in L5, one final reconciliation and the official score. |
| DC22 L1–3 existing compositions | Continued-command counts 7, 22 and 22. Mixed movement/click series remain required at L1 and L3. |
| DC22 L6 physical preparation | Five movements at commands 20–24 followed by the real contact at 25; three movements at 30–32 followed by contact 33; four movements at 116–119 followed by contact 120. These are three distinct transfers, with nine continued preparation movements. |

DC22 L4–5 remain unitary. L6 has 80 continued commands across all native series, but the physical preparation counter credits only the three completed approaches immediately followed by their separately executed acquired contact. Later wall trials may end a prefix with a contradiction, and some later cursor images are partially occluded. Those raw returns are preserved and the generic native contract enforces a stop and one reconciliation; they are not substituted with predicted positions or credited as completed physical preparations.

The gate now covers all six levels of each campaign under their unchanged action ceilings. DC22 moves from the shared one-level cohort to its own full campaign, retaining the original L1 mixed-series requirement. GRAV adds a complete cohort. Relative to main `22e60471`, this protects 126 levels in 20 games and 19 cohorts before the other concurrent lots are added.

Four passive observer tests and 22 contract tests pass. The contract mutations reject foreign or reversed role references, a missing actor, an ambiguous actor, forged pixels, an unacquired attachment direction, continued execution after contradiction, lost reconciliation, omitted or physically ineffective contact, changed click coordinates, loss of the earlier mixed-series witness and incomplete/reset campaigns. The original native role-transfer tests are included in the CI contract job.

## Integration status

Both strict campaigns, the two complete passive campaigns, their 12-level gate checks and the targeted evidence/contract tests pass. The complete combined `npm run test:sic-continuity` gate remains the integration prerequisite. No main merge, Site publication or delivered-viewer qualification is claimed in this branch checkpoint; root coordinates those final steps.
