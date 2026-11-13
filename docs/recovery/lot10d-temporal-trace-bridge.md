# Lot 10D — bridge TemporalSelection vers la trace Logos V6

Date : 2026-11-12

## But

Raccorder la chaîne reconstruite de TemporalSelection au mécanisme de trace borné du noyau Logos V6, sans fabriquer un appel OP01–OP31 et sans libérer ACT.

Fichiers principaux :

- `src/logos-engine/v6-temporal-selection-bridge.ts`
- `tests/v6-temporal-selection-bridge.test.ts`

Fichiers partagés étendus de manière additive :

- `src/logos-engine/v6-operation-trace.ts`
- `tests/v6-operation-trace.test.ts`

## Pourquoi une extension du sink est nécessaire

Le contrat historique du sink représente les besoins et les appels OP01–OP31. TemporalSelection n'est pas qualifié comme une OP particulière.

Utiliser artificiellement OP25, OP28 ou une pseudo-OP aurait pollué le registre des opérations et produit une fausse preuve d'usage.

Le sink accepte donc aussi :

- `capability` ;
- `capability_consumption`.

Les compteurs restent séparés :

- `operation:OPxx:*` ;
- `consumption:OPxx:*` ;
- `capability:temporal-selection:*` ;
- `capability_consumption:temporal-selection:*`.

## Fusion avec la trace canonique récente

La baseline canonique `24fcdbb16c93de59489a6bb0392cc709b7a75d14` contient un mode de diagnostic léger :

- `full` conserve les événements bornés ;
- `counters` ne conserve aucun payload et incrémente seulement les compteurs.

Le report rebasé conserve ce mécanisme et ajoute les primitives :

- `countCapability` ;
- `countCapabilityConsumption`.

Les mêmes clés de compteurs sont produites en mode `full` et `counters`.

## Chaîne tracée

Le bridge enregistre :

1. `need:temporal-selection` ;
2. vérification du reçu Source/DRM ;
3. projection acceptée, refusée ou bloquée ;
4. consommation `project` ou `refuse` ;
5. consommation optionnelle et idempotente de la frontière de preuve exacte.

La chaîne est :

`besoin → domaine Source → reçu vérifié → projection → consommation`

Le bridge ne choisit pas le candidat. Le `selectedRef` provient du reçu externe attribué.

## Invariants

- aucune fausse OP n'est créée ;
- un reçu altéré produit une trace `blocked` avant propagation de l'erreur ;
- un refus vérifié reste un refus, sans fallback ;
- une frontière de retour est consommée au plus une fois ;
- une preuve non reliée au candidat sélectionné est refusée ;
- le même reçu et la même observation donnent le même `needId` ;
- `actAuthorized` reste `false` ;
- le mode `counters` ne retient aucun état détaillé.

## Historique de qualification avant rebase

Premier passage élargi :

- run `43340553068` ;
- 63/63 tests fonctionnels réussis ;
- typecheck échoué sur le rétrécissement d'une union TypeScript ;
- passage non déclaré qualifiant.

Correction :

- commit `d9ce6406379cab1e1ed024d8053392471fc10763` ;
- run `43340660719` ;
- 63/63 tests et typecheck réussis.

Régressions V6 voisines :

- run `43340758482` ;
- head `1033edbb1ba23a75106e34bb5159b7f089c6f46d` ;
- 86/86 tests et typecheck réussis.

## Qualification du report rebasé

Branche :

`recovery/lot10d-temporal-selection-rebased-20261112`

Commit qualifié :

`b759a7adb5d459211a1ca7984acdc5062bbb88ca`

Run GitHub Actions :

`43341620341`

Périmètre :

- worker core ;
- worker public ;
- V6 composition/authority/cache/cycle/trace/operations/target binding ;
- toutes les sources et suites TemporalSelection reconstruites.

Résultat :

- **130/130 tests réussis** ;
- 0 échec, annulation, skip ou todo ;
- typecheck strict réussi.

Les durées CI ne constituent pas une mesure officielle du coût de l'agent.

## Statut fonctionnel

Le bridge est fonctionnellement qualifié dans son périmètre : décision externe attribuée, projection fail-closed, consommation de preuve, trace bornée et compatibilité avec le worker restauré.

Il ne constitue pas encore :

- le caller runtime complet ;
- une politique TemporalSelection ;
- une autorité de libération d'action ;
- une preuve de contribution en partie réelle ;
- une restauration exacte de Site 109.

## Performance

Le protocole ABBA est restauré, mais les runners officiels STCK/SMLP manquent encore.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

## Prochaine étape

Construire un `AgentDecisionPort` passif et explicitement alimenté. Il devra retourner `undefined` tant que l'enveloppe Source, l'état TemporalSelection, le reçu attribué et une autorité ACT séparée ne sont pas présents et valides.
