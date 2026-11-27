# Reçus de qualification de la PR143

Les 28 contrôles de la [PR143](https://github.com/yannick-fontan-1981/sra-playground/pull/143) ont réussi. Les runs [strict 46029260013](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46029260013) et [continuité 46029260117](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46029260117) ont testé le merge synthétique `18f3ab611cfe41fc48094f8e6ea718296cd7c92f`. Le commit intégré sur `main`, `53480b31192831f15a5d0550eb72a3e699c43911`, a les mêmes parents et exactement le même arbre `55c019cb0c8a7dcfda5f3d2983aa98908162ea06`.

Le strict a gagné neuf jeux du premier au dernier niveau, en mode SIC, avec un worker et sous les plafonds d’origine.

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
| WEAV | 6/6 | 199 |

SNAR conserve la trajectoire de 16, 24, 23, 36, 35 et 29 commandes. Le temps qualifiant du L6 est de 12 680 ms pour un plafond de 17 000 ms. Le bloc de validation du workflow a reproduit le manifeste strict à l’octet près sur les reçus téléchargés.

Le contrôle déterministe `npm run test:sic-continuity` et la vérification des manifestes du workflow réussissent sur les 168 niveaux de 26 jeux et les 25 cohortes. L’[index](receipt-index.json) recense les contrôles, l’identité des artefacts GitHub et les empreintes SHA-256 des fichiers bruts. Le [dispatch combiné antérieur](../strict-76890212-46028142470/README.md) est archivé séparément.
