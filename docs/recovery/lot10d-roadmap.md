# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-13

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

Tête canonique parallèle observée après ce jalon :

`d7ba12eef7063cf86dfa55f43879c29bc1dfa87d`

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
| exécution ACT ordinaire | **qualifiée** | revalidation courante et transition `VALIDATED -> RELEASED` |
| consommation/révocation du permis | **qualifiée** | journal terminal unique et fail-closed, CI 225/225 |
| `ActOutput` minimal | **qualifié** | identités seulement, `pending_environment_boundary` |
| frontière d'envoi exactement une fois | **prochaine étape** | `ActionBoundary` non reconstruite |
| résultat de transport incertain | ouverte | redélivrance et réconciliation à reconstruire |
| acquisition et reprise causale | ouverte | observation et workflow non raccordés |
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

Commit de code et d'invariants qualifié :

`ad3437f87f8ea490b1bf1575fe0a1ffba5b1ef70`

GitHub Actions :

- run `43359714683` ;
- **225 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi.

Le précédent jalon comptait 202 tests. Le présent jalon ajoute :

- 20 tests de consommation et révocation ACT ;
- 3 tests anti-dérive supplémentaires des donneurs ;
- le typecheck strict du nouveau source TypeScript.

## Consommation ACT ordinaire - jalon terminé

### Donneurs récupérés

La revalidation ACT, `ActOutput` et la séparation avec la frontière environnementale ont été retrouvés au commit privé épinglé :

`212d8d426f07eea2b6797c2bb647545767488a96`

Carte publique :

`docs/recovery/lot10d-temporal-action-release-donor-map.md`

Les donneurs couvrent :

- le schéma historique utile du permis et de la lease ;
- la revalidation des supports, responsabilités et contextes ;
- la transition de concentration vers `RELEASED` ;
- le `ActOutput` minimal `pending_environment_boundary` ;
- la revalidation scheduler avant transport ;
- la frontière d'envoi exactement une fois et sa récupération.

Le code privé n'est pas republié.

### Chaîne reconstruite

`TemporalSelection acceptée -> intent préparé -> binding candidat/action -> audit éligible -> permis ACT -> consommation ACT`

### Garanties de consommation

- empreintes du binding, du permis et de la lease revalidées ;
- Source, workflow, session, timeline et frame courants ;
- révision et identité temporelle exactes ;
- séquence, image publique et snapshot pré-action exacts ;
- permis et lease canoniques ;
- lease toujours validée et non expirée ;
- action encore disponible ;
- supports non retirés ;
- responsabilité et preuves de consommation du but courantes ;
- continuation parent et transport des contributions courants ;
- contexte canonique d'exécution courant ;
- une seule identité terminale par permis ;
- journal borné sans éviction silencieuse ;
- empreintes de transition et de reçu.

### Succès ACT

Le succès produit :

- transition `validated -> released` ;
- `permitConsumed: true` ;
- `permitReusable: false` ;
- `actCompleted: true` ;
- `actionReleased: true` vers la future frontière ;
- un `ActOutput` minimal.

Il conserve :

- `actionPayloadPresent: false` ;
- `environmentDispatchAuthorized: false` ;
- aucun `AgentAction` ni cible exécutable.

### Révocation ACT

Une divergence produit une transition terminale :

- `validated -> invalidated` ;
- ou `validated -> expired`.

Une révocation persistée ne peut pas être annulée par un appel ultérieur présentant de nouveau des faits courants.

### Idempotence

- rejouer exactement le même permis retourne le reçu existant ;
- aucun second `ActOutput` n'est émis ;
- le même `permitRef` avec une autre empreinte est refusé ;
- doublons et altérations d'un snapshot restauré sont refusés ;
- un journal plein échoue fermé.

## Prochaine étape - `ActionBoundary`

Reconstruire séparément :

`ActOutput -> checkpoint suspendu courant -> tentative durable -> transport exactement une fois -> acquisition -> réconciliation`

La qualification devra couvrir :

1. la relecture du même intent, permis et reçu ACT ;
2. le checkpoint réellement suspendu et la Source courante ;
3. la révision, le snapshot, la responsabilité et la lease `released` ;
4. un digest de requête couvrant adaptateur, workflow, timeline, frame, intent, permis et contexte monde ;
5. la tentative persistée avant le premier appel externe ;
6. l'interdiction de redélivrer automatiquement après résultat inconnu ;
7. la réutilisation d'un dispatch déjà enregistré ;
8. la validation de la réponse contre dispatch, intent et permis ;
9. l'acquisition de l'observation causale ;
10. la reprise et la réconciliation du workflow ;
11. l'absence de faux succès lorsque le résultat externe reste indéterminé.

Le prochain composant ne devra pas être activé par défaut dans le worker avant qualification complète de son journal et de sa récupération.

## Étapes ultérieures

1. qualifier `ActionBoundary` et le digest de requête ;
2. qualifier la tentative durable avant transport ;
3. qualifier l'envoi exactement une fois et le résultat incertain ;
4. qualifier l'acquisition et la reprise causale ;
5. reconstruire les variantes série et acquisition différée si nécessaires ;
6. reconstruire le producteur public du domaine et du candidat d'action ;
7. raccorder la chaîne au runtime uniquement par injection qualifiée ;
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
