# Lot 9 — clôture 9B et transition vers 9C

Date : 2026-11-12

## 9B `region_intervention`

Statut :

**qualifié fonctionnellement et en performance**.

Acquis persistants :

- cœur Region et owner ;
- caller neutre et adaptateur Region ;
- observation publique → delta visible ;
- vrai hook Region ;
- quatre runners explicites A/B × STCK/SMLP ;
- corpus public ACTION6 déterministe ;
- transport réel Worker/Pyodide ;
- parité CPython/Pyodide ;
- identités A/B hashées ;
- manifeste anti-dérive ;
- protocole officiel A1/B1/B2/A2 ;
- qualification officielle séparée STCK/SMLP.

Résultat officiel retenu :

- STCK : +7,155963 % — PASS ;
- SMLP : −4,679306 % — PASS ;
- aucun échantillon supprimé ;
- outlier SMLP 591,1 ms conservé ;
- 86 acquisitions STCK et 126 acquisitions SMLP conservées.

Preuves principales :

- `docs/recovery/native-loop-runner-manifest.json` ;
- `docs/recovery/lot9b-official-abba-performance-qualified.md` ;
- `docs/recovery/lot9b-official-abba-performance-qualified.json` ;
- `docs/recovery/lot9b-official-abba-baseline-failure.md`.

## Contrats 9B à ne pas rouvrir sans régression démontrée

- Region ne déduit jamais `methodRef` par ressemblance visuelle ;
- plusieurs propositions restent ambiguës ;
- aucune priorité cachée ;
- le mode cloné reste le défaut sûr des hooks ;
- le mode readonly est explicite et limité au benchmark qualifié ;
- A et B partagent transport, corpus, seed, niveau initial et actions ;
- B seul active `region_intervention` ;
- aucun fallback de runner ou de corpus ;
- aucun retrait d’échantillon ;
- aucun compteur des 76 incrémenté.

## Transition vers 9C `joint_channels`

La prochaine étape est :

**9C `joint_channels`**.

La reprise 9C doit partir de la branche canonique contenant le commit de
qualification 9B. Elle ne doit pas réutiliser une ancienne branche Lot 9 sans
comparaison explicite avec cette baseline.

### 9C0 — audit de récupération

Rechercher avant toute implémentation :

- anciens fichiers ou symboles `joint_channels`, `joint channel`,
  `jointChannels` et variantes ;
- branches Lot 9 et snapshots de récupération ;
- producteurs de données par canal ;
- règles historiques de liaison ou de séparation ;
- consommateurs décisionnels ;
- snapshots/restauration ;
- campagnes et tests historiques ;
- coût STCK/SMLP ou autre harness documenté.

Sortie : tableau de preuves avec :

`preuve → source → contrat récupérable → partie non prouvée`.

### 9C1 — contrat minimal prouvable

Seulement après 9C0, définir :

- ce qu’est un canal ;
- ce que signifie « joint » ;
- conditions de création et de retrait d’une liaison ;
- identité et portée temporelle ;
- comportement en contradiction ;
- bornes ;
- propriétaire de l’état ;
- consommateur réel du résultat.

Aucune sémantique ne doit être inventée uniquement à partir du nom
`joint_channels`.

### 9C2 — reconstruction du cœur

Implémenter uniquement les règles prouvées, avec :

- entrées explicites ;
- aucune perception cachée ;
- état borné ;
- contradiction conservée ;
- snapshot/restauration validés ;
- refus des entrées incomplètes.

### 9C3 — owner et caller commun

Raccorder au modèle commun sans :

- classement caché ;
- fusion automatique de propositions ;
- priorité artificielle sur Region ou FieldStock ;
- double acquisition d’un même retour.

### 9C4 — données publiques et intégration Worker

Prouver la chaîne complète :

**besoin → données publiques → proposition → sélection → action → retour →
acquisition → effet sur une décision future**.

Si les producteurs publics nécessaires sont absents, les documenter au lieu de
fabriquer des signaux.

### 9C5 — qualification fonctionnelle

Tests minimaux à préciser après récupération, mais obligatoirement couvrir :

- absence de proposition sans preuve ;
- liaison prouvée ;
- ambiguïté conservée ;
- contradiction ;
- déduplication ;
- portée de niveau/session ;
- snapshot/restauration ;
- bornes ;
- aucune régression 9B.

### 9C6 — performance

Réutiliser le harness officiel 9B seulement si le périmètre 9C est réellement
exercé par un corpus public justifié.

Conditions inchangées :

- STCK et SMLP séparément strictement sous +10 % si ces jeux sont pertinents ;
- aucun jeu ne compense l’autre ;
- aucune suppression d’échantillon ;
- nature isolée ou non isolée documentée ;
- sourceRefs A/B recalculés.

## Première action 9C

Exécuter 9C0 sur GitHub et les branches de récupération, puis créer un document
de contrat uniquement à partir des preuves retrouvées.
