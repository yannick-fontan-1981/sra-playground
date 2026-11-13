# Lot 3H — CrossedPrefix : résultats de coût de native 0.49.0

**Le coût est accepté selon le critère global déclaré : STCK −1,666021 %; SMLP +2,663966 %.** La [décision globale](global-budget-decision.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_user_global_rule`. Les diagnostics de phases restent **15/16**, statut `budget_review_required`, avec **1 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](consolidation-review.json) passe 231/231 contrôles.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 76 / native 0.48.0 ; commit `fbbc3fb6b796c0ba359654da7234008767090e1f` ; 266 fichiers natifs | `fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26` |
| B : candidat gelé | Native 0.49.0 ; 268 fichiers natifs ; archive de 279 fichiers | `d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054` |

La [déclaration](declaration.json) finalisée le **2026-11-10 13:18:16 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre de CrossedPrefix. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 13:33:41 UTC−03** au **2026-11-10 13:42:28 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.48.0 | 2026-11-10 13:33:41 UTC−03 | 2026-11-10 13:35:53 UTC−03 | passed |
| B1 | 0.49.0 | 2026-11-10 13:35:53 UTC−03 | 2026-11-10 13:38:09 UTC−03 | passed |
| B2 | 0.49.0 | 2026-11-10 13:38:09 UTC−03 | 2026-11-10 13:40:20 UTC−03 | passed |
| A2 | 0.48.0 | 2026-11-10 13:40:20 UTC−03 | 2026-11-10 13:42:28 UTC−03 | passed |

| Engagement | Valeur conservée |
| --- | --- |
| Ordre | A1, B1, B2, A2 |
| Cohortes | 2 |
| Sessions mesurées | 32 |
| Actions mesurées | 400 |
| Chauffes exclues | 8 sessions / 24 actions |
| Sessions mesurées ou valeurs extrêmes exclues | 0 |
| Choix d’une cohorte favorable | Aucun |
| Tolérance de bruit ajoutée | Aucune |
| Revue statique | 52/52 |

Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.

## Critère global par jeu

Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; seul l’affichage est arrondi.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Écart au seuil, points | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 10646,178 | 10468,810 | −1,666021 % | 11,666021 | Accepté |
| SMLP | 8 / 8 | 17105,686 | 17561,376 | +2,663966 % | 7,336034 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](combined-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 10646,178 | 10468,810 | −1,666021 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 352,555 | 334,448 | −5,135762 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 10,668 | 9,428 | −11,616035 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 12,829 | 11,644 | −9,234987 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,272888 | 0,229549 | −15,881761 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 870,955 | 880,386 | +1,082909 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 166,523 | 179,349 | +7,701698 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 8,431 | 8,533 | +1,207901 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 17105,686 | 17561,376 | +2,663966 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 383,733 | 405,441 | +5,657125 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 11,040 | 11,795 | +6,839840 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 13,657 | 14,544 | +6,491405 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,367448 | 0,403566 | +9,829567 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 840,400 | 967,829 | +15,162882 % | `over_budget_with_noise_unresolved` |
| SMLP | `persistence` | 152 / 152 | 130,700 | 142,418 | +8,965749 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 5,621 | 5,766 | +2,577626 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `acquisition_and_persistence` +15,162882 %** (`over_budget_with_noise_unresolved`).

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10181,560 à 11315,893 | 9690,281 à 12990,140 | indisponible / indisponible | indisponible | 10,654829 % / 31,520856 % |
| STCK | `new_decision` | 186,108 à 545,457 | 173,408 à 555,743 | 472,070 / 506,594 | +7,313263 % | 27,128034 % / 58,286226 % |
| STCK | `known_prefix_service` | 7,321 à 22,611 | 7,040 à 20,538 | 21,399 / 16,341 | −23,638447 % | 31,437270 % / 29,384274 % |
| STCK | `known_prefix_request` | 8,864 à 24,513 | 8,979 à 23,290 | 23,343 / 18,534 | −20,601092 % | 35,050277 % / 27,335756 % |
| STCK | `known_prefix_guard` | 0,089812 à 1,404 | 0,084715 à 1,173 | 0,599816 / 0,447812 | −25,341771 % | 54,085405 % / 39,367730 % |
| STCK | `acquisition_and_persistence` | 396,425 à 3882,285 | 409,627 à 4101,166 | 3741,332 / 3665,017 | −2,039794 % | 16,749728 % / 36,298218 % |
| STCK | `persistence` | 15,060 à 399,341 | 15,367 à 458,867 | 327,171 / 365,080 | +11,586919 % | 32,220160 % / 35,738502 % |
| STCK | `restoration` | 2,014 à 85,644 | 1,940 à 97,089 | 53,044 / 54,191 | +2,162653 % | 36,337167 % / 41,378159 % |
| SMLP | `session_elapsed` | 16110,599 à 17660,136 | 16734,096 à 18813,169 | indisponible / indisponible | indisponible | 9,058607 % / 11,838893 % |
| SMLP | `new_decision` | 189,587 à 1032,533 | 201,997 à 1011,920 | 862,785 / 976,056 | +13,128495 % | 43,614017 % / 17,516325 % |
| SMLP | `known_prefix_service` | 7,627 à 30,622 | 8,321 à 26,505 | 24,234 / 24,666 | +1,781308 % | 41,083384 % / 31,637224 % |
| SMLP | `known_prefix_request` | 9,606 à 34,050 | 10,391 à 29,755 | 26,560 / 28,015 | +5,476663 % | 37,213939 % / 30,469598 % |
| SMLP | `known_prefix_guard` | 0,191524 à 13,134 | 0,196210 à 12,706 | 11,015 / 8,831 | −19,829370 % | 62,757965 % / 57,304501 % |
| SMLP | `acquisition_and_persistence` | 295,982 à 3236,015 | 316,999 à 2921,999 | 2727,569 / 2719,773 | −0,285797 % | 38,159586 % / 27,686351 % |
| SMLP | `persistence` | 15,195 à 344,059 | 24,783 à 382,278 | 259,047 / 272,872 | +5,336794 % | 23,824309 % / 22,871826 % |
| SMLP | `restoration` | 1,732 à 54,424 | 2,306 à 60,518 | 23,802 / 28,803 | +21,013350 % | 35,474554 % / 25,691549 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `persistence` +11,586919 %**; **SMLP `new_decision` +13,128495 %**; **SMLP `restoration` +21,013350 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 10773,841 / 11144,621 | +3,441485 % | 7/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 17405,335 / 17248,832 | −0,899165 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 10407,564 / 10331,712 | −0,728812 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 16652,222 / 17692,389 | +6,246419 % | 5/8 | budget_review_required |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10773,841 | 11144,621 | +3,441485 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 368,439 | 383,141 | +3,990266 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 11,109 | 9,667 | −12,982427 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 13,292 | 11,901 | −10,467900 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,283248 | 0,225984 | −20,216912 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 860,628 | 953,295 | +10,767341 % | `over_budget_with_noise_unresolved` |
| STCK | `persistence` | 52 / 52 | 175,716 | 185,167 | +5,378392 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 9,012 | 7,838 | −13,025198 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 17405,335 | 17248,832 | −0,899165 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 383,733 | 392,474 | +2,277880 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 11,596 | 11,814 | +1,878320 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 14,093 | 14,820 | +5,155848 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,349236 | 0,431337 | +23,508745 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 895,950 | 951,551 | +6,205730 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 132,785 | 142,627 | +7,412379 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 5,813 | 5,798 | −0,254541 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `acquisition_and_persistence` +10,767341 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_guard` +23,508745 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10337,050 à 11315,893 | 10308,792 à 12990,140 | indisponible / indisponible | indisponible | 9,085358 % / 24,059562 % |
| STCK | `new_decision` | 198,955 à 504,565 | 173,408 à 555,743 | 472,070 / 554,544 | +17,470553 % | 26,928953 % / 36,937219 % |
| STCK | `known_prefix_service` | 8,001 à 22,611 | 7,040 à 15,809 | indisponible / indisponible | indisponible | 30,926340 % / 28,341560 % |
| STCK | `known_prefix_request` | 9,608 à 24,513 | 8,979 à 17,536 | indisponible / indisponible | indisponible | 34,255169 % / 27,129187 % |
| STCK | `known_prefix_guard` | 0,089812 à 1,404 | 0,084715 à 0,447812 | indisponible / indisponible | indisponible | 33,952764 % / 29,631345 % |
| STCK | `acquisition_and_persistence` | 408,068 à 3882,285 | 435,791 à 4101,166 | 3775,291 / 4020,744 | +6,501577 % | 16,794713 % / 28,226583 % |
| STCK | `persistence` | 15,060 à 399,341 | 18,867 à 458,867 | 344,970 / 402,283 | +16,614003 % | 30,100952 % / 32,266653 % |
| STCK | `restoration` | 2,038 à 85,644 | 1,940 à 97,089 | 61,133 / 66,684 | +9,080034 % | 23,458557 % / 25,352487 % |
| SMLP | `session_elapsed` | 16539,714 à 17660,136 | 16734,096 à 18813,169 | indisponible / indisponible | indisponible | 6,437234 % / 12,053410 % |
| SMLP | `new_decision` | 214,496 à 1032,533 | 201,997 à 1011,920 | 864,139 / 968,138 | +12,035081 % | 15,437408 % / 9,619425 % |
| SMLP | `known_prefix_service` | 7,627 à 25,128 | 8,656 à 25,914 | 24,234 / 24,666 | +1,781308 % | 37,336485 % / 28,687774 % |
| SMLP | `known_prefix_request` | 9,606 à 27,613 | 10,718 à 28,975 | 26,560 / 28,015 | +5,476663 % | 34,450832 % / 30,404744 % |
| SMLP | `known_prefix_guard` | 0,197292 à 13,134 | 0,199234 à 12,706 | 13,114 / 11,235 | −14,333796 % | 57,017854 % / 46,437810 % |
| SMLP | `acquisition_and_persistence` | 325,402 à 3011,784 | 370,554 à 2921,999 | 2899,776 / 2880,267 | −0,672758 % | 35,464209 % / 28,159977 % |
| SMLP | `persistence` | 15,195 à 344,059 | 24,783 à 310,810 | 272,737 / 264,899 | −2,873813 % | 13,828318 % / 23,095684 % |
| SMLP | `restoration` | 1,912 à 54,424 | 2,306 à 60,518 | 29,791 / 28,803 | −3,315737 % | 25,109069 % / 22,663106 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +17,470553 %**; **STCK `persistence` +16,614003 %**; **SMLP `new_decision` +12,035081 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10407,564 | 10331,712 | −0,728812 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 340,854 | 310,383 | −8,939530 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 10,346 | 9,144 | −11,614853 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 12,352 | 11,330 | −8,270890 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,243294 | 0,235588 | −3,167766 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 877,934 | 863,741 | −1,616633 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 163,287 | 173,337 | +6,154643 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 6,567 | 8,682 | +32,196536 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 4 / 4 | 16652,222 | 17692,389 | +6,246419 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 376,591 | 412,742 | +9,599401 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 10,646 | 10,858 | +1,997597 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 13,239 | 13,447 | +1,568079 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,400717 | 0,392640 | −2,015637 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 813,367 | 967,829 | +18,990369 % | `over_budget_with_noise_unresolved` |
| SMLP | `persistence` | 76 / 76 | 129,068 | 142,418 | +10,343479 % | `over_budget_with_noise_unresolved` |
| SMLP | `restoration` | 72 / 72 | 4,806 | 5,766 | +19,968259 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `restoration` +32,196536 %** (`over_budget_with_noise_unresolved`); **SMLP `acquisition_and_persistence` +18,990369 %** (`over_budget_with_noise_unresolved`); **SMLP `persistence` +10,343479 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +19,968259 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10181,560 à 10906,613 | 9690,281 à 10636,468 | indisponible / indisponible | indisponible | 6,966591 % / 9,158090 % |
| STCK | `new_decision` | 186,108 à 545,457 | 190,496 à 496,103 | 455,886 / 492,987 | +8,138098 % | 23,313767 % / 55,664431 % |
| STCK | `known_prefix_service` | 7,321 à 21,399 | 7,544 à 20,538 | indisponible / indisponible | indisponible | 24,682004 % / 11,549571 % |
| STCK | `known_prefix_request` | 8,864 à 23,343 | 9,500 à 23,290 | indisponible / indisponible | indisponible | 25,183494 % / 10,116560 % |
| STCK | `known_prefix_guard` | 0,092687 à 0,599816 | 0,099216 à 1,173 | indisponible / indisponible | indisponible | 55,481527 % / 34,380254 % |
| STCK | `acquisition_and_persistence` | 396,425 à 3741,332 | 409,627 à 3555,777 | 3495,473 / 3445,375 | −1,433216 % | 10,546275 % / 6,048407 % |
| STCK | `persistence` | 16,681 à 358,966 | 15,367 à 336,212 | 325,718 / 315,838 | −3,033317 % | 28,780372 % / 21,180839 % |
| STCK | `restoration` | 2,014 à 55,172 | 1,973 à 64,111 | 47,500 / 50,355 | +6,010145 % | 29,168576 % / 39,813412 % |
| SMLP | `session_elapsed` | 16110,599 à 17591,069 | 16867,296 à 17782,667 | indisponible / indisponible | indisponible | 8,890529 % / 5,173810 % |
| SMLP | `new_decision` | 189,587 à 882,414 | 202,820 à 1002,845 | 829,880 / 987,999 | +19,053304 % | 46,186424 % / 16,713366 % |
| SMLP | `known_prefix_service` | 7,969 à 30,622 | 8,321 à 26,505 | 23,485 / 22,612 | −3,721190 % | 34,779628 % / 25,404934 % |
| SMLP | `known_prefix_request` | 10,082 à 34,050 | 10,391 à 29,755 | 25,957 / 25,886 | −0,272963 % | 36,669626 % / 23,957637 % |
| SMLP | `known_prefix_guard` | 0,191524 à 9,323 | 0,196210 à 8,625 | 9,163 / 7,259 | −20,786641 % | 50,074822 % / 27,518277 % |
| SMLP | `acquisition_and_persistence` | 295,982 à 3236,015 | 316,999 à 2820,589 | 2457,992 / 2681,528 | +9,094262 % | 11,010134 % / 14,341844 % |
| SMLP | `persistence` | 19,031 à 330,100 | 27,633 à 382,278 | 252,465 / 303,705 | +20,295771 % | 22,939222 % / 5,093480 % |
| SMLP | `restoration` | 1,732 à 38,711 | 2,671 à 43,513 | 22,671 / 31,385 | +38,435094 % | 30,631429 % / 15,747204 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **SMLP `new_decision` +19,053304 %**; **SMLP `persistence` +20,295771 %**; **SMLP `restoration` +38,435094 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 196,696 / 220,202 | +11,950394 % | 168,515 à 261,950 / 172,265 à 276,332 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 349,198 / 381,989 | +9,390350 % | 296,129 à 437,405 / 320,434 à 450,540 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 212,991 / 218,843 | +2,747589 % | 192,463 à 253,708 / 181,001 à 268,599 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 381,104 / 394,270 | +3,454619 % | 334,688 à 434,016 / 338,098 à 438,185 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 188,249 / 178,524 | −5,166167 % | 162,446 à 259,709 / 157,605 à 256,922 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 330,103 / 341,266 | +3,381704 % | 288,026 à 413,440 / 292,653 à 441,792 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 234,508 / 201,925 | −13,894479 % | 192,954 à 290,265 / 190,846 à 288,375 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 406,600 / 358,095 | −11,929547 % | 335,891 à 466,698 / 342,036 à 485,097 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,010085 / 0,013690 | +35,751115 % | 0,007351 à 0,090564 / 0,008843 à 0,041692 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1090,780 / 1120,352 | +2,711067 % | 1025,134 à 1156,043 / 1015,589 à 1572,465 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,015758 / 0,015773 | +0,095190 % | 0,010014 à 0,017676 / 0,010546 à 0,020139 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 833,655 / 959,969 | +15,151751 % | 784,177 à 881,768 / 798,218 à 1109,773 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,006640 / 0,009323 | +40,414156 % | 0,002734 à 0,016875 / 0,003355 à 0,026409 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1602,097 / 1656,278 | +3,381897 % | 1395,113 à 1685,724 / 1525,179 à 1763,829 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,005840 / 0,007030 | +20,395582 % | 0,004487 à 0,029143 / 0,005118 à 0,025378 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 722,537 / 764,763 | +5,844255 % | 701,410 à 811,995 / 704,299 à 932,581 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,044776 / 0,012119 | −72,935278 % | 0,008122 à 0,084535 / 0,007461 à 0,038937 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 999,349 / 1035,411 | +3,608537 % | 928,263 à 1247,106 / 975,851 à 1113,555 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,015303 / 0,014492 | −5,299614 % | 0,010115 à 0,019639 / 0,011758 à 0,019469 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 832,935 / 794,082 | −4,664680 % | 760,268 à 956,034 / 722,176 à 893,087 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,010960 / 0,008848 | −19,273756 % | 0,003906 à 0,050585 / 0,003996 à 0,019339 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1487,880 / 1689,549 | +13,554120 % | 1390,592 à 1875,920 / 1657,661 à 1836,095 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,006705 / 0,015844 | +136,293811 % | 0,004116 à 0,028002 / 0,006310 à 0,035072 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 780,045 / 722,077 | −7,431356 % | 692,064 à 947,569 / 674,501 à 770,208 | indisponible / indisponible |

| Cohorte | Jeu | Version | Contexte Pause | Observations | Acquittements | Actions à la frontière sûre |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | A | `initial_planning` | 4 | 4 | 0 |
| 1 | STCK | A | `engaged_action` | 4 | 4 | 1 |
| 1 | SMLP | A | `initial_planning` | 4 | 4 | 0 |
| 1 | SMLP | A | `engaged_action` | 4 | 4 | 1 |
| 1 | STCK | B | `initial_planning` | 4 | 4 | 0 |
| 1 | STCK | B | `engaged_action` | 4 | 4 | 1 |
| 1 | SMLP | B | `initial_planning` | 4 | 4 | 0 |
| 1 | SMLP | B | `engaged_action` | 4 | 4 | 1 |
| 2 | STCK | A | `initial_planning` | 4 | 4 | 0 |
| 2 | STCK | A | `engaged_action` | 4 | 4 | 1 |
| 2 | SMLP | A | `initial_planning` | 4 | 4 | 0 |
| 2 | SMLP | A | `engaged_action` | 4 | 4 | 1 |
| 2 | STCK | B | `initial_planning` | 4 | 4 | 0 |
| 2 | STCK | B | `engaged_action` | 4 | 4 | 1 |
| 2 | SMLP | B | `initial_planning` | 4 | 4 | 0 |
| 2 | SMLP | B | `engaged_action` | 4 | 4 | 1 |

## Échantillons mémoire conservés

Les rapports bruts conservent chaque valeur de mémoire. Le tableau décrit leur médiane et leur étendue en Mio ; il n’ajoute aucun critère d’acceptation et ne démontre pas une stabilité pendant plusieurs heures.

| Cohorte | Jeu | Version | Mesure | Effectif | Médiane, Mio | Min à max, Mio |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | A | `heapUsed` | 64 | 237,986 | 104,335 à 557,673 |
| 1 | STCK | A | `rss` | 64 | 868,746 | 518,504 à 977,012 |
| 1 | SMLP | A | `heapUsed` | 96 | 281,646 | 120,832 à 611,326 |
| 1 | SMLP | A | `rss` | 96 | 944,111 | 762,191 à 1059,562 |
| 1 | STCK | B | `heapUsed` | 64 | 268,949 | 90,678 à 522,324 |
| 1 | STCK | B | `rss` | 64 | 911,094 | 512,199 à 981,906 |
| 1 | SMLP | B | `heapUsed` | 96 | 313,533 | 122,910 à 650,390 |
| 1 | SMLP | B | `rss` | 96 | 1024,238 | 769,480 à 1091,293 |
| 2 | STCK | A | `heapUsed` | 64 | 264,930 | 99,807 à 508,469 |
| 2 | STCK | A | `rss` | 64 | 877,531 | 525,195 à 1001,938 |
| 2 | SMLP | A | `heapUsed` | 96 | 300,274 | 112,755 à 577,928 |
| 2 | SMLP | A | `rss` | 96 | 967,127 | 762,391 à 1055,910 |
| 2 | STCK | B | `heapUsed` | 64 | 251,359 | 105,370 à 543,778 |
| 2 | STCK | B | `rss` | 64 | 839,719 | 521,195 à 962,590 |
| 2 | SMLP | B | `heapUsed` | 96 | 287,600 | 126,712 à 619,557 |
| 2 | SMLP | B | `rss` | 96 | 981,254 | 816,809 à 1057,242 |

## Calculs, empreintes et transport

La [revue de consolidation](consolidation-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](global-budget-decision.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `ca371fbf437d2434932c74238a75ab0eb6cd6ef27e8db5aa329c2d179c8c667d` |
| global-budget-policy.json | `cd36bc36abde70765edbb6dc0c78165c889a7c5fed1c88f8b7c72d650a4652f7` |
| combined-comparison.json | `8fd3e284b2ec17578759507bdb683dd6dbfb839a06fc7cdc1d4ecb2a4e63fc18` |
| consolidation-review.json | `bae3b4c132c3d58a322782f824384fa205bba7bcac2e5342f97fc57639b465cb` |
| global-budget-decision.json | `548f938e26cbd85fc5c33376cdbc144dd66c365186c5c80bf3257dd6d9767c97` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1571 | 436 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1568 | 434 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1572 | 433 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1557 | 427 |

Le [premier échec de rendu](../diagnostic/cost-report-render-incident.json) est conservé avec son traceback et le générateur antérieur. Il provenait du nom d’un champ du reçu global, après la mesure et avant l’écriture du rapport. La correction lit le schéma effectif et les chauffes enregistrées ; aucun reçu de mesure ni résultat n’a été modifié.

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.49.0 dans cette fenêtre**, selon le reçu `accepted_under_user_global_rule`. Les **1 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves fonctionnelles, de contribution, de régression, de navigateur et d’intégrité séparées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de CrossedPrefix, de revalidation source, d’héritage ou de parité de l’appelant complet. La preuve intégrée synthétique et le résultat effectif de WEAV, avec son horloge cumulée, sont consignés dans leurs reçus propres liés par la readiness. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
