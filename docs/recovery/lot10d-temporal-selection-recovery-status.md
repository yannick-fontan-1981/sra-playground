# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-12

## Identité du lot

Lot : **10D / TemporalSelection**

Branche de travail qualifiée :

`recovery/lot10d-temporal-selection-rebased-20261112`

Baseline canonique utilisée pour le report :

- branche : `recovery/site109-reconstruction-20261112`
- commit : `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

La branche canonique observée au début du présent jalon avait avancé jusqu'à :

`87a538a1c776fb974a1767f30fea735aac28ded9`

Cette divergence parallèle n'est pas assimilée à une intégration. Une nouvelle réconciliation sera nécessaire avant le port canonique.

## Nature de la reconstruction

L'ancienne branche historique `lot10d-temporal-selection-github-20261112` ne contenait aucun delta 10D récupérable. Le code actuel est donc une reconstruction qualifiée à partir de preuves GitHub durables, pas une copie certifiée de Site 109.

Aucune parité Site 109 / native 0.68 n'est revendiquée.

## Couche TemporalSelection actuellement reconstruite

Les briques suivantes sont présentes :

1. contrat Source / sélection fail-closed ;
2. contrat de réutilisation mémoire liée à l'observation courante ;
3. contrat d'identité et d'idempotence des retours ;
4. état minimal descriptif et restaurable ;
5. reçu de décision Source/DRM avec provenance ;
6. adaptateur de consommation d'une décision externe ;
7. bridge traçable vers le noyau Logos V6 ;
8. port runtime passif compatible avec `AgentDecisionPort`.

Fichiers principaux ajoutés par la dernière étape :

- `src/runtime/v6-temporal-decision-port.ts`
- `tests/v6-temporal-decision-port.test.ts`
- `docs/recovery/lot10d-temporal-decision-port.md`

## Port de décision passif

Le port reçoit une enveloppe explicitement fournie et liée à :

- une session worker ;
- une séquence publique exacte ;
- l'empreinte de l'observation publique ;
- l'identité épisode / observation / révision TemporalSelection ;
- un état restaurable ;
- une autorité Source ;
- un reçu Source/DRM ;
- éventuellement une frontière de retour qualifiée.

Il ne :

- lit pas de données privées du jeu ;
- ne déduit pas la sémantique des pixels ;
- ne fabrique pas les alternatives ;
- ne choisit pas un candidat ;
- ne produit pas d'action ;
- ne déduit pas ACT depuis la sélection.

Une sélection acceptée est projetée, mais la sortie reste :

`undefined`

avec le statut :

`action_withheld`

et :

`actionReleased: false`

## Garanties fail-closed

Le port refuse ou bloque :

- l'absence d'enveloppe ;
- une autre session ;
- une observation publique différente ;
- un binding altéré ;
- un reçu périmé ;
- un domaine divergent ;
- un état ou des preuves non restaurables ;
- une enveloppe dupliquée ;
- une autorité ACT embarquée ;
- un budget invalide ou un signal interrompu.

La file est bornée à 32 enveloppes. Les enveloppes antérieures sont supprimées, tandis qu'une enveloppe future exacte reste en attente.

## Trace

Le sink distingue maintenant :

- `operation:OPxx:*` ;
- `consumption:OPxx:*` ;
- `capability:temporal-selection:*` ;
- `capability_consumption:temporal-selection:*` ;
- `capability:temporal-decision-port:*` ;
- `capability_consumption:temporal-decision-port:*`.

Le mode `counters` conserve les compteurs sans retenir les payloads d'événements.

## Worker public

Le nouveau port est qualifié par injection dans `AgentWorkerCore`.

Il ne remplace pas le port public par défaut :

`PendingPerceptionDecisionPort`

Le worker public conserve la révision :

`reconstruction-pending-perception`

et ne fabrique toujours aucune action.

## Qualification GitHub CI

Commit de code qualifié :

`f303174c1104d1f8aa61ade8e628e4b6636d9caa`

Run GitHub Actions :

`43345997522`

Résultat :

- **145 tests** ;
- **145 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck strict réussi sur le sink, TemporalSelection, le port passif et les sources worker concernées.

La nouvelle étape ajoute 15 tests au précédent jalon de 130 tests.

## Limites fonctionnelles

Ne sont toujours pas reconstruits :

- la politique historique de choix TemporalSelection ;
- l'ancien state machine Site 109 ;
- le producteur public justifié des domaines/candidats ;
- une identité d'autorité ACT séparée ;
- la liaison exacte candidat -> cible -> `AgentAction` ;
- `src/logos-engine/v6-native-runtime.ts` ;
- la position finale dans le runtime commun ;
- le registre reconstruit des entrées ;
- une contribution démontrée dans une partie réelle ;
- les quatre runners natifs officiels A/B x STCK/SMLP.

## Performance

Le protocole ABBA et son calcul sont présents sur la baseline canonique, mais les runners et le corpus officiels ne sont pas restaurés.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Critère conservé :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- chaque jeu séparément ;
- aucune compensation ;
- une phase interne peut dépasser +10 % si le global du même jeu respecte le seuil.

## Prochaine étape

Auditer les donneurs durables V5/V6 afin d'identifier, sans l'inventer :

1. une identité d'autorité ACT distincte de TemporalSelection ;
2. un reçu ou contrat de libération ;
3. la liaison exacte entre candidat sélectionné, cible et `AgentAction` ;
4. les règles de fraîcheur, consommation unique, disponibilité et révocation ;
5. le consommateur runtime réel de cette autorisation.

Si la politique historique ne peut pas être récupérée, le manque devra être documenté avant toute conception nouvelle. Une sélection acceptée ne doit jamais devenir implicitement une permission d'agir.
