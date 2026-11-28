# Coexistence de trente-cinq lignes SIC

Le moteur d’essai `09aeb9e14e40b6115269e47267b47ba8d71708fd` descend directement du [moteur à 25 lignes](sic-coexistence-278d5b35.md). Le périmètre et l’arbre `src` `09123570bc9009c3526364ffea57086327af2afc` sont figés avant qualification à 21:50:48 (UTC−3) le 27 novembre 2026. Branche `experiment/sic-coexistence-trente-cinq-lignes`. Le commit de transport CI `90b019cfaf184b416f2e8c3fe41346a7bec4a29d` ajoute le seul workflow. [Diff du moteur](https://github.com/yannick-fontan-1981/sra-playground/compare/278d5b357d3e3328a32697fe402f3fa9d957d547...09aeb9e14e40b6115269e47267b47ba8d71708fd)

| Lignes du lot | Source et témoins de coexistence | Verdict indépendant du banc et de l’opérateur |
|---|---|---|
| 1, 3, 15, 16, 18, 23, 27, 28, 29, 44, 47, 48, 52, 57, 58, 61, 63, 66, 83, 87, 90, 91, 92, 96, 98 | Les 25 du parent. Les parcours de retrait et de reprise du parent sont rejoués sur ce nouvel arbre, ainsi que le mode de projection par défaut, l’attribution ONDE et les captures CONN et VC33. | [Archive des 25](sic-coexistence-278d5b35.md) |
| 80 | REGN `6bfb8ccf`, comportement du gel. Deux longueurs de trajet consommées, retraits du retour et de la question, distinction entre budget et coupure de lecture. | [Banc](sic-qualification-regn-6bfb8ccf.md) · opérateur `93d0af42` |
| 22 | REGN `be816a3f`, comportement du gel. Reprise au tour 16, substitution de la seule question distante, retrait du trajet et persistance du besoin d’accès. | [Banc](sic-qualification-regn-be816a3f.md) · opérateur `641f5540` |
| 35, 36 | GARE `c3f24fb8`, deux entrées du gel. Alternative de transfert T1 et deux suites distinctes de l’analogie aux T4 et T5. | [Banc](sic-qualification-gare-c3f24fb8.md) · opérateur `6f676693` |
| 2, 68, 69 | LIFE `f005be66`, un fichier repris, `v6-typed-material-access.ts`. L’invitation animée relève du gel. Les choix du porteur ou du descendant libre et le rattachement du partenaire ou de la livraison sont éprouvés sur l’assemblage. | [Banc](sic-qualification-life-f005be66.md) · opérateur `85cb6702` |
| 13, 14 | GLOB `48aae7fc`, un fichier repris, `v6-fixed-origin.ts`. La question de dépendance est substituable sur branche. L’origine, le placement et sa confirmation sont déjà mesurés sur le gel. Dix variations et le catalogue sont comparés sur l’assemblage. | [Banc](sic-qualification-glob-48aae7fc.md) · opérateur `1b5dd9d3`, liaison du vérificateur `f52f29ea` |
| 4 | SP80 `bb4a99b5`, seul `v6-branch-routing.ts` a été importé. Mesure native et substituée du vecteur, et réattribution de `ACTION1` après retrait. Le sélecteur de cellule de 41 a été exclu avant le gel de cet assemblage. | [Banc](sic-qualification-sp80-bb4a99b5.md) · opérateur `2177b164` |

Les trois fichiers moteur sont disjoints et leurs blobs correspondent aux révisions indiquées. Le diff cumulé par rapport à `d0e7527c` compte 29 fichiers, tous sous `src`. Le vérificateur exige aussi que le blob `v6-cell-placement.ts` soit celui du gel. La qualification ultérieure de TICT/41 et les références AS66/84 et 97 ont leurs propres reçus.

## Verdict

**Les 35 lignes coexistent sur `09aeb9e1`.** Le banc retrouve les 381 tests hérités et 24 tests supplémentaires sur GARE, LIFE et SP80. Les deux tests du sélecteur de cellule de la ligne 41 sont hors périmètre. Les sept scénarios REGN et onze GLOB reproduisent leurs reçus distincts, dont le retrait de la dépendance GLOB 13 et le changement de besoin au T16 de REGN. Les témoins publics STCK et VALV concordent. Le premier témoin STCK a atteint le délai du dialogue sous charge concurrente. Le banc a repris le candidat en série avec le même délai et les reçus individuels de l’archive des 25, dont les empreintes ont été contrôlées. TypeScript passe avec `--noEmit`. [Témoins et journaux](sic-coexistence-09aeb9e1/temoins.zip)

Les reçus de **107 jeux uniques, 692 niveaux et 18 560 commandes** concordent avec le gel et le parent à 25 lignes. Deux resets, SS01 et SS04, et zéro undo. Le verdict sur les 107 a la précision des reçus historiques. Les décisions, preuves et retours détaillés sont comparés sur les témoins rejoués. [Index par jeu](sic-coexistence-09aeb9e1/qualification.json) · [Reçus des 24 lots](sic-coexistence-09aeb9e1/recus.zip)

Les 24 lots ont tourné en 13 min 34 s, avec un pic de 20 runners et 6372 secondes cumulées de rejeu. L’import de reprise vérifie trois jeux au premier passage, puis 104 nouveaux et trois réutilisés, puis 107 réutilisés. Verdict complet du banc à 27/11 22:13:31 (UTC−3), après 22 min 27 s. [Horaires](sic-coexistence-09aeb9e1/horaires.json)

## Reproduire

L’audit recharge les reçus, contrôle les 107 codes et leurs paramètres, vérifie les blobs, puis compare chaque jeu au gel et au parent à 25 :

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-09aeb9e1/recus.zip --candidate 09aeb9e14e40b6115269e47267b47ba8d71708fd --workflow 90b019cfaf184b416f2e8c3fe41346a7bec4a29d --run 46090081248
```

Pour les témoins, prendre un checkout propre du moteur d’essai en `$m`, Node 24.22.3, les jeux et Pyodide préparés. Depuis le banc, reprendre les commandes de la fiche du parent, dans des dossiers neufs, avec le nouveau `$m` et **`--candidate 09aeb9e14e40b6115269e47267b47ba8d71708fd`** pour les défis STCK/VALV. Ajouter les contrôles suivants. Les trois checkouts de preuve sont épinglés aux révisions du tableau ; GLOB accepte aussi `787fee97`, qui corrige seulement son vérificateur agrégé.

```powershell
foreach ($jeu in 'GARE','LIFE','SP80') { py -3.11 scripts/test-sic-coexistence-catalogue.py $jeu $m "./tests-$jeu" }
py -3.11 scripts/test-sic-coexistence-retours.py REGN80 ../sic-regn-80 $m ./tests-regn80
py -3.11 scripts/test-sic-coexistence-retours.py REGN22 ../sic-regn-22 $m ./tests-regn22
py -3.11 scripts/test-sic-coexistence-retours.py GLOB ../sic-glob-13-14 $m ./tests-glob
```

Pour le défi STCK, le banc a utilisé cet appel de reprise avec l’archive publiée du précédent assemblage. Le programme vérifie les empreintes et la révision du témoin individuel avant de comparer la nouvelle capture de l’assemblage.

```powershell
py -3.11 scripts/test-sic-coexistence-operateur.py ./defis-stck --candidate 09aeb9e14e40b6115269e47267b47ba8d71708fd --pyodide "$m/public/vendor/pyodide" --game STCK --reference-archive docs/diagnostics/sic-coexistence-278d5b35/temoins.zip
```

Les sorties locales sont dans `artifacts/qualification-coexistence-35/`. Les lots d’origine sont sous `ci-46090081248/download`, l’état de reprise sous `reimport`. [Campagne unique sur 35 lignes](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46090081248)
