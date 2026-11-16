# Actions continues de SIC sur les 100 premiers niveaux

La campagne locale utilise SIC seul sur le commit `e483a9d5`, à trois processus. Chaque passage part de l’image initiale et s’arrête à la première victoire du niveau 1. Une série contient plusieurs commandes exécutées sous le même plan engagé. Le délai est mesuré entre les lancements de deux commandes de cette série et inclut le retour du jeu et ses contrôles. Les délais mesurés dépendent aussi de la concurrence des processus.

Les **100 niveaux 1** sont gagnés en **1 248 commandes SIC seul**. **3 jeux sur 100** exécutent une série continue. Les 12 séries produisent les mesures suivantes.

| Jeu | Séries | Plus longue | Délai médian dans une série |
| --- | ---: | ---: | ---: |
| GABA | 7 | 8 | 28 ms |
| HANO | 3 | 2 | 27 ms |
| LS20 | 2 | 6 | 30 ms |

Parmi les 97 jeux sans série observée, 55 utilisent au moins une commande directionnelle, 32 utilisent exclusivement des clics et 10 utilisent d’autres commandes sans déplacement directionnel. Dans les parcours sans série, SC25 répète une même direction 12 fois de suite, AR25 10 fois, CN04, RE86 et TR87 7 fois. Ces répétitions indiquent où inspecter les conditions du plan.

## DC22

SIC gagne en **22 commandes**, avec **21 reprises de décision** et **aucune série**. La famille `sic_remote_support_route` choisit les 22 commandes. Entre des clics de contrôle, le parcours comporte 5 déplacements identiques consécutifs.

La recherche du trajet conserve le champ `first` dans chaque état de la file. Elle renvoie ce premier déplacement à l’arrivée. La proposition contient donc une seule action et laisse `expected_after` à `null`. Son contrôle avant action n’admet que l’indice zéro et son contrôle du retour clôt le préfixe. La répétition des recherches provient de ce contrat de famille.

Pour faire bénéficier toutes les familles d’une exécution continue, chaque planificateur doit transmettre la portion de trajet dont il connaît les effets, avec la cible et les conditions de validité par pas. L’exécuteur garde la vérification de la case d’arrivée et des supports nécessaires. Une commande exploratoire, un changement de terrain, une contradiction ou une fin de niveau clôt le préfixe. Le même principe s’applique aux clics quand leur cible et leur effet restent vérifiables dans la suite.

## Résultat par jeu

| Jeu | Commandes | Reprises de décision | Séries | Plus longue | Délai médian |
| --- | ---: | ---: | ---: | ---: | ---: |
| AMZE | 3 | 2 | 0 | — | — |
| AR25 | 17 | 16 | 0 | — | — |
| AS66 | 4 | 3 | 0 | — | — |
| BP35 | 16 | 15 | 0 | — | — |
| CASC | 6 | 5 | 0 | — | — |
| CATL | 8 | 7 | 0 | — | — |
| CATR | 29 | 28 | 0 | — | — |
| CAVA | 7 | 6 | 0 | — | — |
| CD82 | 9 | 8 | 0 | — | — |
| CGWL | 15 | 14 | 0 | — | — |
| CLRS | 8 | 7 | 0 | — | — |
| CN04 | 18 | 17 | 0 | — | — |
| COLM | 17 | 16 | 0 | — | — |
| COMB | 8 | 7 | 0 | — | — |
| CONN | 24 | 23 | 0 | — | — |
| CRAF | 9 | 8 | 0 | — | — |
| CWSE | 4 | 3 | 0 | — | — |
| DAME | 7 | 6 | 0 | — | — |
| DC22 | 22 | 21 | 0 | — | — |
| DICO | 5 | 4 | 0 | — | — |
| DNOI | 3 | 2 | 0 | — | — |
| ELAS | 16 | 15 | 0 | — | — |
| ESCT | 16 | 15 | 0 | — | — |
| ETAG | 7 | 6 | 0 | — | — |
| EVAS | 3 | 2 | 0 | — | — |
| FITE | 18 | 17 | 0 | — | — |
| FOGW | 18 | 17 | 0 | — | — |
| FT09 | 4 | 3 | 0 | — | — |
| FUIT | 48 | 47 | 0 | — | — |
| G50T | 27 | 26 | 0 | — | — |
| GABA | 47 | 15 | 7 | 8 | 28 ms |
| GARE | 7 | 6 | 0 | — | — |
| GIGO | 6 | 5 | 0 | — | — |
| GLOB | 4 | 3 | 0 | — | — |
| GMAP | 5 | 4 | 0 | — | — |
| GORI | 2 | 1 | 0 | — | — |
| GRAV | 11 | 10 | 0 | — | — |
| GRIL | 5 | 4 | 0 | — | — |
| HANO | 6 | 2 | 3 | 2 | 27 ms |
| HOLE | 5 | 4 | 0 | — | — |
| HPDL | 3 | 2 | 0 | — | — |
| ISOS | 3 | 2 | 0 | — | — |
| KA59 | 15 | 14 | 0 | — | — |
| KATA | 8 | 7 | 0 | — | — |
| KEYD | 34 | 33 | 0 | — | — |
| KLOT | 14 | 13 | 0 | — | — |
| LF52 | 31 | 30 | 0 | — | — |
| LIFE | 14 | 13 | 0 | — | — |
| LKEY | 8 | 7 | 0 | — | — |
| LOGI | 2 | 1 | 0 | — | — |
| LP85 | 5 | 4 | 0 | — | — |
| LS19 | 5 | 4 | 0 | — | — |
| LS20 | 15 | 5 | 2 | 6 | 30 ms |
| M0R0 | 19 | 18 | 0 | — | — |
| MEMO | 10 | 9 | 0 | — | — |
| MIND | 8 | 7 | 0 | — | — |
| MOTO | 6 | 5 | 0 | — | — |
| ONDE | 7 | 6 | 0 | — | — |
| PIPE | 4 | 3 | 0 | — | — |
| POLA | 7 | 6 | 0 | — | — |
| PORT | 16 | 15 | 0 | — | — |
| PRTL | 6 | 5 | 0 | — | — |
| R11L | 3 | 2 | 0 | — | — |
| RE86 | 26 | 25 | 0 | — | — |
| RECR | 3 | 2 | 0 | — | — |
| REGN | 2 | 1 | 0 | — | — |
| REWI | 3 | 2 | 0 | — | — |
| RSWP | 3 | 2 | 0 | — | — |
| S5I5 | 13 | 12 | 0 | — | — |
| SB26 | 9 | 8 | 0 | — | — |
| SC25 | 17 | 16 | 0 | — | — |
| SELE | 30 | 29 | 0 | — | — |
| SEQN | 4 | 3 | 0 | — | — |
| SERI | 4 | 3 | 0 | — | — |
| SIGN | 15 | 14 | 0 | — | — |
| SK48 | 19 | 18 | 0 | — | — |
| SKBN | 22 | 21 | 0 | — | — |
| SMLP | 3 | 2 | 0 | — | — |
| SNAR | 16 | 15 | 0 | — | — |
| SP80 | 8 | 7 | 0 | — | — |
| SPOR | 18 | 17 | 0 | — | — |
| STCK | 3 | 2 | 0 | — | — |
| SU15 | 7 | 6 | 0 | — | — |
| SWCH | 25 | 24 | 0 | — | — |
| SYME | 9 | 8 | 0 | — | — |
| TEQU | 8 | 7 | 0 | — | — |
| THER | 25 | 24 | 0 | — | — |
| TICT | 3 | 2 | 0 | — | — |
| TN36 | 8 | 7 | 0 | — | — |
| TR87 | 26 | 25 | 0 | — | — |
| TRCP | 24 | 23 | 0 | — | — |
| TRIA | 8 | 7 | 0 | — | — |
| TU93 | 30 | 29 | 0 | — | — |
| UPST | 30 | 29 | 0 | — | — |
| VALV | 10 | 9 | 0 | — | — |
| VC33 | 5 | 4 | 0 | — | — |
| VOIS | 14 | 13 | 0 | — | — |
| WA30 | 26 | 25 | 0 | — | — |
| WEAV | 27 | 26 | 0 | — | — |
| ZIPP | 8 | 7 | 0 | — | — |
