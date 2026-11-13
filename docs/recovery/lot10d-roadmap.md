# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-13

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

Tête canonique parallèle observée après ce jalon :

`90cb819f028aea315fdbba9774a22fb345bcfb81`

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
| audit des gates ACT | qualifié | éligibilité sans permis ni action |
| binding candidat préparé | qualifié | `AgentAction` et cible explicites, CI 181/181 |
| schéma historique du permis | récupéré | donneurs privés épinglés par commit et blobs |
| permis ACT ordinaire | qualifié | lease validée, snapshot/révision/action courants, CI 202/202 |
| exécution ACT ordinaire | qualifiée | revalidation courante et transition `VALIDATED -> RELEASED` |
| consommation/révocation du permis | qualifiée | journal terminal unique et fail-closed, CI 225/225 |
| `ActOutput` minimal | qualifié | identités seulement, `pending_environment_boundary` |
| checkpoint suspendu `ActionBoundary` | **qualifié** | lignée intent/permis/reçu ACT et contexte courant |
| digest de requête de transport | **qualifié** | adaptateur, workflow, timeline, frame, action et contexte monde scellés |
| tentative durable avant transport | **qualifiée** | relecture obligatoire avant appel externe |
| dispatch au plus une fois | **qualifié** | une tentative sans dispatch interdit toute redélivrance automatique |
| réponse et dispatch durables | **qualifiés** | identités, digests et observation acquis puis revalidés |
| réutilisation d'un dispatch enregistré | **qualifiée** | aucun second transport ni seconde persistance |
| résultat de transport incertain | **qualifié fail-closed** | `unknown`, redélivrance interdite, réconciliation requise |
| réconciliation externe d'un résultat `unknown` | **prochaine étape** | aucune preuve externe de résolution encore raccordée |
| observation acquise | qualifiée comme donnée | fingerprint et chronologie validés, pas encore consommée causalement |
| qualification causale et reprise du checkpoint | **prochaine étape** | `causalResumeAuthorized: false`, `workflowResumed: false` |
| séries et acquisition différée | ouverte | volontairement exclues du chemin ordinaire |
| producteur public du domaine | ouvert | perception/candidate factory absente |
| politique historique TemporalSelection | absente | ne pas inventer |
| position runtime commune | ouverte | `v6-native-runtime.ts` absent |
| registre d'entrées | ouvert | `v6-entry-point-progress.json` absent |
| contribution en partie réelle | ouverte | aucune campagne comportementale actuelle |
| performance officielle | à confirmer | runners/corpus STCK/SMLP manquants |
| intégration canonique | non réalisée | branche de lot divergente |
| publication Site | non réalisée | interdite avant intégration GitHub |

## Qualification actuelle

Commit qualifié sur un workflow propre :

`858250b6c4ed0a5586da4e000f34611e64293049`

GitHub Actions :

- run `43364028953` ;
- **240 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi ;
- aucune migration automatique ni permission d'écriture dans le workflow de qualification.

Le précédent jalon comptait 225 tests. Le présent jalon ajoute :

- 15 tests fonctionnels de `ActionBoundary` ;
- le typecheck strict du nouveau source TypeScript ;
- les régressions existantes du worker, du runtime V6, du Logos Engine et de TemporalSelection.

## `ActionBoundary` durable - jalon terminé

### Donneurs récupérés

Les invariants de la frontière environnementale proviennent du commit privé épinglé :

`212d8d426f07eea2b6797c2bb647545767488a96`

Carte publique :

`docs/recovery/lot10d-temporal-action-release-donor-map.md`

Document du présent jalon :

`docs/recovery/lot10d-temporal-action-boundary.md`

Les donneurs couvrent :

- la relecture du checkpoint suspendu ;
- la revalidation du contexte avant transport ;
- le digest de requête ;
- la tentative persistée avant l'appel externe ;
- le refus de redélivrer lorsque le résultat reste inconnu ;
- la réutilisation d'un dispatch déjà enregistré ;
- la validation de la réponse et l'acquisition de l'observation ;
- la reprise causale comme frontière séparée.

Le code privé n'est pas republié.

### Chaîne reconstruite

`TemporalSelection acceptée -> intent préparé -> binding candidat/action -> audit éligible -> permis ACT -> consommation ACT -> checkpoint suspendu -> tentative durable -> transport -> dispatch durable`

### Garanties avant transport

- binding, permis, lease, reçu ACT et transition revalidés par fingerprint ;
- même intent, même action, même permis et même reçu ACT ;
- Source, workflow et instance courants ;
- session, timeline, frame et révision courantes ;
- snapshot pré-action exact ;
- action encore disponible ;
- lease encore `released` ;
- checkpoint encore suspendu ;
- responsabilité, adaptateur et contexte monde courants ;
- refus explicite avant tout effet externe si une preuve diverge.

### Tentative durable

La tentative scelle :

- dispatch et digest de requête ;
- adaptateur et checkpoint ;
- workflow, Source, run, timeline, frame et révision ;
- intent, permis, reçu ACT et action ;
- snapshot et contexte monde ;
- preuves causales de la frontière.

Elle est persistée et relue avant le transport.

### Résultat inconnu

Une tentative sans dispatch enregistré produit :

- `outcomeStatus: unknown` ;
- `redeliveryPermitted: false` ;
- `reconciliationRequired: true` ;
- aucune nouvelle remise automatique au transport.

Cela couvre le crash ou l'erreur avant preuve durable du résultat, même lorsqu'un effet externe a pu avoir lieu.

Cette garantie est une frontière d'envoi au plus une fois. La garantie historique complète « exactly-once » dépend encore de la future réconciliation externe du résultat `unknown`.

### Dispatch durable

Une réponse valide produit un dispatch qui conserve :

- tentative et digest de requête ;
- digest de réponse ;
- événement environnemental ;
- intent, permis, reçu ACT et action ;
- identité et fingerprint de l'observation acquise ;
- métadonnées de transport bornées ;
- `causalResumeAuthorized: false` ;
- `workflowResumed: false`.

Un dispatch enregistré est réutilisé sans second transport.

## Prochaine étape - réconciliation et reprise causale

Reconstruire séparément :

`dispatch durable -> observation acquise -> qualification causale -> reprise du checkpoint -> réconciliation du workflow`

La qualification devra couvrir :

1. la relecture exacte de la tentative et du dispatch ;
2. le maintien de la même identité de dispatch, événement, intent, permis et reçu ACT ;
3. la validation de la chronologie de l'observation acquise ;
4. la preuve que cette observation appartient bien au dispatch courant ;
5. une seule consommation causale de l'observation ;
6. une seule reprise du checkpoint suspendu ;
7. le raccordement de l'observation au `TemporalObservationState` sans double écriture ;
8. la reprise du workflow avec la même chaîne causale ;
9. le maintien d'une tentative `unknown` hors du chemin de succès ;
10. une réconciliation externe explicite pour résoudre `unknown`, sans redélivrance par défaut ;
11. l'absence de faux succès lorsque l'effet externe reste indéterminé.

Le prochain composant ne devra pas être activé par défaut dans le worker avant qualification complète de la reprise et de la réconciliation.

## Étapes ultérieures

1. qualifier la réconciliation externe des résultats `unknown` ;
2. qualifier l'identité causale de l'observation acquise ;
3. qualifier la consommation unique de cette observation ;
4. qualifier la reprise unique du checkpoint ;
5. raccorder la reprise au workflow TemporalSelection ;
6. reconstruire les variantes série et acquisition différée si nécessaires ;
7. reconstruire le producteur public du domaine et du candidat d'action ;
8. raccorder la chaîne au runtime uniquement par injection qualifiée ;
9. construire une campagne fonctionnelle durable ;
10. reconstruire le registre d'entrées ;
11. restaurer les runners officiels STCK/SMLP ;
12. mesurer selon ABBA ;
13. réconcilier avec la tête canonique ;
14. intégrer dans `recovery/site109-reconstruction-20261112` ;
15. publier le Site après vérification SHA GitHub <-> Site.

## Performance

Critère historique :

- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- jeux évalués séparément ;
- aucune compensation ;
- phase interne > +10 % admissible si le global du même jeu reste sous le seuil.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
