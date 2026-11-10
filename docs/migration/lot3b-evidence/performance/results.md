# Lot 3B : résultats de coût, moteur 0.39.0

## Décision : coût encore ouvert

**Le budget officiel du lot 3B n’est pas validé : 15/16 médianes agrégées respectent le seuil annoncé de +10 %.** La restauration des familles sur STCK passe de **9,104 ms à 10,806 ms**, soit **+18,686 %**. Le statut est `budget_review_required`, avec un dépassement `over_budget_with_noise_unresolved`. Le bruit ne relève pas le seuil et ne transforme pas ce dépassement en succès.

Le [résultat fonctionnel CATR](../final/catr-resolution.json) et la [contribution relationnelle](../final/catr-session/chamber-contribution.json) restent acquis dans leurs périmètres propres. La publication fonctionnelle **0.39.0** porte donc une réserve de coût. **3B reste ouvert sur ce critère ; la prochaine étape est une correction générique du coût avant 3C.** Aucun nouveau benchmark ou nouvelle sélection de sessions n’est ajouté après examen de ces résultats.

## Protocole, sources et fenêtre

Le [protocole préalable](protocol.md), le [manifeste des cas](cases.json) et la [politique de comparaison](comparison-policy.json) ont été déclarés à **00:08:40 UTC**, avant la fenêtre. Ils fixent une référence **0.38.0 fraîche**, l’intégration **0.39.0 gelée**, deux cohortes de quatre sessions par jeu/version et l’ordre **A1 → B1 → B2 → A2**.

| Version | Origine | Inventaire natif |
| --- | --- | --- |
| Référence 0.38.0 | Publication 66, commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0` | 245 fichiers ; `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff` |
| Intégration 0.39.0 | Gel final du lot 3B | 248 fichiers ; `49648e72cf7d3d719addfe4a6bebd8c29842a0f618664a45ef3929a5d17132b1` |

La [fenêtre d’exécution](window.json) s’étend du **10 novembre 2026, 00:32:09 au 00:41:16 UTC**. Les quatre processus ont terminé avec un code de sortie zéro ; les sources et entrées surveillées sont restées inchangées. Le contrôle d’intégrité de la fenêtre est `passed`. Cette réussite d’exécution est distincte du respect du budget.

| Ordre | Exécution | Début UTC | Fin UTC | Rapport conservé |
| --- | --- | --- | --- | --- |
| 1 | A1, référence | 00:32:09 | 00:34:24 | [cohort1/baseline.json](cohort1/baseline.json) |
| 2 | B1, intégration | 00:34:24 | 00:36:38 | [cohort1/after.json](cohort1/after.json) |
| 3 | B2, intégration | 00:36:38 | 00:38:57 | [cohort2/after.json](cohort2/after.json) |
| 4 | A2, référence | 00:38:57 | 00:41:16 | [cohort2/baseline.json](cohort2/baseline.json) |

Environnement déclaré : **Node v24.22.1**, Linux 6.18.57, AMD EPYC 9V74, neuf processeurs logiques visibles. Il décrit la machine observée sans établir l’identité instantanée du GC, du JIT ou de l’ordonnancement. La prévisualisation, les tests, les builds et les campagnes avaient été arrêtés avant cette fenêtre ; les processus de mesure sont séquentiels.

## Effectifs réellement retenus

| Cas | Actions par session | Niveaux effectivement parcourus par ce rejeu | Sessions mesurées par version | Actions mesurées par version |
| --- | ---: | ---: | ---: | ---: |
| STCK | 10 | 2 | 8 | 80 |
| SMLP | 15 | 3 | 8 | 120 |
| **Total** | | | **16** | **200** |

Les deux versions totalisent **32 sessions mesurées et 400 actions**. Le contrôle STCK porte sur dix actions du parcours public et deux niveaux achevés ; il ne doit pas être présenté comme une nouvelle campagne de trois niveaux.

Chaque exécution d’un cas commence par **une session distincte de trois actions de chauffe**, puis quatre sessions mesurées. `warmupActions: 3` ne signifie pas trois sessions. Sur la fenêtre entière, huit chauffes déclarées restent hors du jeu mesuré. Toutes les sessions mesurées, y compris défavorables, et toutes leurs valeurs extrêmes sont conservées. Chaque session a une mémoire de connaissances froide ; le worker et le JIT sont partagés entre la chauffe et les quatre sessions d’un même cas.

## Les seize critères agrégés

Les durées sont en **millisecondes**. `n` est le nombre de mesures de la phase, pour chacune des deux versions. Les distributions réunissent tous les échantillons des huit sessions ; le résultat n’est pas une moyenne des ratios de cohortes. La variation est `médiane_après / médiane_avant − 1`.

| Cas | Phase | n par version | Médiane 0.38 | Médiane 0.39 | Variation | Budget +10 % |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| STCK | Session complète | 8 | 11 001,673 | 10 953,022 | −0,442 % | Conforme |
| STCK | Nouvelle décision | 48 | 302,175 | 291,009 | −3,695 % | Conforme |
| STCK | Service de continuation | 32 | 8,704 | 8,243 | −5,293 % | Conforme |
| STCK | Requête de continuation avec transport | 32 | 10,380 | 10,176 | −1,965 % | Conforme |
| STCK | Garde de continuation | 32 | 0,221 | 0,217 | −1,756 % | Conforme |
| STCK | Acquisition et persistance | 48 | 975,618 | 979,262 | +0,373 % | Conforme |
| STCK | Persistance | 104 | 174,755 | 182,823 | +4,617 % | Conforme |
| STCK | Restauration des familles | 96 | 9,104 | 10,806 | +18,686 % | **Hors budget** |
| SMLP | Session complète | 8 | 18 275,983 | 18 112,458 | −0,895 % | Conforme |
| SMLP | Nouvelle décision | 72 | 386,507 | 392,281 | +1,494 % | Conforme |
| SMLP | Service de continuation | 48 | 9,660 | 9,366 | −3,050 % | Conforme |
| SMLP | Requête de continuation avec transport | 48 | 11,993 | 11,983 | −0,090 % | Conforme |
| SMLP | Garde de continuation | 48 | 0,353 | 0,340 | −3,744 % | Conforme |
| SMLP | Acquisition et persistance | 72 | 979,026 | 935,763 | −4,419 % | Conforme |
| SMLP | Persistance | 152 | 146,039 | 146,091 | +0,036 % | Conforme |
| SMLP | Restauration des familles | 144 | 4,858 | 4,861 | +0,054 % | Conforme |

La session STCK passe de **11,002 s à 10,953 s** ; SMLP de **18,276 s à 18,112 s**. Ces petites baisses ne compensent pas le dépassement de restauration. Les continuations de service baissent de **5,293 % sur STCK** et de **3,050 % sur SMLP**. Les hausses de persistance, de décision ou de garde en queue de distribution restent documentées ci-dessous.

### Le dépassement de restauration en valeur absolue

La hausse de médiane STCK représente **1,701219 ms** par échantillon de restauration des familles. Le plafond correspondant à +10 % de la référence est **10,014821 ms** ; la médiane observée le dépasse de **0,790781 ms**. Cette taille absolue situe l’écart, sans changer le critère de clôture.

La restauration isolée ne couvre que `restoreFamilies`. La restauration du caller et de l’autorité reste comprise dans les phases qui l’englobent. Les durées des phases sont imbriquées : additionner leurs médianes ou soustraire cette hausse à la durée totale de session ne donnerait pas un coût attribuable fiable.

L’étendue relative des médianes par session de restauration STCK vaut **22,131 %** avant et **48,894 %** après. Les échantillons regroupent plusieurs positions de restauration du parcours. Le protocole conserve cette dispersion ; elle n’est ni un intervalle de confiance ni une preuve que le code ajouté cause l’écart. **La cause du dépassement n’est pas isolée par ces mesures.**

## Résultats des deux cohortes conservés

| Ensemble | Critères conformes | Restauration STCK avant → après | Variation de cette médiane | Statut |
| --- | ---: | ---: | ---: | --- |
| [Cohorte 1](cohort1/comparison.json) | **15/16** | 9,104 → 11,093 ms | **+21,843 %** | `budget_review_required` |
| [Cohorte 2](cohort2/comparison.json) | **16/16** | 9,744 → 8,844 ms | −9,240 % | `passed` |
| [Agrégat annoncé](combined-comparison.json) | **15/16** | 9,104 → 10,806 ms | **+18,686 %** | `budget_review_required` |

La seconde cohorte favorable ne remplace pas la première. Le statut final utilise les huit sessions prévues de chaque cas/version. La différence de sens entre les cohortes reste visible ; aucun échantillon ni cohorte n’est retiré, et aucune tolérance de bruit n’est ajoutée. Les résultats historiques des lots précédents restent séparés et inchangés.

## p95 et queues de distribution

Le p95 est le rang empirique `ceil(0,95 × n)`. Il est publié à partir de **vingt échantillons**. Les huit durées de session par version n’ont donc pas de p95 publié. Les échantillons d’une même session sont corrélés. Le p95 complète le diagnostic ; il n’était pas un dix-septième critère de budget.

| Cas | Phase | p95 0.38, ms | p95 0.39, ms | Variation |
| --- | --- | ---: | ---: | ---: |
| STCK | Nouvelle décision | 416,127 | 453,189 | +8,906 % |
| STCK | Service de continuation | 11,267 | 11,133 | −1,192 % |
| STCK | Requête de continuation avec transport | 13,329 | 13,347 | +0,128 % |
| STCK | Garde de continuation | 0,478 | 0,449 | −6,139 % |
| STCK | Acquisition et persistance | 3 987,852 | 3 961,848 | −0,652 % |
| STCK | Persistance | 337,817 | 347,036 | +2,729 % |
| STCK | Restauration des familles | 64,060 | 63,913 | −0,229 % |
| SMLP | Nouvelle décision | 872,003 | 837,210 | −3,990 % |
| SMLP | Service de continuation | 17,415 | 17,000 | −2,382 % |
| SMLP | Requête de continuation avec transport | 19,929 | 19,392 | −2,696 % |
| SMLP | Garde de continuation | 0,648 | 0,723 | +11,433 % |
| SMLP | Acquisition et persistance | 3 005,518 | 3 026,640 | +0,703 % |
| SMLP | Persistance | 275,342 | 304,006 | +10,410 % |
| SMLP | Restauration des familles | 22,612 | 29,390 | +29,976 % |

Le p95 de restauration STCK reste proche de la référence malgré la hausse de sa médiane. Inversement, plusieurs p95 SMLP augmentent alors que les médianes respectent le budget. Aucun de ces constats n’efface l’autre ; les valeurs complètes, minima, maxima et dispersions sont conservés dans les rapports.

## Inspection et Pause : diagnostics distincts

L’inspection est demandée après chaque rejeu, avec trois appels par session. Elle est **exclue de `replayElapsedMs`** et des seize critères. Les 24 observations par cas/version permettent un p95 de cette opération. Les durées suivantes incluent uniquement le service et, dans la ligne indiquée, le transport worker ; elles ne mesurent pas le rendu de l’inspecteur dans le navigateur.

| Cas | Inspection | n par version | Médiane 0.38, ms | Médiane 0.39, ms | p95 0.38, ms | p95 0.39, ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| STCK | Service natif | 24 | 180,484 | 172,703 | 212,717 | 236,145 |
| STCK | Avec transport | 24 | 319,238 | 314,111 | 358,205 | 384,210 |
| SMLP | Service natif | 24 | 209,726 | 206,648 | 327,022 | 288,789 |
| SMLP | Avec transport | 24 | 364,147 | 368,652 | 550,925 | 469,507 |

Pause est exercée pendant la planification initiale et après la première action engagée. Le retour sûr est observé à zéro puis une action acquise. Son attente se déroule **pendant le rejeu** ; elle ne s’ajoute pas une seconde fois à la durée de session. L’accusé de réception du contrôleur et l’attente de la frontière sûre sont deux mesures distinctes.

| Cas | Moment de Pause | n par version | Accusé 0.38, ms | Accusé 0.39, ms | Frontière sûre 0.38, ms | Frontière sûre 0.39, ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| STCK | Planification initiale | 8 | 0,010650 | 0,009089 | 1 026,519 | 1 009,938 |
| STCK | Première action engagée | 8 | 0,014862 | 0,013374 | 902,453 | 910,565 |
| SMLP | Planification initiale | 8 | 0,012363 | 0,008624 | 1 554,273 | 1 497,732 |
| SMLP | Première action engagée | 8 | 0,005934 | 0,004887 | 813,231 | 734,002 |

Les accusés très courts ne sont pas des temps de réaction visuelle de l’interface. La légère hausse STCK de l’attente après la première action reste au bilan. Ces essais ne prouvent pas l’interruption immédiate d’une recherche arbitraire ; avec huit observations par ligne, aucun p95 de Pause n’est publié.

## Revue indépendante et limites de conclusion

La [revue indépendante](consolidation-review.json), produite par [review-native-cost-consolidation.py](../../../../scripts/review-native-cost-consolidation.py), a passé **231 vérifications** : distributions et médianes, p95, ratios, dispersion, classifications des deux cohortes et de l’agrégat, empreintes, sources, ordre de fenêtre, **32 sessions uniques et 400 actions**. Elle recalcule ces valeurs en Python standard sans lancer le moteur, le jeu, les tests ou le benchmark. Son statut `passed` signifie que le bilan est arithmétiquement cohérent ; son `budgetStatus` demeure **`budget_review_required`**.

Les mesures portent sur un rejeu public contrôlé : le moteur recalcule chaque commande avant de recevoir le retour archivé correspondant. Elles excluent l’exécution du jeu, le réseau de production et le rendu navigateur. Les sources, entrées et outils de mesure sont identifiés par leurs empreintes ; les seuls changements de source attendus sont ceux de la version native mesurée.

Ces sessions finies ne prouvent ni une stabilité sur plusieurs heures, ni une performance identique sur une autre machine, ni la parité globale V5/V6. La réussite fonctionnelle de 3B reste distincte du budget encore ouvert. La suite doit d’abord diagnostiquer la restauration STCK, proposer une correction générique justifiée, puis la vérifier avec un nouveau gel et un protocole annoncé avant les mesures. Les échecs de cette fenêtre resteront conservés.
