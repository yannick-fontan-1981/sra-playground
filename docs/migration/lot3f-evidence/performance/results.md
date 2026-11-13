# Lot 3F : résultats de coût de native 0.47.0

**Le coût est accepté selon le critère global déclaré : STCK −0,405643 %; SMLP −1,789668 %.** La [décision globale](global-budget-decision.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_user_global_rule`. Les diagnostics de phases restent **16/16**, statut `passed`, avec **0 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](consolidation-review.json) passe 231/231 contrôles.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 74 / native 0.46.0 ; commit `a6edbb838670785733155262ae95f69892a236fc` ; 260 fichiers natifs | `5adf58cb9bd0802dd083812e7591c53cb786410ad23c14a29814d870ef67276c` |
| B : candidat gelé | Native 0.47.0 ; 263 fichiers natifs ; archive de 274 fichiers | `54d8742300a04dcdf0cb1b038bc62b947d4a1c60f70da4ee80e6971b0f021165` |

La [déclaration](declaration.json) finalisée le **2026-11-10 13:48:11 UTC** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre de ReferencePopulation. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 14:07:48 UTC** au **2026-11-10 14:16:20 UTC**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC.

| Série | Version | Début UTC | Fin UTC | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.46.0 | 2026-11-10 14:07:48 UTC | 2026-11-10 14:10:00 UTC | passed |
| B1 | 0.47.0 | 2026-11-10 14:10:00 UTC | 2026-11-10 14:12:09 UTC | passed |
| B2 | 0.47.0 | 2026-11-10 14:12:09 UTC | 2026-11-10 14:14:14 UTC | passed |
| A2 | 0.46.0 | 2026-11-10 14:14:14 UTC | 2026-11-10 14:16:20 UTC | passed |

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
| STCK | 8 / 8 | 10051,919 | 10011,144 | −0,405643 % | 10,405643 | Accepté |
| SMLP | 8 / 8 | 17016,050 | 16711,519 | −1,789668 % | 11,789668 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](combined-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 10051,919 | 10011,144 | −0,405643 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 327,671 | 347,806 | +6,144879 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 9,474 | 8,981 | −5,209585 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 11,465 | 11,236 | −1,992444 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,236850 | 0,237851 | +0,422630 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 852,671 | 810,497 | −4,946098 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 174,450 | 157,830 | −9,526784 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 7,474 | 8,049 | +7,703109 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 17016,050 | 16711,519 | −1,789668 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 354,353 | 366,218 | +3,348398 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 10,426 | 9,860 | −5,433328 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 13,011 | 12,533 | −3,673810 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,358434 | 0,364073 | +1,573091 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 973,013 | 859,052 | −11,712166 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 135,425 | 136,087 | +0,488569 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 5,809 | 5,539 | −4,642440 % | `within_observed_budget` |

Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9743,205 à 11233,980 | 9683,368 à 11637,172 | indisponible / indisponible | indisponible | 14,830747 % / 19,516293 % |
| STCK | `new_decision` | 166,695 à 472,833 | 176,430 à 564,931 | 446,010 / 455,122 | +2,043088 % | 40,726118 % / 28,971348 % |
| STCK | `known_prefix_service` | 7,657 à 13,553 | 7,313 à 23,534 | 11,940 / 20,996 | +75,844832 % | 31,972229 % / 44,045346 % |
| STCK | `known_prefix_request` | 9,556 à 16,213 | 8,923 à 26,211 | 15,232 / 23,257 | +52,682126 % | 33,486845 % / 45,506462 % |
| STCK | `known_prefix_guard` | 0,094549 à 0,417457 | 0,085937 à 10,252 | 0,355195 / 0,425454 | +19,780402 % | 67,932400 % / 33,796939 % |
| STCK | `acquisition_and_persistence` | 363,762 à 4069,388 | 375,804 à 4325,076 | 3663,473 / 3748,073 | +2,309278 % | 25,767032 % / 18,507859 % |
| STCK | `persistence` | 15,208 à 407,024 | 15,947 à 427,269 | 337,535 / 323,315 | −4,212806 % | 51,906265 % / 53,416068 % |
| STCK | `restoration` | 1,829 à 76,193 | 1,886 à 73,538 | 52,372 / 52,169 | −0,386172 % | 22,790658 % / 25,157206 % |
| SMLP | `session_elapsed` | 16254,293 à 18369,661 | 16047,304 à 16847,698 | indisponible / indisponible | indisponible | 12,431601 % / 4,789473 % |
| SMLP | `new_decision` | 192,938 à 989,538 | 190,244 à 1019,366 | 830,452 / 790,569 | −4,802570 % | 37,939317 % / 32,776192 % |
| SMLP | `known_prefix_service` | 8,270 à 25,315 | 7,965 à 22,821 | 21,269 / 20,250 | −4,791116 % | 18,525634 % / 29,400989 % |
| SMLP | `known_prefix_request` | 10,205 à 28,331 | 10,002 à 25,188 | 23,964 / 23,197 | −3,201705 % | 18,843876 % / 24,591530 % |
| SMLP | `known_prefix_guard` | 0,191092 à 11,391 | 0,189169 à 10,460 | 9,204 / 9,266 | +0,663176 % | 64,301492 % / 41,564386 % |
| SMLP | `acquisition_and_persistence` | 318,910 à 3336,737 | 294,534 à 2887,584 | 2672,935 / 2708,520 | +1,331287 % | 25,949094 % / 27,146442 % |
| SMLP | `persistence` | 17,772 à 384,923 | 14,535 à 342,345 | 283,019 / 249,269 | −11,925169 % | 13,205710 % / 23,402058 % |
| SMLP | `restoration` | 1,823 à 62,093 | 1,877 à 46,006 | 27,184 / 22,511 | −17,192764 % | 28,971574 % / 49,884584 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `known_prefix_service` +75,844832 %**; **STCK `known_prefix_request` +52,682126 %**; **STCK `known_prefix_guard` +19,780402 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 10139,753 / 10213,220 | +0,724546 % | 8/8 | passed |
| 1 | A1 puis B1 | SMLP | 17597,590 / 16780,339 | −4,644108 % | 8/8 | passed |
| 2 | B2 puis A2 | STCK | 10051,919 / 10011,144 | −0,405643 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 16652,794 / 16672,175 | +0,116383 % | 7/8 | budget_review_required |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10139,753 | 10213,220 | +0,724546 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 302,731 | 331,789 | +9,598597 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 9,038 | 9,347 | +3,417737 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,978 | 11,487 | +4,641851 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,231197 | 0,244201 | +5,624424 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 870,165 | 801,528 | −7,887784 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 175,226 | 166,754 | −4,834870 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 7,474 | 7,239 | −3,134728 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 17597,590 | 16780,339 | −4,644108 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 365,248 | 370,680 | +1,486991 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 10,632 | 9,916 | −6,735596 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 13,054 | 12,644 | −3,140430 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,339296 | 0,345800 | +1,917058 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 1004,078 | 865,940 | −13,757685 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 136,261 | 131,977 | −3,144022 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 5,906 | 5,040 | −14,659249 % | `within_observed_budget` |

Aucun dépassement de médiane selon le comparateur de phases dans cet ensemble.

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9743,205 à 11095,899 | 9837,244 à 11637,172 | indisponible / indisponible | indisponible | 13,340505 % / 17,623518 % |
| STCK | `new_decision` | 174,876 à 445,804 | 182,992 à 564,931 | 435,467 / 476,349 | +9,388112 % | 15,199243 % / 28,025601 % |
| STCK | `known_prefix_service` | 7,657 à 13,553 | 7,313 à 23,534 | indisponible / indisponible | indisponible | 11,716922 % / 36,199319 % |
| STCK | `known_prefix_request` | 9,556 à 15,232 | 8,923 à 26,211 | indisponible / indisponible | indisponible | 10,597694 % / 36,336865 % |
| STCK | `known_prefix_guard` | 0,094549 à 0,353222 | 0,093207 à 10,252 | indisponible / indisponible | indisponible | 42,226206 % / 25,645228 % |
| STCK | `acquisition_and_persistence` | 363,762 à 4069,388 | 377,058 à 4325,076 | 3678,520 / 3932,112 | +6,893870 % | 15,142449 % / 18,278369 % |
| STCK | `persistence` | 15,632 à 407,024 | 18,774 à 363,404 | 339,919 / 323,315 | −4,884803 % | 28,799922 % / 49,181589 % |
| STCK | `restoration` | 1,829 à 76,193 | 1,886 à 73,439 | 55,292 / 43,720 | −20,929109 % | 21,738197 % / 16,376600 % |
| SMLP | `session_elapsed` | 17251,283 à 18369,661 | 16047,304 à 16847,698 | indisponible / indisponible | indisponible | 6,355292 % / 4,769830 % |
| SMLP | `new_decision` | 220,217 à 989,538 | 190,244 à 834,643 | 866,095 / 816,845 | −5,686389 % | 9,811284 % / 10,068957 % |
| SMLP | `known_prefix_service` | 8,714 à 25,315 | 8,074 à 19,081 | 21,269 / 18,337 | −13,788775 % | 17,979617 % / 14,259678 % |
| SMLP | `known_prefix_request` | 11,135 à 28,331 | 10,012 à 21,568 | 23,964 / 21,419 | −10,619068 % | 14,997330 % / 14,097635 % |
| SMLP | `known_prefix_guard` | 0,193396 à 11,391 | 0,194186 à 10,460 | 9,204 / 8,424 | −8,481216 % | 35,837133 % / 18,160428 % |
| SMLP | `acquisition_and_persistence` | 318,910 à 3336,737 | 335,267 à 2846,517 | 2838,951 / 2798,650 | −1,419585 % | 25,146270 % / 17,160695 % |
| SMLP | `persistence` | 17,772 à 384,923 | 14,535 à 268,818 | 310,325 / 258,426 | −16,724242 % | 11,399756 % / 10,700990 % |
| SMLP | `restoration` | 2,569 à 37,796 | 2,178 à 38,650 | 30,481 / 22,511 | −26,148018 % | 10,193010 % / 20,348393 % |

Aucune hausse de p95 calculable supérieure à +10 % dans cet ensemble ; les p95 indisponibles restent signalés.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10051,919 | 10011,144 | −0,405643 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 335,949 | 350,944 | +4,463571 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 10,039 | 8,783 | −12,509481 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 12,152 | 10,697 | −11,973817 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,257981 | 0,233114 | −9,639082 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 826,939 | 810,526 | −1,984748 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 168,026 | 141,801 | −15,607902 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 6,910 | 8,255 | +19,466359 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 4 / 4 | 16652,794 | 16672,175 | +0,116383 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 353,324 | 350,785 | −0,718612 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 10,366 | 9,754 | −5,901785 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,905 | 12,376 | −4,101566 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,399154 | 0,382055 | −4,284055 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 942,570 | 815,086 | −13,525106 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 134,581 | 139,800 | +3,878463 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 4,760 | 5,876 | +23,450648 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `restoration` +19,466359 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +23,450648 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 9783,485 à 11233,980 | 9683,368 à 10163,638 | indisponible / indisponible | indisponible | 14,430026 % / 4,797356 % |
| STCK | `new_decision` | 166,695 à 472,833 | 176,430 à 453,089 | 467,256 / 412,983 | −11,615328 % | 27,519606 % / 26,608058 % |
| STCK | `known_prefix_service` | 8,171 à 11,940 | 7,433 à 19,494 | indisponible / indisponible | indisponible | 29,687353 % / 13,445504 % |
| STCK | `known_prefix_request` | 9,819 à 16,213 | 9,200 à 21,462 | indisponible / indisponible | indisponible | 31,794549 % / 29,649934 % |
| STCK | `known_prefix_guard` | 0,099968 à 0,417457 | 0,085937 à 0,291731 | indisponible / indisponible | indisponible | 64,154839 % / 11,331862 % |
| STCK | `acquisition_and_persistence` | 391,136 à 3663,473 | 375,804 à 3748,073 | 3554,124 / 3405,126 | −4,192268 % | 25,767032 % / 12,772789 % |
| STCK | `persistence` | 15,208 à 374,710 | 15,947 à 427,269 | 326,438 / 342,608 | +4,953584 % | 54,893038 % / 23,115801 % |
| STCK | `restoration` | 2,013 à 52,372 | 2,016 à 73,538 | 43,197 / 57,564 | +33,257198 % | 4,864579 % / 16,226536 % |
| SMLP | `session_elapsed` | 16254,293 à 16780,817 | 16420,375 à 16830,555 | indisponible / indisponible | indisponible | 3,161774 % / 2,460266 % |
| SMLP | `new_decision` | 192,938 à 925,033 | 221,452 à 1019,366 | 830,452 / 790,569 | −4,802570 % | 37,696069 % / 32,640525 % |
| SMLP | `known_prefix_service` | 8,270 à 23,237 | 7,965 à 22,821 | 18,706 / 20,502 | +9,599548 % | 14,796203 % / 27,871310 % |
| SMLP | `known_prefix_request` | 10,205 à 26,730 | 10,002 à 25,188 | 21,356 / 23,686 | +10,909629 % | 12,802958 % / 23,814116 % |
| SMLP | `known_prefix_guard` | 0,191092 à 9,302 | 0,189169 à 9,674 | 0,883444 / 9,266 | +948,797207 % | 49,528776 % / 28,768126 % |
| SMLP | `acquisition_and_persistence` | 332,071 à 2654,816 | 294,534 à 2887,584 | 2564,529 / 2708,520 | +5,614720 % | 11,248018 % / 18,277159 % |
| SMLP | `persistence` | 20,431 à 347,578 | 18,522 à 342,345 | 275,121 / 247,859 | −9,909207 % | 12,464445 % / 22,809946 % |
| SMLP | `restoration` | 1,823 à 62,093 | 1,877 à 46,006 | 23,812 / 22,802 | −4,239524 % | 14,131083 % / 37,759837 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `restoration` +33,257198 %**; **SMLP `known_prefix_request` +10,909629 %**; **SMLP `known_prefix_guard` +948,797207 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 188,290 / 227,322 | +20,729694 % | 165,032 à 225,223 / 173,253 à 271,593 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 330,458 / 371,697 | +12,479304 % | 293,833 à 363,146 / 309,179 à 431,686 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 241,006 / 207,930 | −13,724217 % | 198,622 à 317,100 / 187,975 à 285,876 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 443,813 / 395,240 | −10,944444 % | 392,370 à 537,174 / 343,085 à 428,812 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 191,606 / 176,917 | −7,666334 % | 175,450 à 229,534 / 162,062 à 227,433 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 351,517 / 331,609 | −5,663673 % | 295,922 à 403,053 / 300,521 à 400,031 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 204,295 / 195,635 | −4,238915 % | 188,515 à 251,087 / 185,607 à 248,200 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 367,400 / 356,190 | −3,051221 % | 332,973 à 437,935 / 322,179 à 403,264 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,011026 / 0,011807 | +7,082937 % | 0,007341 à 0,038607 / 0,007270 à 0,098926 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1023,090 / 1045,252 | +2,166209 % | 937,780 à 1106,526 / 988,016 à 1166,648 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,021612 / 0,013416 | −37,925689 % | 0,013169 à 0,086358 / 0,010876 à 0,015183 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 801,491 / 783,368 | −2,261129 % | 711,699 à 906,301 / 687,950 à 932,474 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,010966 / 0,008478 | −22,688309 % | 0,003235 à 0,017085 / 0,002633 à 0,014731 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1595,030 / 1414,821 | −11,298154 % | 1426,122 à 1940,287 / 1328,882 à 1512,752 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,008102 / 0,006965 | −14,027401 % | 0,005198 à 0,022463 / 0,004306 à 0,018938 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 802,289 / 725,788 | −9,535424 % | 775,029 à 878,858 / 684,437 à 752,870 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,011027 / 0,022864 | +107,359543 % | 0,008062 à 0,036344 / 0,006419 à 0,047850 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1061,253 / 1080,336 | +1,798244 % | 937,592 à 1233,682 / 1049,748 à 1109,381 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,013510 / 0,014101 | +4,374537 % | 0,010826 à 0,017145 / 0,012859 à 0,015393 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 801,432 / 775,105 | −3,284992 % | 759,122 à 1171,013 / 754,967 à 839,585 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,007516 / 0,009555 | +27,122139 % | 0,003966 à 0,019640 / 0,004336 à 0,015903 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1533,546 / 1437,038 | −6,293087 % | 1453,809 à 1594,940 / 1412,189 à 1683,649 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,004887 / 0,021867 | +347,452425 % | 0,004447 à 0,021281 / 0,007781 à 0,050745 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 781,840 / 723,273 | −7,490869 % | 690,001 à 876,024 / 642,707 à 802,322 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 258,320 | 94,615 à 534,748 |
| 1 | STCK | A | `rss` | 64 | 865,184 | 558,223 à 972,012 |
| 1 | SMLP | A | `heapUsed` | 96 | 326,989 | 135,545 à 633,207 |
| 1 | SMLP | A | `rss` | 96 | 982,312 | 767,793 à 1100,023 |
| 1 | STCK | B | `heapUsed` | 64 | 270,329 | 99,944 à 525,764 |
| 1 | STCK | B | `rss` | 64 | 888,033 | 538,820 à 961,578 |
| 1 | SMLP | B | `heapUsed` | 96 | 318,506 | 114,545 à 620,519 |
| 1 | SMLP | B | `rss` | 96 | 972,170 | 762,320 à 1059,344 |
| 2 | STCK | A | `heapUsed` | 64 | 254,213 | 95,691 à 544,839 |
| 2 | STCK | A | `rss` | 64 | 860,156 | 509,359 à 952,336 |
| 2 | SMLP | A | `heapUsed` | 96 | 286,632 | 127,343 à 616,434 |
| 2 | SMLP | A | `rss` | 96 | 948,529 | 768,688 à 1060,176 |
| 2 | STCK | B | `heapUsed` | 64 | 255,583 | 102,158 à 507,746 |
| 2 | STCK | B | `rss` | 64 | 861,223 | 516,203 à 961,926 |
| 2 | SMLP | B | `heapUsed` | 96 | 281,013 | 100,794 à 511,054 |
| 2 | SMLP | B | `rss` | 96 | 932,457 | 788,508 à 994,805 |

## Calculs, empreintes et transport

La [revue de consolidation](consolidation-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](global-budget-decision.json) vérifie ensuite la déclaration antérieure et les durées complètes, avec multiplicité de chaque session préservée. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `84200cc1bdae6bb378924df5994b8cfd4baf63c0dd302a123653027837b0becf` |
| global-budget-policy.json | `89fced9e1b7c83f0071ddfd6335c54797e62a99585230aa9c65133f8856febb9` |
| combined-comparison.json | `32bcceb895b4a4678c7f19733e888a27f817957651c143aeadd20b5e0ce24ab7` |
| consolidation-review.json | `185c32ae0eeeb906489534aa38ed6f9cb37b2a5e0bf6ffb527501696fd7da3e4` |
| global-budget-decision.json | `a4b5da6d18acb8fc8ce61e388d5b518cc50d79cc7bc6d2ebf5f03b737129570e` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1569 | 439 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1559 | 436 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1560 | 432 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1550 | 429 |

Le premier contrôle statique adapté a rencontré un défaut de chemin de sortie avant d’écrire son reçu. L’[incident conservé](../diagnostic/static-preflight-generation-incident.json) distingue cette erreur de préparation des mesures officielles. Le contrôle corrigé est lié au reçu statique cité plus haut.

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.47.0 dans cette fenêtre**, selon le reçu `accepted_under_user_global_rule`. Les **0 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves fonctionnelles, de contribution, de régression, de navigateur et d’intégrité séparées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de ReferencePopulation, de revalidation source, d’héritage ou de parité de l’appelant complet. La règle globale ne transforme pas le raccordement des six branches en migration globale complète.
