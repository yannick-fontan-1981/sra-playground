# Troisième validation de la PR144

La tête `8fd38588ee11d7b051eadc7812def30f36b4f29b` de la [PR144](https://github.com/yannick-fontan-1981/sra-playground/pull/144) a été testée via le merge synthétique `e7122a5887418212ca9a10ab39933e106d68f0c4`, arbre `ccacd144970cca821bf884e57bdc812670c04cbb`, sur la base `53480b31192831f15a5d0550eb72a3e699c43911`.

Le [strict 46040162842](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46040162842) a exécuté dix jeux sur des runners hébergés distincts, chacun à partir du premier niveau avec un worker SIC, sans reset ni undo et sous les plafonds d’origine.

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
| WA30 | 8/9 | 607 |
| WEAV | 6/6 | 199 |

WA30 a exécuté 60 commandes au L9 avant le verdict `level_wall_time_budget` à 51 000 ms. Les tickets globaux 601 à 607 sont horodatés entre 50 794 et 50 934 ms. Les huit premiers niveaux conservent les parcours de 26, 59, 76, 48, 113, 48, 42 et 135 commandes. La recomposition locale à partir des dix parties reproduit exactement le verdict et les octets de l’agrégat.

Les 27 contrôles du [workflow de continuité 46040162938](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46040162938) ont réussi sur le même arbre. La vérification des manifestes et `npm run test:sic-continuity` ont validé 170 niveaux, 26 jeux et 25 cohortes sur les reçus téléchargés. La collecte physique WA30 couvre neuf niveaux en 613 commandes, avec 56 continuations au L8 et 21 au L9.

L’[index des reçus](receipt-index.json) conserve ces pièces et leurs empreintes. Les [première](../pr144-ed7d394d/README.md) et [deuxième](../pr144-bbb2ca84/README.md) validations sont conservées sous leurs propres SHA.
