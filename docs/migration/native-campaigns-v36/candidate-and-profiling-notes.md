# Public candidate selection and bounded CPU profiling

## Candidate: TU93, first three levels

`tu93-candidate-provenance.json` records the selection before any new game campaign. The input is the existing public gallery, not an agent journal or hidden game state. Its three decoded frame hashes and atlas hash match the gallery manifest.

The original component and sprite description functions reveal the same alternating square geometry in the first three previews:

| Public initial preview | Square side / full step | Geometric nodes / links | Multicolored / uniform overlays |
| --- | --- | --- | --- |
| Level 1 | 3 / 6 | 31 / 32 | 1 / 1 |
| Level 2 | 3 / 6 | 12 / 13 | 2 / 1 |
| Level 3 | 3 / 6 | 23 / 28 | 4 / 1 |

The three additional same-histogram overlays in level 3 have cardinal singleton markers and fit the original bound of three additional occupants. This supports choosing TU93 for a faithful test of the new family. It does **not** establish which overlay is controlled, what the commands do, whether marker exclusion predicts the game, whether contact removes an occupant, or whether any level can be completed under the source budgets. Those claims require actual public transitions.

No new game actions, priming actions, supplied control translations or hidden solution reads were used for selection. Original V6 `measure` with no learned controls returns no route-bearing description because it requires at least one route labeled by available, compatible controls. The selection therefore checks geometry only and does not manufacture translations to obtain a positive result.

Previously retained isolated-family fixtures are weaker alternatives for the user's current request: MEMO's three levels do not reproduce through the common caller, AS66's three levels use 16 explicit exploratory inputs, and GLOB has only one level with priming. They are not three new levels solved by the unprimed integrated agent.

## Profile the planned campaign once

After freezing product source and passing the integration checks, the campaign owner can include the Node sampler in the planned real campaign:

```sh
node --cpu-prof --cpu-prof-dir=/tmp/logos-v36-profile --cpu-prof-name=tu93.cpuprofile tests/v6-agent-native.smoke.ts TU93 3 docs/migration/native-campaigns-v36/tu93-three-levels.json
```

Create the profile directory before invoking the command. The sampler does not change source limits, choices or the product clock. Its overhead still affects elapsed time, so this single run is a diagnostic rather than a before/after speed comparison. Do not use a larger target or additional exploratory runs merely to obtain the profile.

The standalone analyzer reads the resulting file without importing the agent or starting a game:

```sh
node scripts/analyze-v6-native-cpu-profile.mjs /tmp/logos-v36-profile/tu93.cpuprofile docs/migration/native-campaigns-v36/tu93-cpu-summary.json
```

It provides a disjoint context partition, a leaf-category partition, the main sampled leaf functions/modules, and separately labeled overlapping contexts. Recognized contexts include common acquisition (`NativeCompositionAuthority.acquire` and the common caller acquisition methods), other family/reasoning work, shared memory, explicit campaign inspection, game Python/Wasm, and campaign validation/driver work.

Async ancestry can disappear from CPU stacks. Common acquisition is consequently a visible-stack lower bound; shared utilities without a visible owner remain separate. `inspectKnowledge` is just one accessor: the campaign's `read` closure hydrates retained nodes for proof, and other assertions may remain in the generic helper category. Inclusive context totals overlap and must not be added.

Use the game report's `activeSeconds` and per-request `elapsedMs` for decision-budget evidence. The process profile also contains initialization, game hosting, proof checks, module loading, scheduler delay and garbage collection. The existing `profile-v6-native-retention.ts` deliberately runs GC outside decisions and is suitable for retained-memory diagnosis, not time comparisons.

## Validation of these audit artifacts

- Recomputed all three TU93 frame hashes and the atlas hash from public gallery data.
- Checked analyzer syntax with Node.
- Exercised eight attribution cases in a synthetic CPU profile outside the repository, including acquisition with nested shared memory, inspection with hydration, game Wasm, helper validation, a family, garbage collection, idle, and other native coordination.
- Verified exact conservation of sampled interval totals in the disjoint partition and separate overlapping-context totals.

These checks did not execute a game or produce a performance-improvement claim. The prior M0R0 comparison remains unchanged: no reduction in active cost was demonstrated for its first two levels.
