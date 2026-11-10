# Lot 3I — RecurrentSeries : résultats de coût de native 0.50.0

**Le coût est accepté selon le critère global déclaré : STCK −1,421099 %; SMLP +2,192594 %.** La [décision globale](global-budget-decision.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_user_global_rule`. Les diagnostics de phases restent **16/16**, statut `passed`, avec **0 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](consolidation-review.json) passe 231/231 contrôles.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 78 / native 0.49.0 ; commit `8fa6b261b8b23ac8d232e60c9c179e2f3407d82f` ; 268 fichiers natifs | `d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054` |
| B : candidat gelé | Native 0.50.0 ; 270 fichiers natifs ; archive de 281 fichiers | `e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87` |

La [déclaration](declaration.json) finalisée le **2026-11-10 14:51:24 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre de RecurrentSeries. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 15:45:33 UTC−03** au **2026-11-10 15:54:44 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.49.0 | 2026-11-10 15:45:34 UTC−03 | 2026-11-10 15:47:59 UTC−03 | passed |
| B1 | 0.50.0 | 2026-11-10 15:47:59 UTC−03 | 2026-11-10 15:50:10 UTC−03 | passed |
| B2 | 0.50.0 | 2026-11-10 15:50:10 UTC−03 | 2026-11-10 15:52:34 UTC−03 | passed |
| A2 | 0.49.0 | 2026-11-10 15:52:34 UTC−03 | 2026-11-10 15:54:44 UTC−03 | passed |

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
| STCK | 8 / 8 | 11041,932 | 10885,016 | −1,421099 % | 11,421099 | Accepté |
| SMLP | 8 / 8 | 17831,742 | 18222,719 | +2,192594 % | 7,807406 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](combined-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 11041,932 | 10885,016 | −1,421099 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 324,230 | 315,635 | −2,650840 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 9,531 | 9,294 | −2,484787 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 11,790 | 11,151 | −5,422487 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,250050 | 0,243510 | −2,615282 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 940,571 | 898,962 | −4,423776 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 178,442 | 180,756 | +1,296731 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 7,626 | 7,676 | +0,661738 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 17831,742 | 18222,719 | +2,192594 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 414,019 | 425,073 | +2,669814 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 11,964 | 10,672 | −10,802532 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 14,897 | 13,011 | −12,664938 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,403371 | 0,403250 | −0,029873 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 919,258 | 983,233 | +6,959420 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 141,367 | 140,265 | −0,779385 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 6,087 | 6,044 | −0,696227 % | `within_observed_budget` |

Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9972,155 à 12208,804 | 9693,860 à 13178,721 | indisponible / indisponible | indisponible | 20,255951 % / 32,015211 % |
| STCK | `new_decision` | 167,734 à 612,171 | 189,715 à 668,005 | 495,146 / 539,426 | +8,942846 % | 23,464697 % / 32,690353 % |
| STCK | `known_prefix_service` | 7,569 à 23,760 | 7,594 à 21,154 | 22,715 / 17,696 | −22,094818 % | 44,098432 % / 42,116511 % |
| STCK | `known_prefix_request` | 9,223 à 26,133 | 9,242 à 23,229 | 24,889 / 19,675 | −20,949337 % | 46,822021 % / 55,065784 % |
| STCK | `known_prefix_guard` | 0,082432 à 0,386882 | 0,082272 à 7,528 | 0,384598 / 1,173 | +204,948804 % | 43,598091 % / 85,843677 % |
| STCK | `acquisition_and_persistence` | 369,743 à 4313,189 | 399,736 à 4755,318 | 3992,574 / 4200,402 | +5,205378 % | 34,185613 % / 27,036784 % |
| STCK | `persistence` | 13,625 à 413,254 | 13,853 à 520,068 | 348,461 / 385,246 | +10,556619 % | 35,499862 % / 44,640112 % |
| STCK | `restoration` | 1,786 à 65,127 | 1,809 à 114,354 | 50,753 / 66,684 | +31,388401 % | 33,719010 % / 52,258956 % |
| SMLP | `session_elapsed` | 16631,628 à 20804,436 | 16420,387 à 20399,454 | indisponible / indisponible | indisponible | 23,401010 % / 21,835746 % |
| SMLP | `new_decision` | 199,004 à 1041,178 | 209,028 à 1154,339 | 958,997 / 931,711 | −2,845203 % | 44,418007 % / 33,416917 % |
| SMLP | `known_prefix_service` | 7,827 à 33,149 | 8,059 à 19,869 | 23,930 / 18,641 | −22,102932 % | 61,625640 % / 26,754141 % |
| SMLP | `known_prefix_request` | 9,875 à 36,269 | 10,182 à 22,642 | 27,232 / 20,810 | −23,580479 % | 50,782859 % / 26,153574 % |
| SMLP | `known_prefix_guard` | 0,190041 à 11,196 | 0,189720 à 8,907 | 8,927 / 0,769066 | −91,385065 % | 31,435809 % / 22,499354 % |
| SMLP | `acquisition_and_persistence` | 343,047 à 3276,121 | 288,448 à 3099,575 | 2883,479 / 2887,683 | +0,145794 % | 25,763051 % / 27,483734 % |
| SMLP | `persistence` | 19,797 à 344,447 | 18,637 à 409,322 | 286,631 / 263,661 | −8,013615 % | 22,407816 % / 32,115388 % |
| SMLP | `restoration` | 2,197 à 56,302 | 1,916 à 50,208 | 24,417 / 25,650 | +5,050771 % | 40,631180 % / 26,449340 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `known_prefix_guard` +204,948804 %**; **STCK `persistence` +10,556619 %**; **STCK `restoration` +31,388401 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 11590,122 / 10467,697 | −9,684327 % | 8/8 | passed |
| 1 | A1 puis B1 | SMLP | 18761,526 / 16681,236 | −11,088063 % | 8/8 | passed |
| 2 | B2 puis A2 | STCK | 10509,091 / 11715,552 | +11,480161 % | 4/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 16971,156 / 18469,470 | +8,828589 % | 5/8 | budget_review_required |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11590,122 | 10467,697 | −9,684327 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 329,631 | 311,762 | −5,420971 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 11,688 | 8,960 | −23,341177 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 13,945 | 10,859 | −22,134038 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,277139 | 0,236213 | −14,767139 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 979,353 | 866,931 | −11,479177 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 192,073 | 157,423 | −18,039726 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 7,383 | 7,689 | +4,144765 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 18761,526 | 16681,236 | −11,088063 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 431,734 | 390,677 | −9,509668 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 13,548 | 10,136 | −25,186929 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 17,058 | 12,532 | −26,530544 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,443054 | 0,393832 | −11,109807 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 963,770 | 983,233 | +2,019448 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 149,486 | 131,027 | −12,348301 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 6,208 | 5,913 | −4,758938 % | `within_observed_budget` |

Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 11013,168 à 12208,804 | 9693,860 à 11243,434 | indisponible / indisponible | indisponible | 10,315985 % / 14,803391 % |
| STCK | `new_decision` | 218,296 à 610,558 | 189,715 à 462,858 | 495,146 / 460,279 | −7,041811 % | 11,484777 % / 10,444784 % |
| STCK | `known_prefix_service` | 8,184 à 23,760 | 7,594 à 21,154 | indisponible / indisponible | indisponible | 21,155348 % / 19,625039 % |
| STCK | `known_prefix_request` | 9,870 à 26,133 | 9,242 à 23,229 | indisponible / indisponible | indisponible | 23,421767 % / 18,793069 % |
| STCK | `known_prefix_guard` | 0,089252 à 0,386882 | 0,082272 à 7,528 | indisponible / indisponible | indisponible | 20,648160 % / 52,013364 % |
| STCK | `acquisition_and_persistence` | 468,162 à 4313,189 | 399,736 à 4200,402 | 4157,845 / 3913,830 | −5,868785 % | 20,214990 % / 10,912464 % |
| STCK | `persistence` | 13,625 à 413,254 | 13,853 à 385,246 | 332,741 / 339,535 | +2,041739 % | 17,863463 % / 48,817038 % |
| STCK | `restoration` | 1,786 à 57,936 | 1,809 à 66,684 | 49,546 / 54,822 | +10,649962 % | 31,023501 % / 25,899644 % |
| SMLP | `session_elapsed` | 18025,631 à 20804,436 | 16420,387 à 18703,041 | indisponible / indisponible | indisponible | 14,811189 % / 13,683959 % |
| SMLP | `new_decision` | 207,010 à 1041,178 | 209,028 à 1010,610 | 1006,464 / 890,918 | −11,480461 % | 28,525855 % / 27,398745 % |
| SMLP | `known_prefix_service` | 9,179 à 33,149 | 8,314 à 15,375 | 26,950 / 13,571 | −49,644032 % | 39,072566 % / 14,560504 % |
| SMLP | `known_prefix_request` | 11,464 à 36,269 | 10,815 à 17,458 | 29,841 / 16,569 | −44,477781 % | 26,040366 % / 14,643863 % |
| SMLP | `known_prefix_guard` | 0,245363 à 11,196 | 0,195418 à 6,570 | 10,866 / 0,769066 | −92,922213 % | 29,183810 % / 23,082379 % |
| SMLP | `acquisition_and_persistence` | 347,650 à 3276,121 | 288,448 à 2887,683 | 3032,241 / 2740,361 | −9,625870 % | 24,235403 % / 27,483734 % |
| SMLP | `persistence` | 19,797 à 324,854 | 18,637 à 409,322 | 276,365 / 262,521 | −5,009441 % | 20,277142 % / 28,235789 % |
| SMLP | `restoration` | 2,633 à 41,089 | 1,916 à 50,208 | 22,509 / 27,408 | +21,762398 % | 30,793581 % / 23,993903 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `restoration` +10,649962 %**; **SMLP `restoration` +21,762398 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10509,091 | 11715,552 | +11,480161 % | `over_budget_with_noise_unresolved` |
| STCK | `new_decision` | 24 / 24 | 303,228 | 367,317 | +21,135581 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 16 / 16 | 8,434 | 10,737 | +27,304876 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_request` | 16 / 16 | 10,286 | 12,805 | +24,492479 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,235853 | 0,254236 | +7,793821 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 893,261 | 947,366 | +6,057061 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 173,804 | 189,725 | +9,160415 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 7,659 | 7,676 | +0,222086 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16971,156 | 18469,470 | +8,828589 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 388,883 | 428,671 | +10,231295 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_service` | 24 / 24 | 10,960 | 12,080 | +10,225871 % | `over_budget_with_noise_unresolved` |
| SMLP | `known_prefix_request` | 24 / 24 | 13,772 | 14,667 | +6,495916 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,393026 | 0,410026 | +4,325546 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 879,697 | 978,005 | +11,175208 % | `over_budget_with_noise_unresolved` |
| SMLP | `persistence` | 76 / 76 | 132,677 | 144,908 | +9,218963 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 6,087 | 6,644 | +9,157231 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `session_elapsed` +11,480161 %** (`over_budget_with_noise_unresolved`); **STCK `new_decision` +21,135581 %** (`over_budget_with_noise_unresolved`); **STCK `known_prefix_service` +27,304876 %** (`over_budget_with_noise_unresolved`); **STCK `known_prefix_request` +24,492479 %** (`over_budget_with_noise_unresolved`); **SMLP `new_decision` +10,231295 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_service` +10,225871 %** (`over_budget_with_noise_unresolved`); **SMLP `acquisition_and_persistence` +11,175208 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9972,155 à 11070,696 | 10741,543 à 13178,721 | indisponible / indisponible | indisponible | 10,453247 % / 20,802925 % |
| STCK | `new_decision` | 167,734 à 612,171 | 208,484 à 668,005 | 463,126 / 540,967 | +16,807736 % | 22,048186 % / 21,085167 % |
| STCK | `known_prefix_service` | 7,569 à 17,427 | 8,244 à 14,681 | indisponible / indisponible | indisponible | 12,153773 % / 31,812171 % |
| STCK | `known_prefix_request` | 9,223 à 19,312 | 9,962 à 17,202 | indisponible / indisponible | indisponible | 13,611939 % / 43,665291 % |
| STCK | `known_prefix_guard` | 0,082432 à 0,353492 | 0,089693 à 1,173 | indisponible / indisponible | indisponible | 19,812540 % / 64,746403 % |
| STCK | `acquisition_and_persistence` | 369,743 à 3861,295 | 457,874 à 4755,318 | 3819,837 / 4638,017 | +21,419243 % | 25,946872 % / 16,660214 % |
| STCK | `persistence` | 16,448 à 383,367 | 18,883 à 520,068 | 349,013 / 442,209 | +26,702677 % | 25,918662 % / 5,572751 % |
| STCK | `restoration` | 2,100 à 65,127 | 2,451 à 114,354 | 50,753 / 69,580 | +37,093518 % | 24,535781 % / 42,081229 % |
| SMLP | `session_elapsed` | 16631,628 à 17637,853 | 18065,193 à 20399,454 | indisponible / indisponible | indisponible | 5,929027 % / 12,638487 % |
| SMLP | `new_decision` | 199,004 à 991,744 | 254,230 à 1154,339 | 851,783 / 979,239 | +14,963396 % | 24,022941 % / 12,845826 % |
| SMLP | `known_prefix_service` | 7,827 à 23,164 | 8,059 à 19,869 | 19,469 / 18,791 | −3,484068 % | 21,934722 % / 20,046291 % |
| SMLP | `known_prefix_request` | 9,875 à 26,331 | 10,182 à 22,642 | 22,127 / 21,260 | −3,918819 % | 21,566284 % / 20,749281 % |
| SMLP | `known_prefix_guard` | 0,190041 à 7,691 | 0,189720 à 8,907 | 0,543622 / 0,756247 | +39,112655 % | 22,194773 % / 8,008352 % |
| SMLP | `acquisition_and_persistence` | 343,047 à 2883,479 | 362,528 à 3099,575 | 2724,463 / 2922,438 | +7,266586 % | 6,242419 % / 14,180026 % |
| SMLP | `persistence` | 21,848 à 344,447 | 22,170 à 302,387 | 287,729 / 280,388 | −2,551292 % | 6,028754 % / 19,385452 % |
| SMLP | `restoration` | 2,197 à 56,302 | 1,974 à 45,217 | 28,376 / 24,123 | −14,988766 % | 37,275264 % / 7,153492 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `new_decision` +16,807736 %**; **STCK `acquisition_and_persistence` +21,419243 %**; **STCK `persistence` +26,702677 %**; **STCK `restoration` +37,093518 %**; **SMLP `new_decision` +14,963396 %**; **SMLP `known_prefix_guard` +39,112655 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 250,526 / 195,700 | −21,884435 % | 187,375 à 303,082 / 162,155 à 244,443 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 407,722 / 361,230 | −11,402907 % | 324,324 à 496,482 / 297,020 à 422,748 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 258,374 / 243,662 | −5,693955 % | 209,504 à 331,704 / 179,587 à 301,108 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 425,885 / 406,549 | −4,540039 % | 375,864 à 562,025 / 345,814 à 481,519 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 206,559 / 212,378 | +2,817050 % | 179,373 à 253,335 / 179,630 à 262,622 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 351,528 / 383,563 | +9,113155 % | 304,216 à 432,728 / 331,810 à 470,207 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 248,962 / 245,448 | −1,411393 % | 196,047 à 285,594 / 182,671 à 291,427 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 403,028 / 422,775 | +4,899668 % | 354,549 à 491,003 / 328,659 à 495,901 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,007466 / 0,014091 | +88,735601 % | 0,007080 à 0,043645 / 0,011346 à 0,041331 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1063,354 / 1051,326 | −1,131110 % | 1001,781 à 1209,124 / 895,092 à 1117,836 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,015769 / 0,016374 | +3,839934 % | 0,010616 à 0,022183 / 0,012048 à 0,111695 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 871,307 / 823,281 | −5,512032 % | 796,451 à 1040,662 / 730,612 à 910,452 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,010601 / 0,009670 | −8,786907 % | 0,006980 à 0,014792 / 0,005097 à 0,020019 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1731,554 / 1518,164 | −12,323633 % | 1647,877 à 2040,724 / 1421,683 à 1782,394 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,007561 / 0,005368 | −29,004100 % | 0,005208 à 0,019159 / 0,003896 à 0,025788 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 817,029 / 692,765 | −15,209269 % | 727,845 à 861,510 / 619,360 à 808,490 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,010115 / 0,012112 | +19,753819 % | 0,006760 à 0,039999 / 0,009694 à 0,051136 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1029,044 / 1227,240 | +19,260258 % | 913,586 à 1134,345 / 1080,259 à 1479,124 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,016499 / 0,016935 | +2,642584 % | 0,009955 à 0,019749 / 0,011417 à 0,025979 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 900,263 / 893,224 | −0,781797 % | 753,673 à 1084,075 / 799,879 à 1115,614 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,023985 / 0,011868 | −50,522190 % | 0,004246 à 0,163661 / 0,003605 à 0,027611 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1505,083 / 1688,108 | +12,160469 % | 1480,937 à 1691,898 / 1565,812 à 1908,917 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,004822 / 0,024145 | +400,736209 % | 0,004226 à 0,024066 / 0,006780 à 0,225053 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 722,013 / 796,043 | +10,253291 % | 676,261 à 766,979 / 764,105 à 859,955 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 278,474 | 114,116 à 519,976 |
| 1 | STCK | A | `rss` | 64 | 884,184 | 529,840 à 974,051 |
| 1 | SMLP | A | `heapUsed` | 96 | 301,482 | 92,433 à 617,955 |
| 1 | SMLP | A | `rss` | 96 | 973,494 | 754,754 à 1083,766 |
| 1 | STCK | B | `heapUsed` | 64 | 284,098 | 114,966 à 520,175 |
| 1 | STCK | B | `rss` | 64 | 869,625 | 530,562 à 953,363 |
| 1 | SMLP | B | `heapUsed` | 96 | 306,087 | 110,933 à 684,478 |
| 1 | SMLP | B | `rss` | 96 | 993,346 | 779,293 à 1099,188 |
| 2 | STCK | A | `heapUsed` | 64 | 227,889 | 101,508 à 508,150 |
| 2 | STCK | A | `rss` | 64 | 862,215 | 526,480 à 968,109 |
| 2 | SMLP | A | `heapUsed` | 96 | 274,238 | 127,245 à 626,769 |
| 2 | SMLP | A | `rss` | 96 | 969,777 | 753,352 à 1071,500 |
| 2 | STCK | B | `heapUsed` | 64 | 278,052 | 90,971 à 516,921 |
| 2 | STCK | B | `rss` | 64 | 870,004 | 517,367 à 939,477 |
| 2 | SMLP | B | `heapUsed` | 96 | 292,532 | 123,938 à 612,834 |
| 2 | SMLP | B | `rss` | 96 | 995,518 | 798,875 à 1056,445 |

## Calculs, empreintes et transport

La [revue de consolidation](consolidation-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](global-budget-decision.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `f36a111701e6f2c795b391e6ff851ece136c218c8b3ff008ee20580b4b010492` |
| global-budget-policy.json | `73cb36faac8bd0e49c83ccb808dc9bc71d13fad2607a917c0f886199d336e89e` |
| combined-comparison.json | `0d5065aff49037be99535c1ba390ca7f680f547993bb470ca575cc1b99099f56` |
| consolidation-review.json | `ed867f0a395f1de8c633c3e1cab0836bf1aaf5a181d315944081846055ee04fd` |
| global-budget-decision.json | `c4e8a58041581e8c4ee26dc9a09508ece031442d8d99591a641695bfec423dec` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1576 | 442 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1567 | 439 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1546 | 430 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1582 | 444 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.50.0 dans cette fenêtre**, selon le reçu `accepted_under_user_global_rule`. Les **0 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves fonctionnelles, de contribution, de régression, de navigateur et d’intégrité séparées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de RecurrentSeries, de revalidation source, d’héritage ou de parité de l’appelant complet. La preuve intégrée synthétique et le résultat effectif de CONN, avec son horloge cumulée, sont consignés dans leurs reçus propres liés par la readiness. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
