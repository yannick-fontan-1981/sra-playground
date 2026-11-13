# Lot 10D - bridge de continuation post-reprise

Date : 2026-11-13

## Objet

Relier un reçu de reprise causale déjà qualifié à un nouvel état descriptif `TemporalObservationState`, sans exécuter le scheduler, sans choisir de candidat et sans produire une nouvelle action.

Fichiers :

- `src/runtime/v6-temporal-resume-continuation.ts`
- `tests/v6-temporal-resume-continuation.test.ts`

## Position dans la chaîne

La chaîne qualifiée devient :

`dispatch durable -> observation acquise -> reprise causale -> checkpoint ACTIVE -> domaine post-action externe -> TemporalObservationState neuf`

La frontière s'arrête avant :

- l'exécution de l'interpréteur scheduler ;
- la sélection d'une alternative ;
- la préparation d'une nouvelle action ;
- ACT ;
- un nouveau transport environnemental.

## Domaine post-action

Le nouveau reçu `sra.temporal_post_action_domain.v1` scelle un domaine fourni par un producteur externe. Il transporte :

- le producteur ;
- Source et workflow ;
- l'instance de workflow ;
- run, timeline, frame et révision ;
- raw input acquis ;
- reçu de reprise causale et son fingerprint ;
- dispatch et son fingerprint ;
- observation acquise et son fingerprint ;
- checkpoint repris et son fingerprint ;
- identité temporelle ;
- domaine complet d'alternatives ;
- exigences et références à préserver ;
- preuves ;
- fingerprint du domaine.

Le reçu ne contient aucun `selectedRef`.

Le bridge ne fabrique pas les alternatives. Il valide seulement un domaine externe contre la Source et l'observation causale courante.

## État post-action neuf

Le bridge appelle `createTemporalObservationState` avec l'identité et le domaine post-action vérifiés.

Le nouvel état commence obligatoirement avec :

- `qualifiedReturns: []` ;
- `consumedReturnIdentityKeys: []` ;
- `memoryReuseContract: null` ;
- `memoryProofRefs: []` ;
- `actAuthorized: false`.

Aucune mémoire ni aucun retour de l'observation pré-action n'est transporté automatiquement. Toute réutilisation future devra repasser par les contrats explicites de mémoire et de retour courant.

## Reçu de continuation

Le reçu `sra.temporal_resume_continuation_receipt.v1` conserve :

- le reçu causal complet ;
- le domaine post-action complet ;
- le nouvel état temporel ;
- les fingerprints de l'état et du reçu ;
- la lignée dispatch, événement, intent, permis, reçu ACT, observation, `ActionObserved`, transition de lease et checkpoint repris.

Les limites sont littérales :

- `priorQualifiedReturnsCarried: false` ;
- `priorMemoryReuseCarried: false` ;
- `continuationPrepared: true` ;
- `schedulerExecutionStarted: false` ;
- `workerActionProduced: false` ;
- `actAuthorized: false`.

## Autorité courante

Une nouvelle continuation vérifie séparément :

- reçu causal courant ;
- checkpoint repris courant ;
- Source courante ;
- workflow et instance courants ;
- run, timeline, frame et révision courants ;
- producteur de domaine courant ;
- fingerprint du domaine courant.

Un replay exact d'un reçu déjà persisté est idempotent et retourne le même reçu sans émettre un second état.

Une tentative de réutiliser le même reçu causal avec un autre domaine est refusée.

## Journal

Le journal `sra.temporal_resume_continuation_journal.v1` est borné et fail-closed :

- capacité par défaut : 128 ;
- maximum configurable : 1024 ;
- une seule continuation par reçu causal ;
- une seule continuation par checkpoint repris ;
- une seule continuation par observation causale ;
- une seule identité de domaine ;
- aucune éviction silencieuse ;
- restauration avec validation des fingerprints.

## Qualification

Commit qualifié :

`a0536fa1dfdef9edf4c4c260385119e85e3ff922`

GitHub Actions :

`43429163491`

Résultat :

- **270 tests** ;
- **270 réussis** ;
- **0 échec** ;
- 0 annulé ;
- 0 ignoré ;
- 0 todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute **15 tests** au total précédent de 255.

Les tests couvrent notamment :

- état post-action neuf ;
- absence de sélection et d'ACT ;
- replay idempotent ;
- conflit de domaine ;
- liaison exacte à l'observation causale ;
- altération du domaine ;
- autorité Source ;
- gates courantes indépendantes ;
- reçu causal absent ou altéré ;
- absence de mémoire/retour pré-action ;
- absence de payload exécutable ;
- fingerprints canoniques ;
- restauration et doublons ;
- bornes du journal.

## Limites

Le jalon ne reconstruit pas :

- le producteur public des alternatives ;
- la politique historique TemporalSelection ;
- le scheduler TypeScript commun ;
- l'exécution du checkpoint `ACTIVE` ;
- le consommateur runtime final ;
- la réconciliation externe d'un résultat `unknown` ;
- les séries ou l'acquisition différée ;
- une contribution dans une partie réelle.

Le worker public reste `reconstruction-pending-perception` et ne produit aucune action.

## Prochaine étape

Construire une frontière d'injection scheduler distincte :

`reçu de continuation -> checkpoint ACTIVE + TemporalObservationState -> SchedulerContinuationPort`

Cette frontière devra :

1. consommer le reçu de continuation une seule fois ;
2. remettre le checkpoint et l'état au même consommateur runtime ;
3. ne pas exécuter le scheduler sans port injecté et qualifié ;
4. conserver la lignée causale complète ;
5. empêcher tout replay divergent ;
6. maintenir le worker public inactif par défaut ;
7. produire un résultat explicite `continuation_withheld` lorsqu'aucun scheduler n'est raccordé.
