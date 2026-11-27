# First correction lot: viewer receipts, 2026-11-27

## Frozen delivered source

- Repository: `yannick-fontan-1981/sra-playground`.
- Exact main source: `052d82dec4e92f4eef5fa90ab0c2a7fd3a5125da` (PR141 first correction lot).
- Parent deployment receipt: Site209, publication succeeded/ready on the exact source above.
- Viewer exercised: Sites managed preview at `http://127.0.0.1:4173/`, opened through CUA cloud Chrome.
- Main checkout: `/workspace/sites/sra-playground-resume-20261127/.sites-checkout`.
- The daemon owns this preview. No second server was started, no host/port was changed, and no source files in the main checkout were modified during these viewer campaigns.

## Observed results

| Game | Viewer result | Completed levels | Actions by level | Total actions |
| --- | --- | --- | --- | --- |
| GRAV | `The game reports WIN.` | 6/6 | 11, 32, 6, 8, 13, 10 | 80 |
| CGWL | `The game reports WIN.` | 6/6 | 15, 16, 15, 18, 61, 42 | 167 |
| SPOR | Deliberately paused after L5, before L6 | 5/6 | 14, 14, 17, 17, 29 | 91 |
| DC22 | Not started in this viewer session | — | — | — |
| WEAV | Not started in this viewer session | — | — | — |
| LS20 | Not started in this viewer session | — | — | — |

Each game began at level1 with SIC selected and zero counters. Each campaign used one continuous reasoning session and only the visible **Run to next level** control. No reset, undo, manual game input, or new reasoning session occurred within a campaign. The per-level receipt files record the visible panel counters and observation timestamps. GRAV and CGWL match their previously archived strict qualification action counts exactly.

The UI check is separate from the strict original-budget runner and physical continuity contracts. It confirms the delivered interface and final official WIN for the two completed campaigns; it does not replace those qualifications. A partial SPOR receipt is not a complete viewer qualification.

## Continuation checkpoint

The user requested a prompt to continue in Codex during SPOR L5. The already running level was allowed to finish, and no subsequent level or game was started. At `2026-11-27T14:52:47.472Z`, the visible panel reported `Level completed.`, `91 actions`, `5 levels solved`, and `91 completed plans`. The current board is level6.

The live CUA cloud Chrome tab was marked for handoff and its browser activity closed correctly. Its last observed URL is `http://127.0.0.1:4173/?game=SPOR&level=6`. The browser binding was Chrome id1, tab id1. If this exact browser session remains available, continue by clicking **Run to next level** once; preserve the existing SIC session. Do not reload the tab, reset, select the game again, or press **New reasoning session**.

A fresh Codex process may not inherit this cloud browser session. The URL alone does not contain learned reasoning state. If the preserved session is unavailable, run SPOR afresh from level1 in one continuous SIC session and keep this receipt as an explicitly partial earlier attempt. DC22, WEAV and LS20 still need complete viewer campaigns from level1. Source and published version must be reverified before claiming any later viewer result belongs to this frozen source.

Expected strict totals, for comparison only: SPOR6/6=121 actions `[14,14,17,17,29,30]`; DC226/6=630 `[22,44,45,76,185,258]`; WEAV6/6=199 `[27,28,24,40,40,40]`; LS20 has seven levels. Record actual observed counters and WIN, do not substitute these expectations for receipts.
