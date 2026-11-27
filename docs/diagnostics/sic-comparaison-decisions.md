# SIC composable · Lot 1 — première divergence de décision

**Référence native** `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le gel valide **107 jeux et 692 niveaux**. Le lot rejoue **trois jeux** depuis L1. AS66 et G50T couvrent le passage d’un effet de commande à une décision d’accès. HOLE est le témoin corrigé au gel. Le banc reprend du pilote l’appariement des entrées, le contrôle Git et les reçus par exécution. [Chantier](https://github.com/yannick-fontan-1981/sra-playground/blob/18e2ab38d3f6164464add5cb73ced1b6a0701093/docs/architecture/sic-chantier-strategies-composables.md) · [Pilote](https://github.com/yannick-fontan-1981/sra-playground/blob/145b8c764477fe913709e999747a0f8db125d060/scripts/sic-effect-composer-replays.mjs)

## Résultats des parcours natifs

| Jeu | Niveaux A et A′ | Décisions A / A′ | Commandes par niveau dans chaque exécution | Événements comparés | Premier écart |
|---|---:|---:|---|---:|---|
| AS66 | 9/9 | 161 / 161 | 4, 9, 16, 31, 19, 37, 13, 17, 15 | 1 613 | Aucun |
| G50T | 7/7 | 301 / 301 | 27, 32, 65, 32, 51, 50, 44 | 3 004 | Aucun |
| HOLE | 6/6 | 78 / 78 | 5, 6, 10, 9, 21, 27 | 784 | Aucun |

Les six arrêts portent le motif `target_levels_completed`. Les empreintes des trajectoires A et A′ reproduisent celles de la campagne du gel sur l’arbre commun à `4be368a3` et `d0e7527c`. Le dossier mesuré est `artifacts/sic-comparison/run-VVq4CG`. Un essai préliminaire concurrent de G50T avait atteint le plafond mural de L6 à 46 commandes (47 secondes). Les six mesures du tableau ont été exécutées en série avec les mêmes plafonds. Les cinq tests du dépôt sur les budgets et le surveillant passent.

## Reproduire

Banc `6d539f7b1212dfae79d93e12e9eb93774551f970`, branche `codex/sic-comparison-bench`, Node `24.22.3`. Pour un checkout isolé, exécuter `git fetch origin codex/sic-comparison-bench` puis `git worktree add --detach ../sic-lot1-reprise 6d539f7b1212dfae79d93e12e9eb93774551f970`. Depuis sa racine :

```sh
node scripts/sic-comparison-bench.mjs
node scripts/sic-comparison-controls.mjs
```

La première commande vérifie Pyodide, lance A et A′ en série avec un processus neuf par jeu et par essai, puis compare les fichiers. Chaque appel réserve un dossier local dans `artifacts/sic-comparison/`. Son `report.json` contient les commandes exactes et les verdicts dans l’ordre AS66, G50T, HOLE. La seconde commande contrôle la dernière trace AS66 A, ou une trace passée en argument. Code de sortie 0 en cas de succès. Pour reprendre deux fichiers existants : `node scripts/compare-sic-decisions.mjs GAUCHE.jsonl DROITE.jsonl`.

**Parcours du gel.** Niveau 1, cible `auto`, un worker, mode `sic`. Graine 0 (`instance_seed` pour AS66 et HOLE, `seed` pour G50T), UUID de session fixé par le lanceur. Les variables `SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json` et `SIC_DECISION_TRACE=<dossier>/<jeu>-<étiquette>.jsonl` accompagnent chaque appel, avec `A` ou `Aprime` comme étiquette. [Manifeste historique](sic-107-4a546a13-20261126/manifest.json) · [Plafonds vérifiés dans chaque reçu](sic-107-4a546a13-20261126/expected-budgets.json)

```text
node scripts/check-sic-chronological.mjs <jeu> auto <dossier>/<jeu>-<étiquette>.receipt 1 sic
```

| Jeu | Plafonds du niveau 1 au dernier, en commandes / secondes |
|---|---|
| AS66 | 80/90, 80/90, 80/90, 80/90, 80/90, 516/486, 30/27, 80/75, 20/19 |
| G50T | 33/28, 38/36, 77/83, 38/41, 60/73, 59/47, 52/46 |
| HOLE | 10/11, 11/10, 15/15, 14/14, 24/29, 33/33 |

## Ce que le banc compare

Les événements et tours sont numérotés depuis 1. Le service émet l’agenda visité, l’offre, le besoin, les preuves, les gardes, leurs motifs et le ticket. Les refus détaillés sont conservés lorsqu’ils sont émis. Le banc compare ensuite la commande appliquée et ses coordonnées, l’état public, le niveau, la progression, la palette, les actions disponibles, les empreintes SHA-256 de l’image et de la séquence ordonnée d’images, puis les frontières et l’arrêt. Une famille simplement visitée conserve ce seul statut.

Les durées d’exécution et les métadonnées de présentation du viewer sont exclues. Les arrêts sur budget sont comparés. Au premier tour d’AS66, les graphes bruts divergent à l’écriture 418 sur 420 par la date de création de `reasoning:trace:1`. Le banc réempreinte les écritures ordonnées en mettant à zéro le seul champ `created` des entrées du journal de raisonnement. Le corps, les causes, les faits et les preuves participent à l’empreinte. Les correspondances avec les empreintes brutes restent dans `*.chains.jsonl`.

**P07 à l’approche, P05 au contact.** Sur G50T L4, tours 11 et 12 (événements 1334 et 1344), `sic_verify_remote_replay` commande deux fois `ACTION2` avec `data: {}`. Le champ `proposal.sicLocalDecision.strategy` passe de P07 à P05. L’objectif passe de l’approche d’un contact au test de son impulsion. La carte `sicSituationCard`, ses preuves et le reçu `sic_native_plan` exposent la justification. La garde et le ticket exposent l’autorisation. Dans la famille des passages appariés, `switchContact` est un calcul local : la trace expose la stratégie, la situation, l’offre et les preuves qui en résultent. [Cas de l’interrupteur dans la cartographie P05](https://github.com/yannick-fontan-1981/sra-playground/blob/dd9f8212404cd476f28b6cf62faad58e6869b531/docs/architecture/sic-cartographie-p05.md)

## Contrôles sur une copie d’AS66 A

| Essai | Attendu = obtenu | Champ | Avant → après |
|---|---|---|---|
| Deux mutations | L1, tour 2, événement 16 | `/value/proposal/sicLocalDecision/need/evidence/0` | révision 2, image `f7b0a6951802004b` → révision 1, image `39bddf2920c3e13f`, commande `ACTION2` conservée |
| Première mutation rétablie | L1, tour 3, événement 26 | `/value/command/actionRef` | `ACTION3` → `ACTION4` |
| Copie coupée après 25 événements | L1, tour 3, événement 26 | `$event` | décision présente → absente |

Les positions attendues sont fixées dans le test. Il vérifie les valeurs complètes avec le même comparateur que le rejeu natif, ainsi que la troncature en sens inverse et au milieu d’une ligne.
