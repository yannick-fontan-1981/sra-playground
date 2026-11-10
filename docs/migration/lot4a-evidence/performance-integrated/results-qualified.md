# Lot 4A : coût 0.50 → 0.51, qualification du propriétaire ajouté

**Résultat : conforme à la règle globale, avec qualification structurelle.** Cette décision est distincte de l’échec du consolidateur strict, qui demeure conservé. La règle numérique a été déclarée avant la mesure ; la qualification de comparabilité structurelle a été ajoutée après la fenêtre.

| Jeu | Sessions par version | Médiane A, ms | Médiane B, ms | Variation globale | Budget strict < +10 % |
| --- | --- | --- | --- | --- | --- |
| STCK | 8 | 10800,922617 | 9818,725429 | −9,093642 % | Conforme |
| SMLP | 8 | 16603,995727 | 17368,032281 | +4,601522 % | Conforme |

A désigne **Site 79 / native 0.50.0**, commit `6d03c2adda9f60b1c97304f5491a428cfbec7a6c`, digest `e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87`. B désigne le gel intégré **0.51.0**, `c1e3dbdba85929dee4a287bc2f5cb6a011457ba43e9a67078f2764f659b603b7`. Les anciennes durées ne fournissent aucun échantillon.

## Fenêtre et population conservées

La fenêtre officielle s’étend du **2026-11-10 19:29:44 UTC** au **2026-11-10 19:38:19 UTC**, dans l’ordre **A1/B1/B2/A2**. Elle conserve **32 sessions et 400 actions mesurées**, avec huit sessions par jeu et version. Seules les huit chauffes préannoncées de trois actions, soit 24 actions, sont exclues. Aucun outlier, session ou cohorte n’est retiré. Le verrou exclusif, les acquittements explicites des autres fils et l’arrêt du preview sont liés aux reçus de préparation et d’exécution.

## Échec strict et qualification distincte

Le [consolidateur strict inchangé a échoué](aggregation-failure-reproduced.json) sur l’égalité des métadonnées de graphe. Il n’existe aucun agrégat officiel `combined-comparison.json` de remplacement. Les deux comparaisons de cohorte conservent leurs statuts originaux.

Les seules différences de la signature de travail hors durées sont **432 occurrences** : 344 comptes de nœuds d’observation, 48 comptes d’inspection, 20 comptes finaux et 20 révisions finales. Le nombre de nœuds est toujours augmenté de **trois**. La révision finale augmente de **3 + nombre de préfixes acquis**, soit +9 pour STCK, +12 pour SMLP et +6 pour chaque chauffe. Tous les autres champs de la signature complète de travail sont exactement égaux ; à version fixe, toutes les signatures sont stables entre cohortes.

Les [captures de graphes et leur qualification](owner-addition-qualification.json) attribuent ces ajouts à `family_state:feedback_sequences`, `family_activation:feedback_sequences` et `program:v6.feedback_sequences.choose`, avec les écritures de provenance conservées par préfixe. Chaque graphe garde sa chaîne propre. Les captures exécutées après la fenêtre corroborent l’attribution sur les mêmes gels ; elles ne prouvent pas rétroactivement les feuilles privées que les mesures ne capturaient pas. Aucune identité binaire ou égalité intégrale des graphes A/B n’est revendiquée.

La qualification est explicitement [déclarée après mesure](owner-addition-declaration.json), avant les captures et le calcul groupé qualifié. Elle ne change ni source native, outil officiel, temps, seuil, population ou ordre de phase. **Tout le coût des trois nœuds demeure dans les durées brutes** ; aucune dépense du nouveau propriétaire n’est soustraite. Le [calcul qualifié](../aggregate-owner-qualified-cost.mjs) utilise les [fonctions arithmétiques JavaScript inchangées](../../../../scripts/compare-native-cost-cohorts.mjs) pour reproduire les deux comparaisons originales, puis une [revue Python indépendante](owner-qualified-cost-review.json) recalcule les distributions et la règle stricte.

La revue qualifiée vérifie **274 contrôles**. Le diagnostic groupé de phases est **15/16**, de statut `budget_review_required`. Ce compteur ne remplace pas la décision globale par jeu.

## Toutes les médianes groupées

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 10800,923 | 9818,725 | −9,093642 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 331,296 | 313,937 | −5,239826 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 11,402 | 10,078 | −11,607149 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 13,685 | 12,129 | −11,375022 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,284310 | 0,232264 | −18,306250 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 892,535 | 801,964 | −10,147556 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 177,859 | 156,357 | −12,089599 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 8,503 | 7,970 | −6,271085 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 16603,996 | 17368,032 | +4,601522 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 393,362 | 420,552 | +6,912243 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 10,912 | 10,228 | −6,274727 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 13,419 | 12,773 | −4,816460 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,388574 | 0,356787 | −8,180306 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 865,503 | 966,305 | +11,646641 % | `over_budget_with_noise_unresolved` |
| SMLP | `persistence` | 152 / 152 | 132,234 | 140,745 | +6,436689 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 5,270 | 5,735 | +8,810354 % | `within_observed_budget` |

Tous les diagnostics défavorables de cet ensemble restent conservés : **SMLP `acquisition_and_persistence` +11,646641 %** (`over_budget_with_noise_unresolved`).

## Dispersions et queues groupées

Le p95 empirique utilise le rang `ceil(0,95 × n)` seulement lorsque n ≥ 20. Huit sessions par jeu/version ne fournissent aucun p95 de session. Les phases sont imbriquées et leurs médianes ne s’additionnent pas. Les échantillons d’une même session sont corrélés.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9329,487 à 11575,206 | 9293,925 à 10566,646 | indisponible / indisponible | indisponible | 20,791920 % / 12,962183 % |
| STCK | `new_decision` | 191,460 à 566,527 | 179,421 à 534,179 | 479,397 / 490,349 | +2,284513 % | 19,113112 % / 46,283250 % |
| STCK | `known_prefix_service` | 7,937 à 30,924 | 7,989 à 35,259 | 29,652 / 20,461 | −30,996406 % | 45,565346 % / 29,434228 % |
| STCK | `known_prefix_request` | 9,696 à 33,011 | 9,472 à 37,554 | 32,883 / 23,088 | −29,787185 % | 40,638521 % / 29,702051 % |
| STCK | `known_prefix_guard` | 0,090914 à 2,985 | 0,084385 à 1,374 | 1,104 / 1,043 | −5,541160 % | 59,690817 % / 129,451078 % |
| STCK | `acquisition_and_persistence` | 384,653 à 4188,140 | 388,814 à 3715,256 | 3919,482 / 3511,102 | −10,419228 % | 41,954718 % / 12,696302 % |
| STCK | `persistence` | 15,167 à 392,449 | 15,221 à 383,481 | 319,491 / 321,962 | +0,773358 % | 26,685312 % / 26,613645 % |
| STCK | `restoration` | 1,696 à 78,411 | 1,904 à 69,756 | 58,967 / 50,496 | −14,366463 % | 16,582285 % / 31,592433 % |
| SMLP | `session_elapsed` | 15568,005 à 17414,452 | 15255,240 à 19226,794 | indisponible / indisponible | indisponible | 11,120503 % / 22,867037 % |
| SMLP | `new_decision` | 202,488 à 983,698 | 208,053 à 988,661 | 857,076 / 886,140 | +3,390995 % | 29,612733 % / 30,705115 % |
| SMLP | `known_prefix_service` | 7,689 à 18,896 | 8,239 à 24,213 | 18,126 / 20,979 | +15,739873 % | 30,186184 % / 39,952391 % |
| SMLP | `known_prefix_request` | 9,820 à 21,594 | 10,223 à 26,967 | 20,452 / 23,766 | +16,204141 % | 28,759136 % / 40,859990 % |
| SMLP | `known_prefix_guard` | 0,189811 à 7,576 | 0,190321 à 7,656 | 0,625093 / 0,661027 | +5,748585 % | 72,393571 % / 52,292876 % |
| SMLP | `acquisition_and_persistence` | 303,443 à 2828,769 | 281,171 à 3119,938 | 2533,136 / 2776,570 | +9,609989 % | 24,904033 % / 31,009751 % |
| SMLP | `persistence` | 14,537 à 341,956 | 16,526 à 353,528 | 260,310 / 263,033 | +1,046060 % | 24,091956 % / 29,610770 % |
| SMLP | `restoration` | 1,759 à 55,720 | 2,165 à 41,822 | 23,718 / 24,996 | +5,385735 % | 38,025243 % / 58,951447 % |

Hausses de p95 supérieures à +10,000000 %, sans attribution causale par cette mesure : **SMLP `known_prefix_service` +15,739873 %**; **SMLP `known_prefix_request` +16,204141 %**.

## Cohorte 1, résultat original conservé

Statut `passed` ; **16/16** diagnostics dans le seuil historique.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11055,438 | 9818,725 | −11,186465 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 343,672 | 280,829 | −18,285824 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 12,249 | 10,434 | −14,816164 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 14,408 | 12,875 | −10,637325 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,307369 | 0,238988 | −22,247201 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 946,658 | 825,740 | −12,773071 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 175,944 | 167,808 | −4,624553 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 8,503 | 7,970 | −6,271085 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16817,204 | 17302,038 | +2,882964 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 425,586 | 423,019 | −0,603375 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 11,787 | 10,415 | −11,644879 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 14,304 | 12,652 | −11,543885 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,384383 | 0,356787 | −7,179177 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 895,887 | 916,961 | +2,352354 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 130,307 | 142,969 | +9,716638 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 5,232 | 5,149 | −1,580522 % | `within_observed_budget` |

Aucun diagnostic de médiane hors du seuil historique dans cet ensemble.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10687,222 à 11575,206 | 9635,940 à 10566,646 | indisponible / indisponible | indisponible | 8,032104 % / 9,478882 % |
| STCK | `new_decision` | 191,460 à 566,527 | 179,421 à 470,432 | 468,722 / 441,706 | −5,763893 % | 18,060098 % / 5,813513 % |
| STCK | `known_prefix_service` | 8,583 à 30,924 | 7,989 à 35,259 | indisponible / indisponible | indisponible | 20,158787 % / 24,826202 % |
| STCK | `known_prefix_request` | 10,985 à 33,011 | 9,472 à 37,554 | indisponible / indisponible | indisponible | 15,380904 % / 24,368171 % |
| STCK | `known_prefix_guard` | 0,104294 à 2,985 | 0,086678 à 1,374 | indisponible / indisponible | indisponible | 37,369746 % / 110,140881 % |
| STCK | `acquisition_and_persistence` | 423,287 à 4001,401 | 398,855 à 3715,256 | 3919,482 / 3634,160 | −7,279577 % | 25,453891 % / 12,791971 % |
| STCK | `persistence` | 15,793 à 392,449 | 15,221 à 383,481 | 318,639 / 332,996 | +4,505732 % | 17,585593 % / 21,398262 % |
| STCK | `restoration` | 1,696 à 78,411 | 1,904 à 63,456 | 45,604 / 50,496 | +10,727242 % | 16,582285 % / 32,347701 % |
| SMLP | `session_elapsed` | 16360,048 à 17235,053 | 15255,240 à 19226,794 | indisponible / indisponible | indisponible | 5,203035 % / 22,954257 % |
| SMLP | `new_decision` | 202,488 à 983,698 | 239,869 à 988,661 | 977,003 / 886,140 | −9,300201 % | 30,219788 % / 31,933909 % |
| SMLP | `known_prefix_service` | 7,689 à 18,896 | 8,425 à 20,979 | 18,386 / 14,522 | −21,017026 % | 21,910671 % / 22,382828 % |
| SMLP | `known_prefix_request` | 9,820 à 21,594 | 10,391 à 23,766 | 20,973 / 17,641 | −15,885828 % | 20,813552 % / 27,021334 % |
| SMLP | `known_prefix_guard` | 0,189811 à 0,615639 | 0,190321 à 0,670280 | 0,548981 / 0,583632 | +6,311876 % | 10,054495 % / 20,086408 % |
| SMLP | `acquisition_and_persistence` | 303,443 à 2749,393 | 281,171 à 3119,938 | 2736,321 / 2776,570 | +1,470913 % | 23,746136 % / 29,163688 % |
| SMLP | `persistence` | 15,568 à 341,956 | 20,304 à 316,142 | 300,928 / 268,984 | −10,614977 % | 12,201376 % / 31,605597 % |
| SMLP | `restoration` | 1,759 à 55,720 | 2,165 à 35,513 | 24,338 / 27,625 | +13,505827 % | 11,406069 % / 66,276362 % |

Hausses de p95 supérieures à +10,000000 %, sans attribution causale par cette mesure : **STCK `restoration` +10,727242 %**; **SMLP `restoration` +13,505827 %**.

## Cohorte 2, résultat original conservé

Statut `budget_review_required` ; **13/16** diagnostics dans le seuil historique.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10210,714 | 9854,421 | −3,489410 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 306,754 | 342,930 | +11,793130 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 16 / 16 | 9,219 | 9,516 | +3,225320 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 11,166 | 11,231 | +0,581423 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,246309 | 0,232264 | −5,702390 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 852,635 | 801,964 | −5,942812 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 178,450 | 147,913 | −17,112236 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 7,864 | 7,517 | −4,410289 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16473,289 | 17494,609 | +6,199854 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 392,305 | 408,410 | +4,105168 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 10,643 | 10,228 | −3,903210 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,962 | 12,773 | −1,459714 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,393470 | 0,362987 | −7,747468 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 854,956 | 992,054 | +16,035659 % | `over_budget_with_noise_unresolved` |
| SMLP | `persistence` | 76 / 76 | 139,355 | 138,149 | −0,865276 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 5,540 | 6,105 | +10,190083 % | `over_budget_with_noise_unresolved` |

Tous les diagnostics défavorables de cet ensemble restent conservés : **STCK `new_decision` +11,793130 %** (`over_budget_with_noise_unresolved`); **SMLP `acquisition_and_persistence` +16,035659 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +10,190083 %** (`over_budget_with_noise_unresolved`).

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9329,487 à 11122,879 | 9293,925 à 10301,546 | indisponible / indisponible | indisponible | 17,563826 % / 10,225067 % |
| STCK | `new_decision` | 199,944 à 483,764 | 198,611 à 534,179 | 479,397 / 518,783 | +8,215825 % | 8,679741 % / 42,051251 % |
| STCK | `known_prefix_service` | 7,937 à 23,369 | 8,076 à 17,457 | indisponible / indisponible | indisponible | 34,820448 % / 30,945787 % |
| STCK | `known_prefix_request` | 9,696 à 25,694 | 9,653 à 19,160 | indisponible / indisponible | indisponible | 36,018564 % / 31,935646 % |
| STCK | `known_prefix_guard` | 0,090914 à 0,381654 | 0,084385 à 1,043 | indisponible / indisponible | indisponible | 32,256697 % / 42,878081 % |
| STCK | `acquisition_and_persistence` | 384,653 à 4188,140 | 388,814 à 3396,119 | 3540,905 / 3366,657 | −4,920988 % | 18,889949 % / 10,524467 % |
| STCK | `persistence` | 15,167 à 384,433 | 16,827 à 359,698 | 340,875 / 321,962 | −5,548405 % | 21,553989 % / 24,388029 % |
| STCK | `restoration` | 1,882 à 70,788 | 1,924 à 69,756 | 60,805 / 44,688 | −26,505694 % | 12,080109 % / 14,660490 % |
| SMLP | `session_elapsed` | 15568,005 à 17414,452 | 16245,614 à 18012,681 | indisponible / indisponible | indisponible | 11,208738 % / 10,100640 % |
| SMLP | `new_decision` | 223,938 à 931,552 | 208,053 à 941,316 | 816,416 / 902,169 | +10,503533 % | 9,439044 % / 16,379154 % |
| SMLP | `known_prefix_service` | 8,340 à 17,081 | 8,239 à 24,213 | 15,485 / 23,580 | +52,276812 % | 25,266982 % / 34,695966 % |
| SMLP | `known_prefix_request` | 10,264 à 19,322 | 10,223 à 26,967 | 17,586 / 26,573 | +51,101891 % | 23,050294 % / 33,477125 % |
| SMLP | `known_prefix_guard` | 0,211843 à 7,576 | 0,192134 à 7,656 | 7,253 / 0,661027 | −90,886601 % | 75,871906 % / 52,662423 % |
| SMLP | `acquisition_and_persistence` | 318,188 à 2828,769 | 322,495 à 3079,946 | 2505,371 / 2886,127 | +15,197587 % | 6,527080 % / 30,057210 % |
| SMLP | `persistence` | 14,537 à 271,791 | 16,526 à 353,528 | 244,852 / 263,033 | +7,425107 % | 22,967577 % / 13,568506 % |
| SMLP | `restoration` | 2,120 à 39,592 | 2,201 à 41,822 | 21,405 / 24,996 | +16,775701 % | 37,364677 % / 13,844173 % |

Hausses de p95 supérieures à +10,000000 %, sans attribution causale par cette mesure : **SMLP `new_decision` +10,503533 %**; **SMLP `known_prefix_service` +52,276812 %**; **SMLP `known_prefix_request` +51,101891 %**; **SMLP `acquisition_and_persistence` +15,197587 %**; **SMLP `restoration` +16,775701 %**.

## Inspection, Pause et mémoire

Ces diagnostics restent séparés des seize médianes de phase. Pause est contrôlée pendant la planification initiale et la première action engagée ; cela ne valide pas chaque recherche longue ni l’interface navigateur.

| Cohorte | Jeu | Version | Inspection | n | Médiane, ms | Min à max, ms | p95, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | A | nativeService | 12 | 221,972 | 168,721 à 268,293 | indisponible |
| 1 | STCK | A | endToEnd | 12 | 378,261 | 342,194 à 446,732 | indisponible |
| 1 | STCK | B | nativeService | 12 | 174,469 | 163,783 à 200,276 | indisponible |
| 1 | STCK | B | endToEnd | 12 | 320,270 | 292,010 à 375,297 | indisponible |
| 1 | SMLP | A | nativeService | 12 | 212,616 | 183,561 à 281,057 | indisponible |
| 1 | SMLP | A | endToEnd | 12 | 371,781 | 324,228 à 454,767 | indisponible |
| 1 | SMLP | B | nativeService | 12 | 198,750 | 180,685 à 275,510 | indisponible |
| 1 | SMLP | B | endToEnd | 12 | 368,620 | 339,828 à 453,473 | indisponible |
| 2 | STCK | A | nativeService | 12 | 185,223 | 169,217 à 227,332 | indisponible |
| 2 | STCK | A | endToEnd | 12 | 333,790 | 288,318 à 377,277 | indisponible |
| 2 | STCK | B | nativeService | 12 | 183,812 | 155,557 à 212,425 | indisponible |
| 2 | STCK | B | endToEnd | 12 | 333,993 | 283,653 à 377,322 | indisponible |
| 2 | SMLP | A | nativeService | 12 | 202,859 | 166,598 à 282,542 | indisponible |
| 2 | SMLP | A | endToEnd | 12 | 353,830 | 300,817 à 422,192 | indisponible |
| 2 | SMLP | B | nativeService | 12 | 214,321 | 189,327 à 303,213 | indisponible |
| 2 | SMLP | B | endToEnd | 12 | 388,115 | 332,526 à 527,860 | indisponible |

| Cohorte | Jeu | Version | Contexte Pause | Mesure | n | Médiane, ms | Min à max, ms | p95, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | A | initial_planning | acknowledgement | 4 | 0,016304 | 0,009564 à 0,045968 | indisponible |
| 1 | STCK | A | initial_planning | safeBoundary | 4 | 1090,277 | 980,804 à 1178,982 | indisponible |
| 1 | STCK | A | engaged_action | acknowledgement | 4 | 0,015993 | 0,013079 à 0,017886 | indisponible |
| 1 | STCK | A | engaged_action | safeBoundary | 4 | 863,971 | 743,007 à 1090,288 | indisponible |
| 1 | STCK | B | initial_planning | acknowledgement | 4 | 0,010901 | 0,009745 à 0,063194 | indisponible |
| 1 | STCK | B | initial_planning | safeBoundary | 4 | 1009,546 | 892,774 à 1140,050 | indisponible |
| 1 | STCK | B | engaged_action | acknowledgement | 4 | 0,015723 | 0,010405 à 0,020090 | indisponible |
| 1 | STCK | B | engaged_action | safeBoundary | 4 | 759,470 | 694,708 à 873,866 | indisponible |
| 1 | SMLP | A | initial_planning | acknowledgement | 4 | 0,009259 | 0,005137 à 0,024145 | indisponible |
| 1 | SMLP | A | initial_planning | safeBoundary | 4 | 1612,862 | 1351,212 à 1771,377 | indisponible |
| 1 | SMLP | A | engaged_action | acknowledgement | 4 | 0,005679 | 0,003846 à 0,024587 | indisponible |
| 1 | SMLP | A | engaged_action | safeBoundary | 4 | 745,225 | 597,895 à 915,550 | indisponible |
| 1 | SMLP | B | initial_planning | acknowledgement | 4 | 0,005929 | 0,003094 à 0,021161 | indisponible |
| 1 | SMLP | B | initial_planning | safeBoundary | 4 | 1508,487 | 1428,929 à 1743,037 | indisponible |
| 1 | SMLP | B | engaged_action | acknowledgement | 4 | 0,006520 | 0,004998 à 0,021392 | indisponible |
| 1 | SMLP | B | engaged_action | safeBoundary | 4 | 753,915 | 624,480 à 934,311 | indisponible |
| 2 | STCK | A | initial_planning | acknowledgement | 4 | 0,024846 | 0,007921 à 0,072177 | indisponible |
| 2 | STCK | A | initial_planning | safeBoundary | 4 | 997,777 | 944,675 à 1187,346 | indisponible |
| 2 | STCK | A | engaged_action | acknowledgement | 4 | 0,014306 | 0,012839 à 0,021482 | indisponible |
| 2 | STCK | A | engaged_action | safeBoundary | 4 | 815,933 | 764,187 à 893,867 | indisponible |
| 2 | STCK | B | initial_planning | acknowledgement | 4 | 0,010220 | 0,005658 à 0,061912 | indisponible |
| 2 | STCK | B | initial_planning | safeBoundary | 4 | 1109,408 | 891,515 à 1220,349 | indisponible |
| 2 | STCK | B | engaged_action | acknowledgement | 4 | 0,015032 | 0,010866 à 0,016073 | indisponible |
| 2 | STCK | B | engaged_action | safeBoundary | 4 | 774,481 | 750,314 à 926,945 | indisponible |
| 2 | SMLP | A | initial_planning | acknowledgement | 4 | 0,007245 | 0,003625 à 0,017045 | indisponible |
| 2 | SMLP | A | initial_planning | safeBoundary | 4 | 1492,466 | 1315,623 à 1599,687 | indisponible |
| 2 | SMLP | A | engaged_action | acknowledgement | 4 | 0,004797 | 0,004036 à 0,020451 | indisponible |
| 2 | SMLP | A | engaged_action | safeBoundary | 4 | 712,210 | 686,235 à 738,179 | indisponible |
| 2 | SMLP | B | initial_planning | acknowledgement | 4 | 0,007952 | 0,004747 à 0,021351 | indisponible |
| 2 | SMLP | B | initial_planning | safeBoundary | 4 | 1506,057 | 1380,825 à 1652,699 | indisponible |
| 2 | SMLP | B | engaged_action | acknowledgement | 4 | 0,007456 | 0,004487 à 0,019930 | indisponible |
| 2 | SMLP | B | engaged_action | safeBoundary | 4 | 787,596 | 656,736 à 865,848 | indisponible |

| Cohorte | Jeu | Version | Contexte Pause | Observations | Acquittements | Actions à la frontière sûre |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | A | initial_planning | 4 | 4 | 0 |
| 1 | STCK | A | engaged_action | 4 | 4 | 1 |
| 1 | SMLP | A | initial_planning | 4 | 4 | 0 |
| 1 | SMLP | A | engaged_action | 4 | 4 | 1 |
| 1 | STCK | B | initial_planning | 4 | 4 | 0 |
| 1 | STCK | B | engaged_action | 4 | 4 | 1 |
| 1 | SMLP | B | initial_planning | 4 | 4 | 0 |
| 1 | SMLP | B | engaged_action | 4 | 4 | 1 |
| 2 | STCK | A | initial_planning | 4 | 4 | 0 |
| 2 | STCK | A | engaged_action | 4 | 4 | 1 |
| 2 | SMLP | A | initial_planning | 4 | 4 | 0 |
| 2 | SMLP | A | engaged_action | 4 | 4 | 1 |
| 2 | STCK | B | initial_planning | 4 | 4 | 0 |
| 2 | STCK | B | engaged_action | 4 | 4 | 1 |
| 2 | SMLP | B | initial_planning | 4 | 4 | 0 |
| 2 | SMLP | B | engaged_action | 4 | 4 | 1 |

| Cohorte | Jeu | Version | Mesure | n | Médiane, Mio | Min à max, Mio |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | A | heapUsed | 64 | 288,819 | 103,561 à 526,553 |
| 1 | STCK | A | rss | 64 | 898,074 | 525,637 à 950,613 |
| 1 | SMLP | A | heapUsed | 96 | 321,563 | 132,684 à 627,207 |
| 1 | SMLP | A | rss | 96 | 996,613 | 786,379 à 1051,844 |
| 1 | STCK | B | heapUsed | 64 | 271,431 | 107,824 à 523,913 |
| 1 | STCK | B | rss | 64 | 881,168 | 540,629 à 962,504 |
| 1 | SMLP | B | heapUsed | 96 | 284,295 | 86,878 à 596,858 |
| 1 | SMLP | B | rss | 96 | 980,006 | 801,320 à 1075,125 |
| 2 | STCK | A | heapUsed | 64 | 251,751 | 105,852 à 550,924 |
| 2 | STCK | A | rss | 64 | 888,291 | 530,684 à 962,957 |
| 2 | SMLP | A | heapUsed | 96 | 300,008 | 113,881 à 592,040 |
| 2 | SMLP | A | rss | 96 | 979,643 | 759,625 à 1060,629 |
| 2 | STCK | B | heapUsed | 64 | 290,759 | 102,337 à 520,789 |
| 2 | STCK | B | rss | 64 | 901,717 | 514,613 à 979,273 |
| 2 | SMLP | B | heapUsed | 96 | 312,861 | 110,072 à 546,432 |
| 2 | SMLP | B | rss | 96 | 965,121 | 749,746 à 1032,000 |

Les échantillons mémoire incluent le travail et l’allocation réellement exécutés. Les processus, GC et chauffes influencent ces valeurs ; une variation de RSS ne démontre pas à elle seule une fuite ou une cause liée à Feedback. Ces sessions finies ne prouvent pas une stabilité de plusieurs heures.

## Portée de la décision

La [décision globale qualifiée](owner-qualified-global-budget-decision.json) applique le seuil numérique préalable à chaque jeu séparément. La consolidation stricte reste en échec, la comparabilité structurelle est qualifiée après mesure et le contrôle navigateur reste bloqué par infrastructure. La fenêtre mesure la boucle commune sur retours enregistrés : rendu navigateur, moteur du jeu et réseau sont exclus. Ces coûts ne constituent ni une campagne live ni une contribution propre de Feedback aux choix de STCK/SMLP.
