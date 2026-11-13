# Lot 10D — adaptateur descriptif de sélection externe

Date : 2026-11-12

## But

Relier l'état TemporalSelection minimal à un résultat de sélection produit **à l'extérieur** par une autorité Source/DRM, sans reconstruire ni inventer la politique historique perdue.

Fichier :

`src/logos-engine/v6-temporal-selection-adapter.ts`

Tests :

`tests/v6-temporal-selection-adapter.test.ts`

## Contrat

L'adaptateur reçoit :

- l'état TemporalSelection minimal déjà qualifié ;
- l'autorité Source attendue ;
- un `selectedRef` fourni de l'extérieur ;
- facultativement une frontière de retour exacte déjà qualifiée à consommer.

L'adaptateur ne calcule jamais `selectedRef`.

Il projette la référence externe via `projectTemporalSelectionDecision`.

## Règles

### Sélection

- `null` reste une non-sélection explicite et fail-closed ;
- une référence hors du domaine Source est refusée ;
- une sélection acceptée conserve les faits et preuves du candidat déclaré ;
- l'adaptateur n'accorde jamais ACT.

### Consommation d'un retour

Un retour n'est consommé que si :

1. sa frontière mesurée exacte est déjà dans `qualifiedReturns` ;
2. la sélection est acceptée ;
3. au moins une référence de preuve du retour appartient aux preuves du candidat sélectionné.

Un simple nom, digest approximatif ou référence de candidat ne suffit pas à désigner un retour.

Une seconde consommation de la même frontière est idempotente.

## Tests exécutés

Commande :

`node --experimental-strip-types --test tests/v6-temporal-selection-adapter.test.ts`

Résultat :

- **8 tests**
- **8 réussis**
- **0 échec**

Typecheck strict des cinq sources Temporal reconstruites :

`npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --strict --skipLibCheck ...`

Résultat : **réussi**.

## Qualification cumulée

Avant ce jalon :

- contrats + identité retour : 23 tests ;
- état minimal : 11 tests.

Ce jalon ajoute :

- adaptateur descriptif : 8 tests.

Total ciblé TemporalSelection reconstruit : **42 tests réussis, 0 échec fonctionnel**.

Ce total ne prouve pas une parité avec Site 109 et ne remplace pas les campagnes runtime ou la performance officielle.

## Limite

Le type `ExternalTemporalSelectionResult` transporte actuellement un `selectedRef` externe, mais ne transporte pas encore une identité complète de la décision externe elle-même.

La prochaine étape doit donc reconstruire un **reçu de décision Source/DRM** :

- workflow ;
- source hash ;
- observation/révision ;
- domaine d'alternatives ;
- selectedRef ou refus ;
- preuves/empreinte du résultat.

L'adaptateur devra ensuite exiger ce reçu au lieu d'un simple `selectedRef`.

Cela renforcera la provenance sans ajouter de politique de choix.
