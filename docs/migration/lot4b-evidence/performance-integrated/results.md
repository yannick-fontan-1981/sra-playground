# Lot 4B : résultats de coût de native 0.54.0

**Le coût est accepté selon le critère global déclaré : STCK −1,812977 %; SMLP +2,735461 %.** La [décision globale](owner-growth-review.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_predeclared_owner_cost_rule`. Les diagnostics de phases restent **14/16**, statut `budget_review_required`, avec **2 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](owner-growth-review.json) passe 3960/3960 contrôles.

## Qualification structurelle et refus historique

**Le contrôle historique d’identité intégrale du travail a échoué.** Son [refus conservé](aggregation-failure.json) reste distinct de cette analyse complémentaire. Le [contrat](owner-growth-contract.json) et la [fixture fonctionnelle](owner-structural-fixture.json) ont été figés avant toute mesure. Les captures fonctionnelles attribuent les nouveaux nœuds RelativeArrangements ; chaque session de coût est comparée aux valeurs publiques exactes de sa forme pré-déclarée. Les feuilles privées des sessions mesurées ne sont pas exposées par leurs seuls compteurs. Tous les autres champs de travail restent strictement comparés, et les signatures complètes restent identiques au sein de chaque version. Aucune durée ni observation défavorable n’est corrigée ou retirée pour compenser les nœuds supplémentaires.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 85 / native 0.53.0 ; commit `a009e1f138bb18251d697f49647bacc615ee514f` ; 283 fichiers natifs | `d30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f` |
| B : candidat gelé | Native 0.54.0 ; 286 fichiers natifs ; archive de 297 fichiers | `f25d56d1c63dc929b01bb31b3898b84cecc69e6e412d535c0d122170ea401ce9` |

La [déclaration](declaration.json) finalisée le **2026-11-10 22:28:17 UTC** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre des arrangements relatifs. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 22:38:57 UTC** au **2026-11-10 22:47:33 UTC**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC.

| Série | Version | Début UTC | Fin UTC | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.53.0 | 2026-11-10 22:38:57 UTC | 2026-11-10 22:41:05 UTC | passed |
| B1 | 0.54.0 | 2026-11-10 22:41:05 UTC | 2026-11-10 22:43:14 UTC | passed |
| B2 | 0.54.0 | 2026-11-10 22:43:14 UTC | 2026-11-10 22:45:23 UTC | passed |
| A2 | 0.53.0 | 2026-11-10 22:45:23 UTC | 2026-11-10 22:47:32 UTC | passed |

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

Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.

## Critère global par jeu

Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; seul l’affichage est arrondi.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Écart au seuil, points | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 10986,993 | 10787,801 | −1,812977 % | 11,812977 | Accepté |
| SMLP | 8 / 8 | 16041,945 | 16480,766 | +2,735461 % | 7,264539 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](owner-growth-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 10986,993 | 10787,801 | −1,812977 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 353,725 | 323,352 | −8,586609 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 8,720 | 8,392 | −3,756947 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 10,273 | 10,071 | −1,959310 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,231186 | 0,209975 | −9,175060 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 890,347 | 886,294 | −0,455279 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 204,438 | 196,242 | −4,008931 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 17,940 | 17,178 | −4,244545 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 8 / 8 | 16041,945 | 16480,766 | +2,735461 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 386,734 | 386,247 | −0,125767 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 9,461 | 9,845 | +4,056542 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 11,865 | 12,154 | +2,436512 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,333739 | 0,374018 | +12,069030 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 838,498 | 804,810 | −4,017758 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 152,777 | 156,010 | +2,116409 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 7,291 | 9,466 | +29,830670 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `known_prefix_guard` +12,069030 %** (`over_budget_with_noise_unresolved`); **SMLP `restoration` +29,830670 %** (`over_budget_with_noise_unresolved`).

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10425,521 à 11773,244 | 10325,057 à 11067,862 | indisponible / indisponible | indisponible | 12,266530 % / 6,885600 % |
| STCK | `new_decision` | 232,630 à 666,716 | 241,650 à 640,550 | 635,747 / 631,606 | −0,651478 % | 25,340922 % / 23,515064 % |
| STCK | `known_prefix_service` | 7,166 à 24,405 | 7,202 à 23,856 | 11,644 / 15,460 | +32,773109 % | 33,263765 % / 40,460641 % |
| STCK | `known_prefix_request` | 8,616 à 27,185 | 9,100 à 26,081 | 13,750 / 17,440 | +26,838601 % | 38,340206 % / 37,189690 % |
| STCK | `known_prefix_guard` | 0,084325 à 12,362 | 0,077815 à 0,376536 | 0,454030 / 0,355485 | −21,704513 % | 62,671483 % / 59,470524 % |
| STCK | `acquisition_and_persistence` | 420,372 à 3814,602 | 419,179 à 3770,215 | 3742,127 / 3648,195 | −2,510113 % | 28,017315 % / 17,706087 % |
| STCK | `persistence` | 15,509 à 573,242 | 14,803 à 717,431 | 469,986 / 500,434 | +6,478556 % | 29,565935 % / 19,224915 % |
| STCK | `restoration` | 2,132 à 179,990 | 1,987 à 195,844 | 159,881 / 143,832 | −10,038399 % | 32,792653 % / 28,988852 % |
| SMLP | `session_elapsed` | 15584,296 à 16617,424 | 16157,891 à 17067,512 | indisponible / indisponible | indisponible | 6,440170 % / 5,519293 % |
| SMLP | `new_decision` | 244,696 à 932,884 | 237,077 à 914,445 | 795,847 / 819,433 | +2,963659 % | 19,436791 % / 20,190304 % |
| SMLP | `known_prefix_service` | 7,923 à 19,681 | 7,447 à 13,734 | 13,346 / 13,358 | +0,093572 % | 19,397413 % / 44,224451 % |
| SMLP | `known_prefix_request` | 9,810 à 22,021 | 9,424 à 17,823 | 16,180 / 16,168 | −0,076626 % | 17,341766 % / 38,342001 % |
| SMLP | `known_prefix_guard` | 0,190992 à 0,587248 | 0,193927 à 0,740594 | 0,486088 / 0,599596 | +23,351327 % | 29,359278 % / 54,921379 % |
| SMLP | `acquisition_and_persistence` | 370,598 à 2538,025 | 371,768 à 2945,534 | 2419,829 / 2716,941 | +12,278213 % | 24,540990 % / 11,381245 % |
| SMLP | `persistence` | 12,756 à 345,206 | 12,935 à 337,147 | 240,621 / 251,581 | +4,555099 % | 23,767552 % / 5,296455 % |
| SMLP | `restoration` | 2,080 à 122,762 | 1,937 à 75,854 | 50,047 / 51,008 | +1,919522 % | 30,026764 % / 42,302120 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `known_prefix_service` +32,773109 %**; **STCK `known_prefix_request` +26,838601 %**; **SMLP `known_prefix_guard` +23,351327 %**; **SMLP `acquisition_and_persistence` +12,278213 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 10944,546 / 10640,715 | −2,776094 % | 8/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 16007,484 / 16480,766 | +2,956625 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 10991,222 / 10813,521 | −1,616746 % | 8/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 16478,256 / 16523,756 | +0,276119 % | 7/8 | budget_review_required |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 10425,521282 | 2026-11-10 22:39:03 UTC |
| A1 | STCK | 2 | 10 | 2 | 11773,244014 | 2026-11-10 22:39:14 UTC |
| A1 | STCK | 3 | 10 | 2 | 11046,703081 | 2026-11-10 22:39:27 UTC |
| A1 | STCK | 4 | 10 | 2 | 10842,389091 | 2026-11-10 22:39:39 UTC |
| A1 | SMLP | 1 | 15 | 3 | 16072,198314 | 2026-11-10 22:39:56 UTC |
| A1 | SMLP | 2 | 15 | 3 | 16011,690694 | 2026-11-10 22:40:14 UTC |
| A1 | SMLP | 3 | 15 | 3 | 16003,277936 | 2026-11-10 22:40:31 UTC |
| A1 | SMLP | 4 | 15 | 3 | 15679,069044 | 2026-11-10 22:40:48 UTC |
| B1 | STCK | 1 | 10 | 2 | 10325,057198 | 2026-11-10 22:41:11 UTC |
| B1 | STCK | 2 | 10 | 2 | 10519,270637 | 2026-11-10 22:41:22 UTC |
| B1 | STCK | 3 | 10 | 2 | 10762,159757 | 2026-11-10 22:41:34 UTC |
| B1 | STCK | 4 | 10 | 2 | 10942,704850 | 2026-11-10 22:41:46 UTC |
| B1 | SMLP | 1 | 15 | 3 | 17067,512390 | 2026-11-10 22:42:03 UTC |
| B1 | SMLP | 2 | 15 | 3 | 16489,673554 | 2026-11-10 22:42:21 UTC |
| B1 | SMLP | 3 | 15 | 3 | 16157,890683 | 2026-11-10 22:42:39 UTC |
| B1 | SMLP | 4 | 15 | 3 | 16471,857766 | 2026-11-10 22:42:56 UTC |
| B2 | STCK | 1 | 10 | 2 | 10813,442256 | 2026-11-10 22:43:20 UTC |
| B2 | STCK | 2 | 10 | 2 | 10813,600598 | 2026-11-10 22:43:32 UTC |
| B2 | STCK | 3 | 10 | 2 | 11067,861981 | 2026-11-10 22:43:43 UTC |
| B2 | STCK | 4 | 10 | 2 | 10463,069162 | 2026-11-10 22:43:56 UTC |
| B2 | SMLP | 1 | 15 | 3 | 16757,347939 | 2026-11-10 22:44:12 UTC |
| B2 | SMLP | 2 | 15 | 3 | 16237,862989 | 2026-11-10 22:44:30 UTC |
| B2 | SMLP | 3 | 15 | 3 | 16459,607278 | 2026-11-10 22:44:47 UTC |
| B2 | SMLP | 4 | 15 | 3 | 16587,904213 | 2026-11-10 22:45:05 UTC |
| A2 | STCK | 1 | 10 | 2 | 11445,486174 | 2026-11-10 22:45:29 UTC |
| A2 | STCK | 2 | 10 | 2 | 10685,291269 | 2026-11-10 22:45:41 UTC |
| A2 | STCK | 3 | 10 | 2 | 11055,160751 | 2026-11-10 22:45:53 UTC |
| A2 | STCK | 4 | 10 | 2 | 10927,282267 | 2026-11-10 22:46:05 UTC |
| A2 | SMLP | 1 | 15 | 3 | 16617,424163 | 2026-11-10 22:46:22 UTC |
| A2 | SMLP | 2 | 15 | 3 | 16604,952090 | 2026-11-10 22:46:40 UTC |
| A2 | SMLP | 3 | 15 | 3 | 15584,295614 | 2026-11-10 22:46:58 UTC |
| A2 | SMLP | 4 | 15 | 3 | 16351,560075 | 2026-11-10 22:47:15 UTC |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10944,546 | 10640,715 | −2,776094 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 357,141 | 323,352 | −9,460958 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 8,683 | 8,175 | −5,856709 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,223 | 9,965 | −2,523650 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,241517 | 0,189685 | −21,460853 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 926,585 | 886,831 | −4,290437 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 204,730 | 192,845 | −5,805412 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 18,773 | 17,178 | −8,496070 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16007,484 | 16480,766 | +2,956625 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 386,621 | 400,990 | +3,716706 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,259 | 9,613 | +3,815268 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 11,454 | 11,976 | +4,557184 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,333739 | 0,365815 | +9,611417 % | `within_observed_budget` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 789,449 | 804,810 | +1,945761 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 154,368 | 156,651 | +1,478969 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 7,190 | 10,226 | +42,231325 % | `over_budget_with_noise_unresolved` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `restoration` +42,231325 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10425,521 à 11773,244 | 10325,057 à 10942,705 | indisponible / indisponible | indisponible | 12,314103 % / 5,804569 % |
| STCK | `new_decision` | 269,373 à 666,716 | 243,082 à 640,550 | 658,280 / 639,037 | −2,923127 % | 11,470558 % / 18,928288 % |
| STCK | `known_prefix_service` | 7,166 à 24,405 | 7,202 à 15,460 | indisponible / indisponible | indisponible | 33,263765 % / 11,850993 % |
| STCK | `known_prefix_request` | 8,616 à 27,185 | 9,100 à 17,440 | indisponible / indisponible | indisponible | 38,340206 % / 10,784497 % |
| STCK | `known_prefix_guard` | 0,088220 à 12,362 | 0,077815 à 0,290820 | indisponible / indisponible | indisponible | 62,494860 % / 21,984188 % |
| STCK | `acquisition_and_persistence` | 420,372 à 3779,029 | 446,861 à 3715,316 | 3697,619 / 3648,195 | −1,336638 % | 18,067586 % / 14,038948 % |
| STCK | `persistence` | 15,901 à 547,950 | 14,803 à 717,431 | 493,426 / 473,928 | −3,951624 % | 29,621967 % / 19,485974 % |
| STCK | `restoration` | 2,132 à 171,882 | 1,987 à 195,844 | 145,890 / 128,225 | −12,108548 % | 24,346265 % / 14,563001 % |
| SMLP | `session_elapsed` | 15679,069 à 16072,198 | 16157,891 à 17067,512 | indisponible / indisponible | indisponible | 2,455909 % / 5,519293 % |
| SMLP | `new_decision` | 244,696 à 867,616 | 237,849 à 858,427 | 828,786 / 821,452 | −0,884908 % | 19,436791 % / 17,478209 % |
| SMLP | `known_prefix_service` | 7,923 à 19,681 | 7,874 à 13,734 | 12,825 / 13,436 | +4,762960 % | 7,370658 % / 40,480123 % |
| SMLP | `known_prefix_request` | 9,810 à 22,021 | 9,781 à 17,823 | 15,632 / 16,280 | +4,148794 % | 9,815645 % / 35,725149 % |
| SMLP | `known_prefix_guard` | 0,190992 à 0,486088 | 0,193927 à 0,740383 | 0,475682 / 0,599596 | +26,049756 % | 18,093613 % / 53,544410 % |
| SMLP | `acquisition_and_persistence` | 428,776 à 2517,989 | 392,411 à 2867,205 | 2465,256 / 2716,941 | +10,209259 % | 16,488706 % / 8,361808 % |
| SMLP | `persistence` | 13,153 à 333,341 | 14,415 à 266,569 | 239,135 / 248,791 | +4,037768 % | 11,802136 % / 3,927866 % |
| SMLP | `restoration` | 2,080 à 52,400 | 2,019 à 70,886 | 48,742 / 48,143 | −1,228842 % | 22,340505 % / 26,108959 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **SMLP `known_prefix_guard` +26,049756 %**; **SMLP `acquisition_and_persistence` +10,209259 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10991,222 | 10813,521 | −1,616746 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 353,071 | 332,147 | −5,926249 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 8,741 | 8,735 | −0,077333 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,378 | 10,576 | +1,907137 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,229118 | 0,235734 | +2,887371 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 847,739 | 885,212 | +4,420321 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 204,212 | 198,674 | −2,711766 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 17,940 | 18,893 | +5,311509 % | `within_observed_budget` |
| SMLP | `session_elapsed` | 4 / 4 | 16478,256 | 16523,756 | +0,276119 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 387,812 | 371,452 | −4,218435 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,619 | 10,101 | +5,009220 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,371 | 12,440 | +0,553298 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,326297 | 0,374018 | +14,624866 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 867,846 | 810,134 | −6,650003 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 149,127 | 153,456 | +2,903171 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 7,647 | 7,593 | −0,710458 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **SMLP `known_prefix_guard` +14,624866 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10685,291 à 11445,486 | 10463,069 à 11067,862 | indisponible / indisponible | indisponible | 6,916382 % / 5,592931 % |
| STCK | `new_decision` | 232,630 à 635,747 | 241,650 à 631,606 | 634,846 / 620,511 | −2,257963 % | 24,768309 % / 17,644336 % |
| STCK | `known_prefix_service` | 7,859 à 11,644 | 7,803 à 23,856 | indisponible / indisponible | indisponible | 19,838420 % / 36,769788 % |
| STCK | `known_prefix_request` | 9,636 à 13,626 | 9,291 à 26,081 | indisponible / indisponible | indisponible | 18,338348 % / 34,545200 % |
| STCK | `known_prefix_guard` | 0,084325 à 0,375525 | 0,096693 à 0,376536 | indisponible / indisponible | indisponible | 19,411769 % / 36,273982 % |
| STCK | `acquisition_and_persistence` | 446,172 à 3814,602 | 419,179 à 3770,215 | 3742,127 / 3602,475 | −3,731893 % | 8,433560 % / 8,232396 % |
| STCK | `persistence` | 15,509 à 573,242 | 16,514 à 559,456 | 465,442 / 549,401 | +18,038516 % | 13,842783 % / 5,364094 % |
| STCK | `restoration` | 2,309 à 179,990 | 2,153 à 178,270 | 159,881 / 143,832 | −10,038399 % | 14,015124 % / 14,500504 % |
| SMLP | `session_elapsed` | 15584,296 à 16617,424 | 16237,863 à 16757,348 | indisponible / indisponible | indisponible | 6,269647 % / 3,143867 % |
| SMLP | `new_decision` | 245,747 à 932,884 | 237,077 à 914,445 | 770,828 / 819,433 | +6,305531 % | 12,900387 % / 9,570575 % |
| SMLP | `known_prefix_service` | 8,173 à 18,118 | 7,447 à 12,874 | 13,346 / 12,800 | −4,090467 % | 15,905796 % / 15,704226 % |
| SMLP | `known_prefix_request` | 10,344 à 20,298 | 9,424 à 16,168 | 16,180 / 15,441 | −4,566948 % | 11,982253 % / 20,868162 % |
| SMLP | `known_prefix_guard` | 0,192093 à 0,587248 | 0,197141 à 0,740594 | 0,540659 / 0,557363 | +3,089563 % | 26,218755 % / 41,187012 % |
| SMLP | `acquisition_and_persistence` | 370,598 à 2538,025 | 371,768 à 2945,534 | 2419,829 / 2844,260 | +17,539725 % | 19,570880 % / 10,700622 % |
| SMLP | `persistence` | 12,756 à 345,206 | 12,935 à 337,147 | 249,542 / 262,177 | +5,063120 % | 24,289921 % / 4,959290 % |
| SMLP | `restoration` | 2,110 à 122,762 | 1,937 à 75,854 | 53,917 / 52,387 | −2,837502 % | 22,974321 % / 25,938167 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `persistence` +18,038516 %**; **SMLP `acquisition_and_persistence` +17,539725 %**.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 205,958 / 193,056 | −6,264181 % | 180,189 à 245,848 / 181,034 à 246,066 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 363,284 / 369,333 | +1,665194 % | 339,078 à 436,286 / 314,927 à 545,169 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 216,208 / 230,403 | +6,565327 % | 200,367 à 266,322 / 200,030 à 258,202 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 390,998 / 401,151 | +2,596770 % | 361,296 à 446,396 / 370,299 à 479,928 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 206,951 / 202,007 | −2,389178 % | 181,757 à 246,232 / 172,836 à 246,794 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 368,844 / 354,302 | −3,942652 % | 330,271 à 446,437 / 315,308 à 451,169 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 213,071 / 215,870 | +1,313555 % | 195,972 à 277,082 / 199,908 à 265,360 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 389,431 / 372,008 | −4,473911 % | 350,515 à 448,933 / 343,843 à 459,724 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,011717 / 0,010836 | −7,514722 % | 0,008662 à 0,040790 / 0,006650 à 0,035332 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 968,716 / 978,959 | +1,057314 % | 926,326 à 1020,856 / 878,349 à 1116,585 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,011872 / 0,011862 | −0,088440 % | 0,009564 à 0,018798 / 0,009264 à 0,020069 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 1004,932 / 928,938 | −7,562140 % | 842,357 à 1185,357 / 795,611 à 1048,216 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,009319 / 0,006815 | −26,869836 % | 0,002884 à 0,017296 / 0,003025 à 0,014762 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1467,613 / 1362,203 | −7,182406 % | 1254,837 à 1522,188 / 1303,327 à 1590,105 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,005563 / 0,012012 | +115,935646 % | 0,004446 à 0,023634 / 0,004447 à 0,144904 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 766,249 / 744,359 | −2,856710 % | 679,512 à 795,345 / 683,656 à 941,262 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,010946 / 0,029959 | +173,685653 % | 0,008873 à 0,036754 / 0,013591 à 0,052307 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1168,082 / 1008,888 | −13,628630 % | 974,082 à 1259,366 / 885,370 à 1207,683 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,015548 / 0,013936 | −10,367893 % | 0,012989 à 0,022083 / 0,010496 à 0,017797 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 955,358 / 873,816 | −8,535225 % | 868,563 à 974,727 / 839,704 à 1008,035 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,008593 / 0,010641 | +23,834740 % | 0,004567 à 0,014962 / 0,003896 à 0,014631 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1388,568 / 1400,823 | +0,882584 % | 1252,449 à 1584,557 / 1337,792 à 1479,986 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,005272 / 0,006289 | +19,279279 % | 0,004216 à 0,020690 / 0,005779 à 0,021441 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 755,127 / 734,846 | −2,685779 % | 680,527 à 907,881 / 711,041 à 812,754 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 242,333 | 104,489 à 549,616 |
| 1 | STCK | A | `rss` | 64 | 926,996 | 544,211 à 996,559 |
| 1 | SMLP | A | `heapUsed` | 96 | 291,616 | 116,555 à 641,459 |
| 1 | SMLP | A | `rss` | 96 | 998,326 | 831,176 à 1125,406 |
| 1 | STCK | B | `heapUsed` | 64 | 236,031 | 104,470 à 580,943 |
| 1 | STCK | B | `rss` | 64 | 949,611 | 542,066 à 1020,695 |
| 1 | SMLP | B | `heapUsed` | 96 | 317,684 | 94,733 à 585,829 |
| 1 | SMLP | B | `rss` | 96 | 972,750 | 757,754 à 1078,672 |
| 2 | STCK | A | `heapUsed` | 64 | 295,574 | 100,920 à 548,874 |
| 2 | STCK | A | `rss` | 64 | 944,363 | 550,672 à 1008,691 |
| 2 | SMLP | A | `heapUsed` | 96 | 326,438 | 123,441 à 648,132 |
| 2 | SMLP | A | `rss` | 96 | 1042,828 | 833,023 à 1116,887 |
| 2 | STCK | B | `heapUsed` | 64 | 289,112 | 121,075 à 635,686 |
| 2 | STCK | B | `rss` | 64 | 995,445 | 576,031 à 1062,969 |
| 2 | SMLP | B | `heapUsed` | 96 | 328,672 | 137,824 à 664,801 |
| 2 | SMLP | B | `rss` | 96 | 989,090 | 821,090 à 1086,547 |

## Calculs, empreintes et transport

La [revue de consolidation](owner-growth-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](owner-growth-review.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. La qualification historique du générateur global reste conservée dans son reçu ; elle ne remplace pas cette chronologie. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `2940ab2c1b5b303ea103fbf6f3a9f1edaa0b83ff2b40cfbf535bda54f477bd20` |
| global-budget-policy.json | `5f62d99315ea71efc91451596c171f2cc0782b14be8151ba503a427df8eaacf0` |
| owner-growth-comparison.json | `5c6510f56105431e127b565d1d5b8d8a0cd2cdd52d684392040ff7bfc1dcd576` |
| owner-growth-review.json | `445b0283d1ae3860a2639da1af8f28cd369fa359424d846357bf8e37772098f1` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1588 | 448 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1578 | 443 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1572 | 438 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1600 | 450 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.54.0 dans cette fenêtre**, selon le reçu `accepted_under_predeclared_owner_cost_rule`. Les **2 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle de la famille RelativeArrangements, de revalidation source ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
