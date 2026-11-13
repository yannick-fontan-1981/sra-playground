# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-13

## Identité

- Lot : **10D / TemporalSelection**
- Branche : `recovery/lot10d-temporal-selection-rebased-20261112`
- Baseline de report historique : `24fcdbb16c93de59489a6bb0392cc709b7a75d14`
- Branche canonique : `recovery/site109-reconstruction-20261112`
- Tête canonique parallèle observée pendant ce jalon : `68cdddc92b4b7f0214a2d7e5a5f0ffe6c94e7216`

La branche du lot n’est pas encore intégrée. Aucune identité complète avec Site 109 / native 0.68 n’est revendiquée.

## Nature de la reconstruction

L’ancienne branche historique 10D ne contenait aucun delta récupérable. Le code actuel est une reconstruction qualifiée à partir de contrats GitHub durables et de donneurs V5 épinglés.

Le donneur privé utilisé pour les invariants ACT, dispatch et reprise reste :

`212d8d426f07eea2b6797c2bb647545767488a96`

Le code privé n’est pas republié.

## Briques reconstruites

1. sélection Source fail-closed ;
2. mémoire liée à l’observation ;
3. identité et idempotence des retours ;
4. état descriptif restaurable ;
5. reçu Source/DRM ;
6. adaptateur de consommation ;
7. bridge de trace Logos V6 ;
8. port runtime passif ;
9. audit des gates ACT ;
10. binding candidat / cible / action préparée ;
11. permis ACT ordinaire ;
12. consommation ACT, transition de lease et révocation ;
13. `ActionBoundary` avec tentative durable et dispatch ;
14. reprise causale et checkpoint `ACTIVE` ;
15. bridge post-reprise vers un `TemporalObservationState` neuf ;
16. port passif de handoff vers un consommateur scheduler injecté.

Derniers fichiers :

- `src/runtime/v6-temporal-scheduler-continuation-port.ts`
- `tests/v6-temporal-scheduler-continuation-port.test.ts`
- `docs/recovery/lot10d-temporal-scheduler-continuation-port.md`

## Chaîne qualifiée

`TemporalSelection -> intent -> binding action -> audit ACT -> permis -> consommation ACT -> checkpoint suspendu -> tentative durable -> transport -> dispatch durable -> observation causale -> ActionObserved -> lease OBSERVED -> checkpoint ACTIVE -> domaine post-action externe -> TemporalObservationState neuf -> enveloppe de handoff scheduler`

Le worker public n’utilise pas cette chaîne par défaut.

## Port passif de continuation scheduler

Le nouveau port reçoit une enveloppe attribuée contenant ensemble :

- le reçu de continuation post-reprise ;
- le checkpoint repris `ACTIVE` ;
- le nouvel état temporel ;
- leurs empreintes ;
- la lignée complète du dispatch causal ;
- une raison explicite.

L’enveloppe ne transporte aucun `selectedRef`, aucun candidat d’action, aucun payload `AgentAction` et aucune autorité ACT.

Ses champs de sécurité restent :

- `schedulerExecutionAuthorization: null` ;
- `workerAction: null` ;
- `actAuthorization: null`.

## Mode sans scheduler

Sans port scheduler qualifié injecté, la résolution est explicitement :

`continuation_withheld`

Dans ce cas :

- le reçu de continuation n’est pas consommé ;
- l’enveloppe reste en attente ;
- le scheduler n’est pas appelé ;
- aucune action n’est produite ;
- ACT reste absent.

L’absence d’interpréteur ne devient donc jamais un faux succès.

## Handoff injecté

Un port injecté reçoit exactement le checkpoint, l’état temporel, le reçu et la lignée causale.

Il peut répondre `accepted` ou `refused`, mais son accusé doit conserver :

- `schedulerExecutionStarted: false` ;
- `workerActionProduced: false` ;
- `actAuthorized: false`.

Une acceptation signifie uniquement que le même consommateur runtime a pris possession du checkpoint et de l’état pour une future étape qualifiée.

Elle ne signifie pas que le scheduler a exécuté une instruction.

## Revalidation courante

Avant tout appel du consommateur, le port revalide indépendamment :

- reçu de continuation ;
- checkpoint repris ;
- nouvel état temporel ;
- Source ;
- workflow et instance ;
- run ;
- timeline ;
- frame ;
- révision.

Une divergence bloque avant l’appel du scheduler injecté.

## Consommation unique et journal

Une réponse valide, acceptée ou refusée, produit un reçu terminal de handoff et consomme la continuation une seule fois.

Le journal est borné et fail-closed :

- capacité par défaut : 128 ;
- maximum : 1024 ;
- une identité par continuation ;
- une identité par enveloppe ;
- une identité par accusé ;
- aucune éviction silencieuse ;
- restauration avec validation des empreintes.

Un replay exact retourne le reçu existant sans rappeler le port injecté.

Les erreurs avant consommation, notamment absence de scheduler, annulation, contexte périmé, exception du consommateur ou accusé invalide, laissent l’enveloppe en attente.

## Trace Logos V6

La capability suivante est tracée séparément des OP01-OP31 :

`temporal-scheduler-continuation-port`

Les modes `full` et `counters` sont qualifiés.

## Séparation du scheduler réel

Le jalon qualifie la prise de possession, pas l’interpréteur.

Il ne :

- choisit aucune alternative ;
- prépare aucune nouvelle action ;
- ne réautorise pas ACT ;
- ne transporte rien vers l’environnement ;
- ne remplace pas le worker public ;
- n’exécute aucune étape du scheduler.

Le worker reste `reconstruction-pending-perception` et le statut runtime global reste `action_withheld`.

## Qualification GitHub CI

Commit de code, tests et workflow :

`a5878570afa473c8de3a3f03d47b1fece27a4c82`

Run GitHub Actions :

`43438970837`

Résultat :

- **287 tests** ;
- **287 réussis** ;
- **0 échec** ;
- 0 annulé ;
- 0 ignoré ;
- 0 todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute 17 tests au total précédent de 270.

`npm ci` signale toujours deux vulnérabilités de sévérité élevée dans les dépendances de la baseline. Aucune correction forcée n’a été appliquée dans ce lot.

## Limites ouvertes

- politique historique TemporalSelection ;
- producteur public des domaines et candidats ;
- mapping historique exact `selectedRef -> AgentAction` ;
- réconciliation externe d’une tentative `unknown` ;
- interpréteur scheduler TypeScript commun ;
- contrat du résultat d’une étape scheduler ;
- consommateur runtime final ;
- séries pré-déclarées ;
- acquisition différée de concentration ;
- registre des entrées ;
- campagne en partie réelle ;
- runners et corpus officiels STCK/SMLP.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Critère conservé :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- jeux évalués séparément ;
- aucune compensation ;
- une phase interne peut dépasser +10 % si le global du même jeu reste sous le seuil.

## Prochaine étape

Auditer les donneurs durables du scheduler et reconstruire le contrat d’une étape d’interprétation après handoff :

`handoff accepté -> checkpoint ACTIVE + TemporalObservationState -> résultat scheduler borné`

La prochaine qualification devra distinguer explicitement :

1. la prise de possession déjà qualifiée ;
2. le début réel de l’exécution ;
3. le résultat de l’étape ;
4. une éventuelle nouvelle décision ;
5. une éventuelle nouvelle chaîne d’action.

Aucune politique scheduler ne sera inventée si son donneur durable exact reste absent.
