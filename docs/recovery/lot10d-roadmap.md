# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-13

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Branche canonique cible : `recovery/site109-reconstruction-20261112`

Tête canonique parallèle observée après ce jalon :

`97ba156fd0ffb8359cb84514c91f1504d84e928c`

## Règle de portée

Cette feuille décrit une reconstruction qualifiée à partir de preuves GitHub durables. Elle ne revendique ni identité de code ni parité complète avec Site 109 / native 0.68.

## État actuel

| Étape | Statut | Limite principale |
| --- | --- | --- |
| audit de l'ancienne branche 10D | terminé | aucun delta récupérable |
| contrat Source / sélection | qualifié | choix externe, aucun fallback |
| mémoire et retours | qualifiés | portée et observation revalidées |
| état TemporalSelection restaurable | qualifié | descriptif, sans ACT |
| reçu Source/DRM | qualifié | identité et domaine scellés |
| bridge Logos V6 | qualifié | capability distincte des OP |
| port runtime passif | qualifié | action retenue sans ACT |
| audit des gates ACT | qualifié | éligibilité distincte du permis |
| binding candidat / cible / action | qualifié | action fournie extérieurement |
| permis ACT ordinaire | qualifié | lease validée, pas de transport |
| consommation ACT | qualifiée | permis unique, lease `released` |
| `ActionBoundary` | qualifiée | tentative pré-transport et dispatch durable |
| résultat externe `unknown` | fail-closed | aucune redélivrance automatique |
| reprise causale | qualifiée | observation unique, checkpoint `ACTIVE` |
| domaine post-action | **qualifié** | fourni par un producteur externe |
| état TemporalSelection post-action | **qualifié** | neuf, sans mémoire/retour implicite |
| replay de continuation | **qualifié** | idempotent, domaine divergent refusé |
| injection scheduler passive | **prochaine étape** | aucun scheduler TypeScript raccordé |
| exécution du checkpoint `ACTIVE` | ouverte | interpréteur commun absent |
| producteur public du domaine | ouvert | perception/candidate factory absente |
| politique historique TemporalSelection | absente | ne pas inventer |
| réconciliation externe `unknown` | ouverte | preuve externe encore absente |
| consommateur runtime final | ouvert | worker par défaut inactif |
| campagne en partie réelle | ouverte | aucun gain comportemental établi |
| performance officielle | à confirmer | runners/corpus STCK/SMLP incomplets |
| intégration canonique | non réalisée | branche divergente |
| publication Site | non réalisée | interdite avant intégration GitHub |

## Qualification actuelle

Commit qualifié :

`a0536fa1dfdef9edf4c4c260385119e85e3ff922`

GitHub Actions :

- run `43429163491` ;
- **270 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi ;
- checkout GitHub normal ;
- aucune migration automatique ;
- permissions GitHub en lecture seulement.

Le jalon ajoute 15 tests au total précédent de 255.

## Chaîne reconstruite

`TemporalSelection -> intent -> action préparée -> permis -> ACT -> tentative durable -> transport -> dispatch -> observation causale -> checkpoint ACTIVE -> domaine post-action -> TemporalObservationState neuf`

## Bridge post-reprise - jalon terminé

### Domaine externe scellé

Le reçu de domaine conserve :

- producteur ;
- Source, workflow et instance ;
- run, timeline, frame et révision ;
- raw input acquis ;
- reçu causal, dispatch, observation et checkpoint repris ;
- alternatives, exigences et preuves ;
- fingerprint du domaine.

Le bridge valide le domaine mais ne produit aucune alternative et ne choisit aucun candidat.

### État neuf

Le nouvel état ne transporte pas automatiquement :

- retours de l'observation précédente ;
- consommations de retours précédentes ;
- contrat mémoire précédent ;
- preuves mémoire précédentes ;
- autorité ACT.

Toute réutilisation future doit être explicitement requalifiée.

### Reçu et idempotence

Le reçu de continuation conserve la lignée causale complète et marque :

- continuation préparée ;
- scheduler non démarré ;
- worker sans action ;
- ACT non autorisé.

Le replay exact réutilise le reçu existant. Un domaine différent pour le même reçu causal est refusé.

### Journal

- capacité par défaut : 128 ;
- maximum : 1024 ;
- une seule continuation par reçu, checkpoint, observation et domaine ;
- aucune éviction silencieuse ;
- restauration avec validation des fingerprints.

## Prochaine étape - `SchedulerContinuationPort`

Reconstruire une frontière passive :

`reçu de continuation -> checkpoint ACTIVE + TemporalObservationState -> port scheduler injecté`

Le port devra produire deux résultats explicites :

1. `continuation_withheld` lorsque le scheduler manque, est périmé ou refuse la lignée ;
2. `continuation_accepted` seulement lorsqu'un consommateur injecté confirme l'identité exacte du checkpoint, de l'état et du reçu causal.

La qualification devra couvrir :

1. consommation unique du reçu de continuation ;
2. transmission atomique du checkpoint et de l'état ;
3. identité Source / workflow / run / timeline / frame / révision ;
4. fingerprint du reçu, du domaine, du checkpoint et de l'état ;
5. refus d'un scheduler absent ;
6. refus d'un scheduler provenant d'une autre révision ;
7. refus d'un résultat qui change le checkpoint ou l'état ;
8. replay exact idempotent ;
9. absence de sélection, d'ACT et d'action dans le port ;
10. worker public toujours inactif par défaut.

## Étapes ultérieures

1. qualifier le port scheduler injecté ;
2. raccorder un interpréteur commun versionné ;
3. qualifier la continuation réelle du workflow ;
4. reconstruire le producteur public du domaine et du candidat ;
5. traiter la réconciliation externe des résultats `unknown` ;
6. construire une campagne fonctionnelle durable ;
7. reconstruire le registre des entrées ;
8. restaurer les runners officiels STCK/SMLP ;
9. mesurer selon ABBA ;
10. réconcilier avec la tête canonique ;
11. intégrer dans `recovery/site109-reconstruction-20261112` ;
12. publier le Site après vérification SHA GitHub <-> Site.

## Performance

Critère historique :

- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- jeux séparés ;
- aucune compensation ;
- phase interne > +10 % admissible si le global du même jeu reste sous le seuil.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
