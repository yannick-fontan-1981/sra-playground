# Lot 10D - consommation ACT ordinaire et révocation persistante

Date : 2026-11-13

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

## Objet

Ce jalon reconstruit la frontière ACT qui suit immédiatement un permis ordinaire déjà qualifié :

`permis courant -> revalidation ACT -> lease RELEASED ou révocation terminale -> ActOutput`

La frontière ACT reste distincte de la frontière environnementale. Elle ne reçoit ni ne retourne un payload `AgentAction` exécutable et n'appelle jamais le jeu.

## Provenance durable

Les invariants historiques sont issus du dépôt V5 privé au commit épinglé :

`212d8d426f07eea2b6797c2bb647545767488a96`

La carte publique des donneurs et blobs Git est conservée dans :

`docs/recovery/lot10d-temporal-action-release-donor-map.md`

Les donneurs établissent notamment que :

1. ACT revalide l'intent, le permis, les preuves courantes et la lease ;
2. la lease passe de `VALIDATED` à `RELEASED` uniquement après cette revalidation ;
3. `ActOutput` transporte seulement les identités de l'action, de l'intent et du permis, avec le statut `pending_environment_boundary` ;
4. l'envoi exactement une fois demeure la responsabilité séparée d'`ActionBoundary`.

## Fichiers

Code :

`src/runtime/v6-temporal-act-consumption.ts`

Tests :

`tests/v6-temporal-act-consumption.test.ts`

Carte des donneurs :

`docs/recovery/lot10d-temporal-action-release-donor-map.md`

## Schémas reconstruits

### Transition de lease

Version :

`sra.temporal_act_lease_transition.v1`

La transition lie :

- la lease et le permis exacts ;
- l'intent ;
- Source, workflow, run, timeline et frame ;
- la révision courante ;
- l'état initial `validated` ;
- l'état terminal `released`, `invalidated` ou `expired` ;
- une raison explicite ;
- les preuves courantes ;
- une empreinte déterministe.

### Reçu terminal ACT

Version :

`sra.temporal_act_terminal_receipt.v1`

Chaque permis reçoit au plus un résultat terminal :

- `consumed` lorsque toutes les revalidations réussissent ;
- `revoked` lorsque le contexte n'est plus courant ou qu'une autorité a été retirée.

Le reçu terminal conserve :

- les empreintes du permis et de la lease ;
- l'intent, le binding et l'action candidate par identité ;
- le contexte d'exécution ;
- la transition de lease ;
- les preuves ;
- l'absence de payload d'action ;
- l'absence d'autorité de transport ;
- l'interdiction de réutiliser le permis.

### Journal de consommation

Version :

`sra.temporal_act_consumption_journal.v1`

Le journal est borné :

- capacité par défaut : 128 reçus terminaux ;
- maximum configurable : 1024 ;
- une seule identité terminale par permis ;
- aucune éviction silencieuse lorsque la capacité est atteinte.

Un journal plein échoue fermé afin de ne jamais perdre la preuve d'unicité.

## Mapping public V6

Le mapping courant est explicite et ne prétend pas reproduire octet pour octet la sérialisation historique :

- `runRef` correspond au `sessionId` public ;
- `timelineRef` correspond à l'`episodeId` temporel ;
- `frameRef` correspond à l'`observationId` ;
- `stateRevision` correspond à l'`observationRevision` ;
- le snapshot courant correspond à l'empreinte exacte de l'`AgentObservation` ;
- l'identité de disponibilité est `available-action:<session>:<sequence>:<id>`.

## Revalidation ACT

Avant consommation, le contrat revalide séparément :

- l'empreinte du binding préparé ;
- l'empreinte de la lease ;
- l'empreinte du permis ;
- la sélection, l'intent et l'audit ACT éligible ;
- Source et workflow ;
- la session/run ;
- la timeline ;
- la frame ;
- la révision et l'identité temporelle ;
- la séquence et l'image publiques ;
- le snapshot pré-action ;
- les empreintes canoniques courantes du permis et de la lease ;
- une lease toujours `validated` ;
- l'absence d'expiration ;
- l'action toujours disponible ;
- l'absence de supports retirés ;
- la responsabilité courante ;
- les preuves courantes de consommation du but ;
- la continuation parent ;
- le transport des contributions ;
- le contexte canonique d'exécution.

Une autorité courante mal formée ou privée de ses preuves obligatoires est refusée techniquement. Elle n'est pas transformée artificiellement en révocation sémantique.

## Issue consommée

Lorsque tout est courant :

- la lease passe de `validated` à `released` ;
- le permis devient terminal ;
- `permitConsumed: true` ;
- `permitReusable: false` ;
- `actCompleted: true` ;
- `actionReleased: true` ;
- un `ActOutput` minimal est émis.

Ici, `actionReleased: true` signifie uniquement que l'identité d'action est relâchée vers la future frontière environnementale.

Le `ActOutput` contient :

- `outputKind: action_dispatch` ;
- `actionRef` ;
- `actionIntentRef` ;
- `actionReleasePermitRef` ;
- `dispatchStatus: pending_environment_boundary`.

Il ne contient :

- ni `AgentAction` ;
- ni identifiant public `id` ;
- ni coordonnées ;
- ni cible exécutable ;
- ni autorité de transport.

Le reçu conserve donc :

- `actionPayloadPresent: false` ;
- `environmentDispatchAuthorized: false` ;
- `actAuthorized: false` après consommation terminale.

## Issue révoquée

Le permis devient terminalement révoqué lorsque le contexte n'est plus courant, par exemple :

- Source, run, timeline ou frame changés ;
- révision ou identité temporelle changée ;
- séquence ou snapshot public changé ;
- empreinte canonique du permis ou de la lease différente ;
- permis ou lease expiré ;
- lease déjà libérée, invalidée ou non validée ;
- action plus disponible ;
- support retiré ;
- responsabilité, consommation de but, continuation parent, contribution ou contexte d'exécution périmés.

La transition terminale est :

- `validated -> invalidated` pour une autorité retirée ou un contexte divergent ;
- `validated -> expired` pour une fenêtre de validité écoulée.

Une révocation ne produit aucun `ActOutput`, ne libère aucune action et interdit la réutilisation du permis.

## Idempotence et unicité

Le journal impose :

- le replay du même permis retourne le même reçu sans second `ActOutput` ;
- le même `permitRef` avec une autre empreinte est refusé ;
- une révocation persistée ne peut pas renaître si des faits courants sont présentés ultérieurement ;
- les doublons d'identité dans un snapshot restauré sont refusés ;
- toute altération du reçu ou de la transition est détectée ;
- l'ordre des ensembles de preuves est canonicalisé sans accepter de doublons.

Cette unicité concerne la consommation ACT. Elle ne remplace pas l'envoi exactement une fois de l'environnement.

## Limites maintenues

Ce jalon ne reconstruit pas encore :

- `ActionBoundary` ;
- le checkpoint suspendu exact ;
- le digest de requête de transport ;
- la tentative durable écrite avant l'appel externe ;
- le résultat de transport `unknown` ;
- l'interdiction et la réconciliation de redélivrance après résultat incertain ;
- le dispatch enregistré et réutilisable ;
- l'acquisition de la nouvelle observation ;
- la reprise causale ;
- les séries pré-déclarées ;
- l'acquisition différée de concentration ;
- le producteur public du candidat ;
- une campagne comportementale réelle.

Le worker public n'est pas modifié. Le port passif continue à retourner `undefined` et le statut global reste `action_withheld` tant que la frontière environnementale complète n'est pas qualifiée.

## Qualification GitHub CI

Commit de code et de tests qualifié :

`ad3437f87f8ea490b1bf1575fe0a1ffba5b1ef70`

Run GitHub Actions :

`43359714683`

Résultat :

- **225 tests** ;
- **225 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute au total précédent de 202 :

- 20 tests fonctionnels de consommation/révocation ACT ;
- 3 contrôles supplémentaires des invariants donneurs ;
- le typecheck strict du nouveau module.

Un run précédent avait déjà qualifié le contrat fonctionnel à 222/222. Une assertion documentaire ancienne a ensuite été ajustée pour distinguer correctement `actionReleased` de l'autorité de transport ; la qualification finale est 225/225.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Critère conservé :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- chaque jeu séparément ;
- aucune compensation entre jeux ;
- une phase interne peut dépasser +10 % si le global du même jeu reste sous le seuil.

## Prochaine étape

Reconstruire `ActionBoundary` comme frontière distincte :

`ActOutput -> checkpoint suspendu courant -> tentative durable -> transport exactement une fois -> acquisition -> réconciliation`

La prochaine étape devra notamment :

1. relire le même intent, permis et reçu ACT ;
2. vérifier le checkpoint suspendu et Source ;
3. construire un digest couvrant adaptateur, workflow, timeline, frame, intent, permis et contexte monde ;
4. persister la tentative avant l'appel externe ;
5. interdire toute redélivrance automatique si le résultat est inconnu ;
6. réutiliser un dispatch déjà enregistré ;
7. valider la réponse contre les identités de dispatch, intent et permis ;
8. acquérir l'observation causale ;
9. reprendre et réconcilier le workflow sans faux succès.
