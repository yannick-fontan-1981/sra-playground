# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-12

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

Tête canonique parallèle observée après ce jalon :

`67602172665b79e2b282b37b63f80dc24feff3b0`

## Règle de portée

Cette feuille décrit une reconstruction qualifiée à partir de preuves GitHub durables. Elle ne revendique ni identité de code ni parité complète avec Site 109 / native 0.68.

## État actuel

| Étape | Statut | Preuve / limite |
| --- | --- | --- |
| audit de l'ancienne branche 10D | terminé | aucun delta récupérable |
| contrat Source / sélection fail-closed | qualifié | sélection externe, aucun fallback |
| mémoire courante | qualifiée | preuves rappelées et courantes liées à l'observation |
| identité/idempotence des retours | qualifiée | scope, chronologie, produits et empreintes |
| état minimal/restauration | qualifié | descriptif, borné, sans ACT |
| reçu Source/DRM | qualifié | Source, DRM, observation, domaine et résultat scellés |
| adaptateur de consommation | qualifié | ne choisit aucun candidat |
| bridge Logos V6 | qualifié | capability séparée des OP01-OP31 |
| port runtime passif | qualifié | sélection acceptée, action retenue |
| audit des gates ACT | qualifié | ordre durable, aucun permis produit |
| binding candidat préparé | **qualifié** | `AgentAction` et cible explicites, CI 181/181 |
| permis ACT historique | **prochaine étape** | `source_action_release_permit` incomplet |
| consommation/révocation du permis | ouverte | aucun dispatch autorisé |
| producteur public du domaine | ouvert | perception/candidate factory absente |
| politique historique TemporalSelection | absente | ne pas inventer |
| position runtime commune | ouverte | `v6-native-runtime.ts` absent |
| registre d'entrées | ouvert | `v6-entry-point-progress.json` absent |
| contribution en partie réelle | ouverte | aucune campagne comportementale actuelle |
| performance officielle | à confirmer | runners/corpus STCK/SMLP manquants |
| intégration canonique | non réalisée | branche de lot séparée |
| publication Site | non réalisée | interdite avant intégration GitHub |

## Qualification actuelle

Commit qualifié :

`169a3a958507f12d52b86c45668137101895e893`

Run GitHub Actions :

- run `43351773278` ;
- **181 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi.

Le jalon ajoute :

- 16 tests de binding d'action ;
- 5 tests directs des donneurs ;
- une validation stricte du nouveau source TypeScript.

## Binding candidat préparé - jalon terminé

### Donneurs

- `reference/.../agent.py`
- `reference/.../src/core/released_action_cycle.src`
- `reference/.../src/arc3/conditional_reasoning_tree.src`
- `reference/.../docs/architecture/resolving_architecture_overview.md`

### Chaîne établie

`TemporalSelection acceptée -> intent préparé -> cible explicite -> AgentAction candidate`

Le candidat est fourni par un producteur externe. Le binding ne le déduit pas du seul `selectedRef`.

### Garanties

- identité Source et décision préservées ;
- observation publique exacte ;
- session et séquence exactes ;
- action valide et actuellement disponible ;
- cible cohérente avec le payload public ;
- preuves sélectionnées préservées ;
- domaines de preuves explicites, uniques et bornés ;
- empreinte de binding déterministe ;
- aucune autorité ACT.

### Sortie

Même après succès :

- `actionCandidatePresent: true` ;
- `actionPermitPresent: false` ;
- `releaseEligible: false` ;
- `actionReleased: false` ;
- `actAuthorized: false`.

## Prochaine étape - permis ACT distinct

Rechercher le donneur durable exact de :

`prepared action binding -> source_action_release_permit -> dispatch -> acquisition`

Le contrat attendu, s'il est justifié, devra couvrir :

1. identité du producteur du permis ;
2. liaison au binding et à l'intent ;
3. contexte courant `run/timeline/frame/revision` ;
4. engagement, viability, grounding, contrôle, mémoire, parent et sécurité ;
5. action toujours disponible ;
6. consommation unique ;
7. révocation sur changement de contexte ou de preuve ;
8. dispatch seulement par le consommateur runtime autorisé ;
9. trace distincte du candidat, du permis et du dispatch.

### Issue A - donneur complet récupérable

Reconstruire le permis et son consommateur avec tests fail-closed, sans remplacer le worker public par défaut.

### Issue B - donneur incomplet

Documenter le manque et conserver `action_withheld`. Un nouveau permis devra être spécifié comme une nouvelle conception, pas comme une restitution supposée de Site 109.

## Étapes ultérieures

1. qualifier le permis ACT et sa consommation, si reconstructibles ;
2. reconstruire le producteur public du domaine et du candidat d'action ;
3. raccorder la chaîne au runtime uniquement par injection qualifiée ;
4. construire une campagne fonctionnelle durable ;
5. reconstruire le registre d'entrées ;
6. restaurer les runners officiels STCK/SMLP ;
7. mesurer selon ABBA ;
8. réconcilier avec la tête canonique ;
9. intégrer dans `recovery/site109-reconstruction-20261112` ;
10. publier le Site après vérification SHA GitHub <-> Site.

## Performance

Critère historique :

- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- jeux évalués séparément ;
- aucune compensation ;
- phase interne > +10 % admissible si le global du même jeu reste sous le seuil.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
