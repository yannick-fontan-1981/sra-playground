# Public surface goal access — first unresolved decision

The previous partial repair is retained: a public crossing executed by another family preserves the source surface, destination and observed passage. Its strict chronological ETAG checkpoint still wins only 3/6 and reaches the original level-4 limit of 80 commands.

## Public diagnosis before the next production change

The archived 220 native commands were replayed from level 1 through the public game interface, with no SIC solver and no internal game state. The complete public-return hash, including animation frames, is identical to the earlier native run. Reconstructing the surface map from those public observations reproduces all 80 level-4 decisions of the current planner. `public-map-before.json.gz` preserves those observations, maps and choices; `replay-map-before.mjs` reproduces them when checked out at the recovered partial source `947a1dc9` (original production `85883aa7`).

The first useful differing decision is L4 command 30. The acquired navigation role has just entered a measured surface through a known opening. Three surfaces, their oriented openings and the destination are already visible in memory. The destination sits immediately beyond an opening with a visibly compatible opposite opening on another measured surface. The existing planner selects the nearest untested opening elsewhere and reverses the last crossing. It cannot rank the already visible sequence of compatible openings leading toward the destination because it treats each untested opening independently.

This is a planning-priority loss. The known movement role and the observed passage remain present; the map and return were not lost. An offline graph of only these public cells, known transitions and visibly compatible opposite openings exposes a candidate route of 30 commands from this decision, containing four as-yet-unobserved crossings. These crossings are hypotheses to test, not acquired edges or guaranteed destinations.

## Reuse and refutation conditions

The navigation role was acquired through native commands and the official first-level score. It is reusable under the current role witness, one measured actor, compatible surface geometry, directional commands, epoch and score. A known route may be committed only through steps whose visible support or acquired passage remains present. The first untested crossing closes the prefix after its actual return, which determines the destination. An unexpected actor position or surface, ambiguous/missing actor, changed opening, score boundary or budget limit stops execution. Independent known facts survive a contradicted candidate crossing.

The planned correction will prioritize a route through compatible visible openings when its last observed destination is otherwise disconnected, while preserving the conservative route when all its transitions are already known. No game identifier, level, fixed palette, coordinates or witness route will select production behavior. Qualification and native transfer tests remain pending in this diagnosis checkpoint.


## First goal-route candidate: partial strict result

Local source `2db8c024206f02ee976a732cce59c9f687c6bfc2` is preserved remotely as `050ca249d3a43a528acf44c88b759cc170d502cc`, exact tree `088eb1b242ad7489824ee42744647542d586c9e1`. The immutable standard chronological runner preserved every original 80-command / 90-second level limit and all source hashes. It won L1–L4 in 7, 50, 52 and 59 commands, then stopped at L5 with 80 commands and no score. This is **4/6, not a complete qualification**. The raw runner results and source manifests are in `strict-partial-2db8c024/`.

The public replay of all 248 commands is byte-for-byte identical in its full return digest, including animations. `public-map-level5-before.json.gz` contains the 80 L5 observations and reconstructed maps. The known roles and observed returns remain valid. The first entries at commands 3, 20 and 32 reveal dead-end components; after returning, the next reachable opening enters the useful component on the same new surface. All six surfaces are visible after command 32. The measured graph then exposes a 49-command candidate route to the known goal.

A separate priority defect becomes concrete at command 53: with 28 commands left and a 29-command goal route, the search discards the goal and chooses a nearer unrelated opening. The action budget is an execution cap, not evidence that the observed goal or its route ceased to exist. The finite observed graph is therefore searched independently of the execution cap, while the returned native prefix remains bounded by the remaining command count, the 16-command native maximum, and the first unknown crossing. This preserves the objective without changing any qualification budget. It does not by itself establish a complete L5 victory; the earlier exploration choices remain under investigation.

## Observed continuation contexts

The public L1-to-L5 returns expose a reusable distinction before the failing level. At global command 8 (L2's first command), a measured passage has visible support opposite its opening on the source surface; its actual arrival component offers another opening. At global command 13, a different visible context has no such support, and its actual arrival component has neither another opening nor the destination. These observations establish evidence for ranking a future experiment. They do not establish any unobserved destination or guarantee a crossing outcome.

The candidate retains the first actual before/after reference pair for each observed combination of relative opening context and onward/no-onward outcome. The feature is defined relative to the commanded opening and the acquired support role; it uses no absolute direction, palette, coordinate, floor identity or level. The rule is symmetric: either context can be preferred when its observed returns all offer continuation and the other context has a witnessed dead end. One contrary return removes that preference; the earlier role, actual passages and independent evidence remain. A known goal route still takes precedence. An experiment remains unacquired and closes the native prefix at its first actual crossing.

Two native tests start at L1, establish the original role through official completion, execute both L2 observations, then reuse their original references on the first useful subsequent decision. The second test mirrors the rooms, recolors the palette, relocates cells and changes directional commands. Both select the independently reachable opening associated with onward returns, continue across the already acquired return passage without a reasoning restart, and stop/reconcile immediately on a contradictory movement. The existing native ambiguous-actor cases continue to reject acquisition and preserve independent evidence. A symmetric counterexample test demonstrates that the opposite context can be preferred and that a contradictory outcome removes the preference. Full chronological qualification of this second candidate remains pending.


## Complete strict candidate, unchanged original budgets

The immutable standard chronological runner on local `e531143b7d39502e8b06a9de92d65cbe93b780fc` (durable GitHub `0b6bdaad0db6cb55e4ed520a7bca5ea4670f833d`, exact tree `92c6923459f285c77ab2ed096873472cf8b66d79`) completed **6/6** from L1 with **274 commands: 7, 35, 40, 46, 66, 80**. Every level retained the original fallback ceiling of 80 commands and 90 active seconds. L6 uses exactly its original command ceiling; its active solver time was 23.202 seconds. There were zero resets or undo actions and 274 commands with native authority. The wrapper ran from 14:14:19.449 to 14:15:34.878 UTC on 2026-11-27 and confirmed that all tracked source hashes and the source commit remained unchanged. Full public-return digest: `07b73e6e24a00c5f06ad367675c145e59bac9681d2e1911becb12e7dfb537baa`. Raw results and manifests are under `strict/`.

The 25 role/route/native tests and TypeScript check passed before this run. The new passive observer independently locates the public actor and the surface indicator, retains captured pixels and original role references, and reads acquired state only at native closure. Its three unit tests pass, including missing/ambiguous actors, stationary contradictory returns and separation of predictions from measurements. The full physical collector and per-level continuity gate are the remaining integration prerequisites. The strict success alone does not claim a published or interface-reproduced result.

## Independent review and scope restoration

Independent review confirmed that planning does not acquire a passage or its continuation context, and that consumed context proofs are filtered to the current observation scope. It also found a narrow restoration case: globally deduplicating context/outcome pairs could let a retained foreign-scope pair prevent reacquisition of the same pair in the current scope. Deduplication now includes the observation scope. Foreign evidence remains retained, while actual current returns establish their own proof pair; only those current pairs enter a proposal's evidence. Two additional native restoration cases verify this with the real L1 acquisition sequence and two geometric variants. Stationary and ambiguous subsequent returns both close the prefix and preserve independent facts.

This follow-up changes only the scope test in production. The 6/6 strict archive above remains explicitly attached to `e531143b`, before this narrow repair. Physical collection uses the repaired candidate and compares its entire command/return trajectory with that archive. The combined integration strict job is responsible for qualifying the final production tree before main integration.


## Complete physical continuity proof

The passive full campaign ran on local `be09f7e504da3f429698ffdb47ce8b8514109a1e` (GitHub `465c41764a014f3256b0bf9f17e1781f83676230`, exact tree `cd94653289b49439c7e805eda029efed1ea1b29e`) from 14:34:55.518 to 14:36:08.130 UTC. Its source remained frozen and clean. All 274 commands and every public frame, including animation frames, match the strict campaign exactly after the narrow scope repair. No command or active-time qualification limit was changed. The archived collector is passive and makes no additional active-time claim.

| Level | Commands | Continued native commands | Passages within series | Already acquired passages within series | Continued preparation moves | Passages with continuous preparation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| L1 | 7 | 2 | 0 | 0 | 0 | 0 |
| L2 | 35 | 29 | 5 | 1 | 25 | 4 |
| L3 | 40 | 33 | 5 | 0 | 28 | 5 |
| L4 | 46 | 37 | 7 | 0 | 30 | 7 |
| L5 | 66 | 55 | 9 | 0 | 46 | 9 |
| L6 | 80 | 67 | 11 | 0 | 56 | 11 |

The contract verifies actual native ticket identity, ordered scope-bound evidence, the independently located actor and public surface indicator, raw frame digests, translation under the observed directional role, paired openings and actual arrival after each crossing. Unknown crossings carry no acquired destination before their actual return and close the prefix. Known crossings match the retained passage. Acquisition is read only at final native closure. Official completion additionally requires the commanded contact with the visible goal and the resulting acquired score. L1's single contradicted trial is retained as a contradiction and never counted as physical continuity. Two foreign-family unitary commands remain in the full public trajectory; the 272 surface-owner receipts are measured independently.

This protects 223 continued native commands, 37 real passages inside bounded series (one already acquired passage), and 185 continued preparation movements before 36 actual passages. Preparation counters restart after each crossing; movement elsewhere cannot compensate for a lost contact. The per-level gate scales each measured requirement against its own command baseline and preserves every original 80-command ceiling. The new `surface-routes` cohort runs ETAG from L1 through L6 with one native worker. Existing cohorts and thresholds remain unchanged.

All 30 targeted role/route/observer checks pass, including the two scope-restoration scenarios. Twenty additional contract checks accept the complete archive and reject altered native identity, intermediate reconciliation, continued contradictions, stale/foreign/future evidence, missing or forged physical measurements, predicted-but-unexecuted movement, incompatible openings, early or missing acquisition, invented known passages, missing goal contact, incomplete campaigns and resets. The complete multi-game continuity suite and combined-source strict CI remain required before integration; publication and delivered-interface reproduction are coordinated separately.
