# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-12

## Identité

- Lot : **10D / TemporalSelection**
- Branche : `recovery/lot10d-temporal-selection-rebased-20261112`
- Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`
- Tête canonique parallèle observée après ce jalon : `e3fa1901452423a714d3a47d5a469dbf112c55b0`

La divergence parallèle n'est pas une intégration. Aucune parité complète avec Site 109 / native 0.68 n'est revendiquée.

## Nature de la reconstruction

L'ancienne branche historique ne contenait aucun delta 10D récupérable. Le code actuel est une reconstruction qualifiée à partir de contrats et donneurs GitHub durables.

Pour le permis ACT, les sources historiques utiles ont été retrouvées dans le dépôt V5 privé au commit :

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
11. permis ACT ordinaire lié à une lease de concentration validée.

Derniers fichiers ajoutés :

- `src/runtime/v6-temporal-action-release-permit.ts`
- `tests/v6-temporal-action-release-permit.test.ts`
- `docs/recovery/lot10d-temporal-action-release-permit.md`
- `docs/recovery/lot10d-temporal-action-release-donor-map.md`

## Schéma historique récupéré

Les donneurs V5 établissent que le permis historique lie au minimum :

- l'identité de l'intent ;
- l'évaluation de viability ;
- la décision de commitment ;
- l'action disponible ;
- le snapshot pré-action ;
- la révision maximale de validité ;
- une lease de concentration ;
- éventuellement une série pré-déclarée ou une acquisition différée de concentration.

Les donneurs établissent également que :

- le permis ne transporte pas directement l'action vers l'environnement ;
- ACT revalide le contexte et fait passer la lease à `RELEASED` ;
- `ActionBoundary` revérifie encore le checkpoint avant le premier transport ;
- la tentative est persistée avant l'appel externe ;
- un résultat incertain interdit toute redélivrance automatique ;
- l'acquisition et la réconciliation restent des étapes séparées.

## Permis ACT ordinaire reconstruit

Le nouveau reçu public lie :

- l'identité Source ;
- la session et la séquence publiques ;
- l'empreinte exacte de l'observation publique ;
- l'identité et la révision temporelles ;
- l'intent et le binding du candidat d'action ;
- le candidat TemporalSelection et la décision ;
- la cible et l'identifiant public de l'action ;
- l'identité courante de disponibilité ;
- le snapshot pré-action ;
- la viability et le commitment ;
- les décisions DRM et SRC ;
- le principe, l'effet attendu, les prémisses et falsificateurs ;
- une lease de concentration `validated` ;
- une empreinte de lease et une empreinte de permis.

Le mapping public utilise l'`observationRevision`, l'empreinte de l'`AgentObservation` et une identité locale de disponibilité. Il ne prétend pas reproduire octet pour octet la sérialisation historique.

## Conditions de création

Un permis ne peut être créé que si :

- la sélection est acceptée ;
- l'intent et le binding appartiennent à la même décision et à la même observation ;
- l'audit ACT est exactement `eligible` ;
- l'action reste disponible ;
- l'effet attendu appartient à l'intent gelé ;
- toutes les références d'autorité existent déjà dans les preuves qualifiées ;
- le permis n'est pas périmé ;
- la lease n'est pas périmée ;
- le permis ne dépasse pas la durée de la lease ;
- les domaines de preuves sont explicites, uniques et bornés ;
- les empreintes restent intactes.

Les doublons de preuves sont refusés avant canonicalisation.

## Autorité conservée et limites

Un permis valide expose :

- `actionPermitPresent: true` ;
- `releaseEligible: true` ;
- `actAuthorized: true` ;
- `actionPayloadPresent: false` ;
- `actionReleased: false` ;
- `environmentDispatchAuthorized: false`.

`actAuthorized: true` autorise seulement l'entrée dans une future étape ACT distincte. Cela ne prouve pas que la lease est passée à `RELEASED` et ne permet pas d'envoyer l'action au jeu.

Le reçu et sa projection ne contiennent ni `candidateAction` ni cible exécutable.

## Portée encore retenue

Le chemin courant couvre seulement une action ordinaire unique avec une lease déjà validée.

Restent explicitement absents :

- la transition de lease `VALIDATED -> RELEASED` ;
- la revalidation ACT au moment exact de la consommation ;
- le journal de consommation unique ;
- la révocation persistée ;
- le consommateur runtime final ;
- la frontière d'envoi exactement une fois ;
- la récupération d'un résultat de transport incertain ;
- les séries pré-déclarées ;
- l'acquisition différée de concentration ;
- le producteur public du candidat d'action ;
- une exécution comportementale réelle.

Le worker public reste :

`reconstruction-pending-perception`

Le port continue à retourner `undefined` et le statut reste :

`action_withheld`

## Qualification GitHub CI

Commit qualifié :

`467562a1e939e1d8fdc2609d0f212e73df5aeb24`

Run GitHub Actions :

`43356644647`

Résultat :

- **202 tests** ;
- **202 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute au précédent total de 181 :

- 18 tests fonctionnels du permis ;
- 3 contrôles anti-dérive de la carte des donneurs privés ;
- le typecheck strict du nouveau module.

`npm ci` signale toujours deux vulnérabilités de sévérité élevée dans les dépendances de la baseline. Aucune correction forcée n'a été appliquée dans ce lot, car elle toucherait un périmètre partagé qui exige une qualification séparée.

## Limites générales restantes

Ne sont toujours pas reconstruits ou qualifiés :

- la politique historique de sélection TemporalSelection ;
- l'ancien state machine Site 109 ;
- le producteur public des domaines et candidats ;
- le producteur historique exact du mapping `selectedRef -> AgentAction` ;
- l'exécution ACT et la transition de lease ;
- la consommation unique et la révocation du permis ;
- `ActionBoundary` et son journal de transport ;
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

Reconstruire la consommation ACT distincte :

1. relecture du permis et du binding exacts ;
2. revalidation de Source, session, timeline, frame, révision et snapshot ;
3. revalidation des preuves de responsabilité et de continuité ;
4. revalidation de l'action autorisée et de la lease ;
5. transition unique `VALIDATED -> RELEASED` ;
6. reçu persistant de consommation ou de révocation ;
7. production d'un `ActOutput` sans transport direct.

Ensuite seulement, reconstruire `ActionBoundary` avec tentative durable, envoi exactement une fois, traitement du résultat incertain, acquisition et réconciliation.

Le worker restera en `action_withheld` jusqu'à qualification de toute cette chaîne.
