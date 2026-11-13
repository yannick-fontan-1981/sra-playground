# Lot 10D — TemporalSelection — reprise rebasée sur la reconstruction canonique

Date : 2026-11-12

## Identité

Lot : **10D / TemporalSelection**

Branche de travail :

`recovery/lot10d-temporal-selection-rebased-20261112`

Baseline de départ :

- branche : `recovery/site109-reconstruction-20261112`
- commit : `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

Branche précédente préservée :

`recovery/lot10d-temporal-selection-restart2-20261112`

## Pourquoi ce nouveau report

La reconstruction canonique a avancé pendant le développement du Lot 10D. Elle a notamment restauré :

- `src/runtime/v6-agent-worker-core.ts` ;
- `src/runtime/v6-agent-worker.ts` ;
- `tests/helpers/v6-live-game-campaign.ts` ;
- `scripts/measure-native-loop-costs.mjs` ;
- `docs/migration/v6-delivery-roadmap.md`.

La trace Logos V6 canonique a aussi gagné un mode léger `counters` qui n'existait pas au merge-base du premier port 10D.

Un simple remplacement par l'ancienne version 10D aurait donc créé une régression. Le report actuel conserve le mode `counters` et y ajoute les événements de capability nécessaires à TemporalSelection.

## Composants 10D reportés

- contrat Source / sélection fail-closed ;
- contrat de mémoire courante ;
- identité et idempotence des retours ;
- état minimal descriptif/restaurable ;
- reçu Source/DRM ;
- adaptateur de consommation ;
- bridge vers la trace bornée Logos V6 ;
- tests et documents de récupération associés.

Les blobs qualifiés ont été réutilisés directement lorsque le fichier n'entrait pas en conflit avec la baseline.

## Fichiers partagés fusionnés

- `src/logos-engine/v6-operation-trace.ts` ;
- `tests/v6-operation-trace.test.ts`.

La fusion préserve :

- les compteurs OP historiques ;
- le mode `full` ;
- le mode `counters` sans conservation des payloads ;
- la borne d'événements ;
- des compteurs distincts `capability:*` et `capability_consumption:*` ;
- l'absence de fausse OP pour TemporalSelection.

## Qualification antérieure préservée

Sur la branche précédente, le run GitHub Actions `43340758482`, head `1033edbb1ba23a75106e34bb5159b7f089c6f46d`, a réussi :

- 86/86 tests ;
- typecheck strict ;
- suites V6 affectées et suites TemporalSelection.

Cette preuve ne qualifie pas automatiquement le report sur la nouvelle baseline. Une nouvelle CI est obligatoire sur cette branche.

## Runtime canonique observé

Le worker public et son cœur sont maintenant présents, mais le port de décision par défaut reste :

`PendingPerceptionDecisionPort`

avec la révision :

`reconstruction-pending-perception`

Il ne produit volontairement aucune action.

Toujours manquants ou ouverts pour Lot 10D :

- politique historique TemporalSelection ;
- `src/logos-engine/v6-native-runtime.ts` ;
- producteur public des domaines/candidats TemporalSelection ;
- position d'appel runtime justifiée ;
- registre reconstruit des entrées ;
- runners natifs officiels STCK/SMLP ;
- qualification de contribution dans une partie réelle.

## Statut performance

Le protocole ABBA et son calcul sont restaurés, mais les quatre runners natifs/corpus officiels ne le sont pas encore.

Statut : **fonctionnellement qualifié sur la branche précédente ; report en cours de requalification ; performance officielle à confirmer**.

Critère conservé : STCK et SMLP séparément strictement sous +10 %, sans compensation ; une phase interne peut dépasser +10 % si le global du même jeu passe.

## Prochaine étape

1. exécuter la CI du report rebasé avec les régressions worker, V6 core et TemporalSelection ;
2. corriger toute incompatibilité liée à la baseline ;
3. seulement après une CI verte, examiner un port de décision minimal du worker qui consomme des entrées TemporalSelection explicitement fournies, sans fabriquer perception, politique ou action.
