# Coexistence de vingt-cinq lignes SIC

**Le moteur d’essai est `278d5b357d3e3328a32697fe402f3fa9d957d547`**, sur `experiment/sic-coexistence-vingt-cinq-lignes`. Le périmètre a été figé le 28 novembre à 00:17 UTC. Son parent direct est `f27eb1c055d44e852fb90a25c542d0a466eb6c16`, son arbre `src` est `ea84928b27f5027b0e8a6e0960ba2a41fc03eed8`. Les 18 lignes parentes ont conservé leur archive et leur campagne propres. [Qualification des 18](sic-coexistence-f27eb1c0.md) · [Diff moteur du parent à l’enfant](https://github.com/yannick-fontan-1981/sra-playground/compare/f27eb1c055d44e852fb90a25c542d0a466eb6c16...278d5b357d3e3328a32697fe402f3fa9d957d547)

| Numéros | Source et portée des témoins |
|---|---|
| 1, 15, 16, 18, 23, 44, 47, 48, 52, 57, 58, 61, 83, 87, 90, 91, 92, 98 | Les 18 lignes du parent. Les 23 suites, les variantes des producteurs et les défis publics de STCK et VALV sont rejoués sur le nouvel arbre. |
| 96 | `4946cf02`, trois fichiers de planification de la station et d’accès à la ligne enracinée. La projection autorisant un ordre inconnu est activée pour la démarche V6 concernée. Les tests V5 par défaut et les cas explicites d’égalité et d’inversion traversent le moteur assemblé. Les 12 départs de l’historique, du développement, de la réserve et du banc (dont 8↔13) sont comparés aux reçus du correctif. [SK48](sic-qualification-sk48-4946cf02.md) |
| 27, 28, 29 | `75aa3829`, `v6-periodic-sums.ts`. 27 substitue une sonde à préfixe conservé ; son retour change la famille suivante. 28 permet le départage interne à déclaration inchangée. L’ordre déclaré inversé donnait déjà le deuxième ticket sur le gel. 29, avec retrait de la préimage, est attribuée au gel. Huit parcours, dont le catalogue de 16 gestes. [ONDE](sic-qualification-onde-75aa3829.md) |
| 63, 66 | La preuve `f8607d2a` utilise l’arbre du gel. Les sept sessions CONN sont rejouées sur l’assemblage, y compris les substitutions N1/T1 et N3/T13, leurs retours et leurs reprises. [CONN](sic-qualification-conn-f8607d2a.md) |
| 3 | `f489393b`, `v6-band-transfer.ts`. VC33 N1/T1 mesure le transfert sans prévision. N1/T2 prédit avec le signe appris. Le second actionneur donne une autre mesure et une autre prévision confirmée. Le retrait de l’offre conduit à la frontière. [VC33](sic-qualification-vc33-f489393b.md) |

Les cinq fichiers ajoutés au diff du parent sont repris à l’octet de leurs révisions qualifiées. Aucun ne recouvre un chemin que le parent avait modifié. Le diff cumulé avec le gel contient 26 fichiers sous `src`. Le code du workflow est dans un commit distinct, `eaed4f09f42afae0d6e314c36fd4f2c1d3318526`. REGN et GARE conservent leurs qualifications individuelles.

## Verdict

**Les 25 lignes coexistent sur ce moteur d’essai.** Les 27 suites locales passent **381 tests**. Les 280 tests des 18 sont rejoués. S’y ajoutent les 88 tests de projection, dont la référence du comportement par défaut, sept tests CONN et six tests VC33. Les 12 cartes SK48 et les huit cartes ONDE correspondent aux captures de leurs branches. Les sept sessions CONN et six sessions VC33 ont également été comparées ticket par ticket. Les replis publics STCK et VALV conservent leurs reçus. TypeScript passe avec `--noEmit`. [Captures et tests ciblés](sic-coexistence-278d5b35/temoins.zip)

La campagne historique concorde pour **107 jeux uniques, 692 niveaux, 18 560 commandes, deux resets et zéro undo**, face au gel et au parent à 18 lignes. SNAR termine 6/6 en 163 commandes. SS01 (8/8, 444) et SS04 (8/8, 443) utilisent chacun un reset. L’équivalence détaillée porte sur les témoins capturés. Sur les 107, le verdict a la précision des champs des reçus historiques. [Index par jeu](sic-coexistence-278d5b35/qualification.json) · [Reçus des 24 lots](sic-coexistence-278d5b35/recus.zip)

La CI a duré **12 min 02 s**, avec un pic de 20 runners et 6 072 secondes cumulées de rejeu. Le réimport reçoit d’abord trois jeux, puis 104 nouveaux et trois déjà qualifiés, puis réutilise les 107. Une requête de suivi GitHub a expiré pendant la campagne. La récupération a repris sur le même identifiant de run et les mêmes artefacts. Verdict complet du banc à 00:43:11 UTC le 28 novembre, soit 25 min depuis le lancement de la CI. [Horaires des lots](sic-coexistence-278d5b35/horaires.json)

## Vérifier et reproduire

Le vérificateur recalcule le jeu de fichiers moteur, leurs blobs, les rattachements Git, les paramètres et les différences par jeu. Depuis le checkout du banc avec les révisions Git accessibles et Python 3.11 :

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-278d5b35/recus.zip --candidate 278d5b357d3e3328a32697fe402f3fa9d957d547 --workflow eaed4f09f42afae0d6e314c36fd4f2c1d3318526 --run 46087079975
```

Pour les témoins locaux, préparer un checkout propre de `278d5b35`, ses dépendances et Pyodide, ainsi que Node 24.22.3. Depuis le banc, choisir des dossiers de sortie neufs. Les scripts montent la production épinglée avec les tests de leurs auteurs. Les deux programmes de défis publics utilisent les révisions `7448e989` et `fc6373a5`.

```powershell
$m = (Resolve-Path ../sic-banc-ls19).Path
py -3.11 scripts/test-sic-coexistence.py $m ./herites
py -3.11 scripts/test-sic-coexistence-offres.py $m ./offres
py -3.11 scripts/test-sic-coexistence-reprises.py $m ./reprises
py -3.11 scripts/test-sic-coexistence-operateur.py ./defis --candidate 278d5b357d3e3328a32697fe402f3fa9d957d547 --pyodide "$m/public/vendor/pyodide"
foreach ($jeu in 'SK48','ONDE') { py -3.11 scripts/test-sic-coexistence-projection-phases.py $jeu $m "./tests-$jeu" }
foreach ($jeu in 'CONN','VC33') { py -3.11 scripts/test-sic-coexistence-series-bandes.py $jeu $m "./tests-$jeu" }
```

Les sorties locales sont dans `artifacts/qualification-coexistence-25/`. Les lots originaux se trouvent sous `ci-46087079975/download` et l’état de reprise sous `reimport`. [Campagne distante unique](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46087079975)
