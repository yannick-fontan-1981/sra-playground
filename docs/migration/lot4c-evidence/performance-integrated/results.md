# Lot 4C : résultats de coût de native 0.57.0

**Le coût est accepté selon le critère global déclaré : STCK −1,833520 %; SMLP −0,156096 %.** La [décision globale](owner-growth-review.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_predeclared_owner_cost_rule`. Les diagnostics de phases restent **15/16**, statut `budget_review_required`, avec **1 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](owner-growth-review.json) passe 7630/7630 contrôles.

## Qualification structurelle et refus historique

**Le contrôle historique d’identité intégrale du travail a échoué.** Son [refus conservé](aggregation-failure.json) reste distinct de cette analyse complémentaire. Le [contrat](owner-growth-contract.json) et la [fixture fonctionnelle](owner-structural-fixture.json) ont été figés avant toute mesure. Les captures fonctionnelles attribuent les nouveaux nœuds FacetExamples ; chaque session de coût est comparée aux valeurs publiques exactes de sa forme pré-déclarée. Les feuilles privées des sessions mesurées ne sont pas exposées par leurs seuls compteurs. Tous les autres champs de travail restent strictement comparés, et les signatures complètes restent identiques au sein de chaque version. Aucune durée ni observation défavorable n’est corrigée ou retirée pour compenser les nœuds supplémentaires.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 91 / native 0.56.0 ; commit `5659ddc9420c7624df4865f0afc628782296a186` ; 294 fichiers natifs | `be11e761de3c0f3c7d50d10da47be9e0d7b4fc9c5b7d5002cc9272ffce85645a` |
| B : candidat gelé | Native 0.57.0 ; 298 fichiers natifs ; archive de 309 fichiers | `eebd099808672be934389020c8f9061df4fdacab28cd7d60c00cd1b080464c04` |

La [déclaration](declaration.json) finalisée le **2026-11-10 22:02:46 UTC-03:00** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre des exemples de faces. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 22:11:49 UTC-03:00** au **2026-11-10 22:20:32 UTC-03:00**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC-03:00.

| Série | Version | Début UTC-03:00 | Fin UTC-03:00 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.56.0 | 2026-11-10 22:11:49 UTC-03:00 | 2026-11-10 22:14:03 UTC-03:00 | passed |
| B1 | 0.57.0 | 2026-11-10 22:14:03 UTC-03:00 | 2026-11-10 22:16:12 UTC-03:00 | passed |
| B2 | 0.57.0 | 2026-11-10 22:16:12 UTC-03:00 | 2026-11-10 22:18:23 UTC-03:00 | passed |
| A2 | 0.56.0 | 2026-11-10 22:18:23 UTC-03:00 | 2026-11-10 22:20:32 UTC-03:00 | passed |

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
| Revue statique | 65/65 |

Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles. Le [reçu d’isolation](coordinated-isolation-completion.json) lie les signaux observés avant et après ainsi que la fenêtre tenue sous le verrou commun ; le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.

## Critère global par jeu

Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; seul l’affichage est arrondi.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Écart au seuil, points | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 11253,251 | 11046,921 | −1,833520 % | 11,833520 | Accepté |
| SMLP | 8 / 8 | 16297,510 | 16272,070 | −0,156096 % | 10,156096 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](owner-growth-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 11253,251 | 11046,921 | −1,833520 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 335,845 | 342,926 | +2,108535 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 8,793 | 8,731 | −0,711883 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 10,627 | 10,510 | −1,104222 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,234291 | 0,199149 | −14,999296 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 889,447 | 874,232 | −1,710571 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 206,839 | 201,965 | −2,356295 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 17,730 | 18,994 | +7,127829 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 16297,510 | 16272,070 | −0,156096 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 390,931 | 383,367 | −1,934959 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 9,325 | 9,857 | +5,711225 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 11,671 | 12,214 | +4,647371 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,356766 | 0,346587 | −2,853407 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 814,303 | 799,314 | −1,840720 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 154,158 | 150,135 | −2,609888 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 8,021 | 10,032 | +25,066387 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `restoration` +25,066387 %** (`over_budget_with_noise_unresolved`).

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10656,169 à 12751,127 | 10619,395 à 11936,895 | indisponible / indisponible | indisponible | 18,616466 % / 11,926400 % |
| STCK | `new_decision` | 233,099 à 800,834 | 229,835 à 755,281 | 664,128 / 679,989 | +2,388261 % | 34,138639 % / 20,665812 % |
| STCK | `known_prefix_service` | 7,280 à 18,846 | 7,326 à 16,995 | 17,782 / 13,367 | −24,826864 % | 56,370458 % / 30,419936 % |
| STCK | `known_prefix_request` | 8,890 à 20,607 | 9,203 à 18,748 | 20,450 / 15,950 | −22,004284 % | 52,264722 % / 29,598657 % |
| STCK | `known_prefix_guard` | 0,074850 à 2,025 | 0,082622 à 3,533 | 0,607668 / 0,637081 | +4,840308 % | 102,843146 % / 72,608542 % |
| STCK | `acquisition_and_persistence` | 472,292 à 4664,630 | 423,903 à 4348,336 | 3871,397 / 3755,404 | −2,996160 % | 10,694099 % / 18,162311 % |
| STCK | `persistence` | 14,351 à 667,668 | 15,101 à 607,565 | 534,251 / 479,558 | −10,237357 % | 33,749850 % / 14,685417 % |
| STCK | `restoration` | 2,116 à 185,777 | 2,257 à 188,151 | 150,927 / 171,874 | +13,878385 % | 31,227401 % / 21,899985 % |
| SMLP | `session_elapsed` | 16119,799 à 17215,359 | 15600,543 à 17707,512 | indisponible / indisponible | indisponible | 6,722255 % / 12,948376 % |
| SMLP | `new_decision` | 246,072 à 862,640 | 227,780 à 849,647 | 767,707 / 821,838 | +7,051031 % | 16,321286 % / 15,424458 % |
| SMLP | `known_prefix_service` | 7,918 à 16,113 | 7,699 à 14,133 | 12,841 / 13,267 | +3,316090 % | 19,260576 % / 25,266886 % |
| SMLP | `known_prefix_request` | 9,856 à 18,522 | 9,582 à 16,598 | 15,675 / 15,832 | +0,999404 % | 17,839740 % / 20,689726 % |
| SMLP | `known_prefix_guard` | 0,194096 à 0,801394 | 0,192204 à 0,616321 | 0,604343 / 0,565555 | −6,418210 % | 25,343471 % / 45,511670 % |
| SMLP | `acquisition_and_persistence` | 393,280 à 2852,266 | 380,794 à 3200,076 | 2579,988 / 2388,635 | −7,416798 % | 22,479927 % / 25,689546 % |
| SMLP | `persistence` | 12,543 à 288,248 | 12,488 à 544,696 | 253,264 / 238,601 | −5,789833 % | 18,411543 % / 22,299366 % |
| SMLP | `restoration` | 2,273 à 81,459 | 2,152 à 93,933 | 61,058 / 56,300 | −7,792770 % | 24,741703 % / 43,048233 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `restoration` +13,878385 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 11394,980 / 11075,498 | −2,803715 % | 7/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 16280,912 / 16214,259 | −0,409394 % | 8/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 10971,780 / 11046,921 | +0,684852 % | 8/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 16297,510 / 16486,934 | +1,162292 % | 7/8 | budget_review_required |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC-03:00 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 12751,127166 | 2026-11-10 22:11:55 UTC-03:00 |
| A1 | STCK | 2 | 10 | 2 | 11519,446605 | 2026-11-10 22:12:10 UTC-03:00 |
| A1 | STCK | 3 | 10 | 2 | 11270,513985 | 2026-11-10 22:12:22 UTC-03:00 |
| A1 | STCK | 4 | 10 | 2 | 10807,437932 | 2026-11-10 22:12:35 UTC-03:00 |
| A1 | SMLP | 1 | 15 | 3 | 16406,742710 | 2026-11-10 22:12:52 UTC-03:00 |
| A1 | SMLP | 2 | 15 | 3 | 16155,081708 | 2026-11-10 22:13:09 UTC-03:00 |
| A1 | SMLP | 3 | 15 | 3 | 17215,359162 | 2026-11-10 22:13:27 UTC-03:00 |
| A1 | SMLP | 4 | 15 | 3 | 16119,798997 | 2026-11-10 22:13:45 UTC-03:00 |
| B1 | STCK | 1 | 10 | 2 | 11462,721594 | 2026-11-10 22:14:08 UTC-03:00 |
| B1 | STCK | 2 | 10 | 2 | 10688,273451 | 2026-11-10 22:14:20 UTC-03:00 |
| B1 | STCK | 3 | 10 | 2 | 11936,894820 | 2026-11-10 22:14:32 UTC-03:00 |
| B1 | STCK | 4 | 10 | 2 | 10652,259328 | 2026-11-10 22:14:45 UTC-03:00 |
| B1 | SMLP | 1 | 15 | 3 | 16463,416422 | 2026-11-10 22:15:02 UTC-03:00 |
| B1 | SMLP | 2 | 15 | 3 | 16665,802546 | 2026-11-10 22:15:20 UTC-03:00 |
| B1 | SMLP | 3 | 15 | 3 | 15965,101798 | 2026-11-10 22:15:38 UTC-03:00 |
| B1 | SMLP | 4 | 15 | 3 | 15600,543333 | 2026-11-10 22:15:55 UTC-03:00 |
| B2 | STCK | 1 | 10 | 2 | 10619,394887 | 2026-11-10 22:16:17 UTC-03:00 |
| B2 | STCK | 2 | 10 | 2 | 11107,219628 | 2026-11-10 22:16:29 UTC-03:00 |
| B2 | STCK | 3 | 10 | 2 | 11892,620217 | 2026-11-10 22:16:41 UTC-03:00 |
| B2 | STCK | 4 | 10 | 2 | 10986,622037 | 2026-11-10 22:16:54 UTC-03:00 |
| B2 | SMLP | 1 | 15 | 3 | 16080,723640 | 2026-11-10 22:17:11 UTC-03:00 |
| B2 | SMLP | 2 | 15 | 3 | 15781,000982 | 2026-11-10 22:17:28 UTC-03:00 |
| B2 | SMLP | 3 | 15 | 3 | 17707,512127 | 2026-11-10 22:17:45 UTC-03:00 |
| B2 | SMLP | 4 | 15 | 3 | 16893,145306 | 2026-11-10 22:18:04 UTC-03:00 |
| A2 | STCK | 1 | 10 | 2 | 11360,108246 | 2026-11-10 22:18:28 UTC-03:00 |
| A2 | STCK | 2 | 10 | 2 | 10656,169470 | 2026-11-10 22:18:41 UTC-03:00 |
| A2 | STCK | 3 | 10 | 2 | 10707,571892 | 2026-11-10 22:18:53 UTC-03:00 |
| A2 | STCK | 4 | 10 | 2 | 11235,988885 | 2026-11-10 22:19:05 UTC-03:00 |
| A2 | SMLP | 1 | 15 | 3 | 16544,791398 | 2026-11-10 22:19:22 UTC-03:00 |
| A2 | SMLP | 2 | 15 | 3 | 16374,374027 | 2026-11-10 22:19:40 UTC-03:00 |
| A2 | SMLP | 3 | 15 | 3 | 16172,631870 | 2026-11-10 22:19:57 UTC-03:00 |
| A2 | SMLP | 4 | 15 | 3 | 16220,645499 | 2026-11-10 22:20:15 UTC-03:00 |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11394,980 | 11075,498 | −2,803715 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 329,000 | 364,474 | +10,782328 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 16 / 16 | 8,648 | 8,660 | +0,133284 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,483 | 10,676 | +1,840431 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,234291 | 0,199149 | −14,999296 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 870,739 | 936,274 | +7,526336 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 213,033 | 214,239 | +0,566367 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 17,730 | 17,324 | −2,292262 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16280,912 | 16214,259 | −0,409394 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 387,595 | 376,830 | −2,777456 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,431 | 9,955 | +5,558620 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,738 | 12,187 | +3,824120 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,356766 | 0,347303 | −2,652575 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 819,793 | 755,673 | −7,821459 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 159,049 | 147,838 | −7,048913 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 8,021 | 7,831 | −2,367897 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `new_decision` +10,782328 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10807,438 à 12751,127 | 10652,259 à 11936,895 | indisponible / indisponible | indisponible | 17,057416 % / 11,598896 % |
| STCK | `new_decision` | 233,099 à 800,834 | 229,835 à 693,407 | 664,128 / 630,691 | −5,034754 % | 36,551054 % / 12,061499 % |
| STCK | `known_prefix_service` | 7,909 à 17,782 | 7,326 à 13,367 | indisponible / indisponible | indisponible | 57,949809 % / 29,471936 % |
| STCK | `known_prefix_request` | 9,426 à 20,450 | 9,203 à 15,950 | indisponible / indisponible | indisponible | 53,260569 % / 28,108785 % |
| STCK | `known_prefix_guard` | 0,074850 à 0,607668 | 0,082802 à 0,637081 | indisponible / indisponible | indisponible | 100,353926 % / 72,087379 % |
| STCK | `acquisition_and_persistence` | 472,292 à 4664,630 | 423,903 à 4143,017 | 3871,397 / 3742,128 | −3,339070 % | 8,908433 % / 15,516618 % |
| STCK | `persistence` | 14,351 à 667,668 | 15,101 à 584,013 | 571,147 / 500,869 | −12,304716 % | 27,673003 % / 13,887771 % |
| STCK | `restoration` | 2,116 à 185,777 | 2,464 à 183,986 | 151,479 / 157,976 | +4,288582 % | 16,977322 % / 21,393052 % |
| SMLP | `session_elapsed` | 16119,799 à 17215,359 | 15600,543 à 16665,803 | indisponible / indisponible | indisponible | 6,729108 % / 6,569891 % |
| SMLP | `new_decision` | 246,072 à 789,681 | 227,780 à 835,076 | 767,707 / 821,838 | +7,051031 % | 10,896490 % / 13,690185 % |
| SMLP | `known_prefix_service` | 7,949 à 16,113 | 7,699 à 14,133 | 12,841 / 13,357 | +4,018389 % | 15,078596 % / 21,427981 % |
| SMLP | `known_prefix_request` | 9,942 à 18,522 | 9,582 à 16,598 | 15,675 / 16,118 | +2,827563 % | 13,915951 % / 17,870534 % |
| SMLP | `known_prefix_guard` | 0,194096 à 0,801394 | 0,192204 à 0,616321 | 0,604343 / 0,574719 | −4,901852 % | 9,902047 % / 40,437505 % |
| SMLP | `acquisition_and_persistence` | 418,587 à 2656,186 | 389,531 à 3200,076 | 2524,354 / 2432,860 | −3,624469 % | 18,894528 % / 15,548870 % |
| SMLP | `persistence` | 12,543 à 288,248 | 13,288 à 544,696 | 257,668 / 239,987 | −6,861780 % | 14,233278 % / 6,732858 % |
| SMLP | `restoration` | 2,290 à 81,459 | 2,152 à 93,933 | 61,412 / 56,380 | −8,193848 % | 21,331562 % / 27,407677 % |

Aucune hausse de p95 calculable supérieure à +10 % dans cet ensemble ; les p95 indisponibles restent signalés.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10971,780 | 11046,921 | +0,684852 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 339,363 | 316,772 | −6,657036 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 9,069 | 8,731 | −3,733481 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,671 | 10,505 | −1,553589 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,224197 | 0,205558 | −8,313243 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 907,281 | 866,925 | −4,447967 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 200,864 | 196,943 | −1,952281 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 18,583 | 20,032 | +7,801335 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16297,510 | 16486,934 | +1,162292 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 400,428 | 389,259 | −2,789256 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,282 | 9,808 | +5,665051 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,671 | 12,230 | +4,785947 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,354694 | 0,346587 | −2,285773 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 779,890 | 842,732 | +8,057756 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 150,569 | 153,702 | +2,081079 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 7,264 | 10,375 | +42,839691 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `restoration` +42,839691 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10656,169 à 11360,108 | 10619,395 à 11892,620 | indisponible / indisponible | indisponible | 6,415903 % / 11,525613 % |
| STCK | `new_decision` | 250,194 à 734,356 | 235,988 à 755,281 | 639,470 / 679,989 | +6,336322 % | 13,667726 % / 11,721142 % |
| STCK | `known_prefix_service` | 7,280 à 18,846 | 7,965 à 16,995 | indisponible / indisponible | indisponible | 16,862493 % / 7,496377 % |
| STCK | `known_prefix_request` | 8,890 à 20,607 | 9,459 à 18,748 | indisponible / indisponible | indisponible | 19,538274 % / 6,797503 % |
| STCK | `known_prefix_guard` | 0,084655 à 2,025 | 0,082622 à 3,533 | indisponible / indisponible | indisponible | 55,244717 % / 30,474231 % |
| STCK | `acquisition_and_persistence` | 493,663 à 3899,004 | 498,575 à 4348,336 | 3810,830 / 3755,404 | −1,454439 % | 9,648329 % / 6,175685 % |
| STCK | `persistence` | 16,341 à 583,726 | 16,045 à 607,565 | 534,251 / 475,040 | −11,082904 % | 15,043472 % / 7,304969 % |
| STCK | `restoration` | 2,413 à 183,455 | 2,257 à 188,151 | 140,176 / 172,170 | +22,824004 % | 27,987948 % / 9,710650 % |
| SMLP | `session_elapsed` | 16172,632 à 16544,791 | 15781,001 à 17707,512 | indisponible / indisponible | indisponible | 2,283536 % / 11,685078 % |
| SMLP | `new_decision` | 267,029 à 862,640 | 272,007 à 849,647 | 793,836 / 848,308 | +6,861827 % | 15,386734 % / 13,197247 % |
| SMLP | `known_prefix_service` | 7,918 à 13,258 | 8,601 à 13,238 | 12,052 / 11,842 | −1,745325 % | 9,487452 % / 19,027573 % |
| SMLP | `known_prefix_request` | 9,856 à 16,008 | 10,649 à 15,433 | 14,411 / 14,794 | +2,652508 % | 10,949902 % / 19,196898 % |
| SMLP | `known_prefix_guard` | 0,199094 à 0,637783 | 0,194127 à 0,514811 | 0,465267 / 0,442954 | −4,795741 % | 26,463824 % / 45,511670 % |
| SMLP | `acquisition_and_persistence` | 393,280 à 2852,266 | 380,794 à 2640,342 | 2627,655 / 2388,635 | −9,096296 % | 18,713806 % / 19,728270 % |
| SMLP | `persistence` | 13,471 à 283,170 | 12,488 à 302,757 | 227,749 / 229,215 | +0,643816 % | 8,769181 % / 20,122237 % |
| SMLP | `restoration` | 2,273 à 72,782 | 2,366 à 70,587 | 59,810 / 53,711 | −10,197304 % | 10,730079 % / 33,605155 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `restoration` +22,824004 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 209,813 / 199,264 | −5,027506 % | 188,575 à 271,694 / 184,459 à 256,512 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 397,279 / 371,109 | −6,587278 % | 330,584 à 490,726 / 331,193 à 447,065 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 219,205 / 214,969 | −1,932331 % | 204,761 à 259,920 / 198,772 à 246,579 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 385,990 / 381,140 | −1,256279 % | 356,763 à 444,334 / 362,103 à 436,631 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 207,209 / 208,409 | +0,578899 % | 184,541 à 276,814 / 182,897 à 233,337 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 373,758 / 361,526 | −3,272734 % | 327,318 à 472,393 / 345,319 à 408,318 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 211,715 / 215,617 | +1,843235 % | 198,251 à 292,784 / 202,161 à 285,099 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 376,264 / 377,821 | +0,413975 % | 335,964 à 477,973 / 356,329 à 481,957 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,012899 / 0,011142 | −13,628435 % | 0,007601 à 0,042983 / 0,006870 à 0,037135 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1123,932 / 999,957 | −11,030505 % | 915,576 à 1436,805 / 900,066 à 1106,316 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,011356 / 0,012439 | +9,531986 % | 0,008803 à 0,121389 / 0,009725 à 0,018347 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 944,630 / 1019,310 | +7,905730 % | 818,503 à 1305,654 / 923,834 à 1037,077 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,008222 / 0,007025 | −14,558502 % | 0,003295 à 0,015132 / 0,003646 à 0,014511 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1430,873 / 1408,820 | −1,541190 % | 1294,900 à 1458,565 / 1326,357 à 1582,735 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,005368 / 0,005523 | +2,887212 % | 0,004136 à 0,018157 / 0,004446 à 0,028072 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 717,642 / 706,145 | −1,602139 % | 712,547 à 736,477 / 680,462 à 783,364 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,012313 / 0,014221 | +15,491128 % | 0,011718 à 0,038607 / 0,011677 à 0,031386 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1041,071 / 1007,826 | −3,193281 % | 960,408 à 1147,977 / 988,819 à 1192,260 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,012569 / 0,018793 | +49,518657 % | 0,009684 à 0,023555 / 0,009915 à 0,020961 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 956,944 / 881,697 | −7,863219 % | 888,171 à 1045,128 / 827,113 à 929,224 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,007040 / 0,012883 | +82,991265 % | 0,003315 à 0,019619 / 0,004867 à 0,042563 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1405,509 / 1473,347 | +4,826578 % | 1344,674 à 1436,751 / 1326,887 à 1610,626 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,007666 / 0,005393 | −29,654992 % | 0,004727 à 0,048752 / 0,004366 à 0,020470 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 685,731 / 742,871 | +8,332684 % | 664,368 à 740,899 / 687,243 à 809,474 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 318,022 | 107,660 à 545,817 |
| 1 | STCK | A | `rss` | 64 | 917,305 | 530,809 à 990,996 |
| 1 | SMLP | A | `heapUsed` | 96 | 294,761 | 117,162 à 580,923 |
| 1 | SMLP | A | `rss` | 96 | 1017,691 | 756,879 à 1068,973 |
| 1 | STCK | B | `heapUsed` | 64 | 304,849 | 153,996 à 522,432 |
| 1 | STCK | B | `rss` | 64 | 919,688 | 539,539 à 1102,059 |
| 1 | SMLP | B | `heapUsed` | 96 | 300,125 | 127,647 à 629,978 |
| 1 | SMLP | B | `rss` | 96 | 1032,297 | 828,230 à 1103,031 |
| 2 | STCK | A | `heapUsed` | 64 | 281,559 | 104,399 à 549,536 |
| 2 | STCK | A | `rss` | 64 | 933,014 | 545,449 à 980,555 |
| 2 | SMLP | A | `heapUsed` | 96 | 300,660 | 138,265 à 550,060 |
| 2 | SMLP | A | `rss` | 96 | 1018,289 | 812,102 à 1055,465 |
| 2 | STCK | B | `heapUsed` | 64 | 306,922 | 139,508 à 584,419 |
| 2 | STCK | B | `rss` | 64 | 922,201 | 549,570 à 1044,648 |
| 2 | SMLP | B | `heapUsed` | 96 | 320,635 | 96,184 à 627,271 |
| 2 | SMLP | B | `rss` | 96 | 1001,881 | 782,016 à 1084,316 |

## Calculs, empreintes et transport

La [revue de consolidation](owner-growth-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](owner-growth-review.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `8bf44d7ffbfa67222205e2b5c19dfe128df8cd9a0546ff13a14d12369dc6a477` |
| global-budget-policy.json | `c82b0a4f15b8c4e0e27ae91810d08bcf9d3eb6b793cf46d12e8527f68878944d` |
| owner-growth-comparison.json | `b54c20c1e2da76ed05c8100400ff90d1524e721899b64ad35679bd4d36d7d3d7` |
| owner-growth-review.json | `2a672ee1a2809805e3b06f75f1506634bf6e8ffc1f681bd2d0d89223c9bc09bb` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1581 | 446 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1584 | 445 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1585 | 449 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1570 | 441 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.57.0 dans cette fenêtre**, selon le reçu `accepted_under_predeclared_owner_cost_rule`. Les **1 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de la famille FacetExamples, de revalidation source ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
