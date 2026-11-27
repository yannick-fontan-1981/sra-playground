# Rejeu strict combiné avec SNAR

Le [workflow 46028142470](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46028142470) a qualifié neuf jeux sur le commit `76890212a43864fd31c4c206e1dabdd54b15b56e`, arbre `b80a6217733a7f0ce8d17bb8042929c956dbc10d`. Chaque parcours commence au premier niveau, en mode SIC, avec un worker et les plafonds de temps et de commandes d’origine.

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

SNAR gagne ses six niveaux en 16, 24, 23, 36, 35 et 29 commandes. Le bloc de validation du workflow a reproduit le manifeste à l’octet près sur les reçus téléchargés. L’[index](receipt-index.json) conserve les empreintes SHA-256 des fichiers bruts et l’identité de l’artefact GitHub.

Ce lancement manuel qualifie l’arbre ci-dessus. Le contrôle de continuité et les workflows de la PR143 ont leurs propres reçus.
