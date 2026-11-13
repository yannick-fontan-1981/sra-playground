# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-12

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

## Règle de portée

Cette feuille de route décrit une nouvelle reconstruction qualifiée à partir de preuves GitHub durables.

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
| bridge vers trace Logos | qualifié | capability séparée des OP01-OP31 |
| compatibilité worker/V6 rebasée | qualifiée | régressions worker et V6 incluses |
| port `AgentDecisionPort` passif | **qualifié** | CI 145/145, aucune action sans ACT séparé |
| politique historique TemporalSelection | absente | ne pas inventer |
| producteur public du domaine | ouvert | aucune perception/candidate factory justifiée |
| autorité ACT séparée | **audit suivant** | la sélection seule ne donne jamais ACT |
| liaison candidat -> `AgentAction` | ouverte | aucune conversion implicite admise |
| position runtime commune | ouverte | `v6-native-runtime.ts` absent |
| registre d'entrées reconstruit | ouvert | `v6-entry-point-progress.json` absent |
| contribution en partie réelle | ouverte | aucune campagne comportementale TemporalSelection actuelle |
| performance officielle | à confirmer | runners/corpus STCK/SMLP manquants |
| intégration canonique | non réalisée | branche de lot encore séparée |
| publication Site | non réalisée | interdite avant intégration GitHub qualifiée |

## Qualification actuelle

Commit de code qualifié :

`f303174c1104d1f8aa61ade8e628e4b6636d9caa`

GitHub Actions :

- run `43345997522` ;
- **145 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi.

Le précédent jalon comptait 130 tests. Le port passif ajoute 15 tests couvrant son identité, ses refus, sa file bornée, sa trace et son intégration au worker.

Le worker public reste en mode :

`reconstruction-pending-perception`

et ne produit aucune action par défaut.

## Port de décision passif - jalon terminé

Le port reçoit explicitement :

- `TemporalObservationState` ;
- `TemporalSourceAuthority` ;
- `TemporalSourceDecisionReceipt` ;
- éventuellement `TemporalReturnMeasurement` ;
- une liaison à l'observation worker publique exacte.

Il ne reçoit aucune action et impose :

`actAuthorization: null`

Comportement courant :

- enveloppe absente ou invalide : `undefined` ;
- sélection externe refusée : `undefined` ;
- sélection externe acceptée : projection enregistrée, puis `undefined` ;
- aucune action libérée ;
- aucune modification du port public par défaut.

## Prochaine étape - audit de l'autorité ACT

Avant de concevoir un contrat de libération, rechercher dans les donneurs durables V5/V6 :

1. qui détient l'autorité d'agir ;
2. quelle identité relie cette autorité à l'observation courante ;
3. comment une proposition sélectionnée devient une cible et une `AgentAction` disponible ;
4. quelles preuves doivent rester actives ;
5. quelles révisions invalident l'autorisation ;
6. comment empêcher la double consommation ;
7. quel composant runtime consomme réellement le reçu.

### Issue A - donneur récupérable

Reconstruire uniquement les invariants prouvés, puis qualifier :

- autorité distincte ;
- fraîcheur ;
- domaine d'actions disponibles ;
- cible et paramètres ;
- consommation unique ;
- révocation ;
- trace décisionnelle.

### Issue B - donneur non récupérable

Documenter le manque et conserver le port en mode passif.

Une nouvelle politique ACT ne pourra être conçue qu'en tant que nouveau contrat explicitement spécifié et qualifié, jamais comme restitution supposée de Site 109.

## Étapes ultérieures

1. terminer l'audit ACT et de liaison candidat -> action ;
2. reconstruire ou concevoir explicitement un contrat ACT séparé si justifié ;
3. retrouver ou concevoir explicitement le producteur public du domaine TemporalSelection ;
4. raccorder le port au worker uniquement par injection qualifiée ;
5. reconstruire une campagne fonctionnelle durable ;
6. reconstruire le registre d'entrées ;
7. restaurer les runners officiels STCK/SMLP ;
8. mesurer selon ABBA ;
9. réconcilier avec la tête canonique ;
10. intégrer dans `recovery/site109-reconstruction-20261112` ;
11. publier le Site seulement après vérification SHA GitHub <-> Site.

## Performance

Critère historique :

- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- jeux séparés ;
- aucune compensation ;
- dépassement interne admissible si le global du même jeu passe.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
