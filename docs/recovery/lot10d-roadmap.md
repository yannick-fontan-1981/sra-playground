# Lot 10D - TemporalSelection - feuille de route de reconstruction

Date : 2026-11-13

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

Branche canonique cible : `recovery/site109-reconstruction-20261112`

Tête canonique parallèle observée pendant ce jalon :

`68cdddc92b4b7f0214a2d7e5a5f0ffe6c94e7216`

## Règle de portée

Cette feuille décrit une reconstruction qualifiée à partir de preuves GitHub durables. Elle ne revendique ni identité de code ni parité complète avec Site 109 / native 0.68.

## État actuel

| Étape | Statut | Limite principale |
| --- | --- | --- |
| audit de l’ancienne branche 10D | terminé | aucun delta récupérable |
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
| domaine post-action | qualifié | fourni par un producteur externe |
| état TemporalSelection post-action | qualifié | neuf, sans mémoire/retour implicite |
| replay de continuation | qualifié | idempotent, domaine divergent refusé |
| enveloppe scheduler | **qualifiée** | checkpoint et état remis ensemble |
| absence de scheduler | **qualifiée** | `continuation_withheld`, reçu non consommé |
| handoff injecté | **qualifié** | accepté/refusé, sans démarrer l’interpréteur |
| consommation unique du handoff | **qualifiée** | journal terminal borné |
| exécution du scheduler | **prochaine étape** | interpréteur commun encore absent |
| contrat du résultat scheduler | ouvert | donneur à auditer |
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

`a5878570afa473c8de3a3f03d47b1fece27a4c82`

GitHub Actions :

- run `43438970837` ;
- **287 tests réussis** ;
- **0 échec** ;
- typecheck strict réussi ;
- checkout GitHub normal ;
- aucune migration automatique ;
- permissions GitHub en lecture seulement.

Le jalon ajoute 17 tests au total précédent de 270.

## Chaîne reconstruite

`TemporalSelection -> intent -> action préparée -> permis -> ACT -> tentative durable -> transport -> dispatch -> observation causale -> checkpoint ACTIVE -> domaine post-action -> TemporalObservationState neuf -> port scheduler passif`

## Port scheduler passif - jalon terminé

### Enveloppe attribuée

L’enveloppe conserve :

- le reçu de continuation post-reprise ;
- le checkpoint repris `ACTIVE` ;
- le nouvel état temporel ;
- les empreintes du reçu, du checkpoint et de l’état ;
- la lignée complète du dispatch causal.

Elle ne contient ni sélection, ni action, ni autorité ACT, ni permission d’exécuter le scheduler.

### Sans port injecté

Le résultat est :

`continuation_withheld`

Le reçu reste disponible et non consommé. Aucun scheduler n’est appelé.

### Avec port injecté

Le même consommateur reçoit atomiquement le checkpoint et l’état.

L’accusé peut être :

- `accepted` ;
- `refused`.

Dans les deux cas, le reçu terminal conserve :

- `schedulerExecutionStarted: false` ;
- `workerActionProduced: false` ;
- `actAuthorized: false`.

L’acceptation est donc une prise de possession, pas une exécution.

### Revalidation

Avant l’appel du port :

- continuation courante ;
- checkpoint courant ;
- état temporel courant ;
- Source ;
- workflow et instance ;
- run ;
- timeline ;
- frame ;
- révision.

### Unicité

- une consommation par continuation ;
- replay exact idempotent ;
- aucun second appel du port ;
- refus terminal également journalisé ;
- erreurs pré-consommation retryables ;
- capacité du journal : 128 par défaut, 1024 maximum ;
- aucune éviction silencieuse.

### Trace

Capability séparée :

`temporal-scheduler-continuation-port`

Les modes `full` et `counters` sont qualifiés sans pollution des compteurs OP01-OP31.

## Prochaine étape - contrat d’exécution scheduler

Auditer les donneurs V5/V6 durables pour établir le contrat exact d’une étape après handoff :

`handoff accepté -> checkpoint ACTIVE + TemporalObservationState -> résultat scheduler borné`

La prochaine qualification devra répondre avant implémentation :

1. quel composant devient propriétaire du checkpoint ;
2. quel événement démarre réellement l’interpréteur ;
3. comment le budget et l’annulation sont appliqués ;
4. quel résultat terminal ou suspendu est produit ;
5. comment l’état et les bindings sont persistés ;
6. comment une nouvelle décision éventuelle est distinguée de l’exécution ;
7. comment une nouvelle action éventuelle repasse par la chaîne intent / permis / ACT / boundary ;
8. comment les replays sont rendus idempotents ;
9. comment le worker public reste inactif par défaut.

Si aucun donneur exact n’est retrouvé, le manque sera documenté et aucune politique scheduler ne sera inventée.

## Étapes ultérieures

1. auditer et reconstruire le contrat d’une étape scheduler ;
2. qualifier un interpréteur injecté ou un résultat explicitement retenu ;
3. raccorder le producteur public du domaine et du candidat ;
4. traiter la réconciliation externe des résultats `unknown` ;
5. construire une campagne fonctionnelle durable ;
6. reconstruire le registre des entrées ;
7. restaurer les runners officiels STCK/SMLP ;
8. mesurer selon ABBA ;
9. réconcilier avec la tête canonique ;
10. intégrer dans `recovery/site109-reconstruction-20261112` ;
11. publier le Site après vérification SHA GitHub <-> Site.

## Performance

Critère historique :

- STCK global strictement < +10 % ;
- SMLP global strictement < +10 % ;
- jeux séparés ;
- aucune compensation ;
- phase interne > +10 % admissible si le global du même jeu reste sous le seuil.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
