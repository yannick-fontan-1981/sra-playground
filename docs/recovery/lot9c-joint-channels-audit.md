# Lot 9C `joint_channels` — audit de récupération GitHub

Généré le `2026-11-13T03:27:29.065703+00:00`.

## Règle d’admission

Cet audit recherche des preuves durables. Un nom, une mention documentaire ou un ancien test ne suffit pas à admettre une implémentation historique. Aucun comportement n’est déduit du seul nom `joint_channels`.

## Périmètre scanné

- refs distantes accessibles : **85** ;
- arbres Git uniques : **82** ;
- branches aux noms potentiellement pertinents : **60** ;
- historique des messages de commit ;
- historique des patches avec `git log -G` ;
- sources, tests, scripts, documentation et métadonnées textuelles.

Termes exacts et variantes : `joint_channels`, `joint channels`, `joint-channel`, `joint channel`, `jointChannels`, `lot9c`, `lot 9c`, et mentions `9C … joint`.

## Résumé brut

- noms de fichiers correspondants : **12** ;
- lignes de contenu correspondantes : **865** ;
- hits dans du code produit : **0** ;
- hits dans des tests : **14** ;
- hits documentaires/scripts/métadonnées : **851** ;
- messages de commit correspondants : **8** ;
- commits détectés par recherche de patch : **19**.

### Hits dans du code produit

Aucun hit.

### Hits dans les tests

- `tests/lot9b-official-performance-proof.test.mjs`:40 — `origin/recovery/lot9b-official-performance-qualified-20261112`
  - `assert.equal(proof.disposition.nextLot, '9C joint_channels');`
- `tests/lot9b-official-performance-proof.test.mjs`:52 — `origin/op01-op31-browser-addressed-acquisition-20261113`, `origin/recovery/site109-reconstruction-20261112`
  - `assert.equal(proof.disposition.nextLot, '9C joint_channels');`
- `tests/lot9c-joint-channels-audit.test.mjs`:5 — `origin/recovery/lot9c-joint-channels-audit-20261112`
  - `const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';`
- `tests/lot9c-joint-channels-audit.test.mjs`:6 — `origin/recovery/lot9c-joint-channels-audit-20261112`
  - `const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';`
- `tests/lot9c-joint-channels-audit.test.mjs`:12 — `origin/recovery/lot9c-joint-channels-audit-20261112`
  - `test('Lot 9C audit counts remain internally consistent', async () => {`
- `tests/lot9c-joint-channels-audit.test.mjs`:45 — `origin/recovery/lot9c-joint-channels-audit-20261112`
  - `test('every joint_channels contract field remains explicitly unproven', async () => {`
- `tests/lot9c-joint-channels-audit.test.mjs`:59 — `origin/recovery/lot9c-joint-channels-audit-20261112`
  - `assert.match(text, /No semantics inferred from the name joint_channels/);`
- `tests/lot9b-official-performance-proof.test.mjs`:52 — `origin/recovery/lot6c-c7-performance-qualification-20261113`
  - `assert.equal(proof.disposition.nextLot, '9C joint_channels');`
- `tests/lot9b-official-performance-proof.test.mjs`:52 — `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`
  - `assert.equal(proof.disposition.nextLot, '9C joint_channels');`
- `tests/lot9c-joint-channels-audit.test.mjs`:5 — `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`
  - `const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';`
- `tests/lot9c-joint-channels-audit.test.mjs`:6 — `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`
  - `const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';`
- `tests/lot9c-joint-channels-audit.test.mjs`:12 — `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`
  - `test('Lot 9C audit counts remain internally consistent', async () => {`
- `tests/lot9c-joint-channels-audit.test.mjs`:45 — `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`
  - `test('every joint_channels contract field remains explicitly unproven', async () => {`
- `tests/lot9c-joint-channels-audit.test.mjs`:59 — `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`
  - `assert.match(text, /No semantics inferred from the name joint_channels/);`

### Hits documentaires, scripts ou métadonnées

- `docs/migration/v6-delivery-roadmap.md`:129 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `### 4.3 9C — `joint_channels``
- `docs/migration/v6-delivery-roadmap.md`:270 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `| 9C `joint_channels` | open | after shared infrastructure stabilizes |`
- `docs/recovery/lot9b-github-recovery-20261112.md`:26 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `- JointChannels implementation;`
- `docs/recovery/lot9b-restart-assessment-20261112.md`:114 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `- `joint_channels`;`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432 — `origin/recovery/lot9b-region-public-action6-probe-20261112`
  - `D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mir`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/op01-op31-c0-c7-audit`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/op01-op31-c0-c7-audit`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/op01-op31-c0-c7-audit`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/op01-op31-c0-c7-audit`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421 — `origin/op01-op31-c0-c7-audit`
  - `Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432 — `origin/op01-op31-c0-c7-audit`
  - `D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mir`
- `docs/migration/v6-delivery-roadmap.md`:129 — `origin/op01-op31-browser-agent-controller-20261112`
  - `### 4.3 9C — `joint_channels``
- `docs/migration/v6-delivery-roadmap.md`:270 — `origin/op01-op31-browser-agent-controller-20261112`
  - `| 9C `joint_channels` | open | after shared infrastructure stabilizes |`
- `docs/recovery/lot9b-github-recovery-20261112.md`:26 — `origin/op01-op31-browser-agent-controller-20261112`
  - `- JointChannels implementation;`
- `docs/recovery/lot9b-restart-assessment-20261112.md`:114 — `origin/op01-op31-browser-agent-controller-20261112`
  - `- `joint_channels`;`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/op01-op31-browser-agent-controller-20261112`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/op01-op31-browser-agent-controller-20261112`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/op01-op31-browser-agent-controller-20261112`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/op01-op31-browser-agent-controller-20261112`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421 — `origin/op01-op31-browser-agent-controller-20261112`
  - `Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432 — `origin/op01-op31-browser-agent-controller-20261112`
  - `D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mir`
- `docs/recovery/lot9b-github-recovery-20261112.md`:26 — `origin/recovery/op01-op31-c3-core-proofs-20261112`
  - `- JointChannels implementation;`
- `docs/recovery/lot9b-restart-assessment-20261112.md`:114 — `origin/recovery/op01-op31-c3-core-proofs-20261112`
  - `- `joint_channels`;`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/recovery/op01-op31-c3-core-proofs-20261112`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/recovery/op01-op31-c3-core-proofs-20261112`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/recovery/op01-op31-c3-core-proofs-20261112`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/recovery/op01-op31-c3-core-proofs-20261112`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421 — `origin/recovery/op01-op31-c3-core-proofs-20261112`
  - `Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432 — `origin/recovery/op01-op31-c3-core-proofs-20261112`
  - `D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mir`
- `docs/migration/v6-delivery-roadmap.md`:129 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `### 4.3 9C — `joint_channels``
- `docs/migration/v6-delivery-roadmap.md`:270 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `| 9C `joint_channels` | open | after shared infrastructure stabilizes |`
- `docs/recovery/lot9b-github-recovery-20261112.md`:26 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `- JointChannels implementation;`
- `docs/recovery/lot9b-restart-assessment-20261112.md`:114 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `- `joint_channels`;`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432 — `origin/recovery/lot9b-native-runner-a-stck-20261112`
  - `D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mir`
- `docs/migration/v6-delivery-roadmap.md`:126 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `### 4.3 9C — `joint_channels``
- `docs/migration/v6-delivery-roadmap.md`:266 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `| 9C `joint_channels` | open | after shared infrastructure stabilizes |`
- `docs/recovery/lot9b-github-recovery-20261112.md`:26 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `- JointChannels implementation;`
- `docs/recovery/lot9b-restart-assessment-20261112.md`:114 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `- `joint_channels`;`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432 — `origin/recovery/op01-op31-protocol-shaped-cost-20261112`
  - `D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mir`
- `docs/migration/v6-delivery-roadmap.md`:129 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `### 4.3 9C — `joint_channels``
- `docs/migration/v6-delivery-roadmap.md`:270 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `| 9C `joint_channels` | open | after shared infrastructure stabilizes |`
- `docs/recovery/lot9b-github-recovery-20261112.md`:26 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `- JointChannels implementation;`
- `docs/recovery/lot9b-restart-assessment-20261112.md`:114 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `- `joint_channels`;`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432 — `origin/recovery/lot6c-browser-product-runtime-20261112`
  - `D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mir`
- `docs/recovery/lot9b-github-recovery-20261112.md`:26 — `origin/recovery/op01-op31-product-wiring-gate-20261112`
  - `- JointChannels implementation;`
- `docs/recovery/lot9b-restart-assessment-20261112.md`:114 — `origin/recovery/op01-op31-product-wiring-gate-20261112`
  - `- `joint_channels`;`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/recovery/op01-op31-product-wiring-gate-20261112`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/recovery/op01-op31-product-wiring-gate-20261112`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/recovery/op01-op31-product-wiring-gate-20261112`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/recovery/op01-op31-product-wiring-gate-20261112`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421 — `origin/recovery/op01-op31-product-wiring-gate-20261112`
  - `Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432 — `origin/recovery/op01-op31-product-wiring-gate-20261112`
  - `D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mir`
- `docs/migration/v6-delivery-roadmap.md`:129 — `origin/recovery/lot5-site109-rebase-20261112`
  - `### 4.3 9C — `joint_channels``
- `docs/migration/v6-delivery-roadmap.md`:270 — `origin/recovery/lot5-site109-rebase-20261112`
  - `| 9C `joint_channels` | open | after shared infrastructure stabilizes |`
- `docs/recovery/lot9b-github-recovery-20261112.md`:26 — `origin/recovery/lot5-site109-rebase-20261112`
  - `- JointChannels implementation;`
- `docs/recovery/lot9b-restart-assessment-20261112.md`:114 — `origin/recovery/lot5-site109-rebase-20261112`
  - `- `joint_channels`;`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534 — `origin/recovery/lot5-site109-rebase-20261112`
  - `2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contrib`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277 — `origin/recovery/lot5-site109-rebase-20261112`
  - `D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver `
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357 — `origin/recovery/lot5-site109-rebase-20261112`
  - `D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver mar`
- `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420 — `origin/recovery/lot5-site109-rebase-20261112`
  - `D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks`
- … 771 autres hits conservés dans le JSON.

### Messages de commit

- `fb3ca25077c45a902663a0faef600aa5f41ee8c3` — 2026-11-13T00:27:13-03:00 — ci(lot9c0): persist qualified audit evidence durably
- `766d28229ff56a8dd99d897f8501cb2be79371f9` — 2026-11-13T00:25:37-03:00 — Merge canonical addressed acquisition into Lot 9C0 audit qualification
- `97cfe9100c7bd5373107f4465f91acde1067e54f` — 2026-11-13T00:25:03-03:00 — ci(lot9c0): qualify audit on pull request and full regression
- `51804439b4f9d0560b746fcaa3ed2f109b4fe1f8` — 2026-11-13T00:24:38-03:00 — audit(lot9c0): qualify recovery evidence from canonical baseline
- `09e05a3209c0218d1e69dda125894151e1681c36` — 2026-11-13T00:15:28-03:00 — test(lot9c): verify conservative recovery-audit contract
- `686d6beaff5766d3bd4ec08b1af782d078ab309d` — 2026-11-13T00:14:48-03:00 — audit(lot9c): derive conservative contract status from recovered evidence
- `1cb184b265ef1adc704f2c7acc4d89072dad925e` — 2026-11-13T00:13:50-03:00 — ci(lot9c): generate durable GitHub recovery audit
- `7987aea51dbcd96fc8c1e75a4da882a54ebe45d9` — 2026-11-13T00:13:39-03:00 — audit(lot9c): add evidence-only joint_channels scanner

### Historique de patches

- `fb3ca25077c45a902663a0faef600aa5f41ee8c3` — 2026-11-13T00:27:13-03:00 — ci(lot9c0): persist qualified audit evidence durably — `.github/workflows/lot9c0-joint-channels-audit-qualified.yml`
- `51804439b4f9d0560b746fcaa3ed2f109b4fe1f8` — 2026-11-13T00:24:38-03:00 — audit(lot9c0): qualify recovery evidence from canonical baseline — `.github/workflows/lot9c0-joint-channels-audit-qualified.yml`, `scripts/audit-lot9c-joint-channels.py`, `scripts/derive-lot9c-joint-channels-contract-status.py`, `tests/lot9c-joint-channels-audit.test.mjs`
- `e8e2b8f323d78d1f8efff673228329f92f30965c` — 2026-11-13T00:22:59-03:00 — docs(op01-op31): close C7 while tracking addressed cost separately — `docs/migration/op01-op31-progress.md`
- `63bce82a78a463c45f509b1c9cf8312c5f4b2366` — 2026-11-13T00:22:14-03:00 — docs(op01-op31): preserve C7 closure in addressed acquisition report — `docs/recovery/op01-op31-browser-addressed-acquisition-20261113.md`
- `09e05a3209c0218d1e69dda125894151e1681c36` — 2026-11-13T00:15:28-03:00 — test(lot9c): verify conservative recovery-audit contract — `tests/lot9c-joint-channels-audit.test.mjs`
- `08121487cbe952c61f9f012d6083ddef6fb3b15e` — 2026-11-13T00:15:00-03:00 — docs(c7): record official performance qualification — `docs/recovery/op01-op31-official-readiness-status.md`
- `686d6beaff5766d3bd4ec08b1af782d078ab309d` — 2026-11-13T00:14:48-03:00 — audit(lot9c): derive conservative contract status from recovered evidence — `scripts/derive-lot9c-joint-channels-contract-status.py`
- `1cb184b265ef1adc704f2c7acc4d89072dad925e` — 2026-11-13T00:13:50-03:00 — ci(lot9c): generate durable GitHub recovery audit — `.github/workflows/lot9c-joint-channels-audit.yml`
- `7987aea51dbcd96fc8c1e75a4da882a54ebe45d9` — 2026-11-13T00:13:39-03:00 — audit(lot9c): add evidence-only joint_channels scanner — `scripts/audit-lot9c-joint-channels.py`
- `14c4279fcf5498477574664105f6fb279c0cc2aa` — 2026-11-13T00:09:18-03:00 — docs(lot9): close 9B and define evidence-first 9C roadmap — `docs/recovery/lot9b-completion-and-lot9c-roadmap.md`
- `7f0a9a2d86a73cd7f498dc3dcce2e2d97993f027` — 2026-11-13T00:08:09-03:00 — test(lot9b): recompute official performance qualification proof — `tests/lot9b-official-performance-proof.test.mjs`
- `625fe13d5f4bf1d49b4e8be99594a5051baa474e` — 2026-11-13T00:06:06-03:00 — docs(lot9b): mark official functional and performance qualification — `docs/recovery/native-loop-runner-manifest.json`
- `532a59520bf06314a1998ca08ce8a1ace73e50c5` — 2026-11-13T00:04:10-03:00 — docs(lot9b): document official performance qualification — `docs/recovery/lot9b-official-abba-performance-qualified.md`
- `ce99c62a5044f70aaf108fe5b066f625f2009a08` — 2026-11-13T00:03:53-03:00 — docs(lot9b): persist successful official ABBA result — `docs/recovery/lot9b-official-abba-performance-qualified.json`
- `84094e5efc2322fb9f93f46eda18abd71d7c134f` — 2026-11-12T21:06:55-03:00 — docs: reconstruct canonical V6 delivery roadmap — `docs/migration/v6-delivery-roadmap.md`
- `ac5c39e76d0b2e3a2b5914314772e438dacbfdd2` — 2026-11-12T20:41:38-03:00 — docs(lot9b): record qualified Region reconstruction core — `docs/recovery/site109-reconstruction-status.md`
- `70b66ec5a793617ba5bad25eb3de9acecde9baa2` — 2026-11-12T20:17:41-03:00 — docs(lot9b): record Region recovery gap and V6 core test status — `docs/recovery/site109-reconstruction-status.md`
- `6956add7ed07a28ebdd0fd66e17c12727709c2fc` — 2026-11-12T20:15:47-03:00 — docs(lot9b): classify recovery against canonical reconstruction — `docs/recovery/lot9b-restart-assessment-20261112.md`
- `7e4999cea0ff9cd2e7091a9c0f50acadeb0f74ff` — 2026-10-25T03:30:54-03:00 — Publish cited SRA source references and replace private repository links — `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`

## Conclusion d’audit

Aucune implémentation de code produit nommée `joint_channels` n’est admise par cet audit. Les traces retrouvées sont limitées à des tests, documents, scripts, métadonnées ou historique et doivent servir uniquement à reconstruire un contrat prouvable.

Prochaine pièce : extraire de ces traces la chaîne `besoin → données → proposition → consommateur → effet`, en marquant explicitement toute partie non prouvable.

## Statut 9C après cet audit

- implémentation historique admise : **non** ;
- contrat minimal : **à établir à partir des preuves relues** ;
- développement : **non commencé** ;
- performance : **non applicable à ce stade** ;
- compteur des 76 : **inchangé**.

Le détail intégral et les refs associées sont conservés dans `docs/recovery/lot9c-joint-channels-audit.json`.
