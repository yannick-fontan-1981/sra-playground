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

## Completed viewer replays after resumption

The earlier SPOR tab was unavailable in Codex desktop. A fresh session started at L1 on the published Site 209 and won all six levels in 121 actions. The earlier partial receipt remains the record of its own session.

Site 210 and GitHub main use `4313d7ce41505cece5f397dc8125b430697176ed`. The same production build served locally on port 4173 and on the private Site 210. Both surfaces loaded `/assets/index-5nnSgotL.js`. Each row began at L1 with zero actions in SIC and used only **Run to next level** within a single session. All final panels displayed `The game reports WIN.`.

| Game | Viewer | Levels | Actions |
| --- | --- | ---: | ---: |
| SPOR | Published Site 209 | 6/6 | 121 |
| DC22 | Local build of Site 210 | 6/6 | 630 |
| WEAV | Local build of Site 210 | 6/6 | 199 |
| LS20 | Local build of Site 210 | 7/7 | 393 |
| LF52 | Local build of Site 210 | 10/10 | 713 |
| SK48 | Published Site 210 | 8/8 | 348 |
| ETAG | Published Site 210 | 6/6 | 274 |

The per-game receipts retain the visible counter and the UTC observation time at every level transition. The original GRAV and CGWL viewer receipts are above.

## Final two corrections

SNAR won 6/6 in 163 actions on both the private Site 211 and the local build of `53480b31192831f15a5d0550eb72a3e699c43911`. PR143 passed all 28 checks, including 168 protected levels.

WA30 won 9/9 in 613 actions on both the private Site 212 and port 4173. Each run began at level 1 in SIC with zero actions, then used only **Run to next level** within one session. Both served the exact main commit `0fe417b2e91bb8ca15573e82b79b7081157aeb37`. Both used the bundle `/assets/index-B8P9XO58.js` and displayed `The game reports WIN.`. The Site retained its owner-only access policy.

PR144 passed all 38 checks on the same Git tree. The strict campaign confirmed all ten games and the continuity gate validated 170 levels across 26 games and 25 cohorts. The successful and failed qualification receipts remain on [the PR144 audit branch](https://github.com/yannick-fontan-1981/sra-playground/tree/39236e89787f786900c62bd497bd115c00a999d3/docs/diagnostics/sic-10-integration-20261127).

All 27 corrections from the original campaign are qualified and integrated. The qualification record combines multiple revisions. The original complete campaign remains the recorded 80/107 result for a single revision.

## Campaign of 107 games after the SNAR and HOLE fixes

The full campaign on `4be368a365a6347fb551bb4c73dd5756413bb34e` completed 107/107 games and won and reconciled 692/692 levels under the original ceilings. GitHub took 14 minutes 30 seconds with 24 shards and a measured peak of 16 simultaneous shard jobs. [Campaign evidence](https://github.com/yannick-fontan-1981/sra-playground/tree/e36b550cfcaa79f5ee210694a8569cdf47265323/docs/diagnostics/sic-107-4be368a3-20261127)

PR145 passed 38 checks, including continuity on 170 levels. Integrated main `d0e7527ca8033bd805a6d7a8bb021eff62e87021` and the tested commit have the same tree. The integrated SHA was deployed to private Site 213 and rebuilt locally on port 4173. Both surfaces served `/assets/index-CXRgbhOv.js`. The local replays began on the identical build of the campaign SHA while the last PR check was in progress.

Each game won in one SIC session starting at level 1 on each surface. SNAR won 6/6 in 163 actions, and HOLE won 6/6 in 78 actions. The exact counts and timestamps are in [the Site 213 viewer receipt](SNAR-HOLE-complete-site213.json).
