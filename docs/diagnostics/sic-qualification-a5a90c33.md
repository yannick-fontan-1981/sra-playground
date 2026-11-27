# Qualification du déplacement axial · a5a90c33

**Les 107 reçus de l’enfant concordent directement avec ceux du parent et avec ceux du gel.** Les trois campagnes totalisent chacune 692 niveaux gagnés et réconciliés et 18 560 commandes autorisées. Pour dix jeux, le banc établit aussi l’égalité parent → enfant au niveau de 23 103 événements de décision. Les 97 autres verdicts portent sur les champs du reçu historique. [Index chaîné par jeu](sic-qualification-a5a90c33/qualification.json)

Le candidat `a5a90c3349ea49bba8e40055444cea2026bee962` est l’enfant direct de `3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4`. La [qualification du parent](sic-qualification-3c2d6bcf.md) relie ses 107 reçus au gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le diff de production de l’enfant touche trois fichiers. Il extrait `singleStepDisplacement` dans `observed-translation.ts` et l’appelle dans les deux méthodes `record` étudiées. [Contrat de l’extraction](https://github.com/yannick-fontan-1981/sra-playground/blob/a5a90c3349ea49bba8e40055444cea2026bee962/docs/architecture/sic-candidat-deplacement-axial.md)

## Deux consommateurs observés

Chaque paire repart du niveau 1 sur le même runner Ubuntu 24.04, avec deux processus indépendants, Node 24.22.3, mode `sic`, cible `auto`, graine 0, un worker et les plafonds du gel. Le comparateur a lu les deux traces entières dans l’ordre. Les reçus du parent et de l’enfant reproduisent aussi chacun le reçu archivé du parent. G50T et FOGW figurent tous deux dans le catalogue des 107. [Run des témoins](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46069878515)

| Jeu | Niveaux | Commandes par niveau sur les deux SHA | Événements | Premier écart |
|---|---:|---|---:|---|
| G50T | 7/7 | 27, 32, 65, 32, 51, 50, 44 | 3 004 | Aucun |
| FOGW | 6/6 | 18, 7, 18, 29, 38, 63 | 1 623 | Aucun |

Un second rejeu de L1, pour chaque jeu et chaque SHA, mesure le résultat réellement accepté dans la branche du parent puis le résultat rendu par le nouvel appel chez l’enfant. Les préfixes d’actions et de retours publics jusqu’à la victoire L1 ont la même empreinte que les parcours complets correspondants. Le SHA-256 de toute la suite ordonnée des mesures L1 coïncide entre parent et enfant. Les compteurs incluent les mesures refusées. [Sonde des deux sites](../../scripts/sic-displacement-call-witness.mjs)

| Jeu et site `record` | Passage P05 → P07 en L1 | Mesure sur le retour de P05 | Nombre de passages au site en L1, parent / enfant |
|---|---|---|---:|
| G50T · `replay-access.ts` | Tours 5 → 6, événements 46 → 56, `ACTION4` | (14, 8) → (20, 8), pas 6, résultat [6, 0], observation r6 `bd5da91d68f0d73d` | 25 / 25 |
| FOGW · `reception-access.ts` | Tours 3 → 4, événements 26 → 36, `ACTION4` | (30, 42) → (34, 42), pas 4, résultat [4, 0], observation r4 `2ef366caf5b05817` | 15 / 15 |

Dans chacun des deux jeux, le compteur de l’autre site vaut zéro en L1. G50T reproduit également l’empreinte de décision publiée lors du lot P05 pour le parent. Pour FOGW, le lot P05 avait livré le reçu historique. Les deux traces détaillées FOGW ont été capturées dans ce lot. Les 48 tests de géométrie, de caractérisation des familles et de continuité indiqués dans le contrat ont été rejoués sur l’enfant et passent.

## Reproduire une paire native

Depuis le banc, fournir deux checkouts propres aux SHA parent et enfant et Node 24.22.3. Pour chaque jeu, utiliser un dossier neuf. La commande `record` capture le parcours entier ordinaire puis le L1 avec la sonde pour G50T et FOGW. Le sous-ordre `compare` contrôle aussi le reçu archivé du parent.

```powershell
$jeu = 'FOGW'
$sortie = "artifacts/reprise-$jeu-$([guid]::NewGuid())"
py scripts/sic-compare-displacement-revisions.py record $jeu $sortie --checkout ../sic-cartographie-p05 --label A
py scripts/sic-compare-displacement-revisions.py record $jeu $sortie --checkout ../sic-banc-deplacement --label B
py scripts/sic-compare-displacement-revisions.py compare $jeu $sortie
```

Le [workflow des paires](../../.github/workflows/sic-axial-decision-pairs.yml) effectue le même travail. Les grands journaux restent dans le système de fichiers du runner. Les artefacts transmis contiennent les reçus compacts, les points de mesure et le verdict du comparateur.

## Cohorte protégée

La sélection conserve les quatre autres traces détaillées du lot P05, les corrections du gel, les deux parcours avec reset et CWSE pour la réception directionnelle, qui utilise le calcul d’emprise du même module. Les dix jeux détaillés appartiennent aux 107. [Run de la cohorte protégée](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46070652873)

| Jeux | Preuve parent → enfant | Événements comparés par jeu, dans l’ordre indiqué |
|---|---|---|
| AS66, HOLE, PORT, DC22 | Chaque fichier enfant a le SHA-256 du fichier parent déjà qualifié, contrôlé dans l’index P05 | 1 613, 784, 844, 5 662 |
| SNAR, SS01, SS04, CWSE | Deux captures natives complètes par jeu, avec comparaison ordonnée | 1 423, 3 622, 2 578, 1 950 |

Avec G50T et FOGW, les dix jeux totalisent 2 704 décisions et 23 103 événements, sans premier écart sur les runners de qualification. Les [verdicts par jeu](sic-qualification-a5a90c33/decisions.json) précisent les révisions du workflow, le run, la méthode et les empreintes. L’[archive compacte des paires](sic-qualification-a5a90c33/paires.zip) conserve les commandes, les reçus, les mesures L1 et les résultats du comparateur.

## Arrêts complémentaires sous Windows

Les captures locales ont été lancées en série sur le poste Windows, avec les plafonds historiques et le même Node 24.22.3. Elles restent sous `artifacts/qualification-a5a90c33/`. Les chemins, empreintes et premières différences de chaque comparaison figurent dans le [reçu des limites murales](sic-qualification-a5a90c33/plafonds-windows.json).

| Paire locale | Premier écart observable |
|---|---|
| G50T, parent du lot P05 → premier enfant | Événement 2 542. Le parent entame L6 tour 49, l’enfant s’arrête après 48 commandes du niveau, au plafond de 47 s. |
| G50T, parent puis enfant recapturés | Événement 826, L3 tour 25. L’enfant émet `stop` au plafond de 83 s. Le parent atteint ensuite le plafond de L6 après 48 commandes, comme le premier essai enfant. |
| FOGW, parent répété → enfant | Événement 1 489, L6 tour 50. Le parent émet `stop` pendant que l’enfant publie encore un événement natif. Chacun termine avec 160 commandes, dont 50 en L6, au plafond de 37 s. |
| FOGW, parent → même parent | Le premier parent atteint 60 commandes en L6, le second 50. Le premier écart est à l’événement 1 489. |

Chaque paire locale concorde jusqu’à la frontière indiquée. Ces écarts de complétude et de réconciliation restent observables sur ce poste. Les essais ne départagent pas les causes de la variation de temps. Le verdict des dix parcours complets provient des runners Ubuntu avec les plafonds historiques.

## Campagne des 107 et reprise

La première tentative du workflow `4a66adc86b93c28ebb5bba731c5115c0ed0b0eec` a rejoué le SHA enfant sur 24 lots équilibrés, en série dans chaque lot. Les 107 codes sont distincts. Aucune différence d’effet, de préfixe par niveau ou de résultat au niveau des reçus, aucun dépassement au score. SNAR a gagné 6/6 en 163 commandes. SS01 (444 commandes) et SS04 (443) ont gagné 8/8 avec chacun un reset. Les 105 autres jeux comptent zéro reset et les 107 zéro undo. [Run de l’enfant](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46071413619)

Du lancement à la fin du dernier contrôle, **11 min 41 s** se sont écoulées. Les 24 étapes de rejeu couvrent une fenêtre de 9 min 28 s, avec un pic de 20 étapes simultanées et une durée cumulée de **1 h 46 min 14 s**. Le pic des jobs de lot est également de 20, pour 2 h 11 min 25 s cumulées. [Intervalles par lot](sic-qualification-a5a90c33/horaires.json)

L’[archive des 107 reçus](sic-qualification-a5a90c33/recus.zip) a pour SHA-256 `efbe2f46f94a6349fb901470fe7315468b742507650ede88550badbb9b74b906`. Le contrôle chaîné ci-dessous vérifie les deux archives, les paramètres, les 24 manifestes de chacune, le lien de parenté, les SHA-256 de chaque reçu, les dix preuves détaillées et les deux comparaisons pour chaque jeu. Dans un nouveau clone, récupérer d’abord les objets Git des archives et workflows.

```powershell
git fetch origin audit/sic-107-a5a90c33-20261127 audit/sic-107-3c2d6bcf-20261127 audit/sic-107-4be368a3-20261127 audit/sic-107-workflow-tooling-20261127
$d = 'docs/diagnostics/sic-qualification-a5a90c33'
py scripts/sic-compare-receipt-chain.py --parent docs/diagnostics/sic-qualification-3c2d6bcf --candidate a5a90c3349ea49bba8e40055444cea2026bee962 --workflow 4a66adc86b93c28ebb5bba731c5115c0ed0b0eec --run-id 46071413619 --receipts "$d/recus.zip" --pairs "$d/paires.zip"
```

La commande `import-ci` du [banc de reprise](sic-qualification-progressive-107.md) accepte ces mêmes SHA et ce numéro de run avec `--download` pointant vers l’archive décompressée. Un nouvel import a traité trois témoins, puis 104 nouveaux jeux, puis a réutilisé 107 verdicts. L’index regénéré est identique octet pour octet. Les reçus téléchargés et les états de reprise sont dans `artifacts/qualification-a5a90c33/ci-46071413619/` et `artifacts/qualification-a5a90c33/reimport-public/`.
