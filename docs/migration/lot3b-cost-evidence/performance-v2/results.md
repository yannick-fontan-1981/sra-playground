# Correction 3B : coût officiel du gel 391a279

## Décision conservée

**Le deuxième essai officiel de correction reste non conforme : `budget_review_required`, 14/16 médianes dans le seuil annoncé.** Les deux dépassements agrégés concernent SMLP : **acquisition et persistance +11,641662058 %**, **restauration +14,988511609 %**. Ils restent `over_budget_with_noise_unresolved`. La restauration STCK est dans le seuil agrégé à **+4,218399745 %** ; ce résultat ne compense aucun dépassement SMLP. **3B reste ouvert et 3C attend sa clôture.**

La [comparaison agrégée](combined-comparison.json) retient toutes les sessions fixées. La [revue indépendante](consolidation-review.json) passe **231 vérifications**, confirme **32 sessions uniques et 400 actions**, et reproduit les distributions, médianes, p95, dispersions, classifications et effectifs des deux cohortes et de l'agrégat. Son statut `passed` porte sur la cohérence de l'arithmétique ; son **`budgetStatus: budget_review_required`** conserve l'échec du budget. Les comparateurs et règles de décision sont inchangés.

Le gel possède ses validations fonctionnelles et trois niveaux CATR confirmés. La publication privée de cette révision reste à effectuer ; aucun numéro ni succès de déploiement n'est anticipé dans ce bilan.

## Sources mesurées et conservation des essais

| Référence | Octets effectivement mesurés |
| --- | --- |
| A, référence 0.38 fraîche | Publication 66, commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0`, 245 fichiers natifs, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff` |
| B, nouvelle correction 0.40 | Gel `final-v3`, 249 fichiers natifs, digest `391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9`, archive de 260 fichiers |

Le [protocole](protocol.md) a été déclaré le **10 novembre 2026 à 02:06:31 UTC**, avant toute session officielle de cette fenêtre. [Les cas](cases.json) et [la politique](comparison-policy.json) sont des copies exactes de ceux du premier essai. La référence 0.38 est remesurée entièrement ; aucun temps ni échantillon antérieur n'est réutilisé.

Cette correction modifie réellement quatre fichiers natifs par rapport au gel `f0ba` : propriétaire natif, témoin mutable, inventaire observé et série commune. Le numéro moteur 0.40.0 commun aux deux corrections ne suffit pas à les distinguer ; leurs digests identifient leurs octets. Les sources originales V5/V6 restent inchangées.

L'[essai précédent `f0ba`](../performance/results.md) reste **14/16**, avec restauration STCK +66,160 % et SMLP +21,511 %. Ses deux cohortes, reçus, profils, comparaisons et revue restent intacts. Il n'est ni fusionné avec ce nouvel essai ni réécrit. Les variations entre deux fenêtres distinctes ne constituent pas une mesure isolée du gain de la correction : les références, moments et conditions observées diffèrent.

## Fenêtre, environnement et travail comparé

La [fenêtre complète](window.json) s'est déroulée le **10 novembre 2026, de 02:14:55,244567 à 02:24:16,686977 UTC**, dans l'ordre annoncé **A1, B1, B2, A2**. Les quatre commandes se sont terminées avec code 0 ; les sources et entrées sont restées inchangées. Les statuts `passed` de la fenêtre et de son intégrité valident l'exécution, pas le budget.

| Ordre | Source | Début UTC | Fin UTC |
| --- | --- | --- | --- |
| A1 | 0.38 référence | 02:14:55.334685 | 02:17:20.528775 |
| B1 | 0.40 gel 391a279 | 02:17:20.601758 | 02:19:50.910971 |
| B2 | 0.40 gel 391a279 | 02:19:50.986727 | 02:22:03.844000 |
| A2 | 0.38 référence | 02:22:03.935723 | 02:24:16.569334 |

L'environnement déclaré est **Node v24.22.1, Linux 6.18.57, AMD EPYC 9V74, neuf processeurs logiques**. Les deux versions conservent les mêmes descriptions d'environnement, traces publiques, déclarations et générateurs.

| Cas | Actions par session | Niveaux terminés par session | Sessions par version | Actions par version |
| --- | ---: | ---: | ---: | ---: |
| STCK | 10 | 2 | 8 | 80 |
| SMLP | 15 | 3 | 8 | 120 |
| **Total** | | | **16** | **200** |

Les deux versions totalisent **32 sessions et 400 actions**. Chaque session reçoit un nouveau runtime et une mémoire de connaissances froide. Le worker de chaque cas sert sa chauffe puis quatre sessions mesurées ; son JIT n'est pas redémarré entre ces sessions. Les seules exclusions restent les **huit sessions de chauffe de trois actions**, soit **24 actions** hors mesure officielle. Aucune session mesurée, valeur extrême ou cohorte n'est retirée.

Le moteur recalcule chaque commande avant réception du paquet public enregistré correspondant. Le travail, les effectifs et le placement des phases concordent dans le périmètre de la signature vérifiée. Les temps, tailles mémoire, horodatages et identités d'implémentation restent différents ; cette égalité de travail ne signifie pas identité des rapports ou du graphe privé complet.

## Les seize médianes agrégées

Les médianes sont calculées directement sur tous les échantillons des deux cohortes, sans moyenne de leurs ratios. Le seuil **+10 %** s'applique à chaque cellule de décision. Les phases s'imbriquent et ne s'additionnent pas. Les valeurs affichées sont arrondies ; les JSON conservent la précision utilisée pour la décision.

### STCK

| Phase | Échantillons par version | Médiane 0.38 (ms) | Médiane 391a279 (ms) | Variation | Budget |
| --- | --- | --- | --- | --- | --- |
| Session complète | 8 | 11 129,816400 | 11 367,221529 | +2,133 % | Conforme |
| Nouvelle décision | 48 | 303,349890 | 308,220933 | +1,606 % | Conforme |
| Service de continuation | 32 | 8,677695 | 8,276330 | -4,625 % | Conforme |
| Requête de continuation avec transport | 32 | 10,474928 | 10,104543 | -3,536 % | Conforme |
| Garde de continuation | 32 | 0,221373 | 0,229220 | +3,544 % | Conforme |
| Acquisition et persistance | 48 | 976,903100 | 1 019,591276 | +4,370 % | Conforme |
| Persistance | 104 | 192,087972 | 183,082484 | -4,688 % | Conforme |
| Restauration | 96 | 11,058245 | 11,524726 | +4,218 % | Conforme |

### SMLP

| Phase | Échantillons par version | Médiane 0.38 (ms) | Médiane 391a279 (ms) | Variation | Budget |
| --- | --- | --- | --- | --- | --- |
| Session complète | 8 | 18 086,016173 | 18 502,232672 | +2,301 % | Conforme |
| Nouvelle décision | 72 | 400,379006 | 386,904257 | -3,365 % | Conforme |
| Service de continuation | 48 | 10,577592 | 9,428676 | -10,862 % | Conforme |
| Requête de continuation avec transport | 48 | 12,879126 | 11,711459 | -9,066 % | Conforme |
| Garde de continuation | 48 | 0,372351 | 0,370745 | -0,431 % | Conforme |
| Acquisition et persistance | 72 | 987,286711 | 1 102,223294 | +11,642 % | **Non résolu** |
| Persistance | 152 | 145,306508 | 155,495527 | +7,012 % | Conforme |
| Restauration | 144 | 4,871004 | 5,601095 | +14,989 % | **Non résolu** |

### Dépassements SMLP

Les deux résultats restent au-dessus de la borne exacte annoncée. La dispersion ne leur accorde aucune tolérance supplémentaire.

| Phase | Hausse absolue de médiane (ms) | Plafond à +10 % (ms) | Excès au-dessus du plafond (ms) |
| --- | --- | --- | --- |
| Acquisition et persistance | 114,936583 | 1 086,015383 | 16,207911 |
| Restauration | 0,730091 | 5,358104 | 0,242991 |

Les baisses de nouvelle décision ou continuation ne compensent pas ces dépassements locaux. La qualification `over_budget_with_noise_unresolved` signifie précisément que le budget demeure non résolu ; elle n'accepte pas une hausse au motif du bruit.

## Les deux cohortes restent intégralement visibles

| Cohorte | Médianes dans le seuil | Statut | Dépassements conservés |
| --- | --- | --- | --- |
| 1 | 14/16 | budget_review_required | STCK restauration **+10,266 %** ; SMLP restauration **+22,777 %** |
| 2 | 13/16 | budget_review_required | STCK garde de continuation **+11,078 %** ; SMLP acquisition et persistance **+12,112 %** ; SMLP restauration **+13,801 %** |

| Phase | STCK C1 | STCK C2 | SMLP C1 | SMLP C2 |
| --- | --- | --- | --- | --- |
| Session complète | +0,744 % | -1,175 % | +3,624 % | +0,732 % |
| Nouvelle décision | +1,167 % | +8,233 % | -2,565 % | -3,436 % |
| Service de continuation | -20,293 % | +1,150 % | -5,907 % | -10,120 % |
| Requête de continuation avec transport | -19,617 % | +1,987 % | -4,723 % | -7,625 % |
| Garde de continuation | -18,442 % | +11,078 % | -1,840 % | -13,287 % |
| Acquisition et persistance | -0,637 % | +2,519 % | -1,548 % | +12,112 % |
| Persistance | -5,052 % | -3,733 % | +4,496 % | +0,547 % |
| Restauration | +10,266 % | -14,335 % | +22,777 % | +13,801 % |

Aucune cohorte n'est choisie pour obtenir un verdict favorable. Les deux cohortes sont non conformes, et l'agrégat de toutes les distributions reste 14/16. Leurs critères dépassés diffèrent ; chaque résultat original demeure conservé.

## p95 disponibles, hors décision des seize médianes

Le p95 est le rang empirique `ceil(0.95 × n)`, publié uniquement pour **n ≥ 20**. Les huit durées de session par cas et version n'ont donc pas de p95 publié. Les observations d'une même session restent corrélées. Les p95 ci-dessous sont descriptifs et leurs hausses ne sont pas masquées.

| Cas | Phase | p95 0.38 (ms) | p95 391a279 (ms) | Variation |
| --- | --- | --- | --- | --- |
| STCK | Nouvelle décision | 483,506481 | 521,698398 | +7,899 % |
| STCK | Service de continuation | 14,552361 | 11,586436 | -20,381 % |
| STCK | Requête de continuation avec transport | 17,117087 | 15,423605 | -9,894 % |
| STCK | Garde de continuation | 0,576615 | 0,714042 | +23,833 % |
| STCK | Acquisition et persistance | 4 089,357990 | 4 131,273326 | +1,025 % |
| STCK | Persistance | 370,854259 | 351,990242 | -5,087 % |
| STCK | Restauration | 67,251426 | 72,660974 | +8,044 % |
| SMLP | Nouvelle décision | 803,012235 | 880,533381 | +9,654 % |
| SMLP | Service de continuation | 15,759865 | 16,513328 | +4,781 % |
| SMLP | Requête de continuation avec transport | 18,869112 | 20,222444 | +7,172 % |
| SMLP | Garde de continuation | 0,657019 | 0,571635 | -12,996 % |
| SMLP | Acquisition et persistance | 3 070,151960 | 3 159,468527 | +2,909 % |
| SMLP | Persistance | 309,302384 | 296,538892 | -4,127 % |
| SMLP | Restauration | 25,194492 | 25,510149 | +1,253 % |

## Dispersion observée

L'étendue relative des médianes par session décrit la dispersion de cette fenêtre ; elle n'est ni un intervalle de confiance ni une marge d'acceptation. Toutes les variations restent dans les rapports.

| Phase | STCK 0.38 | STCK 391a279 | SMLP 0.38 | SMLP 391a279 |
| --- | --- | --- | --- | --- |
| Session complète | 16,556 % | 29,787 % | 15,222 % | 22,822 % |
| Nouvelle décision | 28,463 % | 50,641 % | 27,802 % | 52,838 % |
| Service de continuation | 68,679 % | 40,226 % | 20,201 % | 39,432 % |
| Requête de continuation avec transport | 64,258 % | 40,542 % | 24,299 % | 37,573 % |
| Garde de continuation | 73,102 % | 73,271 % | 29,023 % | 45,009 % |
| Acquisition et persistance | 32,357 % | 26,507 % | 41,382 % | 31,712 % |
| Persistance | 36,798 % | 41,208 % | 23,226 % | 18,381 % |
| Restauration | 34,031 % | 60,168 % | 28,335 % | 43,776 % |

## Pause, inspection et mémoire

Toutes les demandes de pause mesurées sont acquittées. La planification initiale atteint une frontière à zéro action avec ticket en attente conservé ; la première action engagée rejoint une frontière sûre après son acquisition, à une action. Cela établit la frontière prévue, pas une préemption arbitraire de recherche.

| Cas et phase | Accusé médian 0.38 (ms) | Accusé médian 391a279 (ms) | Frontière sûre médiane 0.38 (ms) | Frontière sûre médiane 391a279 (ms) |
| --- | --- | --- | --- | --- |
| STCK, planification initiale | 0,009 | 0,009 | 1 016,544 | 1 078,002 |
| STCK, action engagée | 0,014 | 0,013 | 916,776 | 890,455 |
| SMLP, planification initiale | 0,007 | 0,008 | 1 517,386 | 1 469,596 |
| SMLP, action engagée | 0,006 | 0,006 | 791,411 | 804,230 |

Trois inspections sont demandées après chaque rejeu, soit **24 inspections par cas et par version**. Elles sont exclues de la durée du rejeu et des seize critères.

| Cas | Service médian 0.38 (ms) | Service médian 391a279 (ms) | Bout en bout médian 0.38 (ms) | Bout en bout médian 391a279 (ms) | Nœuds observés |
| --- | --- | --- | --- | --- | --- |
| STCK | 176,821 | 188,389 | 329,488 | 351,060 | 344 |
| SMLP | 202,699 | 214,522 | 365,922 | 370,162 | 412 |

Les échantillons `heapUsed` et `rss` restent dans les rapports bruts. Ils dépendent notamment du GC et du processus worker ; aucune conclusion de fuite ou de stabilité mémoire pendant plusieurs heures n'est tirée de ces sessions.

## Preuves fonctionnelles et limites de causalité

Le gel `391a279` a passé **1 322/1 322 tests dans 35 fichiers**, les contrôles du projet et **34/34 comparaisons de régression CATR/RSWP**, avec ses propres reçus dans [final-v3](../final-v3/validation/delta-tests-run.json). La [campagne froide CATR](../final-v3/catr-cost-v3-session/execution-catr.json) et le [navigateur](../final-v3/browser/browser-verification.json) confirment **12 actions, trois niveaux et huit plans**. Le navigateur utilise la prévisualisation Vite des sources TypeScript gelées ; ce contrôle est distinct du worker compilé dans `dist`. Trois niveaux terminés ne signifient pas une victoire complète du jeu. Ces succès fonctionnels ne ferment pas un budget échoué.

Les [diagnostics normaux v2](../diagnostic/results.md) comparent `f0ba` à `391a279` avec six contrôles exacts par cas, `strictFinalEquality: false` et toutes les différences d'effectifs et témoins conservées. Leur instrumentation garde les projections et restaurations source intactes, mais observe d'autres méthodes. Leurs temps sont distincts de ceux du runner officiel ; une session diagnostique par source ne détermine ni le seuil +10 % ni la cause complète des dépassements officiels. Les anciens profils instrumentés de repli et leurs hausses sont également conservés.

Le temps du jeu, le réseau de production, le rendu navigateur et les inspections après rejeu sont exclus des métriques du budget. Le protocole fixe l'isolation des travaux ; la revue arithmétique ne vérifie pas indépendamment l'ordonnancement du système d'exploitation ni l'exactitude physique des horloges. Les dépendances entre appels d'une même session limitent les conclusions statistiques. Ces mesures ne prédisent pas la même latence sur tout matériel et ne prouvent pas la stabilité de sessions de plusieurs heures.

La cause précise des deux dépassements SMLP n'est pas isolée par ce bilan. Les améliorations locales de travail observées et l'égalité fonctionnelle ne démontrent pas que la correction satisfait son budget. Une nouvelle progression vers la clôture devra traiter les dépassements conservés, sans modifier les seuils ni sélectionner une mesure favorable du même code. **Le résultat publié doit rester : validations fonctionnelles acquises, budget non conforme, 3B ouvert et 3C en attente.**

## Fichiers conservés

- [Référence C1](cohort1/baseline.json), [journal référence C1](cohort1/baseline.log), [correction C1](cohort1/after.json), [journal correction C1](cohort1/after.log).
- [Correction C2](cohort2/after.json), [journal correction C2](cohort2/after.log), [référence C2](cohort2/baseline.json), [journal référence C2](cohort2/baseline.log).
- [Comparaison C1](cohort1/comparison.json), [comparaison C2](cohort2/comparison.json), [agrégat](combined-comparison.json), [revue indépendante](consolidation-review.json), [fenêtre](window.json).
- [Premier essai officiel 0.40 conservé](../performance/results.md), [bilan principal](../../lot3b-cost-correction.md).

Aucun reçu mesuré, comparateur, paramètre annoncé ni résultat de cohorte n'a été réécrit pour cette consolidation. Aucune mesure supplémentaire n'a été exécutée.
