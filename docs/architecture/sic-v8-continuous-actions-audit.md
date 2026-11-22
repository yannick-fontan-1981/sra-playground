# Actions continues de SIC sur les 100 premiers niveaux

## Contrat de continuité en développement

Le moteur sait engager jusqu’à 16 commandes, contrôler le retour immédiat de chacune et acquérir les transitions au moment où il clôt la série. Une décision reste identifiée par la même révision pendant cette exécution. Une nouvelle stratégie peut pourtant contourner cette capacité en ne proposant que le premier geste d’un trajet. C’est ce qui est arrivé à la famille d’expérimentation introduite en `2c823c51`, puis réutilisée par les plans de résolution. À la révision 203, SS01 gagnait ses huit niveaux en 445 commandes mais n’exécutait aucune deuxième commande sous la même décision.

La révision 205 transmet les approches libres déjà calculées par l’exploration et par les plans de préparation. Les préconditions et les cellules d’arrivée sont liées avant l’exécution. SIC interrompt la série si le sujet n’arrive pas, si une autre région change, si le prochain terrain ne correspond plus, ou à une frontière officielle. Une manipulation, un changement de contrôle ou une expérience à résultat inconnu rend la main au raisonnement. Les transitions réellement exécutées alimentent les mémoires dans leur ordre à la clôture.

| Niveau SS01 | Coups | Séries exécutées | Coups sans nouvelle décision | Plus longue série |
|---|---:|---:|---:|---:|
| L1 | 36 | 4 | 17 | 8 |
| L2 | 32 | 2 | 5 | 4 |
| L3 | 42 | 4 | 8 | 4 |
| L4 | 79 | 10 | 17 | 6 |
| L5 | 62 | 3 | 4 | 3 |
| L6 | 116 | 10 | 21 | 6 |
| L7 | 37 | 5 | 9 | 4 |
| L8 | 41 | 6 | 13 | 6 |

Sur le site local, les commandes, coordonnées et empreintes des observations avant chaque action correspondent aux 445 tickets du témoin. Le jeu rapporte WIN et huit crédits. Le délai médian entre deux autorisations d’une même série était de 17 ms sur cette exécution. Le temps global dépend aussi des recherches, des animations et de la charge de la machine.

Le contrôle local `npm run test:sic-continuity` examine les tickets confirmés par le moteur après la commande. Il vérifie les victoires, la proportion de gestes enchaînés **à chaque niveau**, la limite de 16, la continuité des indices et une seule clôture couvrant exactement les gestes exécutés. Trois témoins sources exercent le déplacement (AR25), le clic (HANO) et un trajet mixte (DC22). Les tests négatifs font échouer une victoire dégradée en décisions unitaires, une réconciliation anticipée, une clôture incomplète et un dépassement de la borne. Le workflow `SIC continuity` exécute le contrat sur les pull requests, la file de fusion et les mises à jour de `main`.

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

## Progression sur les 25 jeux restants

Les 42 jeux de la liste sont rejoués au niveau 1 dans les deux modes. Le parcours s’arrête dès la première victoire. Une série compte au moins deux commandes réellement exécutées dans le même plan, avec contrôle des retours à chaque commande.

| Mode | Victoires avant → après | Victoires avec une série avant → après | Reprises de décision avant → après | Parcours identiques |
| --- | ---: | ---: | ---: | ---: |
| SIC | 42 → 42 | 17 → 29 | 471 → 429 | 42/42 |
| SIC Fallback | 30 → 37 | 17 → 29 | 1116 → 858 | 35/42 |

12 des 25 jeux restants gagnent avec au moins une série dans les deux modes. Le total atteint 29/42. Les 17 déjà couverts conservent leur résultat.

| Jeu nouvellement couvert | SIC | SIC Fallback |
| --- | --- | --- |
| CASC | move-path ×2 · 6 commandes | move-path ×2 · 6 commandes |
| CD82 | move-path ×2 · 9 commandes | move-path ×2 · 9 commandes |
| CGWL | move-path ×4 · 15 commandes | move-path ×4 · 15 commandes |
| DAME | click-path ×3 · 7 commandes | click-path ×3 · 29 commandes |
| ETAG | move-path ×3 · 7 commandes | move-path ×3 · 7 commandes |
| EVAS | click-path ×2 · 3 commandes | click-path ×2 · 3 commandes |
| FT09 | click-path ×2 · 4 commandes | click-path ×2 · 25 commandes |
| KEYD | move-path ×2, move-path ×10 · 34 commandes | move-path ×2, move-path ×10 · 35 commandes |
| S5I5 | click-path ×6, click-path ×5 · 13 commandes | click-path ×7, click-path ×5 · 25 commandes |
| SIGN | move-path ×2, move-path ×4 · 15 commandes | move-path ×2, move-path ×4 · 16 commandes |
| TN36 | click-path ×6 · 8 commandes | click-path ×7 · 53 commandes |
| VC33 | click-path ×4 · 5 commandes | click-path ×4 · 12 commandes |

Sur KEYD en Fallback, les séries comptent 2 et 10 déplacements. Le délai médian entre commandes d’une même série est de 32 ms, sur dix intervalles mesurés lors de cette campagne.

Les nouveaux replis s’amorcent à partir de retours observés pendant la partie, comme un déplacement mesuré, une sélection qui ouvre une capture ou un clic qui modifie une relation entre éléments. Pour chaque commande enchaînée, le moteur vérifie la cible et l’effet prévu. Une contradiction rend la main à SIC.

La trace compare les commandes, leurs coordonnées, les observations, les étapes d’animation et l’issue. Les parcours modifiés en Fallback concernent DAME, FT09, KEYD, S5I5, SIGN, TN36, VC33. Le retrait de la famille principale est établi sur 40 jeux. ELAS et POLA commencent par l’exploration publique. Les 1635 commandes des deux campagnes relèvent de SIC seul.

- **Nouvelles victoires en Fallback** — DAME, FT09, KEYD, S5I5, SIGN, TN36, VC33.
- **En attente d’une victoire avec série dans les deux modes** — CWSE, DNOI, ELAS, FITE, FUIT, KATA, LF52, LS19, POLA, SYME, TU93, WA30, WEAV.
- **Niveaux 1 encore perdus en Fallback** — FUIT, KATA, TU93, WA30, WEAV.

Les tests ciblés de l’agenda, des commandes et du runtime passent (49 tests).

## Couverture des 42 jeux au niveau 1

Les 13 jeux restants gagnent avec au moins une série dans les deux modes. Les 42 jeux de la liste atteignent ce critère. Les deux campagnes s’arrêtent à la première victoire et les séries comptent uniquement les commandes réellement exécutées sous un même plan.

| Mode | Victoires avant → après | Victoires avec une série avant → après | Commandes avant → après | Reprises de décision avant → après | Parcours identiques |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SIC | 42 → 42 | 29 → 42 | 603 → 555 | 429 → 300 | 38/42 |
| SIC Fallback | 37 → 42 | 29 → 42 | 1 032 → 743 | 858 → 484 | 33/42 |

| Jeu | SIC | SIC Fallback | Famille retirée en Fallback |
| --- | --- | --- | --- |
| CWSE | click-path ×2 · 4 commandes | click-path ×2 · 6 commandes | `sic_directional_reception` |
| DNOI | click-path ×2 · 3 commandes | click-path ×2 · 3 commandes | `sic_field_repair` |
| ELAS | mix-path ×2 · 2 commandes | mix-path ×2 · 7 commandes | `sic_compose_measured_supports` |
| FITE | move-path ×2 · 12 commandes | move-path ×2 · 12 commandes | `sic_preserve_room_to_survive` |
| FUIT | move-path ×5, move-path ×4, move-path ×2, move-path ×3, move-path ×6, move-path ×8, move-path ×2, move-path ×7 · 48 commandes | move-path ×5, move-path ×4, move-path ×2, move-path ×3, move-path ×6, move-path ×8, move-path ×2, move-path ×7 · 49 commandes | `sic_verify_reactive_motion` |
| KATA | move-path ×3 · 8 commandes | move-path ×3 · 14 commandes | `sic_verify_preview_placement` |
| LF52 | click-path ×8 · 8 commandes | click-path ×8 · 16 commandes | `sic_compose_visible_reductions` |
| LS19 | move-path ×2 · 5 commandes | move-path ×2 · 5 commandes | `sic_framed_contact` |
| POLA | mix-path ×2 · 2 commandes | move-path ×2 · 6 commandes | `sic_align_opposing_faces` |
| SYME | click-path ×8 · 9 commandes | click-path ×8 · 9 commandes | `sic_field_repair` |
| TU93 | move-path ×16 · 30 commandes | move-path ×16 · 30 commandes | `sic_verify_connected_route` |
| WA30 | move-path ×2, move-path ×4, move-path ×2 · 26 commandes | move-path ×2, move-path ×4, move-path ×2 · 26 commandes | `sic_verify_oriented_delivery` |
| WEAV | move-path ×2, move-path ×3, move-path ×3, move-path ×2, move-path ×3, move-path ×3 · 27 commandes | move-path ×2, move-path ×3, move-path ×3, move-path ×2, move-path ×3, move-path ×3 · 26 commandes | `sic_verify_crossing_rows` |

Les cinq victoires récupérées en Fallback sont FUIT, KATA, TU93, WA30, WEAV. Le journal confirme le retrait de la famille principale avant sa première commande pour chacun des 42 jeux. Les commandes des deux campagnes relèvent de SIC seul.

Sur TU93 en Fallback, la série de 16 déplacements a un intervalle médian de 43 ms entre commandes, mesuré sur 15 intervalles pendant la campagne à quatre processus.

Une série se poursuit tant que les observations confirment son prochain pas. Cela inclut les deux positions lors d’un rapprochement, la pièce sélectionnée et sa réception pour une réduction, le curseur actif sur une ligne de peinture et les couleurs source et cible pour une réparation. Une contradiction rend la main à la décision.

La comparaison porte sur les commandes, les coordonnées, les observations, les images d’animation et l’issue. Les 29 jeux déjà couverts conservent leur résultat. Le typecheck et les 49 tests ciblés passent.

### Rejeu sur `0a51fd1a`

Les 13 jeux du tableau gagnent de nouveau au niveau 1 et exécutent une série dans les deux modes. Le rejeu part de l’image initiale et s’arrête à la première victoire. Le mode SIC Fallback désactive la famille principale. Quand l’événement de retrait sort du journal de fin de partie, un rejeu ciblé le capture pendant les commandes et vérifie que la famille retirée ne fournit aucune commande.

Les 84 passages des 42 jeux reproduisent les commandes, les coordonnées, les observations, les images d’animation, les séries et les nombres de reprises de décision de la campagne finale de `98558200`. Les 555 commandes en SIC et les 743 en SIC Fallback relèvent toutes de SIC seul. Les 42 retraits en Fallback sont confirmés et correspondent à la famille attendue pour chaque jeu.

Le typecheck et les 28 tests ciblés du contrôleur, du runtime et de l’agenda passent.

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
