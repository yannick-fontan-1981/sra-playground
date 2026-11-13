# Lot 10D — bridge TemporalSelection vers la trace Logos V6

Date : 2026-11-12

## But

Raccorder la chaîne reconstruite de TemporalSelection au mécanisme de trace borné du noyau Logos V6, sans fabriquer un appel OP01–OP31 et sans libérer ACT.

Fichiers principaux :

- `src/logos-engine/v6-temporal-selection-bridge.ts`
- `tests/v6-temporal-selection-bridge.test.ts`

Fichier partagé étendu de manière additive :

- `src/logos-engine/v6-operation-trace.ts`

## Pourquoi une extension du sink était nécessaire

Le contrat initial de `OperationTraceSink` ne représentait que :

- `need` ;
- `operation` portant une clé `OPxx` ;
- `consumption` portant une clé `OPxx`.

TemporalSelection n'est pas qualifié comme un appel réel à une OP particulière. Utiliser artificiellement OP25, OP28 ou une pseudo-OP aurait pollué les compteurs OP01–OP31 et aurait créé une fausse preuve d'usage.

Le sink accepte donc maintenant deux événements additionnels :

- `capability` ;
- `capability_consumption`.

Cette extension conserve la borne, les copies détachées, les compteurs et le comportement des événements OP existants.

## Chaîne tracée

Le bridge enregistre :

1. `need:temporal-selection` ;
2. réception et vérification du reçu Source/DRM ;
3. projection acceptée, refusée ou bloquée ;
4. consommation sémantique `project` ou `refuse` ;
5. consommation optionnelle et idempotente de la frontière de preuve exacte.

La chaîne obtenue est :

`besoin → domaine Source → reçu vérifié → projection → consommation`

Le bridge ne choisit pas le candidat. Le `selectedRef` provient toujours du reçu externe attribué.

## Invariants

- aucun événement `operation` ou `consumption` OP n'est créé par TemporalSelection ;
- les compteurs OP01–OP31 restent séparés ;
- un reçu altéré produit une trace `blocked` puis l'erreur est propagée ;
- un refus vérifié reste un refus, sans fallback ;
- une frontière de retour est consommée au plus une fois ;
- une preuve non reliée au candidat sélectionné est refusée ;
- le même reçu et la même observation donnent le même `needId` ;
- `actAuthorized` reste `false` dans tous les résultats et résumés.

## Qualification et correction

### Première exécution élargie

Run GitHub Actions : `43340553068`

Head : `2a3d2af75984b2803831d6202c3d0f58d38a1ac8`

Résultat :

- **63/63 tests fonctionnels réussis** ;
- typecheck échoué sur trois accès à l'union `TemporalSelectionContractResult` non correctement rétrécie.

Ce passage n'a pas été déclaré qualifiant.

### Correction

Commit de correction :

`d9ce6406379cab1e1ed024d8053392471fc10763`

La décision est maintenant explicitement séparée en branches `accepted` et `refused` avant la construction du résumé de trace.

Run GitHub Actions : `43340660719`

Résultat :

- **63/63 tests réussis** ;
- typecheck strict réussi.

### Régressions V6 affectées

Le workflow a ensuite été élargi aux suites :

- composition engine ;
- native authority ;
- operation cache ;
- operation cycle ;
- operation trace ;
- operations OP ;
- target binding ;
- toutes les suites TemporalSelection reconstruites.

Run GitHub Actions final : `43340758482`

Head qualifié :

`1033edbb1ba23a75106e34bb5159b7f089c6f46d`

Résultat :

- **86 tests** ;
- **86 réussis** ;
- **0 échec** ;
- typecheck strict réussi sur le sink et les sources TemporalSelection.

Les durées CI ne constituent pas une mesure officielle de performance de l'agent.

## Statut fonctionnel

Le bridge est fonctionnellement qualifié dans son périmètre : décision externe attribuée, projection fail-closed, consommation de preuve et trace bornée.

Il ne constitue pas encore :

- le caller runtime complet ;
- une politique TemporalSelection ;
- une autorité de libération d'action ;
- une preuve de contribution dans une partie réelle ;
- une restauration de Site 109.

## Performance

Le harness officiel STCK/SMLP reste absent de cette branche.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Le critère historique reste : global strictement inférieur à +10 % pour STCK et SMLP séparément, sans compensation entre jeux.

## Prochaine étape

Examiner la tête actuelle de `recovery/site109-reconstruction-20261112` afin d'identifier les composants runtime restaurés en parallèle.

Ensuite, raccorder le bridge à un propriétaire runtime minimal seulement si l'identité, la restauration et la position d'appel peuvent être justifiées par le code désormais présent sur GitHub.
