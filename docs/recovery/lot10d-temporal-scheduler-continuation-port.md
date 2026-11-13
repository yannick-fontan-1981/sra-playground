# Lot 10D - port passif de continuation scheduler

Date : 2026-11-13

## Objet

Établir une frontière d’injection entre un reçu de continuation post-reprise déjà qualifié et un futur consommateur scheduler, sans exécuter implicitement le scheduler et sans produire de nouvelle action.

Fichiers :

- `src/runtime/v6-temporal-scheduler-continuation-port.ts`
- `tests/v6-temporal-scheduler-continuation-port.test.ts`

## Position dans la chaîne

La chaîne publique reconstruite devient :

`dispatch durable -> observation causale -> checkpoint ACTIVE -> TemporalObservationState neuf -> enveloppe de continuation scheduler -> port injecté`

La frontière reste arrêtée avant :

- l’exécution d’un interpréteur scheduler ;
- la sélection d’une alternative ;
- la préparation d’un nouvel intent d’action ;
- ACT ;
- un nouveau transport environnemental ;
- toute activation du worker public.

## Contrats versionnés

Le module introduit :

- `sra.temporal_scheduler_continuation_envelope.v1` ;
- `sra.temporal_scheduler_continuation_ack.v1` ;
- `sra.temporal_scheduler_continuation_handoff.v1` ;
- `sra.temporal_scheduler_continuation_journal.v1`.

## Enveloppe

L’enveloppe conserve ensemble :

- le reçu de continuation post-reprise ;
- le checkpoint repris `ACTIVE` ;
- le `TemporalObservationState` post-action ;
- leurs empreintes ;
- la lignée causale : reprise, dispatch, événement, intent, permis, reçu ACT, observation, `ActionObserved`, transition de lease et checkpoint repris ;
- une raison explicite.

Elle ne transporte pas :

- de `selectedRef` ;
- de candidat d’action ;
- de payload `AgentAction` ;
- d’autorisation ACT ;
- d’autorisation d’exécuter le scheduler.

Les champs de sécurité restent littéralement :

- `schedulerExecutionAuthorization: null` ;
- `workerAction: null` ;
- `actAuthorization: null`.

## Mode passif par défaut

Sans port scheduler injecté, la résolution est :

`continuation_withheld`

Dans cet état :

- le reçu n’est pas consommé ;
- l’enveloppe reste en attente ;
- le scheduler n’est pas appelé ;
- aucune action n’est produite ;
- ACT reste absent.

Cette absence de consommateur n’est pas transformée en succès implicite.

## Port injecté

Un consommateur injecté reçoit exactement :

- le reçu de continuation ;
- le checkpoint repris ;
- le nouvel état temporel ;
- la lignée causale ;
- les empreintes de l’enveloppe ;
- un `AbortSignal`.

Le consommateur peut uniquement répondre :

- `accepted` ;
- `refused`.

Son accusé doit rester passif :

- `schedulerExecutionStarted: false` ;
- `workerActionProduced: false` ;
- `actAuthorized: false`.

Une acceptation signifie seulement que le même consommateur runtime a pris possession du checkpoint et de l’état pour une future étape qualifiée. Elle ne signifie pas que l’interpréteur a déjà exécuté une instruction.

## Autorité courante

Avant l’appel du port injecté, la frontière revalide séparément :

- le reçu de continuation courant ;
- le checkpoint repris courant ;
- le nouvel état temporel courant ;
- Source ;
- workflow et instance ;
- run ;
- timeline ;
- frame ;
- révision.

Une divergence bloque avant l’appel du consommateur.

## Consommation unique

Une réponse `accepted` ou `refused` valide crée un reçu terminal de handoff et consomme la continuation une seule fois.

Le journal impose :

- une seule identité par continuation ;
- une seule identité par enveloppe ;
- une seule identité par accusé ;
- capacité par défaut : 128 ;
- maximum configurable : 1024 ;
- aucune éviction silencieuse ;
- restauration avec validation des empreintes.

Un replay exact retourne le reçu existant sans rappeler le port injecté.

Une continuation consommée ne peut pas être soumise une seconde fois.

## Erreurs avant consommation

Les situations suivantes restent non terminales et ne consomment pas le reçu :

- enveloppe absente ;
- absence de scheduler injecté ;
- contexte courant divergent ;
- signal déjà annulé ;
- exception du consommateur ;
- accusé mal formé ;
- journal plein avant persistance.

Puisqu’aucune autorisation d’exécution scheduler n’a été émise, une reprise ultérieure est possible après correction de la cause.

## Trace Logos V6

Le port enregistre une capability séparée :

`temporal-scheduler-continuation-port`

Elle ne pollue pas les compteurs OP01-OP31.

Les modes `full` et `counters` sont qualifiés.

## Qualification

Commit qualifié :

`a5878570afa473c8de3a3f03d47b1fece27a4c82`

GitHub Actions :

`43438970837`

Résultat :

- **287 tests** ;
- **287 réussis** ;
- **0 échec** ;
- 0 annulé ;
- 0 ignoré ;
- 0 todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute **17 tests** au total précédent de 270.

Les tests couvrent :

- `continuation_withheld` sans scheduler ;
- handoff accepté ;
- refus terminal ;
- replay idempotent ;
- gates courantes indépendantes ;
- annulation ;
- enveloppe altérée ;
- accusé mal formé ;
- exception retryable ;
- restauration du journal ;
- identités dupliquées ;
- journal borné ;
- resoumission interdite après consommation ;
- enveloppe absente ;
- absence de payload exécutable ;
- traces `full` et `counters` ;
- canonicalisation des preuves.

## Limites

Ne sont pas reconstruits par ce jalon :

- le véritable interpréteur scheduler ;
- sa politique de continuation ;
- son résultat d’une étape ;
- le producteur public du domaine ;
- la politique historique TemporalSelection ;
- le consommateur runtime final ;
- la réconciliation externe des résultats `unknown` ;
- une contribution dans une partie réelle.

Le worker public reste `reconstruction-pending-perception` et ne produit aucune action.

## Prochaine étape

Auditer les donneurs durables du scheduler afin de reconstruire le contrat d’une **étape d’interprétation après handoff** :

`handoff accepté -> checkpoint ACTIVE + état temporel -> résultat scheduler borné`

Cette future étape devra garder distincts :

1. la prise de possession du handoff ;
2. le début réel de l’exécution scheduler ;
3. le résultat de l’étape ;
4. une éventuelle nouvelle décision ;
5. une éventuelle nouvelle chaîne d’action.

Aucune politique ne sera inventée si le donneur exact reste absent.
