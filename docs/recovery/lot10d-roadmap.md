# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-12

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

Tête canonique parallèle observée après le présent jalon :

`8cc510e0a0d09704eb508b3aa2216b4d63482af4`

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
| port `AgentDecisionPort` passif | qualifié | aucune action sans ACT séparé |
| audit des donneurs ACT | **terminé** | ordre des gates récupéré depuis les Source V5 |
| contrat d'éligibilité aux gates ACT | **qualifié** | CI 160/160, ne produit ni permis ni action |
| politique historique TemporalSelection | absente | ne pas inventer |
| producteur public du domaine | ouvert | aucune perception/candidate factory justifiée |
| schéma historique `ActionIntent` | partiellement documenté | forme exacte non récupérée |
| liaison candidat -> `AgentAction` | **prochaine étape** | aucune conversion implicite admise |
| `ActionReleasePermit` historique | ouvert | encodage et consommation non récupérés |
| position runtime commune | ouverte | `v6-native-runtime.ts` absent |
| registre d'entrées reconstruit | ouvert | `v6-entry-point-progress.json` absent |
| contribution en partie réelle | ouverte | aucune campagne comportementale TemporalSelection actuelle |
| performance officielle | à confirmer | runners/corpus STCK/SMLP manquants |
| intégration canonique | non réalisée | branche de lot encore séparée |
| publication Site | non réalisée | interdite avant intégration GitHub qualifiée |

## Qualification actuelle

Commit de code qualifié :

`a474b6c1862879f79272bd44cdf05b8235fe7c54`

GitHub Actions :

- run `43348069627` ;
- **160 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi.

Le précédent jalon comptait 145 tests. L'audit ACT ajoute 15 tests couvrant l'identité de l'intent, les preuves, les gates de release et l'absence permanente d'action.

Le worker public reste en mode :

`reconstruction-pending-perception`

et ne produit aucune action par défaut.

## Audit ACT - jalon terminé

### Donneurs récupérés

- `src/core/release_action.src`
- `src/core/released_action_cycle.src`
- `src/arc3/conditional_reasoning_tree.src`
- `src/arc3/continue_after_information_probe.src`

### Chaîne établie

`selected branch -> prepared intent -> grounding -> wisdom -> release_action -> ACT`

TemporalSelection ne détient donc pas l'autorité ACT.

### Gates portées

- binding du candidat, de la décision et de l'observation ;
- action actuellement disponible ;
- grounding courant ;
- commitment ;
- viability ;
- engagement expérimental courant ;
- preuve de contrôle courante ;
- mémoire revalidée ;
- continuité et influence parentales ;
- sécurité replay ;
- sécurité endpoint.

L'audit retourne seulement :

- `eligible` ;
- `blocked` ;
- `deferred`.

Même `eligible` conserve :

- `actionPayloadPresent: false` ;
- `actionReleased: false` ;
- `actAuthorized: false`.

## Prochaine étape - liaison intent vers action

Rechercher dans les donneurs durables :

1. la forme exacte d'un `ActionIntent` préparé ;
2. le lien entre `selectedRef` et `actionWitnessRef` ;
3. la cible, les paramètres et l'identité de l'action ;
4. la validation face aux `availableActionIds` courants ;
5. l'identité et la fraîcheur d'un `ActionReleasePermit` ;
6. la consommation unique et la révocation ;
7. le consommateur runtime final qui produit l'`AgentAction`.

### Issue A - donneur récupérable

Reconstruire séparément :

- un contrat d'intent d'action attribué ;
- une liaison exact candidate/target/action ;
- un permis ACT distinct ;
- un consommateur runtime borné et traçable.

La qualification devra vérifier :

- observation et révision exactes ;
- action disponible ;
- paramètres valides ;
- preuves toujours actives ;
- aucune réutilisation après révocation ;
- une seule consommation du permis ;
- refus fail-closed de toute divergence.

### Issue B - donneur non récupérable

Documenter le manque et conserver le port en mode `action_withheld`.

Toute nouvelle liaison devra être un nouveau contrat explicitement spécifié, qualifié et distingué de la restitution historique de Site 109.

## Étapes ultérieures

1. terminer l'audit de liaison `prepared intent -> AgentAction` ;
2. reconstruire un permis ACT séparé uniquement si le donneur le justifie ;
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
