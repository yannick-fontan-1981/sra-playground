# Coexistence de dix-huit lignes SIC

Le moteur d’essai `f27eb1c055d44e852fb90a25c542d0a466eb6c16` part directement du [moteur à dix lignes](sic-coexistence-8a424aab.md). Le périmètre a été arrêté au lancement du 27 novembre 2026, 23:50 UTC. Le SHA et son arbre `src`, `f510d30b9c982a632d878f7ed82e81ba4bb39646`, identifient aussi bien les captures locales que les 24 lots de la campagne distante. La branche est `experiment/sic-coexistence-dix-huit-lignes`. [Diff du moteur par rapport au parent](https://github.com/yannick-fontan-1981/sra-playground/compare/8a424aab6ca2e2f6b902cc4b9c89313ed6947b74...f27eb1c055d44e852fb90a25c542d0a466eb6c16)

| Lignes en portée | Provenance moteur et preuve attendue |
|---|---|
| 1, 15, 16, 18, 23, 83, 87, 90, 91, 98 | Reprise du parent `8a424aab`, dont découle tout l’arbre. Rejouer ses 20 suites, les deux époques ZIPP, les témoins G50T et les départages DICO sur le moteur combiné. |
| 61 | `21fd159e`, fichier `v6-reception-service-access.ts` extraction et correction réunies. Distinguer la confirmation physique du T17 et le changement de demande avant le ticket T18 de FOGW. |
| 92 | `b56ea752` apporte la preuve LS19 sur les sources du gel. Rejouer les sept conditions sur le moteur combiné avec les lignes 90 et 91 actives. |
| 44, 47, 48 | `495ea148`, fichier `v6-field-service-access.ts` réunissant l’extraction et le correctif de portée. Rejouer les trois retraits, le témoin authentique, la mauvaise paire et le contexte de récepteur altéré. Les deux verdicts relatifs à 48 précèdent le gel de cet assemblage. [Banc](sic-qualification-valv-495ea148.md) · [Opérateur](https://github.com/yannick-fontan-1981/sra-playground/tree/7448e989373ef7e02808c5142451b21f61f18570/experiments/symbolic-situations/valv-ligne-48-provenance) |
| 52, 57, 58 | `39e32b1f`, fichiers `v6-program-composition-access.ts` et `v6-shared-series.ts`. Rejouer les trois replis, le retrait des apprentissages et l’ordre des répondants dans des animations ayant la même image finale. [Banc](sic-qualification-stck-39e32b1f.md) · [Opérateur](https://github.com/yannick-fontan-1981/sra-playground/tree/fc6373a5298f603692c77c8aade2cecf6f807e2e/experiments/symbolic-situations/stck-lignes-52-57-58) |

Ces huit numéros ajoutent quatre fichiers moteur au parent. Aucun de ces chemins n’y avait changé depuis le gel. Les blobs sont identiques à leurs sources qualifiées. Le diff cumulé avec `d0e7527c` compte 21 fichiers, tous sous `src`. La qualification de SK48/96 reste sur son propre moteur `4946cf02`. [Verdict SK48 et réserve du banc](sic-qualification-sk48-4946cf02.md)

## Rejouer les contrôles

Préparer un checkout propre au SHA d’assemblage, un Node 24.22.3, les dépendances verrouillées et les jeux avec Pyodide. Depuis le banc, adapter `$moteur`, utiliser des dossiers de sortie neufs, et récupérer les commits des opérateurs avant le dernier appel. Les scripts montent la production de l’assemblage et les tests de chaque révision de preuve dans des dossiers distincts.

```powershell
$moteur = (Resolve-Path ../sic-banc-ls19).Path
py scripts/test-sic-coexistence.py $moteur ./temoins-herites --node node
py scripts/test-sic-coexistence-offres.py $moteur ./offres-heritees --node node
py scripts/test-sic-coexistence-reprises.py $moteur ./temoins-nouveaux --node node
git fetch origin 7448e989373ef7e02808c5142451b21f61f18570 fc6373a5298f603692c77c8aade2cecf6f807e2e
py scripts/test-sic-coexistence-operateur.py ./defis-publics --pyodide "$moteur/public/vendor/pyodide" --node node
```

Le commit CI `6e47d3bc869b52724b3c53b10c00e33ff8750bd4` ajoute uniquement le workflow de la campagne. Il rattache les reçus à l’arbre moteur et aux 107 codes du gel. [Campagne distante unique](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46084691760)
