# Deuxième validation de la PR144

Les workflows de la [PR144](https://github.com/yannick-fontan-1981/sra-playground/pull/144) ont testé la tête `ac7790f07467d5a92812f0b50a5deb58d8fcf83c` via le merge synthétique `bbb2ca84eeb97b61db50ba5867fa849501524438`, arbre `55e9ff211fa826bbf8eb715bb90117858b6d5b7f`.

Le [strict 46038060497](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46038060497) a exécuté dix jeux sur des runners hébergés distincts, chacun du premier niveau avec un worker SIC, sans reset ni undo et sous les plafonds d’origine.

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

WA30 a exécuté 65 commandes au L9 avant le verdict `level_wall_time_budget` à 51 002 ms pour un plafond de 51 000 ms. Le dernier ticket est horodaté à 49 315 ms. Les huit niveaux précédents conservent les parcours de 26, 59, 76, 48, 113, 48, 42 et 135 commandes. Les dix jobs d’exécution ont produit leurs reçus et l’agrégateur a rejeté la couverture incomplète de WA30. La recomposition locale à partir des dix parties reproduit exactement le verdict et les octets de l’agrégat.

L’[index des reçus](receipt-index.json) associe l’agrégat, les parties et le journal de validation à leurs empreintes SHA-256. La [première validation](../pr144-ed7d394d/README.md) reste archivée sous son propre SHA.
