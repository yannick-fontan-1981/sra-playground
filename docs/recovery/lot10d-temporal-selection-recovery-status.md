# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-13

## Identité

- Lot : **10D / TemporalSelection**
- Branche : `recovery/lot10d-temporal-selection-rebased-20261112`
- Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`
- Tête canonique parallèle observée après ce jalon : `90cb819f028aea315fdbba9774a22fb345bcfb81`

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
12. consommation ACT ordinaire, transition de lease et révocation terminale ;
13. `ActionBoundary` durable jusqu'au dispatch enregistré et à l'observation acquise.

Derniers fichiers ajoutés :

- `src/runtime/v6-temporal-action-boundary.ts`
- `tests/v6-temporal-action-boundary.test.ts`
- `docs/recovery/lot10d-temporal-action-boundary.md`

## Chaîne publique qualifiée

La chaîne reconstruite atteint désormais :

`TemporalSelection -> intent préparé -> binding action -> audit ACT -> permis -> consommation ACT -> checkpoint suspendu -> tentative durable -> transport -> dispatch durable`

Le worker public n'utilise pas encore cette chaîne par défaut.

## `ActionBoundary` reconstruite

Le nouveau composant reçoit uniquement un `ActOutput` déjà consommé et une lease déjà passée à `released`.

Avant toute tentative ou tout appel externe, il revalide :

- le fingerprint du binding préparé ;
- le fingerprint de la lease ;
- le fingerprint du permis ;
- le fingerprint du reçu ACT et de sa transition ;
- l'identité exacte de l'intent, du permis, du reçu ACT et de l'action ;
- Source, workflow et instance de workflow ;
- session, timeline, frame et révision ;
- identité temporelle et snapshot pré-action ;
- disponibilité courante de l'action ;
- lease encore `released` ;
- checkpoint encore suspendu et courant ;
- responsabilité encore courante ;
- contexte monde encore courant ;
- adaptateur environnemental encore courant.

Une divergence provoque un refus avant transport :

`not_dispatched_release_refused`

Dans ce cas, aucune tentative n'est persistée et l'adaptateur externe n'est pas appelé.

## Requête et digest de transport

La requête scelle :

- l'adaptateur environnemental ;
- le checkpoint ;
- le workflow et son instance ;
- Source ;
- session, timeline, frame et révision ;
- intent, permis et reçu ACT ;
- identité et payload normalisé de l'action ;
- séquence d'observation ;
- snapshot pré-action ;
- contexte monde.

Le `AgentAction` n'est réhydraté qu'au moment de construire cette requête. Il n'est pas ajouté au reçu ACT ni au reçu durable de dispatch.

## Ordre durable qualifié

L'ordre suivant est imposé :

1. construire la requête ;
2. construire la tentative ;
3. persister la tentative ;
4. relire et valider la tentative persistée ;
5. appeler le transport externe ;
6. valider la réponse ;
7. construire le dispatch ;
8. persister le dispatch ;
9. relire et valider le dispatch persisté.

La tentative existe donc durablement avant le premier appel externe.

## Résultat inconnu et interdiction de redélivrer

Une tentative existante sans dispatch durable est classée :

`unknown`

Dans cet état :

- `redeliveryPermitted: false` ;
- `reconciliationRequired: true` ;
- aucun second appel de transport n'est effectué ;
- le journal de tentative est conservé ;
- aucun faux succès n'est produit.

Cette règle couvre notamment :

- l'erreur ou la perte de connexion du transport ;
- le crash après un possible effet externe ;
- une réponse aux identités modifiées ;
- une observation invalide ;
- le crash avant persistance du dispatch ;
- l'échec de persistance du dispatch.

La reconstruction est donc qualifiée pour l'envoi **au plus une fois** et l'absence de redélivrance automatique. La garantie historique complète dite « exactly-once » reste incomplète tant que la réconciliation externe d'un résultat `unknown` n'est pas reconstruite.

## Dispatch durable et observation acquise

Lorsqu'une réponse valide est persistée :

- une tentative et un dispatch exacts sont liés ;
- les digests de requête et de réponse sont conservés ;
- l'événement environnemental, l'intent, le permis et le reçu ACT restent liés ;
- l'observation acquise et son fingerprint sont conservés ;
- `redeliveryPermitted` reste `false` ;
- `causalResumeAuthorized` reste `false` ;
- `workflowResumed` reste `false`.

Rejouer la même demande réutilise le dispatch déjà enregistré :

- aucun nouvel appel externe ;
- aucune nouvelle tentative ;
- aucune nouvelle persistance ;
- même résultat durable.

L'observation est donc acquise comme donnée durable, mais elle n'est pas encore qualifiée pour reprendre causalement le workflow.

## Journal `ActionBoundary`

Le journal est borné et fail-closed :

- capacité par défaut : 128 ;
- maximum configurable : 1024 ;
- identités de tentative, dispatch et digest uniques ;
- aucune éviction silencieuse ;
- restauration avec validation des fingerprints ;
- rejet d'une observation acquise altérée ;
- rejet d'un dispatch sans tentative exacte ;
- rejet d'une tentative réutilisée avec un autre contexte monde ou une autre lignée.

## Séparation des autorités conservée

Le jalon distingue toujours :

1. le permis ACT ;
2. la consommation ACT et la transition de lease ;
3. le checkpoint suspendu ;
4. la tentative durable ;
5. l'appel externe ;
6. le dispatch durable ;
7. la qualification causale de l'observation ;
8. la reprise du workflow.

Les six premières frontières sont maintenant reconstruites pour le chemin ordinaire à action unique. Les deux dernières restent ouvertes.

Le worker public reste :

`reconstruction-pending-perception`

Le port continue à retourner `undefined`. Le statut global reste donc :

`action_withheld`

jusqu'à qualification de la reprise causale et du consommateur runtime final.

## Qualification GitHub CI

Commit qualifié sur un workflow propre :

`858250b6c4ed0a5586da4e000f34611e64293049`

Run GitHub Actions :

`43364028953`

Résultat :

- **240 tests** ;
- **240 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck TypeScript strict réussi ;
- aucune étape de migration automatique ;
- aucune permission GitHub d'écriture dans la CI de qualification.

Le jalon ajoute au précédent total de 225 :

- 15 tests fonctionnels de `ActionBoundary` ;
- le typecheck strict du nouveau module ;
- les régressions worker, runtime V6, Logos et TemporalSelection existantes.

`npm ci` signale toujours deux vulnérabilités de sévérité élevée dans les dépendances de la baseline. Aucune correction forcée n'a été appliquée dans ce lot, car elle toucherait un périmètre partagé qui exige une qualification séparée.

## Limites générales restantes

Ne sont toujours pas reconstruits ou qualifiés :

- la politique historique de sélection TemporalSelection ;
- l'ancien state machine Site 109 ;
- le producteur public des domaines et candidats ;
- le producteur historique exact du mapping `selectedRef -> AgentAction` ;
- la réconciliation externe d'une tentative `unknown` ;
- la preuve externe qu'un effet incertain a ou n'a pas eu lieu ;
- la qualification causale de l'observation acquise ;
- la reprise du checkpoint suspendu ;
- la réconciliation du workflow après dispatch ;
- le consommateur runtime final ;
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

Reconstruire la reprise causale à partir d'un dispatch durable :

`dispatch durable -> observation acquise -> qualification causale -> reprise du checkpoint -> réconciliation du workflow`

La prochaine qualification devra :

1. relire la tentative et le dispatch exacts ;
2. préserver dispatch, événement environnemental, intent, permis et reçu ACT ;
3. vérifier l'identité, la chronologie et le fingerprint de l'observation acquise ;
4. prouver que l'observation appartient à l'effet du dispatch courant ;
5. autoriser une seule reprise du checkpoint ;
6. empêcher une double consommation de l'observation ;
7. reprendre le workflow avec la même chaîne causale ;
8. maintenir une tentative `unknown` hors du chemin de succès ;
9. ne jamais convertir une absence de preuve externe en succès par défaut.

Le worker restera en `action_withheld` tant que cette chaîne n'est pas entièrement qualifiée.
