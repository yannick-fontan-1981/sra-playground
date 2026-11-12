# Lot 5 — rebase sur la reconstruction Site 109

Date : 2026-11-12

## Base canonique

Branche source canonique :
- `recovery/site109-reconstruction-20261112`
- SHA de départ : `658b89cfe77887eb720c95f0e6e6f8595beffdbd`

Branche de travail Lot 5 :
- `recovery/lot5-site109-rebase-20261112`

Ancienne branche de récupération comparée :
- `recovery/lot5-canonical-buffer`

Comparaison GitHub :
- statut : diverged ;
- ancienne branche : 11 commits en avance, 49 en retard ;
- merge-base : `8f8b179718d06a51dc8818deb68c977cd5e1e820`.

## Déjà présent dans la baseline

Le nouveau socle canonique contient déjà :
- `src/logos-engine/v6-operations.ts`
- `src/logos-engine/v6-composition-engine.ts`
- `src/logos-engine/v6-native-authority.ts`
- `src/logos-engine/v6-target-binding.ts`
- `src/logos-engine/v6-operation-cache.ts`
- `src/logos-engine/v6-operation-cycle.ts`
- `src/logos-engine/v6-operation-trace.ts`
- les tests associés OP/composition/authority/cache/cycle/trace/target-binding.

Ces fichiers restent autoritaires pour le moteur OP reconstruit et ne sont pas remplacés par le Lot 5.

## Récupéré avec preuve et porté

Les six fichiers Lot 5 ci-dessous étaient absents de la nouvelle baseline, présents dans l'ancienne branche de récupération, et leur provenance donneur V6 est documentée.

### 5A — linked temporal preparation

Port :
- `src/logos-engine/linked-preparation.ts`
- `tests/linked-preparation.test.ts`

Donneur Git autoritatif :
- repo `yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan`
- branche `codex/v6-combined-publication`
- commit inspecté `a911106d318e79f498cccf302c54149d12cfbfeb`
- source `agents/yf_arc3_v6/laya_proto/common_linked_preparation.py`

### 5B — addressed material wrapper

Port :
- `src/logos-engine/addressed-material.ts`
- `tests/addressed-material.test.ts`

Donneurs :
- `agents/yf_arc3_v6/laya_proto/common_addressed_material.py`
- `agents/yf_arc3_v6/laya_proto/common_addressed_field.py`

Port actuel : wrapper de complétion d'observation seulement. Le cœur `AddressedField` n'est pas encore porté.

### 5C — observed object binding continuity

Port :
- `src/logos-engine/observed-object-binding.ts`
- `tests/observed-object-binding.test.ts`

Donneurs :
- `agents/yf_arc3_v6/morphology_policy/guarded_binding/family.py`
- `binding.src`
- `binding.drm`

Port actuel : continuité/persistance du parent seulement. Géométrie, génération d'offres et planification restent à reconstruire.

Commit GitHub ayant porté les six fichiers depuis l'ancienne branche :
- `63970b5e65dc0cbc34f99a352bcaeb815454d127`

## Éléments de l'ancienne branche non portés

Non Lot 5 :
- `src/agent-product-dispatch.ts`
- `tests/agent-product-dispatch.test.ts`
- `docs/migration/lot6c-recovery.md`

Ils appartiennent au Lot 6C et restent sur sa branche.

Documentation historique :
- `docs/migration/lot5-recovery.md`

Elle n'est pas reprise telle quelle car la nouvelle gouvernance GitHub et le présent document la remplacent pour cette reconstruction.

## Manquant

Encore absent ou incomplet sur la branche Lot 5 :
- cœur `AddressedField` ;
- géométrie/planning complet `ObservedBinding` ;
- intégration effective de 5A/5B/5C dans un runtime/worker commun ;
- `canonical.ts` / `immutableJson` historique ;
- `scripts/measure-native-loop-costs.mjs` ;
- campagnes officielles STCK/SMLP.

## Seulement documenté, non reconstructible exactement à ce stade

Le candidat historique canonical-buffer est documenté mais son diff exact n'est pas récupéré :
- checkpoint intermédiaire historique : `0654dcd7109e9b67b41f3d00dbc060ee6cdde79f` ;
- checkpoint final historique : `d1199006fb990d049611136ea1af9a64f388d8de` ;
- Site 109 historique : native 0.68, 70/76 ;
- SHA Site historique : `d90ce5b64fffa53cca201e2a6a49450fd123f299`, non résolu dans le GitHub accessible.

Aucune équivalence exacte avec Site 109 n'est revendiquée.

## Qualification sur la nouvelle baseline

Checkout local :
- `/mnt/data/sra-playground-lot5-site109-rebase`
- branche `recovery/lot5-site109-rebase-20261112`

Tests ciblés exécutés :
- linked-preparation : 7 cas ;
- addressed-material : 2 cas ;
- observed-object-binding : 5 cas ;
- total : **14/14 réussis**.

Typecheck :
- `tsc --noEmit` : **réussi**.

Runtime local :
- Node 22.16.0 ;
- les tests TypeScript utilisent `--experimental-strip-types` car le dépôt demande >=22.18.0.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Le harness officiel historique n'est pas encore restauré.

Critère conservé :
- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- chaque jeu séparément ;
- aucune compensation ;
- une phase interne peut dépasser +10 % si le global du jeu reste strictement sous +10 %.

## Prochaine étape

Porter le cœur de 5B `AddressedField` à partir du donneur Git V6 en isolant d'abord les invariants réellement consommés :
1. identité d'occurrence courante ;
2. liaison adresse -> objet/context courant ;
3. invalidation sur ambiguïté, déplacement pertinent ou changement de portée ;
4. réponse observée et réfutation ;
5. sauvegarde/restauration nécessaires au consommateur.
