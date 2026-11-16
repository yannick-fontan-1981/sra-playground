# Actions continues de SIC sur les 100 premiers niveaux

## Couverture après extension des trajets

Les **100 niveaux 1** sont gagnés en SIC seul. Les **1 248 commandes** et les retours comparés sont identiques au parcours de référence. L’empreinte couvre les commandes, les images finales et intermédiaires, le niveau, le score et l’état du jeu. Les reprises de décision passent de **1 105 à 1 026**.

**12 jeux sur 100** exécutent au moins deux commandes sous un même plan, contre 3 au départ. Les 32 séries se répartissent en 27 `move-path`, 4 `click-path` et 1 `mix-path`. Une série interrompue avant sa deuxième commande est exclue. Dans une série mixte, le journal doit montrer au moins un déplacement directionnel et un clic effectifs dans le même plan.

| Jeu | Type de série | Longueurs des séries | Reprises avant → après | Délai médian dans une série |
| --- | --- | --- | ---: | ---: |
| AR25 | Déplacements | 4, 10 | 16 → 4 | 54 ms |
| CN04 | Déplacements | 11 | 17 → 7 | 24 ms |
| COLM | Déplacements | 3, 2 | 16 → 13 | 29 ms |
| DC22 | Déplacements et mixte | 2, 2, 2, 2, 2, 2, 2 | 21 → 14 | 27 ms |
| GABA | Déplacements | 6, 4, 8, 6, 8, 4, 2 | 15 → 15 | 19 ms |
| HANO | Clics | 2, 2, 2 | 2 → 2 | 23 ms |
| LS20 | Déplacements | 6, 5 | 5 → 5 | 29 ms |
| M0R0 | Déplacements | 15 | 18 → 4 | 22 ms |
| RE86 | Déplacements | 11, 4 | 25 → 12 | 33 ms |
| SC25 | Déplacements | 2, 2, 2 | 16 → 13 | 29 ms |
| TR87 | Déplacements | 13 | 25 → 13 | 26 ms |
| ZIPP | Clics | 6 | 7 → 2 | 26 ms |

La campagne après extension utilise quatre processus. Les délais incluent le retour du jeu et ses contrôles. La comparaison entre campagnes porte sur les parcours et le nombre de reprises de décision.

### Les 88 jeux sans série au niveau 1

Le regroupement décrit les commandes jouées pendant la résolution.

- **Déplacements et clics (20)** — BP35, CLRS, COMB, CWSE, GIGO, GRAV, GRIL, KA59, KATA, KLOT, LF52, ONDE, PRTL, REWI, SELE, TEQU, THER, TRIA, VOIS, WEAV.
- **Déplacements sans clic (27)** — AS66, CASC, CD82, CGWL, ELAS, ESCT, ETAG, FITE, FOGW, FUIT, G50T, GMAP, KEYD, LKEY, LS19, POLA, PORT, REGN, SEQN, SIGN, SK48, SKBN, SNAR, SP80, SWCH, TU93, WA30.
- **Clics uniquement (31)** — AMZE, CATL, CATR, CAVA, CONN, CRAF, DAME, DICO, DNOI, EVAS, FT09, GARE, GORI, HOLE, ISOS, LIFE, LOGI, LP85, MEMO, PIPE, R11L, S5I5, SERI, SU15, SYME, TICT, TN36, TRCP, UPST, VALV, VC33.
- **Autres commandes sans déplacement directionnel (10)** — GLOB, HPDL, MIND, MOTO, RECR, RSWP, SB26, SMLP, SPOR, STCK.

### SIC Fallback

Les essais ciblés retirent la famille principale et restent sous l’autorité de SIC seul. Les trois formats sont observés au niveau 1. HANO enchaîne deux clics sous `sic_learn_support_moves` après deux dépôts confirmés. Ses six commandes et leurs retours publics sont identiques à ceux du repli avant cette extension. DC22 enchaîne des déplacements et une série mixte après retrait de `sic_remote_support_route`. AR25, GABA, LS20, SC25 et TR87 enchaînent des déplacements. PORT gagne sans série. ZIPP s’arrête au niveau 1 après 84 commandes, faute de famille de repli applicable.

## Lot ciblé de 42 jeux

La campagne s’arrête à la première victoire du niveau 1 et exclut SELE et PRTL. Les deux modes ont une référence séparée. Le mode SIC Fallback retire la famille principale et conserve SIC comme seule autorité de décision.

| Mode | Niveaux gagnés avant → après | Jeux avec série avant → après |
| --- | ---: | ---: |
| SIC | 42 → 42 | 0 → 11 |
| SIC Fallback | 23 → 26 | 0 → 10 |

En SIC, le parcours de référence est reproduit sur les 42 jeux comparés. Les 603 commandes et les retours comparés concordent. Les reprises de décision passent de 561 à 500. En SIC Fallback, les parcours modifiés concernent BP35, LP85, SWCH. Une série est observée dans les deux modes pour 10 jeux.

Les trajets s’arrêtent à un nouvel effet à mesurer, à un retour contradictoire ou à la fin du niveau. Le budget du plan est de 16 commandes. À BP35, le clic de retrait est lié à un obstacle visible en fin de trajet après une première observation de l’effet. À LP85, la permutation apprise doit rester compatible avec la disposition et les valeurs visibles. À SWCH, le mouvement et le compteur visible sont vérifiés à chaque pas.

| Jeu | SIC, longueur des séries | SIC Fallback, longueur des séries |
| --- | --- | --- |
| AMZE | **clic** · 2 | **clic** · 2 |
| BP35 | **déplacement, mixte** · 3, 3, 2, 3, 2 | **déplacement, mixte** · 5, 3, 2, 3, 2 |
| CASC | Gagné, aucune série | Gagné, aucune série |
| CAVA | **clic** · 6 | **clic** · 6 |
| CD82 | Gagné, aucune série | Gagné, aucune série |
| CGWL | Gagné, aucune série | Gagné, aucune série |
| CWSE | Gagné, aucune série | Gagné, aucune série |
| DAME | Gagné, aucune série | Échec |
| DNOI | Gagné, aucune série | Gagné, aucune série |
| ELAS | Gagné, aucune série | Gagné, aucune série |
| ESCT | **déplacement** · 2 | **déplacement** · 2 |
| ETAG | Gagné, aucune série | Gagné, aucune série |
| EVAS | Gagné, aucune série | Gagné, aucune série |
| FITE | Gagné, aucune série | Gagné, aucune série |
| FOGW | **déplacement** · 4, 4 | **déplacement** · 4, 4 |
| FT09 | Gagné, aucune série | Échec |
| FUIT | Gagné, aucune série | Échec |
| G50T | Gagné, aucune série | Échec |
| KA59 | Gagné, aucune série | Gagné, aucune série |
| KATA | Gagné, aucune série | Échec |
| KEYD | Gagné, aucune série | Échec |
| KLOT | Gagné, aucune série | Gagné, aucune série |
| LF52 | Gagné, aucune série | Gagné, aucune série |
| LP85 | **clic** · 4 | **clic** · 4 |
| LS19 | Gagné, aucune série | Gagné, aucune série |
| PIPE | **clic** · 2 | **clic** · 2 |
| POLA | Gagné, aucune série | Gagné, aucune série |
| PORT | **déplacement** · 3, 2, 8 | **déplacement** · 3, 2, 8 |
| S5I5 | Gagné, aucune série | Échec |
| SIGN | Gagné, aucune série | Échec |
| SK48 | Gagné, aucune série | Échec |
| SKBN | **déplacement** · 3, 16 | **déplacement** · 3, 16 |
| SNAR | Gagné, aucune série | Gagné, aucune série |
| SP80 | **déplacement** · 3 | Échec |
| SWCH | **déplacement** · 5, 4 | **déplacement** · 6, 4 |
| SYME | Gagné, aucune série | Gagné, aucune série |
| TN36 | Gagné, aucune série | Échec |
| TU93 | Gagné, aucune série | Échec |
| VC33 | Gagné, aucune série | Échec |
| VOIS | Gagné, aucune série | Échec |
| WA30 | Gagné, aucune série | Échec |
| WEAV | Gagné, aucune série | Échec |

## Repli et chemins confirmés sur le lot de 42 jeux

Le lot de 42 jeux est rejoué dans les deux modes au niveau 1. Les essais excluent SELE et PRTL. Le contrôleur navigateur et le service exécutent chaque commande et le jeu renvoie ses images. Une série doit comporter au moins deux commandes du même plan effectivement exécutées.

| Mode | Victoires avant → après | Jeux avec série avant → après | Reprises de décision avant → après |
| --- | ---: | ---: | ---: |
| SIC | 42 → 42 | 11 → 17 | 500 → 471 |
| SIC Fallback | 26 → 30 | 10 → 17 | 1320 → 1116 |

Les parcours SIC concordent sur 42 jeux. En Fallback, les parcours modifiés concernent G50T, SK48, SP80 et VOIS. Toute commande relève de SIC seul. Le journal confirme le retrait de la famille principale et son absence parmi les familles exécutantes pour 40 jeux. ELAS et POLA utilisent uniquement l’exploration publique dès le départ.

| Jeu désormais continu dans les deux modes | SIC | SIC Fallback | Famille de repli utilisée pour le trajet |
| --- | --- | --- | --- |
| G50T | 2, 2, 2 · 27 commandes | 2, 2, 2 · 27 commandes | `sic_learn_remote_replay` |
| KA59 | 2 · 15 commandes | 2 · 15 commandes | `sic_learn_contact_access` |
| KLOT | 2 · 14 commandes | 2, 2 · 30 commandes | `sic_learn_selected_access` |
| SK48 | 8, 7 · 19 commandes | 8, 7 · 19 commandes | `sic_learn_contact_order` |
| SNAR | 5, 3 · 16 commandes | 2, 4 · 17 commandes | `sic_learn_grid_access` |
| SP80 | 3 · 8 commandes | 3 · 8 commandes | `sic_learn_branch_alignment` |
| VOIS | 3, 4 · 14 commandes | 3, 4 · 45 commandes | `sic_learn_reference_placement` |

En repli, le déplacement ou la sélection mesurés pendant une exploration peuvent amorcer un autre planificateur. SK48 retient les projections du support et des pièces, VOIS suit la sélection et l’occupation des emplacements, SP80 mesure le mouvement d’un contributeur, et G50T relie un déplacement au début de l’enregistrement. Les sondes de mécanismes, les changements de terrain et les retours contradictoires interrompent la série.

- **Sans série dans les deux modes** — CASC, CD82, CGWL, CWSE, DAME, DNOI, ELAS, ETAG, EVAS, FITE, FT09, FUIT, KATA, KEYD, LF52, LS19, POLA, S5I5, SIGN, SYME, TN36, TU93, VC33, WA30, WEAV.
- **Niveaux encore non gagnés en Fallback** — DAME, FT09, FUIT, KATA, KEYD, S5I5, SIGN, TN36, TU93, VC33, WA30, WEAV.

## Référence avant extension

La campagne locale utilise SIC seul sur le commit `e483a9d5`, à trois processus. Chaque passage part de l’image initiale et s’arrête à la première victoire du niveau 1. Une série contient plusieurs commandes exécutées sous le même plan engagé. Le délai est mesuré entre les lancements de deux commandes de cette série et inclut le retour du jeu et ses contrôles. Les délais mesurés dépendent aussi de la concurrence des processus.

Les **100 niveaux 1** sont gagnés en **1 248 commandes SIC seul**. **3 jeux sur 100** exécutent une série continue. Les 12 séries produisent les mesures suivantes.

| Jeu | Séries | Plus longue | Délai médian dans une série |
| --- | ---: | ---: | ---: |
| GABA | 7 | 8 | 28 ms |
| HANO | 3 | 2 | 27 ms |
| LS20 | 2 | 6 | 30 ms |

Parmi les 97 jeux sans série observée, 55 utilisent au moins une commande directionnelle, 32 utilisent exclusivement des clics et 10 utilisent d’autres commandes sans déplacement directionnel. Dans les parcours sans série, SC25 répète une même direction 12 fois de suite, AR25 10 fois, CN04, RE86 et TR87 7 fois. Ces répétitions indiquent où inspecter les conditions du plan.

### DC22 avant extension

SIC gagne en **22 commandes**, avec **21 reprises de décision** et **aucune série**. La famille `sic_remote_support_route` choisit les 22 commandes. Entre des clics de contrôle, le parcours comporte 5 déplacements identiques consécutifs.

La recherche du trajet conserve le champ `first` dans chaque état de la file. Elle renvoie ce premier déplacement à l’arrivée. La proposition contient donc une seule action et laisse `expected_after` à `null`. Son contrôle avant action n’admet que l’indice zéro et son contrôle du retour clôt le préfixe. La répétition des recherches provient de ce contrat de famille.

Pour faire bénéficier toutes les familles d’une exécution continue, chaque planificateur doit transmettre la portion de trajet dont il connaît les effets, avec la cible et les conditions de validité par pas. L’exécuteur garde la vérification de la case d’arrivée et des supports nécessaires. Une commande exploratoire, un changement de terrain, une contradiction ou une fin de niveau clôt le préfixe. Le même principe s’applique aux clics quand leur cible et leur effet restent vérifiables dans la suite.

### Résultat de référence par jeu

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
