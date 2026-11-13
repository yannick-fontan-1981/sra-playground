# Lot 3G : résultats de coût de native 0.48.0

**Le coût est accepté selon le critère global déclaré : STCK +1,654959 %; SMLP +6,641217 %.** La [décision globale](global-budget-decision.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_user_global_rule`. Les diagnostics de phases restent **12/16**, statut `budget_review_required`, avec **4 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](consolidation-review.json) passe 231/231 contrôles.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 75 / native 0.47.0 ; commit `08bc35e447d17530a774c146ce4e660b1ef29d9a` ; 263 fichiers natifs | `54d8742300a04dcdf0cb1b038bc62b947d4a1c60f70da4ee80e6971b0f021165` |
| B : candidat gelé | Native 0.48.0 ; 266 fichiers natifs ; archive de 277 fichiers | `fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26` |

La [déclaration](declaration.json) finalisée le **2026-11-10 12:08:29 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre de FramedWindow. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 12:14:48 UTC−03** au **2026-11-10 12:23:59 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.47.0 | 2026-11-10 12:14:48 UTC−03 | 2026-11-10 12:17:04 UTC−03 | passed |
| B1 | 0.48.0 | 2026-11-10 12:17:04 UTC−03 | 2026-11-10 12:19:26 UTC−03 | passed |
| B2 | 0.48.0 | 2026-11-10 12:19:26 UTC−03 | 2026-11-10 12:21:45 UTC−03 | passed |
| A2 | 0.47.0 | 2026-11-10 12:21:45 UTC−03 | 2026-11-10 12:23:59 UTC−03 | passed |

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
| Revue statique | 48/48 |

Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.

## Critère global par jeu

Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; seul l’affichage est arrondi.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Écart au seuil, points | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 10620,594 | 10796,360 | +1,654959 % | 8,345041 | Accepté |
| SMLP | 8 / 8 | 18046,697 | 19245,217 | +6,641217 % | 3,358783 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](combined-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 10620,594 | 10796,360 | +1,654959 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 328,145 | 303,973 | −7,366176 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 9,617 | 11,033 | +14,718825 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_request` | 32 / 32 | 11,806 | 13,377 | +13,306563 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,247280 | 0,275612 | +11,457232 % | `over_budget_with_noise_unresolved` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 880,237 | 875,559 | −0,531498 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 169,230 | 174,483 | +3,103681 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 7,516 | 7,998 | +6,405221 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 18046,697 | 19245,217 | +6,641217 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 403,728 | 398,436 | −1,310841 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 11,589 | 11,825 | +2,031180 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 14,372 | 14,568 | +1,361573 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,382651 | 0,433090 | +13,181611 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 982,926 | 985,516 | +0,263513 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 154,883 | 149,944 | −3,188663 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 6,011 | 5,900 | −1,838538 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `known_prefix_service` +14,718825 %** (`over_budget_with_noise_unresolved`); **STCK `known_prefix_request` +13,306563 %** (`over_budget_with_noise_unresolved`); **STCK `known_prefix_guard` +11,457232 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_guard` +13,181611 %** (`over_budget_with_noise_unresolved`).

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10155,473 à 11579,221 | 10246,652 à 11116,872 | indisponible / indisponible | indisponible | 13,405545 % / 8,060313 % |
| STCK | `new_decision` | 182,635 à 608,741 | 169,711 à 589,453 | 475,974 / 510,640 | +7,283142 % | 30,312496 % / 20,447722 % |
| STCK | `known_prefix_service` | 7,971 à 22,038 | 8,017 à 23,403 | 18,527 / 23,370 | +26,134641 % | 47,541860 % / 33,093400 % |
| STCK | `known_prefix_request` | 9,576 à 24,297 | 9,872 à 25,835 | 22,524 / 25,539 | +13,383524 % | 55,466065 % / 36,410899 % |
| STCK | `known_prefix_guard` | 0,088661 à 0,840747 | 0,084675 à 0,479899 | 0,385780 / 0,451107 | +16,933745 % | 51,195903 % / 42,390482 % |
| STCK | `acquisition_and_persistence` | 361,165 à 3858,295 | 401,120 à 4209,088 | 3639,562 / 3918,768 | +7,671426 % | 23,733468 % / 24,283919 % |
| STCK | `persistence` | 14,349 à 374,955 | 13,870 à 429,170 | 347,506 / 358,502 | +3,164209 % | 28,226366 % / 31,253534 % |
| STCK | `restoration` | 1,835 à 66,822 | 1,785 à 84,815 | 50,345 / 63,823 | +26,771026 % | 26,041973 % / 46,940486 % |
| SMLP | `session_elapsed` | 17377,235 à 18876,658 | 17049,343 à 20446,898 | indisponible / indisponible | indisponible | 8,308572 % / 17,654021 % |
| SMLP | `new_decision` | 224,550 à 1075,095 | 204,399 à 1075,466 | 1034,306 / 933,018 | −9,792853 % | 22,211551 % / 18,237157 % |
| SMLP | `known_prefix_service` | 8,036 à 32,764 | 8,923 à 28,401 | 22,369 / 24,476 | +9,423008 % | 27,199007 % / 40,320980 % |
| SMLP | `known_prefix_request` | 10,122 à 35,791 | 11,059 à 31,172 | 25,194 / 27,520 | +9,232784 % | 22,783435 % / 42,258970 % |
| SMLP | `known_prefix_guard` | 0,193426 à 18,948 | 0,194577 à 10,306 | 10,343 / 0,733583 | −92,907775 % | 49,097291 % / 28,850603 % |
| SMLP | `acquisition_and_persistence` | 353,011 à 2975,882 | 341,481 à 3418,166 | 2649,289 / 3129,224 | +18,115606 % | 27,111728 % / 47,617871 % |
| SMLP | `persistence` | 19,320 à 397,367 | 17,822 à 459,547 | 276,470 / 305,677 | +10,564400 % | 22,083554 % / 17,386165 % |
| SMLP | `restoration` | 1,985 à 52,966 | 2,068 à 96,123 | 26,723 / 25,107 | −6,045134 % | 44,884473 % / 53,904763 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `known_prefix_service` +26,134641 %**; **STCK `known_prefix_request` +13,383524 %**; **STCK `known_prefix_guard` +16,933745 %**; **STCK `restoration` +26,771026 %**; **SMLP `acquisition_and_persistence` +18,115606 %**; **SMLP `persistence` +10,564400 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 10799,384 / 11052,791 | +2,346492 % | 5/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 17687,619 / 19245,217 | +8,806148 % | 5/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 10474,640 / 10584,916 | +1,052791 % | 5/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 18551,237 / 18620,491 | +0,373311 % | 8/8 | budget_review_required |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10799,384 | 11052,791 | +2,346492 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 313,356 | 309,830 | −1,125037 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 9,848 | 10,953 | +11,219551 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_request` | 16 / 16 | 11,978 | 13,333 | +11,309939 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,246475 | 0,275271 | +11,683359 % | `over_budget_with_noise_unresolved` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 947,113 | 906,638 | −4,273461 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 171,715 | 167,276 | −2,584967 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 7,832 | 8,369 | +6,853412 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 17687,619 | 19245,217 | +8,806148 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 369,578 | 398,695 | +7,878618 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,977 | 11,935 | +19,624814 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,874 | 14,691 | +14,112932 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,349486 | 0,461367 | +32,012870 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 969,197 | 1015,106 | +4,736794 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 150,862 | 156,371 | +3,651981 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 6,318 | 6,686 | +5,820667 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `known_prefix_service` +11,219551 %** (`over_budget_with_noise_unresolved`); **STCK `known_prefix_request` +11,309939 %** (`over_budget_with_noise_unresolved`); **STCK `known_prefix_guard` +11,683359 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_service` +19,624814 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_request` +14,112932 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_guard` +32,012870 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10253,820 à 11579,221 | 10667,954 à 11116,872 | indisponible / indisponible | indisponible | 12,272935 % / 4,061587 % |
| STCK | `new_decision` | 201,870 à 608,741 | 182,944 à 589,453 | 485,350 / 528,556 | +8,902095 % | 10,835894 % / 9,734235 % |
| STCK | `known_prefix_service` | 8,097 à 18,527 | 8,017 à 23,403 | indisponible / indisponible | indisponible | 16,962805 % / 34,727949 % |
| STCK | `known_prefix_request` | 9,817 à 20,530 | 9,872 à 25,835 | indisponible / indisponible | indisponible | 13,712039 % / 38,479766 % |
| STCK | `known_prefix_guard` | 0,088661 à 0,341444 | 0,084675 à 0,479899 | indisponible / indisponible | indisponible | 32,882303 % / 42,390482 % |
| STCK | `acquisition_and_persistence` | 430,681 à 3858,295 | 431,624 à 4209,088 | 3639,562 / 3947,215 | +8,453018 % | 16,719953 % / 21,610304 % |
| STCK | `persistence` | 15,267 à 374,859 | 19,689 à 429,170 | 355,025 / 358,502 | +0,979413 % | 9,249670 % / 28,677113 % |
| STCK | `restoration` | 1,852 à 51,632 | 1,800 à 72,788 | 49,750 / 56,440 | +13,446704 % | 19,293774 % / 39,567243 % |
| SMLP | `session_elapsed` | 17377,235 à 18133,084 | 17685,564 à 20446,898 | indisponible / indisponible | indisponible | 4,273322 % / 14,348154 % |
| SMLP | `new_decision` | 237,084 à 1065,112 | 256,349 à 1008,061 | 878,289 / 933,018 | +6,231368 % | 19,303113 % / 12,201135 % |
| SMLP | `known_prefix_service` | 8,036 à 24,388 | 9,205 à 28,401 | 21,610 / 20,613 | −4,614267 % | 16,618161 % / 11,598515 % |
| SMLP | `known_prefix_request` | 10,122 à 28,446 | 11,859 à 31,172 | 24,527 / 23,541 | −4,017871 % | 13,619601 % / 15,469471 % |
| SMLP | `known_prefix_guard` | 0,193426 à 11,440 | 0,194577 à 9,076 | 10,343 / 0,733583 | −92,907775 % | 35,468534 % / 8,899299 % |
| SMLP | `acquisition_and_persistence` | 369,712 à 2649,289 | 405,097 à 3418,166 | 2644,768 / 3044,558 | +15,116274 % | 27,491774 % / 46,229836 % |
| SMLP | `persistence` | 19,320 à 290,874 | 20,320 à 369,119 | 276,474 / 305,677 | +10,562579 % | 18,116624 % / 9,925061 % |
| SMLP | `restoration` | 2,103 à 43,220 | 2,068 à 96,123 | 22,965 / 38,067 | +65,759691 % | 31,827976 % / 40,414135 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `restoration` +13,446704 %**; **SMLP `acquisition_and_persistence` +15,116274 %**; **SMLP `persistence` +10,562579 %**; **SMLP `restoration` +65,759691 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10474,640 | 10584,916 | +1,052791 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 368,558 | 303,973 | −17,523809 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 9,295 | 11,033 | +18,698930 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_request` | 16 / 16 | 11,127 | 13,377 | +20,214406 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,261236 | 0,275612 | +5,503272 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 855,115 | 873,583 | +2,159682 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 162,842 | 180,006 | +10,540367 % | `over_budget_with_noise_unresolved` |
| STCK | `restoration` | 48 / 48 | 7,516 | 7,848 | +4,414673 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 18551,237 | 18620,491 | +0,373311 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 406,292 | 397,715 | −2,111136 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 12,677 | 11,798 | −6,936089 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 15,555 | 14,568 | −6,345712 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,424636 | 0,417847 | −1,598779 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 987,305 | 961,715 | −2,591937 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 156,055 | 141,580 | −9,275594 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 5,929 | 5,529 | −6,733555 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `known_prefix_service` +18,698930 %** (`over_budget_with_noise_unresolved`); **STCK `known_prefix_request` +20,214406 %** (`over_budget_with_noise_unresolved`); **STCK `persistence` +10,540367 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10155,473 à 10636,760 | 10246,652 à 10924,766 | indisponible / indisponible | indisponible | 4,594790 % / 6,406421 % |
| STCK | `new_decision` | 182,635 à 475,974 | 169,711 à 510,640 | 467,874 / 456,076 | −2,521735 % | 28,300943 % / 20,562038 % |
| STCK | `known_prefix_service` | 7,971 à 22,038 | 8,470 à 23,370 | indisponible / indisponible | indisponible | 48,850497 % / 16,819801 % |
| STCK | `known_prefix_request` | 9,576 à 24,297 | 10,465 à 25,539 | indisponible / indisponible | indisponible | 58,175881 % / 15,993875 % |
| STCK | `known_prefix_guard` | 0,090363 à 0,840747 | 0,086928 à 0,448282 | indisponible / indisponible | indisponible | 40,590220 % / 20,993135 % |
| STCK | `acquisition_and_persistence` | 361,165 à 3661,726 | 401,120 à 3791,785 | 3422,885 / 3729,857 | +8,968242 % | 19,183387 % / 14,792955 % |
| STCK | `persistence` | 14,349 à 374,955 | 13,870 à 389,289 | 339,008 / 368,658 | +8,745955 % | 29,153846 % / 30,164616 % |
| STCK | `restoration` | 1,835 à 66,822 | 1,785 à 84,815 | 50,345 / 63,823 | +26,771026 % | 19,978131 % / 41,923135 % |
| SMLP | `session_elapsed` | 17482,444 à 18876,658 | 17049,343 à 20249,477 | indisponible / indisponible | indisponible | 7,515478 % / 17,186091 % |
| SMLP | `new_decision` | 224,550 à 1075,095 | 204,399 à 1075,466 | 1053,995 / 993,381 | −5,750853 % | 19,738110 % / 10,655683 % |
| SMLP | `known_prefix_service` | 8,721 à 32,764 | 8,923 à 25,732 | 22,369 / 24,476 | +9,423008 % | 7,792755 % / 37,982918 % |
| SMLP | `known_prefix_request` | 10,687 à 35,791 | 11,059 à 29,200 | 25,194 / 27,520 | +9,232784 % | 5,828194 % / 40,167826 % |
| SMLP | `known_prefix_guard` | 0,215208 à 18,948 | 0,198643 à 10,306 | 0,801563 / 0,648077 | −19,148339 % | 26,222608 % / 27,100520 % |
| SMLP | `acquisition_and_persistence` | 353,011 à 2975,882 | 341,481 à 3414,796 | 2912,707 / 3233,149 | +11,001499 % | 10,965897 % / 29,532571 % |
| SMLP | `persistence` | 19,528 à 397,367 | 17,822 à 459,547 | 268,498 / 313,834 | +16,885205 % | 19,449643 % / 12,190936 % |
| SMLP | `restoration` | 1,985 à 52,966 | 2,677 à 37,743 | 34,127 / 25,107 | −26,429880 % | 49,709117 % / 31,871750 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `restoration` +26,771026 %**; **SMLP `acquisition_and_persistence` +11,001499 %**; **SMLP `persistence` +16,885205 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 186,853 / 193,231 | +3,413032 % | 163,420 à 263,769 / 168,462 à 210,892 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 361,678 / 343,883 | −4,920128 % | 299,502 à 512,957 / 301,454 à 385,140 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 228,004 / 284,145 | +24,623090 % | 205,251 à 300,089 / 228,972 à 309,962 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 410,959 / 479,030 | +16,563837 % | 349,271 à 536,481 / 400,578 à 530,099 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 189,039 / 218,661 | +15,669957 % | 169,311 à 255,950 / 178,297 à 272,952 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 343,415 / 390,496 | +13,709735 % | 306,382 à 420,145 / 319,375 à 489,177 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 210,302 / 242,707 | +15,408704 % | 192,311 à 243,681 / 195,315 à 315,615 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 397,121 / 445,026 | +12,063054 % | 322,786 à 438,643 / 366,584 à 524,801 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,036198 / 0,011081 | −69,386853 % | 0,009814 à 0,082462 / 0,009514 à 0,042763 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1153,168 / 1064,341 | −7,702912 % | 919,368 à 1606,653 / 1007,225 à 1342,512 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,015398 / 0,016429 | +6,699139 % | 0,014091 à 0,017767 / 0,014091 à 0,019148 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 880,125 / 896,061 | +1,810642 % | 792,795 à 1012,656 / 748,707 à 1037,346 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,010836 / 0,010045 | −7,299742 % | 0,004206 à 0,023685 / 0,003746 à 0,014922 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1645,584 / 1652,941 | +0,447052 % | 1541,318 à 1900,334 / 1578,504 à 1734,621 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,007606 / 0,007491 | −1,511964 % | 0,004727 à 0,026870 / 0,005899 à 0,023364 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 796,858 / 742,038 | −6,879531 % | 686,304 à 1016,389 / 646,156 à 828,229 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,015969 / 0,009894 | −38,037386 % | 0,008513 à 0,091526 / 0,008933 à 0,041171 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1059,148 / 1085,421 | +2,480576 % | 1024,796 à 1222,446 / 951,223 à 1231,604 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,016530 / 0,016955 | +2,574186 % | 0,012689 à 0,021181 / 0,010976 à 0,019539 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 842,569 / 860,886 | +2,173963 % | 760,916 à 882,263 / 777,091 à 928,916 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,009483 / 0,009564 | +0,843570 % | 0,005158 à 0,027881 / 0,006560 à 0,022313 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1732,631 / 1722,233 | −0,600104 % | 1499,757 à 1782,082 / 1567,282 à 2070,285 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,007021 / 0,007676 | +9,336942 % | 0,004546 à 0,023114 / 0,005008 à 0,022253 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 768,597 / 767,977 | −0,080574 % | 718,280 à 934,416 / 701,966 à 917,679 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 251,730 | 84,025 à 526,287 |
| 1 | STCK | A | `rss` | 64 | 871,734 | 541,969 à 989,102 |
| 1 | SMLP | A | `heapUsed` | 96 | 266,387 | 98,021 à 585,491 |
| 1 | SMLP | A | `rss` | 96 | 972,920 | 750,352 à 1065,383 |
| 1 | STCK | B | `heapUsed` | 64 | 297,730 | 103,531 à 512,472 |
| 1 | STCK | B | `rss` | 64 | 870,293 | 526,215 à 960,227 |
| 1 | SMLP | B | `heapUsed` | 96 | 292,135 | 108,845 à 615,747 |
| 1 | SMLP | B | `rss` | 96 | 990,553 | 754,906 à 1061,293 |
| 2 | STCK | A | `heapUsed` | 64 | 248,018 | 121,507 à 528,019 |
| 2 | STCK | A | `rss` | 64 | 869,469 | 527,562 à 940,211 |
| 2 | SMLP | A | `heapUsed` | 96 | 319,924 | 118,657 à 623,306 |
| 2 | SMLP | A | `rss` | 96 | 983,287 | 770,520 à 1063,852 |
| 2 | STCK | B | `heapUsed` | 64 | 238,350 | 90,742 à 519,808 |
| 2 | STCK | B | `rss` | 64 | 865,324 | 514,973 à 940,934 |
| 2 | SMLP | B | `heapUsed` | 96 | 301,031 | 93,190 à 556,744 |
| 2 | SMLP | B | `rss` | 96 | 958,768 | 711,422 à 1010,125 |

## Calculs, empreintes et transport

La [revue de consolidation](consolidation-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](global-budget-decision.json) vérifie ensuite la déclaration antérieure et les durées complètes, avec multiplicité de chaque session préservée. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `3224f875715181be556063ef63a91a6a49f74aea2d1a6dab5a5100b73d3c2a13` |
| global-budget-policy.json | `96876fa3f683bca67c8f8d314cb0b42011b48c91b02d0d1c63aa06bd9e84bb2b` |
| combined-comparison.json | `1fe05aea7a623abb381016372412f493e082cc62d4e790683e4fcb3390c78f76` |
| consolidation-review.json | `8c5c9e514088e5f04a5162e0afde0e5514bf1e9c6668982248e984499a551294` |
| global-budget-decision.json | `fc98b778492bda82934da0d5b4a4490a9dd1b8177125dcb6056bbc843e7f3149` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1573 | 438 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1563 | 437 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1573 | 439 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1564 | 433 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.48.0 dans cette fenêtre**, selon le reçu `accepted_under_user_global_rule`. Les **4 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves fonctionnelles, de contribution, de régression, de navigateur et d’intégrité séparées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de FramedWindow, de revalidation source, d’héritage ou de parité de l’appelant complet. La preuve intégrée synthétique ne vaut pas résolution d’un jeu public ni horloge de progression FramedWindow. La réserve de contribution en jeu reste distincte de l’acceptation des coûts. La règle globale ne transforme pas ce raccordement en migration globale complète.
