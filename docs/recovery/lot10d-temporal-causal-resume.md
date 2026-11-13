# Lot 10D — reprise causale après dispatch durable

Date : 2026-11-13

## But

Qualifier la frontière qui transforme une observation acquise par un dispatch durable en une seule reprise causale du checkpoint suspendu.

Chaîne couverte :

`dispatch durable -> observation acquise -> ActionObserved -> lease RELEASED -> OBSERVED -> checkpoint ACTIVE`

Fichiers :

- `src/runtime/v6-temporal-causal-resume.ts`
- `tests/v6-temporal-causal-resume.test.ts`

## Donneurs durables

Les invariants proviennent du dépôt V5 privé épinglé au commit :

`212d8d426f07eea2b6797c2bb647545767488a96`

Donneurs principaux :

- `agents/yf_arc3_v5/scheduler/contracts.py`
- `agents/yf_arc3_v5/scheduler/runtime.py`
- `agents/yf_arc3_v5/logos/operations.py`
- `agents/yf_arc3_v5/runtime/boundary.py`

Le code privé n'est pas republié. La reconstruction publique reprend seulement les invariants démontrables.

## Invariants repris

La reprise exige :

- un dispatch durable, avec sa tentative exacte ;
- un checkpoint encore `suspended` ;
- la même Source, le même workflow et la même instance ;
- le même run, la même timeline et la même frame suspendue ;
- le même intent, le même permis et le même reçu ACT ;
- le même événement environnemental ;
- le snapshot sémantique pré-action toujours courant ;
- un intent responsable canonique ;
- une liaison courante du retour observé ;
- une observation réellement nouvelle ;
- une chronologie strictement postérieure au dispatch ;
- une observation non déjà consommée.

Une reprise qualifiée :

- crée un reçu d'observation causale ;
- crée un reçu `ActionObserved` ;
- passe la lease de `released` à `observed` ;
- lie le raw input acquis au binding de frame attendu ;
- ajoute l'observation aux références consommées ;
- efface toute la lignée d'action en attente ;
- incrémente la séquence du checkpoint ;
- projette un checkpoint `active` ;
- produit un reçu atomique de reprise.

## Contrats publics ajoutés

Schémas :

- `sra.temporal_causal_resume_checkpoint.v1`
- `sra.temporal_causal_observation.v1`
- `sra.temporal_action_observed.v1`
- `sra.temporal_lease_observed_transition.v1`
- `sra.temporal_resumed_checkpoint.v1`
- `sra.temporal_causal_resume_receipt.v1`
- `sra.temporal_causal_resume_journal.v1`

## Résultat qualifié

Le reçu terminal conserve :

- le dispatch et son fingerprint ;
- le checkpoint suspendu et son fingerprint ;
- l'observation acquise ;
- l'événement environnemental ;
- l'intent, le permis et le reçu ACT ;
- le reçu `ActionObserved` ;
- la transition `released -> observed` ;
- le checkpoint repris ;
- toutes les preuves bornées de la chaîne.

Le checkpoint repris possède :

- `status: active` ;
- une séquence incrémentée d'une unité ;
- la nouvelle frame ;
- le raw input lié au binding attendu ;
- l'observation ajoutée aux consommations ;
- `pendingActionLineageCleared: true`.

## Consommation unique et idempotence

Le journal causal est borné et fail-closed :

- capacité par défaut : 128 ;
- maximum configurable : 1024 ;
- une seule reprise par dispatch ;
- une seule reprise par checkpoint suspendu ;
- une seule consommation par observation acquise ;
- une seule consommation par événement environnemental ;
- aucun remplacement silencieux lorsque la capacité est atteinte ;
- restauration avec validation de toutes les empreintes.

Rejouer exactement le même dispatch et le même checkpoint retourne le reçu existant :

- `reused: true` ;
- aucun second checkpoint émis ;
- aucune seconde consommation ;
- aucun second `ActionObserved`.

Un checkpoint déjà repris par un autre dispatch est refusé.

## Résultats externes inconnus

Une tentative durable sans dispatch durable ne peut pas entrer dans la reprise causale.

Elle produit :

- `outcomeStatus: unknown` ;
- `redeliveryPermitted: false` ;
- `reconciliationRequired: true` ;
- `observationConsumed: false` ;
- `checkpointResumed: false`.

Ainsi, l'absence de preuve externe n'est jamais transformée en succès.

La résolution externe d'un résultat `unknown` reste un contrat distinct, non encore reconstruit.

## Frontières courantes revalidées

Avant consommation, la couche revalide séparément :

- checkpoint courant ;
- Source courante ;
- run, timeline et frame courants ;
- révision courante ;
- snapshot sémantique courant ;
- responsabilité courante ;
- intent responsable canonique ;
- liaison du retour observé ;
- dispatch canonique ;
- reçu ACT canonique ;
- transition de lease canonique.

Une divergence produit un refus sans consommation de l'observation ni reprise du checkpoint.

## Données volontairement absentes

Les reçus causaux ne conservent pas :

- le payload `AgentAction` ;
- les coordonnées d'une action pointée ;
- la cible exécutable ;
- une nouvelle permission ACT ;
- une nouvelle permission de transport.

Le payload d'action reste limité à la requête de transport déjà qualifiée dans `ActionBoundary`.

## Qualification GitHub CI

Commit qualifié :

`f87d41a5dd76fbdab07618537746c9b61d9c7280`

Run GitHub Actions :

`43426455317`

Résultat :

- **255 tests** ;
- **255 réussis** ;
- **0 échec** ;
- 0 annulé ;
- 0 ignoré ;
- 0 todo ;
- typecheck TypeScript strict réussi, incluant `v6-temporal-causal-resume.ts`.

Le jalon ajoute 15 tests ciblés au total précédent de 240.

## Limites restantes

Cette étape projette un checkpoint repris et un journal causal durable, mais elle ne raccorde pas encore ce checkpoint au véritable interpréteur scheduler du runtime commun.

Restent ouverts :

- réconciliation externe d'une tentative `unknown` ;
- consommation du checkpoint repris par le véritable scheduler ;
- continuation du workflow après la reprise ;
- réconciliation du nouvel état temporel avec `TemporalObservationState` ;
- consommateur runtime final ;
- activation du worker public ;
- campagne fonctionnelle réelle ;
- mesure officielle STCK/SMLP.

## Prochaine étape

Construire le bridge de continuation runtime :

`reçu causal -> checkpoint repris -> nouvelle observation temporelle -> continuation du workflow`

Il devra :

1. consommer le reçu causal une seule fois ;
2. reconstruire l'identité de la nouvelle observation sans réutiliser les preuves périmées ;
3. préserver le lien vers dispatch, événement, intent, permis et observation acquise ;
4. ne jamais traiter une tentative `unknown` comme un retour observé ;
5. séparer la simple reprise du checkpoint de l'exécution ultérieure du workflow ;
6. rester inactif par défaut tant que le producteur public et le consommateur runtime final ne sont pas qualifiés.
