# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-13

## Identité

- Lot : **10D / TemporalSelection**
- Branche : `recovery/lot10d-temporal-selection-rebased-20261112`
- Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`
- Tête canonique parallèle observée après ce jalon : `d7ba12eef7063cf86dfa55f43879c29bc1dfa87d`

La divergence parallèle n'est pas une intégration. Aucune parité complète avec Site 109 / native 0.68 n'est revendiquée.

## Nature de la reconstruction

L'ancienne branche historique ne contenait aucun delta 10D récupérable. Le code actuel est une reconstruction qualifiée à partir de contrats et donneurs GitHub durables.

Les sources historiques utiles du permis, d'ACT et de la frontière environnementale ont été retrouvées dans le dépôt V5 privé au commit :

`212d8d426f07eea2b6797c2bb647545767488a96`

Le code privé n'est pas republié. Les chemins, blobs Git et invariants récupérés sont conservés dans :

`docs/recovery/lot10d-temporal-action-release-donor-map.md`

## Couche reconstruite

Les briques présentes sont maintenant :

1. sélection Source fail-closed ;
2. mémoire liée à l'observation ;
3. identité et idempotence des retours ;
4. état descriptif restaurable ;
5. reçu Source/DRM ;
6. adaptateur de consommation ;
7. bridge traçable Logos V6 ;
8. port runtime passif ;
9. audit des gates d'éligibilité ACT ;
10. binding attribué d'un candidat `AgentAction` préparé ;
11. permis ACT ordinaire lié à une lease de concentration validée ;
12. consommation ACT ordinaire, transition de lease et révocation terminale.

Derniers fichiers ajoutés :

- `src/runtime/v6-temporal-act-consumption.ts`
- `tests/v6-temporal-act-consumption.test.ts`
- `docs/recovery/lot10d-temporal-act-consumption.md`

## Consommation ACT ordinaire reconstruite

La chaîne publique qualifiée atteint désormais :

`TemporalSelection -> intent préparé -> binding action -> audit ACT -> permis -> consommation ACT`

Le module de consommation relit et revalide :

- le binding préparé ;
- la lease ;
- le permis ;
- la décision TemporalSelection ;
- l'intent et l'audit ACT ;
- Source et workflow ;
- le run/session ;
- la timeline ;
- la frame ;
- la révision et l'identité temporelle ;
- la séquence et l'empreinte de l'observation publique ;
- le snapshot pré-action ;
- les empreintes canoniques courantes du permis et de la lease ;
- la lease encore validée et non expirée ;
- l'action encore disponible ;
- les supports non retirés ;
- la responsabilité ;
- les preuves de consommation du but ;
- la continuation parent ;
- le transport des contributions ;
- le contexte canonique d'exécution.

Le mapping public courant est explicite :

- `runRef = sessionId` ;
- `timelineRef = episodeId` ;
- `frameRef = observationId` ;
- `stateRevision = observationRevision` ;
- le snapshot courant est l'empreinte exacte de l'`AgentObservation`.

Ce mapping ne prétend pas être la sérialisation historique octet pour octet.

## Issue consommée

Lorsque toutes les revalidations réussissent :

- la lease passe de `validated` à `released` ;
- le permis devient terminal et non réutilisable ;
- un `ActOutput` minimal est produit ;
- le reçu conserve `actionReleased: true`.

Dans cette reconstruction, `actionReleased: true` signifie uniquement que l'identité de l'action est relâchée vers la future frontière environnementale.

Le `ActOutput` transporte seulement :

- `actionRef` ;
- `actionIntentRef` ;
- `actionReleasePermitRef` ;
- `dispatchStatus: pending_environment_boundary`.

Il ne contient ni `AgentAction`, ni coordonnées, ni cible exécutable.

Le reçu conserve donc :

- `actionPayloadPresent: false` ;
- `environmentDispatchAuthorized: false` ;
- `actAuthorized: false` après consommation terminale.

## Révocation terminale

Une divergence courante produit un reçu terminal de révocation, avec transition :

- `validated -> invalidated` ;
- ou `validated -> expired` lorsque la fenêtre est écoulée.

Les causes qualifiées incluent notamment :

- Source, run, timeline ou frame modifiés ;
- révision, identité temporelle, séquence ou snapshot modifiés ;
- permis ou lease non canoniques ;
- expiration ;
- lease qui n'est plus validée ;
- action indisponible ;
- support retiré ;
- responsabilité, consommation du but, continuation parent, contribution ou contexte d'exécution non courants.

Une révocation persistée reste terminale même si un appel ultérieur présente de nouveau des faits valides.

## Journal d'unicité

Le journal de consommation ACT est borné et fail-closed :

- capacité par défaut : 128 ;
- maximum configurable : 1024 ;
- une seule identité terminale par permis ;
- le replay exact retourne le même reçu sans second `ActOutput` ;
- le même `permitRef` avec une autre empreinte est refusé ;
- aucun reçu n'est supprimé silencieusement lorsque le journal est plein ;
- les snapshots restaurés refusent doublons et altérations.

Cette unicité couvre la consommation ACT du permis. Elle ne remplace pas l'envoi exactement une fois de l'environnement.

## Séparation avec `ActionBoundary`

Le jalon courant ne transporte aucune action au jeu.

Restent distincts :

1. le checkpoint suspendu exact ;
2. la revalidation scheduler avant transport ;
3. le digest de requête couvrant intent, permis, contexte et adaptateur ;
4. la tentative durable persistée avant l'appel externe ;
5. l'envoi exactement une fois ;
6. le résultat incertain qui interdit toute redélivrance automatique ;
7. le dispatch enregistré et réutilisable ;
8. l'acquisition de l'observation ;
9. la reprise et la réconciliation causales.

Le worker public reste :

`reconstruction-pending-perception`

Le port continue à retourner `undefined`. Le statut global reste donc :

`action_withheld`

jusqu'à qualification de toute la frontière environnementale.

## Qualification GitHub CI

Commit de code et de donneurs qualifié :

`ad3437f87f8ea490b1bf1575fe0a1ffba5b1ef70`

Run GitHub Actions :

`43359714683`

Résultat :

- **225 tests** ;
- **225 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute au précédent total de 202 :

- 20 tests fonctionnels de consommation et révocation ACT ;
- 3 contrôles anti-dérive supplémentaires des donneurs ;
- le typecheck strict du nouveau module.

`npm ci` signale toujours deux vulnérabilités de sévérité élevée dans les dépendances de la baseline. Aucune correction forcée n'a été appliquée dans ce lot, car elle toucherait un périmètre partagé qui exige une qualification séparée.

## Limites générales restantes

Ne sont toujours pas reconstruits ou qualifiés :

- la politique historique de sélection TemporalSelection ;
- l'ancien state machine Site 109 ;
- le producteur public des domaines et candidats ;
- le producteur historique exact du mapping `selectedRef -> AgentAction` ;
- `ActionBoundary` et son checkpoint suspendu ;
- le journal de tentative de transport ;
- l'envoi environnemental exactement une fois ;
- la récupération d'un résultat de transport incertain ;
- l'acquisition et la reprise causale ;
- les séries pré-déclarées ;
- l'acquisition différée de concentration ;
- la position dans le runtime commun ;
- le registre des entrées ;
- une contribution en partie réelle ;
- les runners et corpus officiels STCK/SMLP.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Critère conservé :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- chaque jeu séparément ;
- aucune compensation entre jeux ;
- une phase interne peut dépasser +10 % si le global du même jeu reste sous le seuil.

## Prochaine étape

Reconstruire `ActionBoundary` à partir du `ActOutput` minimal :

1. relire le checkpoint suspendu et les mêmes intent, permis et reçu ACT ;
2. revalider Source, révision, snapshot, responsabilité et lease libérée ;
3. construire le digest exact de la requête de transport ;
4. persister la tentative avant l'appel externe ;
5. interdire une redélivrance après résultat inconnu ;
6. réutiliser un dispatch déjà enregistré ;
7. valider la réponse contre les identités de dispatch, intent et permis ;
8. acquérir l'observation causale ;
9. reprendre et réconcilier le workflow sans faux succès.

Le worker restera en `action_withheld` tant que cette chaîne n'est pas entièrement qualifiée.
