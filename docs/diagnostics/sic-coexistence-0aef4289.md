# Coexistence des 98 lignes SIC sur 0aef4289

Le moteur commun `0aef4289e97ce094782dfd03f5a79ace6eae5fd2` réunit **98 lignes distinctes**, dont 65 qualifiées au gel et 33 sur branches. Il descend directement de `167be950334988ffbc46a04bc26de60c74fea527`, moteur des jalons 87 et 96. L'arbre `src` `97a68f338d0ea96875cd915f65839db021595d95` correspond à la projection indépendante de l'Agenda. Les 41 chemins de production modifiés face au gel sont rattachés à leurs composants dans l'audit. [Périmètre et filiations](sic-coexistence-0aef4289/perimetre.json) · [Jalon 96](sic-coexistence-96-167be950.md)

Le seul fichier moteur modifié depuis `167be950` est `src/logos-engine/v6-visual-sequences.ts`. Son blob `c3993fec81a272ae9d76488bc534d5e21a6409a6` est repris exactement de `eb5611b3ff76409fbd67680ac29a5f6a17586422`, le correctif SERI/93. LKEY/72 exerce le code déjà présent au gel. Ces deux numéros portent le périmètre de 96 à 98. [Preuve de branche SERI](sic-qualification-seri-eb5611b3.md) · [Preuve au gel LKEY](sic-qualification-lkey-d67284e8.md)

## Témoins sur le moteur commun

TypeScript et **23 tests ciblés** passent. Les **11 scénarios natifs** de SERI et LKEY retrouvent leurs reçus individuels. [Contrôles et empreintes](sic-coexistence-0aef4289/index.json)

| Ligne | Résultat vérifié sur 0aef4289 |
|---|---|
| SERI · 93 | Sept scénarios, dont les témoins du doublon et le retour stationnaire. Au N2/T5, le journal `[2,3,3]` donne le plan `[2,3,5]` et le gabarit `[5,2,3,5]`, où le premier 5 dénote la vue courante. Le gel citait deux fois 3 dans la partie propre aux preuves. Le premier écart est la première référence du plan, 3 → 2. `ACTION6 (46,54)` et le remplissage observé concordent. Une seule question répétée laisse la décision sans continuation. [Verdict opérateur sur le SHA commun](https://github.com/yannick-fontan-1981/sra-playground/blob/c9a5f3550610bef88190233c4c4efd2f6bddfeba/experiments/symbolic-situations/seri-ligne-93-commun/BILAN.md) |
| LKEY · 72 | Quatre scénarios réussis. Le changement de mode est acquis au T10, puis les profils et le mode mesuré alimentent les tickets T11–16. Retirer la relation ou le contraste produit les replis réellement joués. Les six tickets suivent cette portée sans citer d'extension portable. |

SC25/21 conserve la qualification du franchissement dans le service natif sur terrain construit, dans la même époque. Son parcours officiel atteste les activations, et aucun franchissement n'est observé dans les captures détaillées. RECR/70 conserve la qualification du calcul des survivants, avec les effets physiques attribués au plateau réellement joué. [Portée de SC25](sic-coexistence-167be950.md) · [Portée de RECR](sic-coexistence-96-167be950.md)

## Vérifier les témoins

Depuis le banc, utiliser Node 24. `$m` désigne le checkout de `0aef4289` avec Pyodide et `$out` un dossier neuf.

```powershell
py -3.11 scripts/test-sic-coexistence-provenance.py SERI $m "$out/SERI"
py -3.11 scripts/test-sic-coexistence-catalogue.py LKEY $m "$out/LKEY"
```

## Campagne historique

Le run `46109199284` rejoue le catalogue de 107 jeux depuis L1 en mode `sic`, avec un travailleur par parcours et les budgets du gel. Les jeux de chacun des 24 lots s'exécutent en série. Le commit CI `9c2926482ca758130f325562947bcbcf5c6fe63b` ajoute uniquement le workflow au moteur éprouvé. Ses paramètres sont identiques à ceux du run précédent après substitution des identifiants source et arbre. [Campagne unique](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46109199284)

**107/107 jeux complets, 692 niveaux, 18 560 commandes et aucun écart au grain des reçus contre le gel ou le moteur des 96.** La campagne a duré **12 min 17 s**, avec un pic de 20 lots en rejeu. Le premier import traite trois reçus, le second ajoute les 104 suivants et le troisième retrouve les 107 reçus déjà vérifiés. [Verdict par jeu et provenance](sic-coexistence-0aef4289/qualification.json) · [Reçus de la campagne](sic-coexistence-0aef4289/recus.zip) · [Horaires](sic-coexistence-0aef4289/horaires.json)

L'audit vérifie le rattachement à Git des 24 lots, les empreintes des fichiers, la liste sans doublons des jeux et les conditions de chaque parcours. La comparaison porte sur les champs des reçus historiques, dont les commandes, leurs coordonnées, les effets exportés, les empreintes de fin de niveau et les arrêts. Les preuves de décision détaillées sont établies par les témoins ciblés.

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-0aef4289/recus.zip --candidate 0aef4289e97ce094782dfd03f5a79ace6eae5fd2 --workflow 9c2926482ca758130f325562947bcbcf5c6fe63b --run 46109199284
```

Pour contrôler la reprise, télécharger les artefacts CI dans un dossier neuf `$download` et réserver `$state` pour ce run. Les trois imports utilisent le même état local.

```powershell
gh run download 46109199284 --dir $download
foreach ($groupe in 'initial','all','all') {
  py -3.11 scripts/sic-qualification-progressive.py import-ci --candidate 0aef4289e97ce094782dfd03f5a79ace6eae5fd2 --download $download --state $state --workflow 9c2926482ca758130f325562947bcbcf5c6fe63b --run-id 46109199284 --games $groupe
}
```

Le gel officiel et la branche `main` distante sont à `d0e7527ca8033bd805a6d7a8bb021eff62e87021`.
