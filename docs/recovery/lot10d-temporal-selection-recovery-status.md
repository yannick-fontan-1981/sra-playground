# Lot 10D — TemporalSelection — statut de reconstruction GitHub

Date : 2026-11-12

## Identité du lot

Lot : **10D / TemporalSelection**

Branche de travail qualifiée :

`recovery/lot10d-temporal-selection-rebased-20261112`

Baseline canonique utilisée pour ce report :

- branche : `recovery/site109-reconstruction-20261112`
- commit : `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

Branche précédente préservée :

`recovery/lot10d-temporal-selection-restart2-20261112`

Ancienne branche de récupération historique :

`lot10d-temporal-selection-github-20261112`

Cette ancienne branche ne contenait aucun delta 10D récupérable : elle était à 0 commit en avance sur son merge-base. Le travail actuel est donc une reconstruction explicitement qualifiée, pas un cherry-pick de l'ancien Site 109.

## Pourquoi le report a été refait

La reconstruction canonique a avancé pendant le chantier 10D. Elle contient désormais notamment :

- `src/runtime/v6-agent-worker-core.ts` ;
- `src/runtime/v6-agent-worker.ts` ;
- `tests/helpers/v6-live-game-campaign.ts` ;
- `scripts/measure-native-loop-costs.mjs` ;
- `docs/migration/v6-delivery-roadmap.md`.

Le sink Logos V6 canonique a aussi gagné un mode léger `counters`.

Le Lot 10D a donc été reporté sur la tête canonique `24fcdbb…`, avec fusion explicite de l'extension `capability` dans ce mode léger. Les composants 10D non conflictuels ont conservé leurs blobs qualifiés.

## Couche TemporalSelection reconstruite

Les composants suivants sont présents :

1. contrat Source / sélection fail-closed ;
2. contrat de réutilisation mémoire liée à l'observation courante ;
3. contrat d'identité et d'idempotence des retours ;
4. état minimal descriptif et restaurable ;
5. reçu de décision Source/DRM avec provenance ;
6. adaptateur de consommation d'une décision externe ;
7. bridge traçable vers le noyau Logos V6.

Fichiers principaux :

- `src/logos-engine/v6-temporal-selection-contract.ts`
- `src/logos-engine/v6-temporal-memory-contract.ts`
- `src/logos-engine/v6-temporal-return-contract.ts`
- `src/logos-engine/v6-temporal-observation-state.ts`
- `src/logos-engine/v6-temporal-decision-receipt.ts`
- `src/logos-engine/v6-temporal-selection-adapter.ts`
- `src/logos-engine/v6-temporal-selection-bridge.ts`

## Bridge de trace

Le bridge établit :

`besoin → domaine Source → reçu vérifié → projection → consommation`

Il n'utilise aucune fausse OP pour TemporalSelection.

Le sink partagé conserve séparément :

- `operation:OPxx:*` ;
- `consumption:OPxx:*` ;
- `capability:temporal-selection:*` ;
- `capability_consumption:temporal-selection:*`.

Les modes `full` et `counters` sont tous deux préservés. Le mode `counters` ne retient aucun payload d'événement.

## Qualification GitHub CI du report rebasé

Commit de code qualifié :

`b759a7adb5d459211a1ca7984acdc5062bbb88ca`

Run GitHub Actions :

`43341620341`

Résultat :

- **130 tests** ;
- **130 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck strict réussi.

Périmètre de ce run :

- worker core et worker public ;
- composition engine ;
- native authority ;
- cache, cycle et trace OP ;
- opérations OP01–OP31 couvertes par les tests courants ;
- target binding ;
- tous les contrats, états, reçus, adaptateurs et bridge TemporalSelection.

Le worker public reste volontairement configuré avec :

`PendingPerceptionDecisionPort`

et la révision :

`reconstruction-pending-perception`

Il ne fabrique aucune action.

## Limites fonctionnelles

Ne sont toujours pas reconstruits :

- la politique historique de choix TemporalSelection ;
- l'ancien state machine Site 109 ;
- les anciens champs métier `measurement`, `edit`, `pending`, `response` ;
- `src/logos-engine/v6-native-runtime.ts` ;
- un producteur public justifié des domaines/candidats TemporalSelection ;
- la position exacte d'appel dans le runtime commun ;
- le registre reconstruit des entrées ;
- une contribution démontrée dans une partie réelle ;
- les quatre runners natifs officiels A/B × STCK/SMLP.

Aucune parité Site 109 / native 0.68 n'est revendiquée.

## Performance

Le protocole ABBA et son calcul sont présents sur la baseline canonique, mais les runners et le corpus officiels ne sont pas restaurés.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Critère conservé :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- chaque jeu séparément ;
- aucune compensation ;
- une phase interne peut dépasser +10 % si le global du même jeu respecte le seuil.

## Prochaine étape

Construire un port de décision runtime **passif et explicitement alimenté**, qui ne peut fonctionner que lorsqu'un producteur externe fournit :

- l'enveloppe Source complète ;
- l'état TemporalSelection minimal ;
- le reçu Source/DRM attribué ;
- éventuellement une frontière de preuve qualifiée.

Ce port devra retourner `undefined` en l'absence de ces données et ne pourra produire une action tant qu'un contrat distinct de libération ACT n'est pas établi.
