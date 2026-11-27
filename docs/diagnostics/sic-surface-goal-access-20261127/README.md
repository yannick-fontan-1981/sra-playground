# Public surface goal access — first unresolved decision

The previous partial repair is retained: a public crossing executed by another family preserves the source surface, destination and observed passage. Its strict chronological ETAG checkpoint still wins only 3/6 and reaches the original level-4 limit of 80 commands.

## Public diagnosis before the next production change

The archived 220 native commands were replayed from level 1 through the public game interface, with no SIC solver and no internal game state. The complete public-return hash, including animation frames, is identical to the earlier native run. Reconstructing the surface map from those public observations reproduces all 80 level-4 decisions of the current planner. `public-map-before.json.gz` preserves those observations, maps and choices; `replay-map-before.mjs` reproduces them when checked out at the recovered partial source `947a1dc9` (original production `85883aa7`).

The first useful differing decision is L4 command 30. The acquired navigation role has just entered a measured surface through a known opening. Three surfaces, their oriented openings and the destination are already visible in memory. The destination sits immediately beyond an opening with a visibly compatible opposite opening on another measured surface. The existing planner selects the nearest untested opening elsewhere and reverses the last crossing. It cannot rank the already visible sequence of compatible openings leading toward the destination because it treats each untested opening independently.

This is a planning-priority loss. The known movement role and the observed passage remain present; the map and return were not lost. An offline graph of only these public cells, known transitions and visibly compatible opposite openings exposes a candidate route of 30 commands from this decision, containing four as-yet-unobserved crossings. These crossings are hypotheses to test, not acquired edges or guaranteed destinations.

## Reuse and refutation conditions

The navigation role was acquired through native commands and the official first-level score. It is reusable under the current role witness, one measured actor, compatible surface geometry, directional commands, epoch and score. A known route may be committed only through steps whose visible support or acquired passage remains present. The first untested crossing closes the prefix after its actual return, which determines the destination. An unexpected actor position or surface, ambiguous/missing actor, changed opening, score boundary or budget limit stops execution. Independent known facts survive a contradicted candidate crossing.

The planned correction will prioritize a route through compatible visible openings when its last observed destination is otherwise disconnected, while preserving the conservative route when all its transitions are already known. No game identifier, level, fixed palette, coordinates or witness route will select production behavior. Qualification and native transfer tests remain pending in this diagnosis checkpoint.
