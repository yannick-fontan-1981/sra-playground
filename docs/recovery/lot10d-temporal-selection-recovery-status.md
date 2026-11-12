# Lot 10D — TemporalSelection — statut de récupération GitHub

Date : 2026-11-12

## Identité du lot

Cette conversation reprend le **Lot 10D / TemporalSelection**.

Branche de travail de reprise :

`recovery/lot10d-temporal-selection-restart-20261112`

Baseline canonique de reconstruction :

`recovery/site109-reconstruction-20261112`

Baseline observée au démarrage de cette reprise :

`658b89cfe77887eb720c95f0e6e6f8595beffdbd`

Ancienne branche de récupération annoncée :

`lot10d-temporal-selection-github-20261112`

## Comparaison avec l'ancienne branche

La comparaison GitHub entre la baseline canonique et l'ancienne branche 10D donne :

- merge-base : `2c9e8b45555fa21dbc4cb22a2cc66c7efb1383ac`
- ancienne branche : **0 commit en avance**
- ancienne branche : **30 commits en retard**
- aucun fichier propre au Lot 10D dans le diff

Conclusion : **aucun code TemporalSelection ne peut être cherry-pické depuis cette ancienne branche**.

## Déjà présent dans la baseline

La baseline contient un noyau Logos V6 réellement versionné sur GitHub, notamment :

- `src/logos-engine/v6-operations.ts`
- `src/logos-engine/v6-composition-engine.ts`
- `src/logos-engine/v6-native-authority.ts`
- `src/logos-engine/v6-operation-trace.ts`
- `src/logos-engine/v6-operation-cache.ts`
- `src/logos-engine/v6-operation-cycle.ts`
- `src/logos-engine/v6-target-binding.ts`

et leurs tests ciblés `tests/v6-*.test.ts`.

Les documents OP01–OP31 décrivent ce noyau comme reconstruit et qualifié dans son périmètre, mais indiquent encore qu'il doit être raccordé au runtime/browser réel.

## Manquant pour le Lot 10D

Les éléments historiques suivants ne sont pas présents dans la baseline GitHub inspectée :

- `src/logos-engine/v6-temporal-selection.ts`
- `src/logos-engine/v6-native-runtime.ts`
- les tests et fixtures spécifiques TemporalSelection du Lot 10D
- les dossiers de preuve `docs/migration/lot10d-evidence/*`
- `docs/migration/lot10d-temporal-selection-next-step.md`
- `docs/migration/v6-delivery-roadmap.md`
- `docs/migration/v6-entry-point-progress.json`

La reconstruction générale signale également comme manquants :

- `src/runtime/v6-agent-worker.ts`
- `tests/helpers/v6-live-game-campaign.ts`
- `scripts/measure-native-loop-costs.mjs`

## Historique non reconstructible exactement

La conversation historique du Lot 10D décrit des qualifications fonctionnelles de TemporalSelection, des captures, des ablations et des checkpoints antérieurs.

Cependant, les SHA historiques correspondants ne sont pas résolus dans le GitHub canonique et les sources exactes ne sont pas présentes sur une branche récupérée.

Ces informations sont donc traitées comme **preuves historiques de comportement à réétablir**, et non comme une source permettant de réécrire silencieusement l'ancien code.

Aucune affirmation de parité avec Site 109 / native 0.68 n'en découle.

## Ce qui est récupérable avec preuve

1. Le noyau Logos V6 actuellement présent sur GitHub et ses contrats de release/analyse.
2. Le contrat de traçage besoin → opération → consommation.
3. Les règles de cache et d'invalidation par identité/révision.
4. Les contrats OP18/OP28 et OP29→OP30→OP31 déjà reconstruits.
5. L'identité du chantier : Lot 10D / TemporalSelection.
6. Les contraintes de reconstruction et de performance définies par la politique GitHub actuelle.

## Ce qui doit être reconstruit

TemporalSelection doit être reconstruit **comme nouveau port qualifié**, à partir de contrats et donneurs dont le contenu est disponible et vérifiable.

Ordre retenu :

1. retrouver un donneur ou contrat durable décrivant l'état et les opérations TemporalSelection ;
2. écrire des tests de contrat avant le port ;
3. reconstruire l'adaptateur TemporalSelection sans inventer de champs ou de décisions ;
4. raccorder au noyau Logos V6 existant ;
5. qualifier acquisition/restauration et décision suivante ;
6. seulement ensuite étendre au runtime/browser ;
7. restaurer les campagnes et le harness de performance avant toute qualification officielle du coût.

## Performance

Critère historique conservé :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- chaque jeu séparément ;
- aucune compensation entre jeux ;
- une phase interne peut dépasser +10 % si le global du même jeu reste sous +10 %.

Le harness officiel n'est pas encore restauré sur cette baseline.

Statut actuel : **fonctionnellement qualifié uniquement pour le noyau Logos déjà présent ; performance officielle à confirmer**.

## Prochaine étape

Chercher dans les sources donneuses et documents durables accessibles depuis GitHub un contrat TemporalSelection suffisamment précis pour écrire les premiers tests de reconstruction.

Si aucun donneur exact n'est retrouvé, ne pas inventer l'ancien code : documenter le manque et reconstruire explicitement une nouvelle capacité sous un contrat nouveau et traçable.
