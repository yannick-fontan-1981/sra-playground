# Reçus de la première validation de la PR144

La tête `01226397e5b868d2d511d4b385f5f8c109cb1374` de la [PR144](https://github.com/yannick-fontan-1981/sra-playground/pull/144) a été testée via le merge synthétique `ed7d394dcee931edb058d73ed68fcf1d361b1cd5`, arbre `c0e96cb3913a6b105506e035b222380f87c148ab`. La base était `53480b31192831f15a5d0550eb72a3e699c43911`.

Le [rejeu strict 46033617797](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46033617797) a exécuté dix jeux avec un worker SIC depuis le premier niveau, sous les plafonds d’origine.

| Jeu | Niveaux gagnés | Commandes |
| --- | ---: | ---: |
| CGWL | 6/6 | 167 |
| DC22 | 6/6 | 630 |
| ETAG | 6/6 | 274 |
| GRAV | 6/6 | 80 |
| LF52 | 10/10 | 713 |
| SK48 | 8/8 | 348 |
| SNAR | 6/6 | 163 |
| SPOR | 6/6 | 121 |
| WA30 | 8/9 | 612 |
| WEAV | 6/6 | 199 |

WA30 a atteint le plafond de 51 000 ms après 65 commandes au L9. Le dernier ticket exécuté arrive à 50 579 ms. Le reçu brut conserve le verdict `level_wall_time_budget` et les huit premiers parcours en 26, 59, 76, 48, 113, 48, 42 et 135 commandes. Le bloc d’acceptation strict a échoué et a conservé les reçus de la campagne.

Les 27 contrôles du [run de continuité 46033617663](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46033617663) ont réussi. Le bloc de vérification des manifestes et `npm run test:sic-continuity` ont été revalidés sur les 170 niveaux de 26 jeux en 25 cohortes. Le reçu physique WA30 est complet en 613 commandes. Le L8/L9 mesurent 56/19 continuations, 53/19 paires de déplacements du porteur et 44/8 paires de translations de la même caisse.

L’[index des reçus](receipt-index.json) contient les résultats, les identités des artefacts et les empreintes SHA-256 des fichiers bruts. Cette archive conserve le premier échec de la PR144 et son contrôle de continuité réussi.
