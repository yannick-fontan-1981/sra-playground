# Lot 10D — TemporalSelection — feuille de route de reconstruction

Date : 2026-11-12

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Baseline : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

## Règle de portée

Cette feuille de route décrit une **nouvelle reconstruction qualifiée** à partir de preuves GitHub durables.

Elle ne revendique ni identité de code ni parité fonctionnelle complète avec l'ancien Site 109 / native 0.68.

## État actuel

| Étape | Statut | Preuve / limite |
| --- | --- | --- |
| audit de l'ancienne branche 10D | terminé | aucun delta 10D récupérable |
| contrat Source / sélection fail-closed | qualifié | sélection externe seulement, aucun fallback |
| mémoire courante | qualifiée | preuve rappelée + preuve courante liée à l'observation |
| identité/idempotence des retours | qualifiée | scope, chronologie, produits, révisions et empreintes |
| état minimal/restauration | qualifié | état descriptif, borné, `actAuthorized: false` |
| reçu Source/DRM | qualifié | Source, DRM, observation, domaine et résultat scellés |
| adaptateur de consommation | qualifié | ne choisit pas le candidat |
| bridge vers trace Logos | qualifié | capability séparée des OP01–OP31 |
| compatibilité worker/V6 rebasée | qualifiée | CI 130/130, typecheck strict |
| politique historique TemporalSelection | absente | ne pas inventer |
| producteur public du domaine | ouvert | aucune perception/candidate factory justifiée |
| position runtime commune | ouverte | `v6-native-runtime.ts` absent |
| autorité ACT | ouverte et séparée | aucune commande ne doit être libérée par le bridge |
| registre d'entrées reconstruit | ouvert | `v6-entry-point-progress.json` absent |
| contribution en partie réelle | ouverte | aucune campagne comportementale TemporalSelection actuelle |
| performance officielle | à confirmer | runners/corpus STCK/SMLP manquants |
| intégration canonique | non réalisée | branche de lot encore séparée |
| publication Site | non réalisée | interdite avant intégration GitHub qualifiée |

## Qualification actuelle

Commit de code rebasé :

`b759a7adb5d459211a1ca7984acdc5062bbb88ca`

GitHub Actions :

- run `43341620341` ;
- **130 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi.

Le worker public reste en mode :

`reconstruction-pending-perception`

et ne produit aucune action par défaut.

## Étape suivante — port de décision passif

Créer un port compatible avec `AgentDecisionPort` qui reçoit explicitement, depuis un producteur injecté :

- `TemporalObservationState` ;
- `TemporalSourceAuthority` ;
- `TemporalSourceDecisionReceipt` ;
- éventuellement `TemporalReturnMeasurement` ;
- un contrat ACT distinct, si et seulement s'il existe une preuve durable permettant d'en définir le schéma.

### Comportement obligatoire

En l'absence d'un de ces éléments ou en cas de divergence :

`decide(...) → undefined`

Le port ne doit pas :

- analyser les pixels ;
- fabriquer les alternatives ;
- sélectionner lui-même un candidat ;
- transformer des coordonnées arbitraires en action ;
- déduire une autorisation ACT depuis la seule sélection ;
- remplacer le port par défaut du worker avant qualification explicite.

### Qualification attendue

- initialisation et reset de session ;
- liaison stricte session/observation/révision ;
- refus d'un reçu périmé ou d'un domaine divergent ;
- restauration de l'état minimal ;
- trace `counters` et `full` ;
- aucune action sans contrat ACT ;
- non-régression worker et V6 core.

## Étapes ultérieures

1. retrouver ou concevoir explicitement le producteur public du domaine TemporalSelection ;
2. qualifier un contrat ACT séparé, sans réutiliser la décision comme autorisation ;
3. raccorder passivement le port au worker par injection, sans remplacer le défaut ;
4. reconstruire une campagne fonctionnelle durable ;
5. reconstruire le registre d'entrées ;
6. restaurer les runners officiels STCK/SMLP ;
7. mesurer selon ABBA ;
8. réconcilier avec la tête canonique ;
9. intégrer dans `recovery/site109-reconstruction-20261112` ;
10. publier le Site seulement après vérification SHA GitHub ↔ Site.

## Performance

Critère historique :

- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- jeux séparés ;
- aucune compensation ;
- dépassement interne admissible si le global du même jeu passe.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
