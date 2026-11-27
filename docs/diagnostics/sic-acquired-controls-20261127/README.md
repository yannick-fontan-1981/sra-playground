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

## Integration status

The two strict campaigns pass. Passive continuity collection, contract calibration and the complete integration gate are still in progress in this checkpoint. No main merge, Site publication or delivered-viewer qualification is claimed here. Root coordinates those steps after the physical contracts are complete.
