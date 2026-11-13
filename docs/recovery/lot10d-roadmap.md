# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-13

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

Tête canonique parallèle observée après ce jalon :

`81f56ce74a3413d3835bd4b30b9c3fd14570aabc`

## Règle de portée

Cette feuille décrit une reconstruction qualifiée à partir de preuves GitHub durables. Elle ne revendique ni identité de code ni parité complète avec Site 109 / native 0.68.

## État actuel

| Étape | Statut | Preuve / limite |
| --- | --- | --- |
| audit de l'ancienne branche 10D | terminé | aucun delta récupérable |
| contrat Source / sélection fail-closed | qualifié | sélection externe, aucun fallback |
| mémoire courante | qualifiée | preuves liées à l'observation |
| identité/idempotence des retours | qualifiée | scope, chronologie, produits et empreintes |
| état minimal/restauration | qualifié | descriptif, borné, sans ACT |
| reçu Source/DRM | qualifié | Source, DRM, observation, domaine et résultat scellés |
| adaptateur de consommation | qualifié | ne choisit aucun candidat |
| bridge Logos V6 | qualifié | capability séparée des OP01-OP31 |
| port runtime passif | qualifié | sélection acceptée, action retenue |
| audit des gates ACT | qualifié | éligibilité sans permis ni action |
| binding candidat préparé | qualifié | `AgentAction` et cible explicites |
| schéma historique du permis | récupéré | donneurs privés épinglés |
| permis ACT ordinaire | qualifié | lease validée, snapshot/révision/action courants |
| exécution ACT ordinaire | qualifiée | revalidation et transition `VALIDATED -> RELEASED` |
| consommation/révocation du permis | qualifiée | journal terminal unique et fail-closed |
| `ActOutput` minimal | qualifié | identités seulement, `pending_environment_boundary` |
| checkpoint suspendu `ActionBoundary` | qualifié | lignée et contexte courants |
| digest de transport | qualifié | adaptateur, workflow, action et contexte scellés |
| tentative durable avant transport | qualifiée | relecture avant appel externe |
| dispatch au plus une fois | qualifié | pas de redélivrance après tentative sans dispatch |
| réponse et dispatch durables | qualifiés | identités, digests et observation acquis |
| dispatch enregistré réutilisable | qualifié | aucun second transport |
| résultat externe `unknown` | qualifié fail-closed | réconciliation requise, aucun faux succès |
| observation causale acquise | **qualifiée** | liée au dispatch, intent, permis et événement |
| consommation unique de l'observation | **qualifiée** | journal causal, replay idempotent |
| `ActionObserved` | **qualifié** | intent responsable et retour observé liés |
| transition `RELEASED -> OBSERVED` | **qualifiée** | transition de lease scellée |
| reprise unique du checkpoint | **qualifiée** | séquence +1, frame remplacée, lignée d'action effacée |
| checkpoint repris `ACTIVE` | **qualifié comme projection** | interpréteur scheduler non encore raccordé |
| réconciliation externe de `unknown` | ouverte | aucune preuve externe raccordée |
| bridge de continuation workflow | **prochaine étape** | reçu causal non encore consommé par le runtime commun |
| nouvelle observation TemporalSelection | ouverte | état temporel post-action non reconstruit |
| consommateur runtime final | ouvert | worker toujours inactif |
| séries et acquisition différée | ouverte | exclues du chemin ordinaire |
| producteur public du domaine | ouvert | perception/candidate factory absente |
| politique historique TemporalSelection | absente | ne pas inventer |
| position runtime commune | ouverte | `v6-native-runtime.ts` absent |
| registre d'entrées | ouvert | `v6-entry-point-progress.json` absent |
| contribution en partie réelle | ouverte | aucune campagne comportementale actuelle |
| performance officielle | à confirmer | runners/corpus STCK/SMLP manquants |
| intégration canonique | non réalisée | branche de lot divergente |
| publication Site | non réalisée | interdite avant intégration GitHub |

## Qualification actuelle

Commit qualifié :

`f87d41a5dd76fbdab07618537746c9b61d9c7280`

GitHub Actions :

- run `43426455317` ;
- **255 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi, incluant `v6-temporal-causal-resume.ts`.

Le précédent jalon comptait 240 tests. Le présent jalon ajoute :

- 15 tests fonctionnels de reprise causale ;
- le typecheck strict du nouveau source TypeScript ;
- les régressions existantes worker, runtime V6, Logos et TemporalSelection.

## Reprise causale - jalon terminé

### Donneurs récupérés

Les invariants proviennent du commit privé épinglé :

`212d8d426f07eea2b6797c2bb647545767488a96`

Donneurs principaux :

- `scheduler/contracts.py` ;
- `scheduler/runtime.py` ;
- `logos/operations.py` ;
- `runtime/boundary.py`.

Document du jalon :

`docs/recovery/lot10d-temporal-causal-resume.md`

### Chaîne qualifiée

`dispatch durable -> observation causale -> ActionObserved -> lease OBSERVED -> checkpoint ACTIVE`

### Garanties

- tentative et dispatch durables exacts requis ;
- résultat `unknown` exclu du succès ;
- Source, checkpoint, run, timeline et frame courants ;
- révision et snapshot sémantique courants ;
- intent responsable canonique ;
- liaison courante du retour observé ;
- dispatch, reçu ACT et transition de lease canoniques ;
- observation strictement nouvelle ;
- chronologie postérieure au dispatch ;
- une seule consommation de l'observation ;
- une seule reprise du checkpoint ;
- ajout du raw input dans le binding attendu ;
- lignée d'action en attente effacée ;
- séquence de checkpoint incrémentée ;
- journal borné sans éviction silencieuse ;
- replay exact idempotent.

### Résultat projeté

La reprise crée :

- un reçu d'observation acquise ;
- un reçu `ActionObserved` ;
- une transition de lease `released -> observed` ;
- un checkpoint `active` ;
- un reçu causal atomique.

Le checkpoint projeté conserve l'identité de la nouvelle frame et du raw input acquis, mais le véritable interpréteur scheduler n'est pas encore appelé.

### Protection contre le faux succès

Une tentative sans dispatch durable conserve :

- `outcomeStatus: unknown` ;
- `redeliveryPermitted: false` ;
- `reconciliationRequired: true` ;
- aucune observation consommée ;
- aucun checkpoint repris.

La future réconciliation externe restera un chemin séparé.

## Prochaine étape - bridge de continuation runtime

Reconstruire séparément :

`reçu causal -> checkpoint ACTIVE -> nouvelle observation TemporalSelection -> continuation du workflow`

La qualification devra couvrir :

1. la consommation unique du reçu causal ;
2. l'identité de la nouvelle observation liée au dispatch ;
3. l'invalidation des preuves devenues périmées après l'action ;
4. la conservation de la lignée dispatch / événement / intent / permis / reçu ACT ;
5. la création ou restauration d'un `TemporalObservationState` post-action ;
6. la séparation entre reprise du checkpoint et exécution suivante du workflow ;
7. l'interdiction d'une seconde continuation depuis le même reçu ;
8. l'exclusion permanente d'une tentative `unknown` non réconciliée ;
9. le maintien du worker public en mode passif tant que le producteur et le consommateur final manquent.

## Étapes ultérieures

1. construire le bridge de continuation depuis le reçu causal ;
2. reconstruire le nouvel état temporel post-action ;
3. raccorder le checkpoint repris à un scheduler/runtime public qualifié ;
4. reconstruire la réconciliation externe des résultats `unknown` ;
5. reconstruire les variantes série et acquisition différée si nécessaires ;
6. reconstruire le producteur public du domaine et du candidat d'action ;
7. raccorder la chaîne au runtime seulement par injection qualifiée ;
8. construire une campagne fonctionnelle durable ;
9. reconstruire le registre d'entrées ;
10. restaurer les runners officiels STCK/SMLP ;
11. mesurer selon ABBA ;
12. réconcilier avec la tête canonique ;
13. intégrer dans `recovery/site109-reconstruction-20261112` ;
14. publier le Site après vérification SHA GitHub <-> Site.

## Performance

Critère historique :

- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- jeux évalués séparément ;
- aucune compensation ;
- phase interne > +10 % admissible si le global du même jeu reste sous le seuil.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
