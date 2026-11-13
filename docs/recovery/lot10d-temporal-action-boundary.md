# Lot 10D - ActionBoundary durable et transport au plus une fois

Date : 2026-11-13

Branche :

`recovery/lot10d-temporal-selection-rebased-20261112`

## Objectif du jalon

Ce jalon reconstruit la frontière située après la consommation ACT ordinaire :

`ActOutput -> checkpoint suspendu -> tentative durable -> transport -> dispatch durable`

La reconstruction garantit qu'une action déjà remise au transport externe ne peut pas être envoyée automatiquement une seconde fois lorsqu'aucune preuve durable du résultat n'est disponible.

Le jalon ne reprend pas encore le workflow de raisonnement. L'acquisition causale, la reprise et la réconciliation restent une étape distincte.

## Donneurs historiques

Les invariants historiques proviennent du dépôt privé épinglé :

`yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan`

Commit :

`212d8d426f07eea2b6797c2bb647545767488a96`

Sources qualifiées :

- `agents/yf_arc3_v5/runtime/boundary.py` ;
- `agents/yf_arc3_v5/runtime/contracts.py` ;
- `agents/yf_arc3_v5/scheduler/runtime.py` ;
- les contrats ACT et permis déjà cartographiés dans `docs/recovery/lot10d-temporal-action-release-donor-map.md`.

Le code privé n'est pas republié. Le module public reconstruit seulement les invariants nécessaires au runtime navigateur.

## Source publique reconstruite

Module :

`src/runtime/v6-temporal-action-boundary.ts`

Tests :

`tests/v6-temporal-action-boundary.test.ts`

Le composant n'est pas activé dans le worker par défaut.

## Schémas publics

Le module introduit six schémas versionnés :

- `sra.temporal_action_boundary_checkpoint.v1` ;
- `sra.temporal_environment_action_request.v1` ;
- `sra.temporal_environment_action_response.v1` ;
- `sra.temporal_environment_attempt.v1` ;
- `sra.temporal_environment_dispatch.v1` ;
- `sra.temporal_action_boundary_journal.v1`.

## Autorités séparées

La reconstruction conserve quatre autorités distinctes :

1. `TemporalActConsumedReceipt` prouve que le permis a été consommé et que la lease est passée à `released` ;
2. `TemporalActionBoundaryCheckpoint` identifie le workflow réellement suspendu ;
3. `TemporalActionBoundaryCurrentAuthority` atteste que le contexte est encore courant avant transport ;
4. l'adaptateur `TemporalEnvironmentTransport` est le seul composant qui reçoit le payload `AgentAction`.

Le reçu ACT reste sans payload exécutable. L'action est réhydratée depuis le binding préparé uniquement lors de la construction de la requête de transport.

## Revalidation avant tentative

Avant toute écriture ou tout appel externe, `ActionBoundary` revalide :

- le fingerprint du binding préparé ;
- le fingerprint de la lease ;
- le fingerprint du permis ;
- le fingerprint du reçu ACT et de sa transition ;
- l'identité exacte intent, permis, reçu ACT et action ;
- Source, workflow et instance de workflow ;
- session, timeline, frame et révision ;
- identité temporelle et snapshot pré-action ;
- disponibilité courante de l'action ;
- état `released` de la lease ;
- checkpoint encore suspendu et courant ;
- responsabilité encore courante ;
- contexte monde et adaptateur environnemental encore courants.

Une divergence provoque un refus avant transport :

`not_dispatched_release_refused`

Aucune tentative n'est persistée et l'adaptateur externe n'est pas appelé.

## Digest de requête

La requête de transport scelle notamment :

- l'adaptateur environnemental ;
- le checkpoint ;
- le workflow et son instance ;
- Source ;
- session, timeline, frame et révision ;
- intent, permis et reçu ACT ;
- identité de l'action ;
- payload `AgentAction` normalisé ;
- séquence d'observation ;
- snapshot pré-action ;
- contexte monde.

Le digest est déterministe et détecte tout changement de lignée ou de contexte.

## Ordre durable obligatoire

L'ordre qualifié est :

1. construire la requête ;
2. construire la tentative ;
3. persister la tentative ;
4. relire et valider la tentative persistée ;
5. appeler le transport ;
6. valider la réponse ;
7. construire le dispatch ;
8. persister le dispatch ;
9. relire et valider le dispatch persisté.

La tentative doit exister durablement avant le premier appel externe.

## Résultat inconnu

Une tentative existante sans dispatch durable est classée :

`unknown`

Dans cet état :

- `redeliveryPermitted: false` ;
- `reconciliationRequired: true` ;
- aucun nouvel appel de transport n'est effectué ;
- le journal durable de tentative est conservé ;
- aucun faux succès n'est produit.

La même règle s'applique lorsque :

- le transport lève une erreur ;
- la connexion est perdue après un possible effet externe ;
- la réponse change les identités de dispatch, intent ou permis ;
- l'observation retournée est invalide ;
- le processus tombe après le transport mais avant la persistance du dispatch ;
- la persistance du dispatch échoue.

Le système préfère donc un résultat explicitement inconnu à une redélivrance potentiellement duplicative.

## Dispatch durable et réutilisation

Lorsqu'une réponse valide est persistée :

- le journal contient exactement une tentative et un dispatch pour cette requête ;
- le dispatch conserve le digest de requête et le digest de réponse ;
- les identités de l'événement environnemental, de l'intent, du permis et du reçu ACT sont liées ;
- l'observation acquise et son fingerprint sont conservés ;
- `redeliveryPermitted` reste `false` ;
- `causalResumeAuthorized` reste `false` ;
- `workflowResumed` reste `false`.

Rejouer la même demande réutilise le dispatch enregistré :

- aucun nouvel appel externe ;
- aucune nouvelle tentative ;
- aucune nouvelle persistance ;
- même résultat durable.

## Journal

Le journal est borné et fail-closed :

- capacité par défaut : 128 dispatches ;
- capacité maximale configurable : 1024 ;
- identités de tentative, dispatch et digest uniques ;
- aucune éviction silencieuse ;
- restauration avec validation des fingerprints ;
- rejet des observations acquises altérées ;
- rejet des dispatches sans tentative exacte.

## Qualification fonctionnelle

Le jalon ajoute 15 tests fonctionnels couvrant :

- ordre tentative, transport, dispatch ;
- réutilisation d'un dispatch enregistré ;
- tentative sans dispatch et interdiction de redélivrer ;
- crash après effet externe ;
- réponse aux identités modifiées ;
- échec de persistance du dispatch ;
- refus courant avant transport ;
- changement du contexte monde ;
- payload point uniquement dans la requête de transport ;
- canonicalisation des métadonnées ;
- restauration et détection d'altération ;
- persistance incomplète de la tentative ;
- observation sans progression de séquence ;
- reçu ACT altéré.

La suite affectée compte désormais 240 tests fonctionnels, tous réussis, avec typecheck TypeScript strict réussi.

## Limites du jalon

Ne sont pas encore reconstruits :

- la réconciliation externe d'une tentative `unknown` ;
- la preuve qu'un effet externe incertain a ou n'a pas eu lieu ;
- la qualification causale de l'observation acquise ;
- la reprise du workflow suspendu ;
- l'intégration à `TemporalObservationState` ;
- le consommateur runtime final ;
- l'activation du worker ;
- les séries pré-déclarées ;
- l'acquisition différée de concentration ;
- la campagne comportementale réelle ;
- la mesure officielle STCK/SMLP.

## Prochaine étape

Construire la frontière de reprise causale :

`dispatch durable -> observation acquise -> qualification causale -> reprise du checkpoint -> réconciliation du workflow`

Cette étape devra conserver la même identité de dispatch, intent, permis, événement environnemental, snapshot et observation acquise, sans convertir une tentative `unknown` en succès par défaut.
