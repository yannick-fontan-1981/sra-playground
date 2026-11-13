# Lot 5B : résultats de coût de native 0.58.0

**Le coût est accepté selon le critère global déclaré : STCK +3,780905 %; SMLP −1,556219 %.** La [décision globale](owner-growth-review.json) conserve 2/2 jeux conformes, avec le statut `accepted_under_predeclared_owner_cost_rule`. Les diagnostics de phases restent **14/16**, statut `budget_review_required`, avec **2 dépassement(s) conservé(s)**. La [revue arithmétique indépendante](owner-growth-review.json) passe 11865/11865 contrôles.

## Qualification structurelle et refus historique

**Le contrôle historique d’identité intégrale du travail a échoué.** Son [refus conservé](aggregation-failure.json) reste distinct de cette analyse complémentaire. Le [contrat](owner-growth-contract.json) et la [fixture fonctionnelle](owner-structural-fixture.json) ont été figés avant toute mesure. Les captures fonctionnelles attribuent les nouveaux nœuds AddressedMaterial ; chaque session de coût est comparée aux valeurs publiques exactes de sa forme pré-déclarée. Les feuilles privées des sessions mesurées ne sont pas exposées par leurs seuls compteurs. Tous les autres champs de travail restent strictement comparés, et les signatures complètes restent identiques au sein de chaque version. Aucune durée ni observation défavorable n’est corrigée ou retirée pour compenser les nœuds supplémentaires.

### Lecture des entrées baseline déclarée avant mesure

Les deux outils déclarés avant la fenêtre comprennent le lecteur des chemins absolus de l’attribution. Chaque entrée externe doit correspondre exactement à une empreinte du reçu de capture baseline pré-déclaré ; son chemin réel doit rester dans le checkout gelé lié à la fenêtre. La taille et le SHA-256 sont vérifiés à la lecture puis en fin de calcul. Les lecteurs généraux de rapports restent locaux. Les sorties identifient ces mêmes outils, sans variante de correction après mesure. Les données brutes, les formes attendues, les populations, les calculs et le seuil restent ceux déclarés.

## Sources et périmètre

| Rôle | Identité | Digest natif |
| --- | --- | --- |
| A : référence remesurée | Site 92 / native 0.57.0 ; commit `d06620d1e4ca2c9758cc693b1ced9eeeddccb7e6` ; 298 fichiers natifs | `eebd099808672be934389020c8f9061df4fdacab28cd7d60c00cd1b080464c04` |
| B : candidat gelé | Native 0.58.0 ; 302 fichiers natifs ; archive de 313 fichiers | `099444085f0579ce60e226c9dece42110c577538f5f337579305a2e5f65483c4` |

La [déclaration](declaration.json) finalisée le **2026-11-10 22:53:16 UTC−03** précède la fenêtre. Le [protocole](protocol.md), la [politique globale](global-budget-policy.json), les [cas](cases.json) et la [politique de phases](comparison-policy.json) restent liés par leurs empreintes. Les textes historiques des cas et de la politique de phases gardent leur provenance ; les identités A/B courantes sont celles de cette déclaration. Aucune durée historique ne fournit un échantillon à la fenêtre actuelle.

Le moteur recalcule chaque commande avant de recevoir le retour public enregistré. Aucun état appris ni trajet ne préinitialise ses décisions. STCK et SMLP mesurent la boucle commune ; leur coût ne prouve pas une contribution propre des matériaux adressés. Le moteur du jeu, le réseau de production et le rendu navigateur restent hors mesure.

| Jeu | Actions par session | Niveaux terminés dans le rejeu conservé |
| --- | --- | --- |
| STCK | 10 | 2 |
| SMLP | 15 | 3 |

Le paramètre de cible ne transforme pas le nombre de niveaux effectivement terminés dans ce rejeu.

## Fenêtre, effectifs et intégrité

La [fenêtre officielle](window.json) s’étend du **2026-11-10 23:18:39 UTC−03** au **2026-11-10 23:27:33 UTC−03**. Son statut et son intégrité finale sont `passed` et `passed`. Tous les horaires ci-dessous sont en UTC−03.

| Série | Version | Début UTC−03 | Fin UTC−03 | Statut |
| --- | --- | --- | --- | --- |
| A1 | 0.57.0 | 2026-11-10 23:18:39 UTC−03 | 2026-11-10 23:20:50 UTC−03 | passed |
| B1 | 0.58.0 | 2026-11-10 23:20:50 UTC−03 | 2026-11-10 23:23:05 UTC−03 | passed |
| B2 | 0.58.0 | 2026-11-10 23:23:05 UTC−03 | 2026-11-10 23:25:18 UTC−03 | passed |
| A2 | 0.57.0 | 2026-11-10 23:25:18 UTC−03 | 2026-11-10 23:27:33 UTC−03 | passed |

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
| Revue statique | 68/68 |

Chaque série utilise un worker distinct par jeu, une chauffe séparée et quatre sessions à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Les deux cohortes sont conservées intégralement. Le [reçu de readiness](readiness.json) lie les preuves fonctionnelles et l’isolation déclarée ; le [contrôle statique](static-preflight.json) couvre les fichiers et ne remplace pas ce reçu.

Environnement consigné : Node v24.22.1, linux 6.18.57, AMD EPYC 9V74 80-Core Processor, 9 processeurs logiques exposés. L’ordre ABBA ne supprime pas les variations de GC, JIT ou d’ordonnancement.

## Critère global par jeu

Le global est `session_elapsed`, la durée complète du rejeu par le contrôleur. Les huit sessions par jeu et version sont réunies avant le calcul : `médiane(B) / médiane(A) − 1`. Chaque jeu doit rester **strictement sous +10 %** ; une égalité à +10 % échoue. Aucun jeu ne compense un autre, aucun ratio de cohorte n’est moyenné et les phases imbriquées ne sont pas additionnées. Les valeurs intégrales du reçu déterminent la décision ; seul l’affichage est arrondi.

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Écart au seuil, points | Décision |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | 8 / 8 | 10879,140 | 11290,470 | +3,780905 % | 6,219095 | Accepté |
| SMLP | 8 / 8 | 17079,561 | 16813,765 | −1,556219 % | 11,556219 | Accepté |

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait. Le comparateur de phases garde son seuil historique, ses classifications et ses valeurs défavorables ; son diagnostic ne remplace pas la décision globale distincte.

## Les seize diagnostics agrégés

Source : [comparaison agrégée](owner-growth-comparison.json). Les résultats reproduisent les classifications du comparateur conservé. Une qualification de bruit ne relève aucun seuil.

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 8 / 8 | 10879,140 | 11290,470 | +3,780905 % | `within_observed_budget` |
| STCK | `new_decision` | 48 / 48 | 338,320 | 346,789 | +2,503192 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 32 / 32 | 8,878 | 8,440 | −4,933821 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 32 / 32 | 10,643 | 10,412 | −2,168952 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 32 / 32 | 0,223385 | 0,217231 | −2,755109 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 48 / 48 | 840,831 | 917,410 | +9,107520 % | `within_observed_budget` |
| STCK | `persistence` | 104 / 104 | 193,541 | 203,751 | +5,275071 % | `within_observed_budget` |
| STCK | `restoration` | 96 / 96 | 17,345 | 19,605 | +13,032972 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 8 / 8 | 17079,561 | 16813,765 | −1,556219 % | `within_observed_budget` |
| SMLP | `new_decision` | 72 / 72 | 413,326 | 408,034 | −1,280515 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 48 / 48 | 10,156 | 10,333 | +1,748802 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 48 / 48 | 12,441 | 13,049 | +4,889170 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 48 / 48 | 0,365670 | 0,408273 | +11,650805 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 72 / 72 | 852,848 | 848,695 | −0,486955 % | `within_observed_budget` |
| SMLP | `persistence` | 152 / 152 | 159,394 | 157,017 | −1,491447 % | `within_observed_budget` |
| SMLP | `restoration` | 144 / 144 | 9,081 | 8,930 | −1,656676 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `restoration` +13,032972 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_guard` +11,650805 %** (`over_budget_with_noise_unresolved`).

### Dispersion et p95 agrégés

Les intervalles incluent le minimum et le maximum de toutes les observations retenues. L’étendue relative des médianes de session vaut `(maximum − minimum) / médiane`. Les observations d’une session sont corrélées : ces valeurs décrivent la dispersion, sans intervalle de confiance. Le p95 utilise le rang empirique `ceil(0,95 × n)` seulement pour `n ≥ 20` ; il reste indisponible pour les huit durées de session.

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10376,587 à 12255,217 | 10964,855 à 11887,354 | indisponible / indisponible | indisponible | 17,268186 % / 8,170600 % |
| STCK | `new_decision` | 233,585 à 740,377 | 235,334 à 920,232 | 711,808 / 719,565 | +1,089740 % | 20,442178 % / 24,162093 % |
| STCK | `known_prefix_service` | 7,552 à 23,718 | 7,342 à 23,572 | 12,238 / 20,350 | +66,285252 % | 36,259212 % / 27,910995 % |
| STCK | `known_prefix_request` | 9,134 à 25,962 | 8,880 à 25,548 | 13,993 / 22,402 | +60,093745 % | 36,983667 % / 28,420310 % |
| STCK | `known_prefix_guard` | 0,083514 à 0,430546 | 0,084294 à 11,004 | 0,398188 / 9,531 | +2293,584689 % | 51,875690 % / 57,365026 % |
| STCK | `acquisition_and_persistence` | 451,203 à 4458,406 | 431,707 à 4204,056 | 3924,918 / 4045,342 | +3,068199 % | 20,526219 % / 12,693594 % |
| STCK | `persistence` | 15,056 à 847,953 | 14,029 à 636,381 | 506,410 / 474,979 | −6,206665 % | 27,116080 % / 39,249043 % |
| STCK | `restoration` | 2,056 à 184,177 | 2,214 à 196,697 | 144,110 / 146,450 | +1,623518 % | 25,937120 % / 16,936177 % |
| SMLP | `session_elapsed` | 15644,488 à 18159,580 | 15879,819 à 18739,789 | indisponible / indisponible | indisponible | 14,725742 % / 17,009694 % |
| SMLP | `new_decision` | 235,117 à 927,714 | 235,556 à 972,353 | 847,068 / 871,951 | +2,937574 % | 45,256814 % / 19,785112 % |
| SMLP | `known_prefix_service` | 7,879 à 20,965 | 7,895 à 22,807 | 13,706 / 20,633 | +50,540129 % | 34,535164 % / 30,225001 % |
| SMLP | `known_prefix_request` | 9,894 à 23,282 | 9,788 à 25,204 | 16,601 / 22,881 | +37,822217 % | 33,504903 % / 30,214329 % |
| SMLP | `known_prefix_guard` | 0,192144 à 0,882664 | 0,195048 à 11,464 | 0,620347 / 10,219 | +1547,302719 % | 60,445598 % / 51,093631 % |
| SMLP | `acquisition_and_persistence` | 415,215 à 2877,336 | 372,818 à 3197,120 | 2587,057 / 2778,039 | +7,382215 % | 28,170495 % / 30,206275 % |
| SMLP | `persistence` | 13,556 à 368,640 | 13,341 à 341,737 | 258,871 / 247,477 | −4,401334 % | 18,296434 % / 16,841960 % |
| SMLP | `restoration` | 2,341 à 100,443 | 2,199 à 87,820 | 48,017 / 57,835 | +20,447449 % | 18,547212 % / 33,888639 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **STCK `known_prefix_service` +66,285252 %**; **STCK `known_prefix_request` +60,093745 %**; **STCK `known_prefix_guard` +2293,584689 %**; **SMLP `known_prefix_service` +50,540129 %**; **SMLP `known_prefix_request` +37,822217 %**; **SMLP `known_prefix_guard` +1547,302719 %**; **SMLP `restoration` +20,447449 %**.

## Deux cohortes intégralement conservées

Les [comparaisons de cohorte 1](cohort1/comparison.json) et [de cohorte 2](cohort2/comparison.json) gardent chacune leurs seize diagnostics. Leurs résultats favorables ou défavorables ne sélectionnent pas les sessions de l’agrégat.

| Cohorte | Ordre | Jeu | Médiane globale A / B, ms | Variation globale | Diagnostics dans le seuil | Statut cohorte |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A1 puis B1 | STCK | 10404,038 / 11290,470 | +8,520077 % | 4/8 | budget_review_required |
| 1 | A1 puis B1 | SMLP | 17186,473 / 17212,592 | +0,151972 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | STCK | 11475,210 / 11299,866 | −1,528025 % | 7/8 | budget_review_required |
| 2 | B2 puis A2 | SMLP | 16881,963 / 16434,686 | −2,649437 % | 7/8 | budget_review_required |

## Les trente-deux sessions mesurées

Ce registre conserve chaque session dans l’ordre de sa série, sans exclusion ni moyenne des ratios. Les rapports bruts liés plus bas conservent également tous les échantillons des phases, requêtes, pauses et mémoire.

| Série | Jeu | Répétition | Actions | Niveaux terminés | Durée complète, ms | Début UTC−03 |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | STCK | 1 | 10 | 2 | 10385,036023 | 2026-11-10 23:18:45 UTC−03 |
| A1 | STCK | 2 | 10 | 2 | 10376,586710 | 2026-11-10 23:18:56 UTC−03 |
| A1 | STCK | 3 | 10 | 2 | 10791,934639 | 2026-11-10 23:19:08 UTC−03 |
| A1 | STCK | 4 | 10 | 2 | 10423,039753 | 2026-11-10 23:19:20 UTC−03 |
| A1 | SMLP | 1 | 15 | 3 | 15644,487745 | 2026-11-10 23:19:36 UTC−03 |
| A1 | SMLP | 2 | 15 | 3 | 18159,579692 | 2026-11-10 23:19:53 UTC−03 |
| A1 | SMLP | 3 | 15 | 3 | 17157,158621 | 2026-11-10 23:20:13 UTC−03 |
| A1 | SMLP | 4 | 15 | 3 | 17215,788183 | 2026-11-10 23:20:31 UTC−03 |
| B1 | STCK | 1 | 10 | 2 | 11547,502824 | 2026-11-10 23:20:55 UTC−03 |
| B1 | STCK | 2 | 10 | 2 | 11353,729826 | 2026-11-10 23:21:08 UTC−03 |
| B1 | STCK | 3 | 10 | 2 | 11227,209970 | 2026-11-10 23:21:20 UTC−03 |
| B1 | STCK | 4 | 10 | 2 | 11013,256840 | 2026-11-10 23:21:33 UTC−03 |
| B1 | SMLP | 1 | 15 | 3 | 16800,284528 | 2026-11-10 23:21:50 UTC−03 |
| B1 | SMLP | 2 | 15 | 3 | 18739,789228 | 2026-11-10 23:22:08 UTC−03 |
| B1 | SMLP | 3 | 15 | 3 | 17368,316828 | 2026-11-10 23:22:28 UTC−03 |
| B1 | SMLP | 4 | 15 | 3 | 17056,867181 | 2026-11-10 23:22:47 UTC−03 |
| B2 | STCK | 1 | 10 | 2 | 11077,836153 | 2026-11-10 23:23:11 UTC−03 |
| B2 | STCK | 2 | 10 | 2 | 10964,855197 | 2026-11-10 23:23:23 UTC−03 |
| B2 | STCK | 3 | 10 | 2 | 11887,354339 | 2026-11-10 23:23:35 UTC−03 |
| B2 | STCK | 4 | 10 | 2 | 11521,895556 | 2026-11-10 23:23:48 UTC−03 |
| B2 | SMLP | 1 | 15 | 3 | 16827,245997 | 2026-11-10 23:24:07 UTC−03 |
| B2 | SMLP | 2 | 15 | 3 | 16600,322746 | 2026-11-10 23:24:25 UTC−03 |
| B2 | SMLP | 3 | 15 | 3 | 16269,049178 | 2026-11-10 23:24:43 UTC−03 |
| B2 | SMLP | 4 | 15 | 3 | 15879,819160 | 2026-11-10 23:25:00 UTC−03 |
| A2 | STCK | 1 | 10 | 2 | 10966,345189 | 2026-11-10 23:25:23 UTC−03 |
| A2 | STCK | 2 | 10 | 2 | 12255,216866 | 2026-11-10 23:25:35 UTC−03 |
| A2 | STCK | 3 | 10 | 2 | 11398,130197 | 2026-11-10 23:25:48 UTC−03 |
| A2 | STCK | 4 | 10 | 2 | 11552,289709 | 2026-11-10 23:26:01 UTC−03 |
| A2 | SMLP | 1 | 15 | 3 | 17810,951925 | 2026-11-10 23:26:20 UTC−03 |
| A2 | SMLP | 2 | 15 | 3 | 17001,962605 | 2026-11-10 23:26:39 UTC−03 |
| A2 | SMLP | 3 | 15 | 3 | 16761,963187 | 2026-11-10 23:26:57 UTC−03 |
| A2 | SMLP | 4 | 15 | 3 | 16623,181247 | 2026-11-10 23:27:15 UTC−03 |

### Cohorte 1 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 10404,038 | 11290,470 | +8,520077 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 320,381 | 358,583 | +11,923888 % | `over_budget_with_noise_unresolved` |
| STCK | `known_prefix_service` | 16 / 16 | 8,408 | 8,686 | +3,297762 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,130 | 10,558 | +4,225692 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,224487 | 0,207546 | −7,546334 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 801,132 | 925,180 | +15,484061 % | `over_budget_with_noise_unresolved` |
| STCK | `persistence` | 52 / 52 | 174,984 | 212,744 | +21,579248 % | `over_budget_with_noise_unresolved` |
| STCK | `restoration` | 48 / 48 | 16,738 | 19,148 | +14,399007 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 4 / 4 | 17186,473 | 17212,592 | +0,151972 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 436,586 | 426,632 | −2,279977 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 10,372 | 10,205 | −1,609946 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,696 | 13,420 | +5,708856 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,384043 | 0,436509 | +13,661769 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 842,788 | 871,914 | +3,455872 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 163,360 | 158,408 | −3,031750 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 8,642 | 7,568 | −12,424888 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `new_decision` +11,923888 %** (`over_budget_with_noise_unresolved`); **STCK `acquisition_and_persistence` +15,484061 %** (`over_budget_with_noise_unresolved`); **STCK `persistence` +21,579248 %** (`over_budget_with_noise_unresolved`); **STCK `restoration` +14,399007 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_guard` +13,661769 %** (`over_budget_with_noise_unresolved`).

### Cohorte 1 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10376,587 à 10791,935 | 11013,257 à 11547,503 | indisponible / indisponible | indisponible | 3,992180 % / 4,731831 % |
| STCK | `new_decision` | 233,585 à 724,558 | 235,334 à 920,232 | 698,841 / 641,400 | −8,219470 % | 18,656362 % / 19,210882 % |
| STCK | `known_prefix_service` | 7,552 à 23,718 | 7,901 à 20,350 | indisponible / indisponible | indisponible | 37,501497 % / 18,705640 % |
| STCK | `known_prefix_request` | 9,134 à 25,962 | 9,425 à 22,402 | indisponible / indisponible | indisponible | 38,340800 % / 14,023861 % |
| STCK | `known_prefix_guard` | 0,083514 à 0,430546 | 0,089372 à 11,004 | indisponible / indisponible | indisponible | 53,474761 % / 52,170820 % |
| STCK | `acquisition_and_persistence` | 451,203 à 3686,705 | 462,189 à 4140,967 | 3546,862 / 3787,185 | +6,775655 % | 17,207054 % / 7,214860 % |
| STCK | `persistence` | 15,056 à 847,953 | 17,013 à 501,938 | 506,410 / 471,376 | −6,918265 % | 18,697927 % / 19,608496 % |
| STCK | `restoration` | 2,056 à 166,239 | 2,489 à 196,697 | 137,840 / 137,636 | −0,148088 % | 7,011115 % / 16,493141 % |
| SMLP | `session_elapsed` | 15644,488 à 18159,580 | 16800,285 à 18739,789 | indisponible / indisponible | indisponible | 14,634136 % / 11,267941 % |
| SMLP | `new_decision` | 266,578 à 885,781 | 259,199 à 910,232 | 828,875 / 876,650 | +5,763861 % | 36,244341 % / 9,157642 % |
| SMLP | `known_prefix_service` | 7,879 à 13,706 | 8,174 à 22,807 | 12,472 / 22,364 | +79,314692 % | 34,535164 % / 20,622030 % |
| SMLP | `known_prefix_request` | 9,894 à 16,601 | 10,365 à 25,204 | 15,402 / 24,640 | +59,982422 % | 33,504903 % / 26,034550 % |
| SMLP | `known_prefix_guard` | 0,214587 à 0,620347 | 0,196851 à 11,464 | 0,582400 / 10,936 | +1777,733860 % | 52,577070 % / 51,022498 % |
| SMLP | `acquisition_and_persistence` | 415,215 à 2825,260 | 396,555 à 3117,019 | 2776,852 / 2778,039 | +0,042755 % | 29,150027 % / 22,279342 % |
| SMLP | `persistence` | 13,556 à 368,640 | 13,341 à 341,737 | 260,699 / 276,878 | +6,205784 % | 17,766529 % / 15,511001 % |
| SMLP | `restoration` | 2,341 à 63,984 | 2,199 à 87,820 | 52,822 / 61,535 | +16,494533 % | 14,791117 % / 34,313109 % |

Hausses de p95 supérieures à +10 %, sans attribution causale par cette seule mesure : **SMLP `known_prefix_service` +79,314692 %**; **SMLP `known_prefix_request` +59,982422 %**; **SMLP `known_prefix_guard` +1777,733860 %**; **SMLP `restoration` +16,494533 %**.

### Cohorte 2 : seize diagnostics

| Jeu | Mesure | Effectif A / B | Médiane A, ms | Médiane B, ms | Variation | Diagnostic conservé |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 4 / 4 | 11475,210 | 11299,866 | −1,528025 % | `within_observed_budget` |
| STCK | `new_decision` | 24 / 24 | 353,808 | 346,789 | −1,983739 % | `within_observed_budget` |
| STCK | `known_prefix_service` | 16 / 16 | 9,068 | 8,170 | −9,905511 % | `within_observed_budget` |
| STCK | `known_prefix_request` | 16 / 16 | 10,876 | 9,793 | −9,958813 % | `within_observed_budget` |
| STCK | `known_prefix_guard` | 16 / 16 | 0,223385 | 0,222168 | −0,544799 % | `within_observed_budget` |
| STCK | `acquisition_and_persistence` | 24 / 24 | 913,133 | 913,640 | +0,055562 % | `within_observed_budget` |
| STCK | `persistence` | 52 / 52 | 200,578 | 188,472 | −6,035762 % | `within_observed_budget` |
| STCK | `restoration` | 48 / 48 | 17,890 | 20,018 | +11,897738 % | `over_budget_with_noise_unresolved` |
| SMLP | `session_elapsed` | 4 / 4 | 16881,963 | 16434,686 | −2,649437 % | `within_observed_budget` |
| SMLP | `new_decision` | 36 / 36 | 390,555 | 395,842 | +1,353677 % | `within_observed_budget` |
| SMLP | `known_prefix_service` | 24 / 24 | 9,930 | 10,560 | +6,341405 % | `within_observed_budget` |
| SMLP | `known_prefix_request` | 24 / 24 | 12,246 | 12,881 | +5,183351 % | `within_observed_budget` |
| SMLP | `known_prefix_guard` | 24 / 24 | 0,349056 | 0,398595 | +14,192299 % | `over_budget_with_noise_unresolved` |
| SMLP | `acquisition_and_persistence` | 36 / 36 | 861,932 | 810,359 | −5,983340 % | `within_observed_budget` |
| SMLP | `persistence` | 76 / 76 | 156,460 | 147,367 | −5,811808 % | `within_observed_budget` |
| SMLP | `restoration` | 72 / 72 | 9,081 | 8,930 | −1,656676 % | `within_observed_budget` |

Tous les dépassements de médiane de cet ensemble restent conservés : **STCK `restoration` +11,897738 %** (`over_budget_with_noise_unresolved`); **SMLP `known_prefix_guard` +14,192299 %** (`over_budget_with_noise_unresolved`).

### Cohorte 2 : dispersion et p95

| Jeu | Mesure | Min à max A, ms | Min à max B, ms | p95 A / B, ms | Variation p95 | Étendue relative des médianes de session A / B |
| --- | --- | --- | --- | --- | --- | --- |
| STCK | `session_elapsed` | 10966,345 à 12255,217 | 10964,855 à 11887,354 | indisponible / indisponible | indisponible | 11,231792 % / 8,163806 % |
| STCK | `new_decision` | 254,549 à 740,377 | 248,130 à 861,493 | 711,808 / 719,565 | +1,089740 % | 19,343838 % / 10,730095 % |
| STCK | `known_prefix_service` | 8,144 à 11,056 | 7,342 à 23,572 | indisponible / indisponible | indisponible | 25,651133 % / 28,822264 % |
| STCK | `known_prefix_request` | 9,628 à 13,387 | 8,880 à 25,548 | indisponible / indisponible | indisponible | 22,503582 % / 29,504845 % |
| STCK | `known_prefix_guard` | 0,087509 à 0,273975 | 0,084294 à 0,524524 | indisponible / indisponible | indisponible | 18,148180 % / 49,274586 % |
| STCK | `acquisition_and_persistence` | 513,136 à 4458,406 | 431,707 à 4204,056 | 3980,527 / 4045,342 | +1,628299 % | 10,735673 % / 12,693594 % |
| STCK | `persistence` | 16,888 à 564,925 | 14,029 à 636,381 | 555,246 / 520,497 | −6,258426 % | 17,369543 % / 41,246570 % |
| STCK | `restoration` | 2,558 à 184,177 | 2,214 à 195,854 | 144,349 / 156,933 | +8,717747 % | 22,031780 % / 3,991423 % |
| SMLP | `session_elapsed` | 16623,181 à 17810,952 | 15879,819 à 16827,246 | indisponible / indisponible | indisponible | 7,035738 % / 5,764800 % |
| SMLP | `new_decision` | 235,117 à 927,714 | 235,556 à 972,353 | 912,368 / 871,951 | −4,429917 % | 25,856154 % / 18,347810 % |
| SMLP | `known_prefix_service` | 7,940 à 20,965 | 7,895 à 13,316 | 16,494 / 13,194 | −20,009480 % | 17,233919 % / 32,342479 % |
| SMLP | `known_prefix_request` | 9,901 à 23,282 | 9,788 à 16,250 | 18,994 / 16,098 | −15,246030 % | 16,549792 % / 29,607714 % |
| SMLP | `known_prefix_guard` | 0,192144 à 0,882664 | 0,195048 à 0,578765 | 0,641062 / 0,567558 | −11,465974 % | 35,685938 % / 20,962002 % |
| SMLP | `acquisition_and_persistence` | 416,547 à 2877,336 | 372,818 à 3197,120 | 2587,057 / 2802,995 | +8,346848 % | 10,420007 % / 21,718686 % |
| SMLP | `persistence` | 13,649 à 310,199 | 16,710 à 247,477 | 243,250 / 239,970 | −1,348503 % | 8,978743 % / 8,233833 % |
| SMLP | `restoration` | 2,457 à 100,443 | 2,391 à 58,839 | 44,792 / 41,251 | −7,905042 % | 14,977141 % / 15,273157 % |

Aucune hausse de p95 calculable supérieure à +10 % dans cet ensemble ; les p95 indisponibles restent signalés.

## Inspection et Pause

Ces observations restent hors des seize diagnostics de coût. L’inspection inclut le service natif et, pour `endToEnd`, le transport worker ; elle ne mesure pas un inspecteur rendu à l’écran. Toutes les variations restent affichées.

| Cohorte | Jeu | Inspection | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `nativeService` | 12 / 12 | 202,237 / 215,423 | +6,520038 % | 185,895 à 257,186 / 192,254 à 302,484 | indisponible / indisponible |
| 1 | STCK | `endToEnd` | 12 / 12 | 367,700 / 381,246 | +3,683723 % | 325,948 à 451,925 / 322,741 à 479,009 | indisponible / indisponible |
| 1 | SMLP | `nativeService` | 12 / 12 | 225,155 / 222,177 | −1,322310 % | 210,966 à 250,464 / 202,994 à 294,540 | indisponible / indisponible |
| 1 | SMLP | `endToEnd` | 12 / 12 | 409,485 / 385,143 | −5,944708 % | 357,978 à 454,207 / 353,368 à 530,523 | indisponible / indisponible |
| 2 | STCK | `nativeService` | 12 / 12 | 208,715 / 235,531 | +12,848222 % | 186,738 à 267,578 / 190,552 à 303,097 | indisponible / indisponible |
| 2 | STCK | `endToEnd` | 12 / 12 | 398,858 / 434,424 | +8,916906 % | 336,224 à 455,648 / 363,085 à 507,835 | indisponible / indisponible |
| 2 | SMLP | `nativeService` | 12 / 12 | 224,441 / 228,491 | +1,804127 % | 197,717 à 264,821 / 196,143 à 288,337 | indisponible / indisponible |
| 2 | SMLP | `endToEnd` | 12 / 12 | 395,158 / 396,854 | +0,429291 % | 366,922 à 459,032 / 352,640 à 488,385 | indisponible / indisponible |

La Pause est observée pendant la planification initiale et à la première action engagée. Les journaux gardent l’acquittement et l’action atteinte à la frontière sûre. Le délai vers cette frontière inclut le travail en cours ; il ne démontre pas une interruption immédiate de toute recherche arbitrairement longue.

| Cohorte | Jeu | Contexte | Latence | Effectif A / B | Médiane A / B, ms | Variation | Min à max A / B, ms | p95 A / B, ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,012088 / 0,010345 | −14,418662 % | 0,008772 à 0,049223 / 0,006800 à 0,079768 | indisponible / indisponible |
| 1 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 990,840 / 1070,655 | +8,055268 % | 838,270 à 1221,616 / 1013,068 à 1117,475 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,018767 / 0,016524 | −11,951512 % | 0,014982 à 0,080228 / 0,010726 à 0,037796 | indisponible / indisponible |
| 1 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 830,322 / 883,233 | +6,372325 % | 811,338 à 1034,989 / 866,191 à 950,435 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,009004 / 0,007731 | −14,133393 % | 0,005829 à 0,018277 / 0,003475 à 0,020400 | indisponible / indisponible |
| 1 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1401,106 / 1490,472 | +6,378274 % | 1333,767 à 1578,739 / 1415,157 à 1524,939 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,007370 / 0,005464 | −25,873414 % | 0,004646 à 0,023464 / 0,004146 à 0,021441 | indisponible / indisponible |
| 1 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 781,604 / 779,011 | −0,331799 % | 690,965 à 932,918 / 722,845 à 823,410 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `acknowledgement` | 4 / 4 | 0,015543 / 0,017661 | +13,626713 % | 0,006630 à 0,042042 / 0,011477 à 0,039057 | indisponible / indisponible |
| 2 | STCK | `initial_planning` | `safeBoundary` | 4 / 4 | 1081,437 / 1060,035 | −1,978996 % | 999,659 à 1228,741 / 892,830 à 1155,909 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `acknowledgement` | 4 / 4 | 0,015583 / 0,016179 | +3,821350 % | 0,010266 à 0,022463 / 0,011106 à 0,019869 | indisponible / indisponible |
| 2 | STCK | `engaged_action` | `safeBoundary` | 4 / 4 | 971,673 / 1003,567 | +3,282346 % | 963,400 à 1122,927 / 872,142 à 1146,811 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `acknowledgement` | 4 / 4 | 0,015047 / 0,007546 | −49,850469 % | 0,006831 à 0,022353 / 0,005989 à 0,020791 | indisponible / indisponible |
| 2 | SMLP | `initial_planning` | `safeBoundary` | 4 / 4 | 1579,883 / 1446,747 | −8,426909 % | 1526,983 à 1628,699 / 1319,076 à 1634,407 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `acknowledgement` | 4 / 4 | 0,006465 / 0,005528 | −14,479078 % | 0,004066 à 0,024426 / 0,004386 à 0,026029 | indisponible / indisponible |
| 2 | SMLP | `engaged_action` | `safeBoundary` | 4 / 4 | 794,814 / 769,542 | −3,179563 % | 721,317 à 838,941 / 689,308 à 802,478 | indisponible / indisponible |

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
| 1 | STCK | A | `heapUsed` | 64 | 280,682 | 91,920 à 584,990 |
| 1 | STCK | A | `rss` | 64 | 903,965 | 547,398 à 1005,539 |
| 1 | SMLP | A | `heapUsed` | 96 | 315,165 | 123,089 à 613,281 |
| 1 | SMLP | A | `rss` | 96 | 1028,455 | 808,340 à 1104,891 |
| 1 | STCK | B | `heapUsed` | 64 | 252,734 | 83,858 à 515,008 |
| 1 | STCK | B | `rss` | 64 | 961,000 | 555,844 à 1027,984 |
| 1 | SMLP | B | `heapUsed` | 96 | 298,949 | 135,514 à 607,129 |
| 1 | SMLP | B | `rss` | 96 | 1027,945 | 804,020 à 1102,426 |
| 2 | STCK | A | `heapUsed` | 64 | 315,873 | 106,710 à 546,207 |
| 2 | STCK | A | `rss` | 64 | 957,535 | 562,027 à 996,848 |
| 2 | SMLP | A | `heapUsed` | 96 | 322,784 | 95,569 à 580,073 |
| 2 | SMLP | A | `rss` | 96 | 1009,340 | 782,254 à 1077,074 |
| 2 | STCK | B | `heapUsed` | 64 | 298,173 | 126,450 à 536,460 |
| 2 | STCK | B | `rss` | 64 | 906,631 | 543,066 à 986,727 |
| 2 | SMLP | B | `heapUsed` | 96 | 287,577 | 101,880 à 566,891 |
| 2 | SMLP | B | `rss` | 96 | 1005,123 | 787,734 à 1083,641 |

## Calculs, empreintes et transport

La [revue de consolidation](owner-growth-review.json) recalcule les distributions, ratios et classements depuis les quatre rapports bruts. La [revue globale](owner-growth-review.json) recalcule les durées complètes, avec multiplicité de chaque session préservée. La déclaration et la readiness établissent séparément l’antériorité de la politique pour cette fenêtre. Les deux générateurs exécutés sont exactement ceux déclarés avant la fenêtre, avec leur lecteur borné des entrées baseline. Cette provenance ne remplace pas les vérifications chronologiques. Aucun ratio de phase ou de cohorte n’est substitué au global.

| Pièce | SHA-256 |
| --- | --- |
| declaration.json | `d3aac0ec5975a480099641b999ef81a5d74929446d748ba8b8311e7e2184f4dd` |
| global-budget-policy.json | `b15eed60c5f068d9a60db1494a3e5406bc89c3e15339d5c5700abce283af533a` |
| owner-growth-comparison.json | `3ad759ab4ced920a844165853a7dc621586878dcc83151bef3d3f2b299bd7243` |
| owner-growth-review.json | `4954a1cd25f5bc6df54d2a317cf1b49d3669769773b2d964d8b7d5aa500bab96` |

Le [reçu de transport](log-transport.json) lie les originaux et leurs copies gzip sans perte. Le générateur du présent rapport vérifie à nouveau les empreintes et l’égalité exacte après décompression, sans modifier les journaux.

| Série | Rapport | Journal compressé | Octets originaux | Octets gzip |
| --- | --- | --- | --- | --- |
| A1 | [cohort1/baseline.json](cohort1/baseline.json) | [cohort1/baseline.log.gz](cohort1/baseline.log.gz) | 1581 | 444 |
| B1 | [cohort1/after.json](cohort1/after.json) | [cohort1/after.log.gz](cohort1/after.log.gz) | 1590 | 448 |
| B2 | [cohort2/after.json](cohort2/after.json) | [cohort2/after.log.gz](cohort2/after.log.gz) | 1578 | 443 |
| A2 | [cohort2/baseline.json](cohort2/baseline.json) | [cohort2/baseline.log.gz](cohort2/baseline.log.gz) | 1588 | 447 |

## Décision et portée fonctionnelle

**Le coût est accepté pour native 0.58.0 dans cette fenêtre**, selon le reçu `accepted_under_predeclared_owner_cost_rule`. Les **2 dépassement(s) agrégé(s)** et tous les diagnostics de cohorte, p95, dispersions, inspections, pauses et échantillons mémoire restent visibles. Aucun seuil, observation ou cohorte n’est modifié par ce rapport.

La [readiness](readiness.json) rassemble les preuves disponibles, leurs limites et les réserves conservées. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle des matériaux adressés, de revalidation source ou de parité de l’appelant complet. La preuve intégrée synthétique et les éventuelles campagnes en jeu, avec leurs horloges cumulées, restent consignées dans leurs reçus propres ; le présent rapport n’en déduit aucune réussite. Le statut réel de contribution relève de ces preuves, séparément de la décision de coût. La règle globale ne transforme pas ce raccordement en migration globale complète.
