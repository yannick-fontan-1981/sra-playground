# Correction 3B : coût de l'essai 0.40, gel f0ba

## Décision conservée

**Le budget n'est pas validé : `budget_review_required`, 14/16 médianes dans le seuil annoncé.** La restauration dépasse +10 % sur les deux cas : **STCK +66,160 %**, **SMLP +21,511 %**. Ces dépassements restent non résolus malgré la dispersion observée. La correction de cet essai n'a donc pas clôturé le coût de 3B et ne rend pas 3C prête.

La [comparaison agrégée](combined-comparison.json) inclut toutes les sessions prévues. La [revue indépendante](consolidation-review.json) réussit **231 vérifications**, confirme **32 sessions uniques et 400 actions**, et reproduit les distributions, médianes, p95, dispersions et classifications des deux cohortes et de l'agrégat. Son statut `passed` valide la cohérence de l'arithmétique et des preuves ; son **`budgetStatus: budget_review_required`** conserve l'échec du budget.

Le dossier de cet essai, ses deux cohortes, leurs sorties et l'agrégat restent inchangés. Une correction de code ultérieure nécessite un nouveau gel et une nouvelle fenêtre déclarée séparément. Aucun nouveau protocole ni résultat de cette correction ultérieure n'est annoncé ici.

## Sources, fenêtre et travail comparé

| Référence | Octets réellement mesurés |
| --- | --- |
| A, référence 0.38 fraîche | Publication 66, commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0`, 245 fichiers natifs, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff` |
| B, correction 0.40 de cet essai | Gel `final-v2`, 249 fichiers natifs, digest `f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece` |

Le [protocole initial](protocol.md) et son [amendement préalable](protocol-amendment-v2.json) sont conservés. L'amendement a seulement changé le chemin du gel corrigé vers `final-v2`, après identification d'un cas d'invalidation supplémentaire. Le premier gel et ses 1 270 tests restent conservés ; ils n'ont servi à aucune cohorte de coût. Paramètres, ordre, cas, seuil et exclusions de la fenêtre sont restés inchangés.

La [fenêtre d'exécution](window.json) s'est déroulée le **10 novembre 2026, de 01:23:37,298776 à 01:32:40,293060 UTC**, dans l'ordre **A1, B1, B2, A2**. Les quatre exécutions se sont terminées correctement avec leurs sources et entrées inchangées. Le statut technique `passed` de la fenêtre signifie exécution et intégrité complètes ; il ne valide pas le budget.

L'environnement déclaré est Node **v24.22.1**, Linux **6.18.57**, processeur **AMD EPYC 9V74**, neuf processeurs logiques déclarés. Les deux versions ont les mêmes descriptions d'environnement, les mêmes traces publiques et les mêmes générateurs.

| Cas | Actions par session | Niveaux effectivement terminés par session | Sessions mesurées par version | Actions mesurées par version |
| --- | ---: | ---: | ---: | ---: |
| STCK | 10 | 2 | 8 | 80 |
| SMLP | 15 | 3 | 8 | 120 |
| **Total** | | | **16** | **200** |

Les deux versions totalisent donc **32 sessions et 400 actions**. Chaque session reçoit un nouveau runtime et une mémoire de connaissances froide. Un worker sert la chauffe puis quatre sessions d'un cas : son JIT n'est pas redémarré entre ces sessions. Les seules exclusions sont les **huit sessions de chauffe de trois actions**, soit **24 actions** hors mesure officielle. Aucune session mesurée, valeur extrême ni cohorte n'est retirée.

Le moteur calcule chaque commande avant que le rejeu rende le paquet public correspondant. Les métadonnées de travail et le placement des phases sont égaux dans le périmètre de la signature annoncée. Les temps, horodatages, tailles mémoire et étiquettes d'implémentation gardent leurs différences ; cette égalité de travail ne signifie pas identité des rapports ou du graphe privé complets.

## Seize médianes agrégées

Les chiffres ci-dessous sont calculés directement sur tous les échantillons des deux cohortes. Les phases s'imbriquent et ne s'additionnent pas. Le seuil de **+10 %** s'applique séparément à chacune des seize médianes.

### STCK

| Phase | Échantillons par version | Médiane 0.38 (ms) | Médiane 0.40 f0ba (ms) | Variation | Budget |
| --- | ---: | ---: | ---: | ---: | --- |
| Session complète | 8 | 10 836,061442 | 10 823,850916 | -0,113 % | Conforme |
| Nouvelle décision | 48 | 288,006928 | 277,743626 | -3,564 % | Conforme |
| Service de continuation | 32 | 8,193033 | 8,316238 | +1,504 % | Conforme |
| Requête de continuation avec transport | 32 | 10,040378 | 10,093471 | +0,529 % | Conforme |
| Garde de continuation | 32 | 0,208417 | 0,201999 | -3,080 % | Conforme |
| Acquisition et persistance | 48 | 940,875314 | 972,952621 | +3,409 % | Conforme |
| Persistance | 104 | 183,832995 | 185,332983 | +0,816 % | Conforme |
| Restauration | 96 | 9,594767 | 15,942658 | +66,160 % | **Non résolu** |

### SMLP

| Phase | Échantillons par version | Médiane 0.38 (ms) | Médiane 0.40 f0ba (ms) | Variation | Budget |
| --- | ---: | ---: | ---: | ---: | --- |
| Session complète | 8 | 17 824,711213 | 17 761,059203 | -0,357 % | Conforme |
| Nouvelle décision | 72 | 400,324146 | 414,196158 | +3,465 % | Conforme |
| Service de continuation | 48 | 10,424957 | 8,976657 | -13,893 % | Conforme |
| Requête de continuation avec transport | 48 | 12,785899 | 11,512195 | -9,962 % | Conforme |
| Garde de continuation | 48 | 0,393943 | 0,371465 | -5,706 % | Conforme |
| Acquisition et persistance | 72 | 1 057,027419 | 1 034,992418 | -2,085 % | Conforme |
| Persistance | 152 | 152,198714 | 150,365851 | -1,204 % | Conforme |
| Restauration | 144 | 4,716928 | 5,731593 | +21,511 % | **Non résolu** |

### Dépassements de restauration

| Cas | Hausse absolue de médiane | Plafond correspondant à +10 % | Dépassement du plafond |
| --- | ---: | ---: | ---: |
| STCK | 6,347892 ms | 10,554243 ms | 5,388415 ms |
| SMLP | 1,014665 ms | 5,188621 ms | 0,542972 ms |

La baisse des durées de session, **−0,113 % pour STCK** et **−0,357 % pour SMLP**, ne compense pas ces hausses locales. La restauration STCK garde une dispersion élevée entre médianes de sessions ; son classement est `over_budget_with_noise_unresolved`. La restauration SMLP porte le même classement. Le bruit n'ajoute aucune tolérance au seuil.

## Les deux cohortes restent visibles

| Cohorte | Critères conformes | Résultat | Dépassements conservés |
| --- | ---: | --- | --- |
| 1 | 14/16 | `budget_review_required` | STCK nouvelle décision **+17,262 %** ; SMLP restauration **+19,743 %** |
| 2 | 13/16 | `budget_review_required` | STCK restauration **+66,160 %** ; SMLP acquisition et persistance **+13,020 %** ; SMLP restauration **+24,235 %** |

Les comparaisons [cohorte 1](cohort1/comparison.json) et [cohorte 2](cohort2/comparison.json) ne sont ni remplacées ni choisies comme gagnantes. Les différences de médianes entre cohortes sont conservées. La règle finale annoncée porte sur les distributions réunies, pas sur une moyenne des ratios de cohortes.

Toutes les variations par cohorte sont données ici pour éviter de ne retenir que les critères qui expliquent l'agrégat :

| Phase | STCK C1 | STCK C2 | SMLP C1 | SMLP C2 |
| --- | ---: | ---: | ---: | ---: |
| Session complète | +1,091 % | -0,728 % | -7,623 % | +2,308 % |
| Nouvelle décision | +17,262 % | -5,599 % | +9,640 % | +1,063 % |
| Service de continuation | +6,623 % | -1,843 % | -15,114 % | -7,361 % |
| Requête de continuation avec transport | +3,424 % | -2,327 % | -15,286 % | -3,738 % |
| Garde de continuation | -8,773 % | +7,253 % | -12,589 % | +1,729 % |
| Acquisition et persistance | +8,775 % | -1,757 % | -10,953 % | +13,020 % |
| Persistance | +8,079 % | -3,971 % | -1,373 % | -1,431 % |
| Restauration | +9,119 % | +66,160 % | +19,743 % | +24,235 % |

## Percentiles et dispersion

Le p95 est le rang empirique `ceil(0.95 × n)` et n'est publié que pour **n ≥ 20**. Les huit durées de session n'ont donc pas de p95. Les observations d'une même session sont corrélées ; le nombre d'appels ne constitue pas un nombre égal d'expériences indépendantes. Le p95 n'était pas un critère budgété supplémentaire, mais ses hausses restent au bilan.

| Phase | p95 STCK, 0.38 → 0.40 (ms) | Variation | p95 SMLP, 0.38 → 0.40 (ms) | Variation |
| --- | ---: | ---: | ---: | ---: |
| Session complète | Non publié, n = 8 | | Non publié, n = 8 | |
| Nouvelle décision | 461,677 → 462,769 | +0,236 % | 868,829 → 814,348 | -6,271 % |
| Service de continuation | 9,214 → 11,494 | +24,742 % | 21,277 → 15,526 | -27,030 % |
| Requête de continuation avec transport | 11,050 → 14,223 | +28,708 % | 24,345 → 17,971 | -26,181 % |
| Garde de continuation | 0,348 → 0,499 | +43,263 % | 0,674 → 0,653 | -3,250 % |
| Acquisition et persistance | 3 956,500 → 3 911,214 | -1,145 % | 2 947,481 → 2 959,857 | +0,420 % |
| Persistance | 345,600 → 344,864 | -0,213 % | 272,236 → 265,945 | -2,311 % |
| Restauration | 65,098 → 67,423 | +3,571 % | 24,904 → 24,941 | +0,150 % |

L'étendue relative des médianes de session est une description de dispersion, pas un intervalle de confiance :

| Phase | STCK référence | STCK correction | SMLP référence | SMLP correction |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 13,918 % | 6,960 % | 16,345 % | 16,226 % |
| Nouvelle décision | 25,597 % | 39,757 % | 28,907 % | 25,051 % |
| Service de continuation | 9,678 % | 15,245 % | 29,158 % | 42,524 % |
| Requête de continuation avec transport | 11,601 % | 13,276 % | 30,172 % | 39,225 % |
| Garde de continuation | 35,309 % | 55,043 % | 31,392 % | 50,828 % |
| Acquisition et persistance | 12,492 % | 19,672 % | 31,236 % | 37,276 % |
| Persistance | 30,754 % | 23,137 % | 31,170 % | 21,824 % |
| Restauration | 39,200 % | 101,213 % | 33,722 % | 35,090 % |

## Pause et inspection, diagnostics distincts du budget

Toutes les demandes de pause mesurées ont été acquittées. La planification initiale s'arrête à zéro action avec le ticket en attente conservé ; la première action déjà engagée rejoint une frontière sûre après son acquisition, à une action. Cela établit une pause à la frontière prévue, pas une préemption arbitraire de recherche.

| Cas et phase | Accusé médian 0.38 (ms) | Accusé médian 0.40 (ms) | Frontière sûre médiane 0.38 (ms) | Frontière sûre médiane 0.40 (ms) |
| --- | ---: | ---: | ---: | ---: |
| STCK, planification initiale | 0,010 | 0,008 | 1 017,434 | 1 041,098 |
| STCK, action engagée | 0,015 | 0,013 | 919,044 | 903,396 |
| SMLP, planification initiale | 0,006 | 0,008 | 1 470,914 | 1 567,837 |
| SMLP, action engagée | 0,005 | 0,006 | 750,830 | 758,252 |

Trois inspections sont demandées après chaque rejeu, soit **24 inspections par cas et par version**. Elles sont exclues de la durée du rejeu et ne participent pas aux seize critères.

| Cas | Service d'inspection médian 0.38 (ms) | Service médian 0.40 (ms) | Bout en bout médian 0.38 (ms) | Bout en bout médian 0.40 (ms) | Nœuds observés |
| --- | ---: | ---: | ---: | ---: | --- |
| STCK | 181,354 | 164,338 | 333,809 | 301,254 | 344 |
| SMLP | 195,825 | 195,311 | 357,565 | 352,694 | 412 |

Les échantillons `heapUsed` et `rss` restent dans les rapports bruts. Ils dépendent notamment du GC et du processus worker ; aucune conclusion de fuite ou de stabilité mémoire sur plusieurs heures n'est tirée de ces sessions.

## Portée fonctionnelle et limites de causalité

Le gel de cet essai a passé **1 272/1 272 tests dans 33 fichiers**, les contrôles du projet et les **34/34 comparaisons de régression CATR/RSWP**. CATR conserve trois niveaux, douze actions et huit plans en campagne froide et dans la prévisualisation Vite des sources gelées. Le navigateur ne testait pas le fichier worker compilé dans `dist`. Ces succès fonctionnels ne ferment pas un budget de coût échoué.

Le [diagnostic instrumenté](../diagnostic/results.md) conserve ses propres hausses de temps et son `strictFinalEquality: false`. Il remplace la projection `family.state`, ce qui désactive volontairement la réutilisation de l'inventaire et exerce son chemin de repli. Le runner officiel conserve les identités de projection des familles. Aucun ratio du diagnostic de repli n'est utilisé pour expliquer ou compenser le résultat officiel.

Les chronométrages officiels excluent l'exécution du jeu, le réseau de production, le rendu navigateur et l'inspection après rejeu. Ils ne prédisent ni une latence identique sur tout matériel ni la stabilité de sessions de plusieurs heures. La revue arithmétique ne vérifie pas indépendamment l'isolation du système d'exploitation ni l'exactitude physique des horloges. Les dépendances entre appels d'une même session limitent les conclusions statistiques.

La cause précise des hausses de restauration n'est pas établie par cette comparaison. Le comportement fonctionnel, les tests adverses et l'arithmétique ne prouvent pas que l'optimisation choisie améliore la restauration. Ce résultat justifie une correction concrète supplémentaire du chemin commun, puis un nouveau gel et une fenêtre distincte déclarée avant mesure. **3B reste ouvert et 3C attend sa clôture.**

## Fichiers conservés

- [Rapport référence C1](cohort1/baseline.json), [journal référence C1](cohort1/baseline.log), [rapport correction C1](cohort1/after.json), [journal correction C1](cohort1/after.log).
- [Rapport correction C2](cohort2/after.json), [journal correction C2](cohort2/after.log), [rapport référence C2](cohort2/baseline.json), [journal référence C2](cohort2/baseline.log).
- [Comparaison C1](cohort1/comparison.json), [comparaison C2](cohort2/comparison.json), [agrégat](combined-comparison.json), [revue indépendante](consolidation-review.json), [fenêtre](window.json).

Aucun fichier mesuré, comparateur, résultat de cohorte ou paramètre annoncé n'a été réécrit pour cette consolidation.
