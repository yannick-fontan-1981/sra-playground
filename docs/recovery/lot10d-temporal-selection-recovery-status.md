# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-13

## Identité

- Lot : **10D / TemporalSelection**
- Branche : `recovery/lot10d-temporal-selection-rebased-20261112`
- Baseline de report historique : `24fcdbb16c93de59489a6bb0392cc709b7a75d14`
- Branche canonique : `recovery/site109-reconstruction-20261112`
- Tête canonique parallèle observée après ce jalon : `97ba156fd0ffb8359cb84514c91f1504d84e928c`

La branche du lot n'est pas encore intégrée. Aucune identité complète avec Site 109 / native 0.68 n'est revendiquée.

## Nature de la reconstruction

L'ancienne branche historique 10D ne contenait aucun delta récupérable. Le code actuel est une reconstruction qualifiée à partir de contrats GitHub durables et de donneurs V5 épinglés.

Le donneur privé utilisé pour les invariants ACT, dispatch et reprise reste :

`212d8d426f07eea2b6797c2bb647545767488a96`

Le code privé n'est pas republié.

## Briques reconstruites

1. sélection Source fail-closed ;
2. mémoire liée à l'observation ;
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
15. bridge post-reprise vers un `TemporalObservationState` neuf.

Derniers fichiers :

- `src/runtime/v6-temporal-resume-continuation.ts`
- `tests/v6-temporal-resume-continuation.test.ts`
- `docs/recovery/lot10d-temporal-resume-continuation.md`

## Chaîne qualifiée

`TemporalSelection -> intent -> binding action -> audit ACT -> permis -> consommation ACT -> checkpoint suspendu -> tentative durable -> transport -> dispatch durable -> observation causale -> ActionObserved -> lease OBSERVED -> checkpoint ACTIVE -> domaine post-action externe -> TemporalObservationState neuf`

Le worker public n'utilise pas cette chaîne par défaut.

## Bridge post-reprise

Le nouveau bridge reçoit :

- un journal de reprise causale durable ;
- un reçu causal précis ;
- un domaine d'alternatives post-action fourni extérieurement ;
- l'autorité Source ;
- l'autorité courante de continuation.

Il vérifie :

- reçu causal et checkpoint repris courants ;
- Source, workflow et instance ;
- run, timeline, frame et révision ;
- producteur externe du domaine ;
- identité de l'observation causale ;
- domaine complet des alternatives ;
- fingerprints du reçu, du domaine et de l'état.

Le bridge ne produit ni candidats ni sélection. Il scelle un domaine déjà fourni et construit un état temporel descriptif.

## Invalidation des preuves pré-action

Le nouvel état commence toujours sans héritage implicite :

- aucun retour qualifié ;
- aucune identité de retour consommée ;
- aucun contrat de mémoire ;
- aucune preuve mémoire ;
- aucune autorité ACT.

Les marqueurs du reçu sont :

- `priorQualifiedReturnsCarried: false` ;
- `priorMemoryReuseCarried: false` ;
- `continuationPrepared: true` ;
- `schedulerExecutionStarted: false` ;
- `workerActionProduced: false` ;
- `actAuthorized: false`.

Toute réutilisation future de mémoire ou de retour devra être requalifiée sur la nouvelle observation.

## Idempotence et journal

Le journal de continuation est borné et fail-closed :

- capacité par défaut : 128 ;
- maximum : 1024 ;
- une continuation par reçu causal ;
- une continuation par checkpoint repris ;
- une continuation par observation causale ;
- une identité de domaine ;
- aucune éviction silencieuse ;
- restauration avec validation des empreintes.

Le replay exact retourne le reçu existant sans produire un second état. Un autre domaine pour le même reçu causal est refusé.

## Séparation du scheduler

Le jalon prépare une continuation, mais n'exécute pas encore le scheduler commun.

Il ne :

- choisit aucune alternative ;
- prépare aucune action ;
- ne réautorise pas ACT ;
- ne transporte rien vers l'environnement ;
- ne remplace pas le worker public ;
- ne transforme pas automatiquement le checkpoint `ACTIVE` en nouvelle exécution de workflow.

Le worker reste `reconstruction-pending-perception` et le statut runtime global reste `action_withheld`.

## Qualification GitHub CI

Commit de code, tests et workflow :

`a0536fa1dfdef9edf4c4c260385119e85e3ff922`

Run GitHub Actions :

`43429163491`

Résultat :

- **270 tests** ;
- **270 réussis** ;
- **0 échec** ;
- 0 annulé ;
- 0 ignoré ;
- 0 todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute 15 tests au total précédent de 255.

`npm ci` signale toujours deux vulnérabilités de sévérité élevée dans les dépendances de la baseline. Aucune correction forcée n'a été appliquée dans ce lot.

## Limites ouvertes

- politique historique TemporalSelection ;
- producteur public des domaines et candidats ;
- mapping historique exact `selectedRef -> AgentAction` ;
- réconciliation externe d'une tentative `unknown` ;
- scheduler TypeScript commun ;
- consommation réelle du checkpoint repris ;
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

Reconstruire une frontière d'injection scheduler passive :

`reçu de continuation -> checkpoint ACTIVE + TemporalObservationState -> SchedulerContinuationPort`

Elle devra :

1. consommer le reçu de continuation une seule fois ;
2. transmettre ensemble le checkpoint et l'état temporel ;
3. retourner `continuation_withheld` si aucun scheduler qualifié n'est injecté ;
4. empêcher un replay divergent ;
5. conserver la lignée causale complète ;
6. ne produire aucune action par elle-même ;
7. maintenir le worker public inactif jusqu'au raccordement du producteur public et du consommateur runtime final.
