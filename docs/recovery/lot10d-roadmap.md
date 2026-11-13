# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-12

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

Tête canonique parallèle observée après ce jalon :

`e3fa1901452423a714d3a47d5a469dbf112c55b0`

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
| schéma historique du permis | **récupéré** | donneurs privés épinglés par commit et blobs |
| permis ACT ordinaire | **qualifié** | lease validée, snapshot/révision/action courants, CI 202/202 |
| exécution ACT | **prochaine étape** | lease pas encore passée à `RELEASED` |
| consommation/révocation du permis | ouverte | aucun reçu persistant de consommation unique |
| frontière d'envoi exactement une fois | ouverte | `ActionBoundary` non reconstruite |
| séries et acquisition différée | ouverte | volontairement exclues du permis ordinaire |
| producteur public du domaine | ouvert | perception/candidate factory absente |
| politique historique TemporalSelection | absente | ne pas inventer |
| position runtime commune | ouverte | `v6-native-runtime.ts` absent |
| registre d'entrées | ouvert | `v6-entry-point-progress.json` absent |
| contribution en partie réelle | ouverte | aucune campagne comportementale actuelle |
| performance officielle | à confirmer | runners/corpus STCK/SMLP manquants |
| intégration canonique | non réalisée | branche de lot divergente |
| publication Site | non réalisée | interdite avant intégration GitHub |

## Qualification actuelle

Commit de code et de provenance qualifié :

`467562a1e939e1d8fdc2609d0f212e73df5aeb24`

GitHub Actions :

- run `43356644647` ;
- **202 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi.

Le précédent jalon comptait 181 tests. Le présent jalon ajoute :

- 18 tests du permis ACT ordinaire ;
- 3 tests anti-dérive des donneurs privés ;
- le typecheck strict du nouveau source TypeScript.

## Permis ACT ordinaire - jalon terminé

### Donneurs récupérés

Le schéma et la séparation des autorités ont été retrouvés au commit privé épinglé :

`212d8d426f07eea2b6797c2bb647545767488a96`

Carte publique :

`docs/recovery/lot10d-temporal-action-release-donor-map.md`

Les donneurs couvrent :

- le schéma historique de `ActionIntent` utile au chemin de release ;
- `ConcentrationLease` ;
- `ActionReleasePermit` ;
- la revalidation ACT ;
- la transition de lease vers `RELEASED` ;
- la revalidation du scheduler avant dispatch ;
- la frontière d'envoi exactement une fois et sa récupération.

Le code privé n'est pas republié.

### Chaîne reconstruite

`TemporalSelection acceptée -> intent préparé -> binding candidat/action -> audit éligible -> lease validated -> permis ACT`

### Garanties du permis

- identité Source, décision, intent, binding et observation préservée ;
- session, séquence, identité temporelle et révision explicites ;
- snapshot pré-action lié à l'observation publique exacte ;
- action encore disponible ;
- effet attendu appartenant à l'intent gelé ;
- références de viability, commitment, DRM, SRC, principe, prémisses et falsificateurs déjà qualifiées ;
- lease non périmée ;
- permis non périmé et ne dépassant pas la lease ;
- preuves explicites, uniques et bornées ;
- empreintes de lease et de permis ;
- aucune série ni acquisition différée sur le chemin courant.

### Sortie

Après succès :

- `actionPermitPresent: true` ;
- `releaseEligible: true` ;
- `actAuthorized: true` ;
- `actionPayloadPresent: false` ;
- `actionReleased: false` ;
- `environmentDispatchAuthorized: false`.

Le permis autorise uniquement une future consommation ACT. Il ne contient pas le payload d'action et n'autorise pas le transport environnemental.

Le worker public reste `reconstruction-pending-perception`, le port retourne toujours `undefined` et le statut reste `action_withheld`.

## Prochaine étape - consommation ACT et transition de lease

Reconstruire depuis les donneurs durables :

`permis courant -> revalidation ACT -> lease RELEASED -> ActOutput`

La qualification devra vérifier :

1. l'intent, le binding et le permis exacts ;
2. Source, session, timeline, frame, révision et snapshot courants ;
3. les preuves de responsabilité, de continuité et de consommation de buts ;
4. le binding de continuation parent ;
5. l'action et la lease encore admissibles ;
6. l'absence d'expiration ;
7. une seule transition `VALIDATED -> RELEASED` ;
8. une consommation ou révocation persistée ;
9. un `ActOutput` transportant seulement action, intent et permis ;
10. toujours aucun envoi direct vers l'environnement.

### Étape suivante après ACT

Reconstruire séparément :

`ActOutput -> ActionBoundary -> tentative durable -> transport exactement une fois -> acquisition -> réconciliation`

Cette frontière devra :

- persister la tentative avant l'appel externe ;
- refuser une redélivrance lorsque le résultat est inconnu ;
- réutiliser un dispatch déjà enregistré ;
- vérifier intent, permis, dispatch et réponse ;
- reprendre la chaîne causale exacte ;
- ne produire aucun faux succès en cas de résultat incertain.

## Étapes ultérieures

1. qualifier la consommation ACT et la transition de lease ;
2. qualifier la consommation unique et la révocation du permis ;
3. reconstruire `ActionBoundary` et sa récupération ;
4. reconstruire les variantes série et acquisition différée si elles sont nécessaires ;
5. reconstruire le producteur public du domaine et du candidat d'action ;
6. raccorder la chaîne au runtime uniquement par injection qualifiée ;
7. construire une campagne fonctionnelle durable ;
8. reconstruire le registre d'entrées ;
9. restaurer les runners officiels STCK/SMLP ;
10. mesurer selon ABBA ;
11. réconcilier avec la tête canonique ;
12. intégrer dans `recovery/site109-reconstruction-20261112` ;
13. publier le Site après vérification SHA GitHub <-> Site.

## Performance

Critère historique :

- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- jeux évalués séparément ;
- aucune compensation ;
- phase interne > +10 % admissible si le global du même jeu reste sous le seuil.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
