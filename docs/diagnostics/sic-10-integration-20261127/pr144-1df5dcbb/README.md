# Qualification stricte sur la quatrième tête de la PR144

La tête `650852abc3e06698ed346b1d79e3875bf4f75290` de la [PR144](https://github.com/yannick-fontan-1981/sra-playground/pull/144) a été testée via le merge synthétique `1df5dcbba217696f6a94137e162dab3c8da4dd9f`, arbre `359b57d62ee36110cfb349496eabe13d4ebfb13a`, sur la base `53480b31192831f15a5d0550eb72a3e699c43911`.

Les 38 contrôles de la PR ont réussi. Le merge intégré sur `main`, `0fe417b2e91bb8ca15573e82b79b7081157aeb37`, a exactement le même arbre et les mêmes parents que le merge testé.

Les 11 contrôles du [strict 46043528753](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46043528753) ont réussi. Les dix jeux ont été exécutés sur des runners hébergés distincts, chacun à partir du premier niveau avec un worker SIC, sans reset ni undo et sous les plafonds d’origine.

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
| WA30 | 9/9 | 613 |
| WEAV | 6/6 | 199 |

Les neuf niveaux de WA30 gagnent en 26, 59, 76, 48, 113, 48, 42, 135 et 66 commandes. Le temps qualifiant du L9 est de 48 540 ms sous 51 000 ms. Son temps total est de 50 157 ms. La recomposition locale à partir des dix parties reproduit le manifeste et l’agrégat à l’octet près.

Les 27 contrôles du [workflow de continuité 46043528762](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46043528762) ont réussi. Le bloc de vérification des manifestes et `npm run test:sic-continuity` ont été reproduits sur les reçus des 170 niveaux, 26 jeux et 25 cohortes. La collecte physique de WA30 conserve 613 commandes. Au L8/L9, elle mesure 56/21 continuations, 53/20 paires de déplacements du porteur et 44/8 paires de translations de la même caisse.

L’[index des reçus](receipt-index.json) conserve les empreintes SHA-256. Les validations antérieures [une](../pr144-ed7d394d/README.md), [deux](../pr144-bbb2ca84/README.md) et [trois](../pr144-e7122a58/README.md) restent consultables sous leurs propres SHA.
