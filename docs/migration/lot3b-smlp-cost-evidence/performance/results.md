# Correction générique 3B : coût officiel du gel 0.41 `3edffde9`

## Décision conservée

**Le budget reste non conforme : `budget_review_required`, 14/16 médianes dans le seuil annoncé.** Deux dépassements agrégés restent **`over_budget_with_noise_unresolved`** : **persistance STCK +14,269890051 %** et **restauration SMLP +11,220691835 %**. **3B reste ouvert et 3C attend sa clôture.**

Dans cette fenêtre, l'acquisition et persistance SMLP est conforme à **−10,647038364 %**, et la restauration STCK à **−15,575460100 %**. Ces baisses ne compensent aucun dépassement local. Le résultat historique 0.40 à 14/16 reste inchangé ; la référence 0.38 ayant été remesurée, les variations entre fenêtres ne constituent pas une mesure isolée du gain 0.40 → 0.41.

La [comparaison agrégée](combined-comparison.json) retient toutes les sessions fixées. La [revue indépendante](consolidation-review.json) passe **231 vérifications**, confirme **32 sessions uniques et 400 actions**, et reproduit distributions, médianes, p95, dispersions, classifications et effectifs des deux cohortes et de l'agrégat. Son statut `passed` valide la cohérence de l'arithmétique ; son **`budgetStatus: budget_review_required`** conserve l'échec du budget. Les comparateurs et règles de décision sont inchangés.

Le gel possède ses validations fonctionnelles et trois niveaux CATR confirmés. Ce bilan ne déclare aucun numéro de publication ni aucun succès de déploiement.

## Sources mesurées et conservation des essais

| Référence | Octets effectivement mesurés |
| --- | --- |
| A, référence 0.38 fraîche | Publication 66, commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0`, 245 fichiers natifs, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff` |
| B, correction 0.41 | [Gel final](../final/source-manifest.json), 249 fichiers natifs, digest `3edffde9b21f4fc8af9dda9a1dbd40707c015d9f7cba8a41460021e39acb7605`, [archive de 260 fichiers](../final/source-archive.json) |
| Référence fonctionnelle publiée | Publication 68, native 0.40.0, commit `512ac2cd7270b669aca0a12dbc9c4702174f1c0f`, digest `391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9` |

Le [protocole](protocol.md) et sa [déclaration](declaration.json) ont été figés le **10 novembre 2026 à 03:27:40.663165 UTC**, avant toute session officielle. Le protocole conserve le SHA-256 `45a242dd01181244b73982ee74e198f58ebe0682bab116d4f66fa4dd607041f4`. [Les cas](cases.json) et [la politique](comparison-policy.json) sont des copies exactes des entrées 0.40. Leur prose historique mentionnant 0.40 est explicitement qualifiée par ce protocole : A est 0.38 fraîche, B est le gel 0.41. Les libellés historiques des outils ne changent pas les effectifs déclarés et vérifiés de quatre sessions par cohorte, huit par cas et version après réunion.

Cinq fichiers natifs changent par rapport à la source publiée 0.40 : `canonical.ts`, le graphe d'état natif, le contexte d'inventaire, l'inventaire observé et la version du runtime natif. La correction porte sur un cache borné de fragments terminaux immuables et sur des copies génériques évitables. Les sources originales des agents V5/V6 restent inchangées.

Le [résultat officiel 0.40 publié](../../lot3b-cost-evidence/performance-v2/results.md) conserve ses **14/16** et ses dépassements SMLP d'acquisition/persistance **+11,641662058 %** et restauration **+14,988511609 %**. Le [premier essai 0.40](../../lot3b-cost-evidence/performance/results.md) et le [résultat 0.39](../../lot3b-evidence/performance/combined-comparison.json) restent également intacts. Aucun ancien échantillon n'est réutilisé ou fusionné avec la présente fenêtre ; aucun résultat défavorable n'est remplacé.

## Fenêtre, environnement et travail comparé

La [fenêtre complète](window.json) s'est déroulée le **10 novembre 2026 de 03:29:17.604801 à 03:38:41.399588 UTC**, dans l'ordre annoncé **A1, B1, B2, A2**. Les quatre commandes se sont terminées avec code 0 ; les sources et entrées sont restées inchangées. Les statuts `passed` de la fenêtre et de son intégrité valident l'exécution, pas le budget.

| Ordre | Source | Début UTC | Fin UTC |
| --- | --- | --- | --- |
| A1 | 0.38 référence | 03:29:17.702981 | 03:31:39.134766 |
| B1 | 0.41 gel 3edffde9 | 03:31:39.237029 | 03:34:02.384099 |
| B2 | 0.41 gel 3edffde9 | 03:34:02.464102 | 03:36:22.890259 |
| A2 | 0.38 référence | 03:36:22.969268 | 03:38:41.276980 |

L'environnement déclaré est **Node v24.22.1, Linux 6.18.57, AMD EPYC 9V74, neuf processeurs logiques**. Les deux versions ont les mêmes descriptions d'environnement, traces publiques, déclarations et générateurs. Les diagnostics, tests, builds, campagnes et contrôles navigateur étaient terminés ; le preview était arrêté. Les comparateurs ont été exécutés après la fin complète de la fenêtre.

| Cas | Actions par session | Niveaux terminés par session | Sessions par version | Actions par version |
| --- | ---: | ---: | ---: | ---: |
| STCK | 10 | 2 | 8 | 80 |
| SMLP | 15 | 3 | 8 | 120 |
| **Total** | | | **16** | **200** |

Les deux versions totalisent **32 sessions et 400 actions**. Chaque session reçoit un nouveau runtime et une mémoire de connaissances froide. Le worker d'un cas sert sa chauffe puis quatre sessions mesurées ; son JIT n'est pas redémarré entre ces sessions. Les seules exclusions restent les **huit sessions de chauffe de trois actions**, soit **24 actions** hors mesure officielle. Aucune session mesurée, valeur extrême ou cohorte n'est retirée.

Le moteur recalcule chaque commande avant réception du paquet public enregistré correspondant. Le travail et les effectifs des phases concordent dans le périmètre de la signature vérifiée. Les temps, tailles mémoire, horodatages et identités d'implémentation en sont exclus ; l'égalité de travail n'est pas une identité de tous les rapports ou du graphe privé complet.

## Les seize médianes agrégées

Les médianes sont calculées directement sur tous les échantillons des deux cohortes, sans moyenne de leurs ratios. Le seuil **+10 %** s'applique à chaque cellule de décision. Les phases s'imbriquent et ne s'additionnent pas. Les valeurs affichées sont arrondies ; les JSON conservent la précision utilisée pour la décision.

### STCK

| Phase | Échantillons par version | Médiane 0.38 (ms) | Médiane 0.41 (ms) | Variation | Budget |
| --- | ---: | ---: | ---: | ---: | --- |
| Session complète | 8 | 11 421,563532 | 11 440,935006 | +0,170 % | Conforme |
| Nouvelle décision | 48 | 306,456956 | 301,780640 | -1,526 % | Conforme |
| Service de continuation | 32 | 8,733730 | 8,826201 | +1,059 % | Conforme |
| Requête de continuation avec transport | 32 | 10,573192 | 10,609015 | +0,339 % | Conforme |
| Garde de continuation | 32 | 0,218453 | 0,234757 | +7,463 % | Conforme |
| Acquisition et persistance | 48 | 953,005049 | 1 005,302040 | +5,488 % | Conforme |
| Persistance | 104 | 169,327983 | 193,490900 | +14,270 % | **Non résolu** |
| Restauration | 96 | 9,992861 | 8,436427 | -15,575 % | Conforme |

### SMLP

| Phase | Échantillons par version | Médiane 0.38 (ms) | Médiane 0.41 (ms) | Variation | Budget |
| --- | ---: | ---: | ---: | ---: | --- |
| Session complète | 8 | 18 372,584632 | 18 433,246848 | +0,330 % | Conforme |
| Nouvelle décision | 72 | 403,080909 | 377,554613 | -6,333 % | Conforme |
| Service de continuation | 48 | 10,196658 | 10,324615 | +1,255 % | Conforme |
| Requête de continuation avec transport | 48 | 12,576493 | 12,657255 | +0,642 % | Conforme |
| Garde de continuation | 48 | 0,372991 | 0,401628 | +7,678 % | Conforme |
| Acquisition et persistance | 72 | 1 046,081611 | 934,704901 | -10,647 % | Conforme |
| Persistance | 152 | 155,180564 | 154,570810 | -0,393 % | Conforme |
| Restauration | 144 | 4,907037 | 5,457640 | +11,221 % | **Non résolu** |

### Les deux dépassements restent non résolus

| Cas et phase | Hausse absolue de médiane (ms) | Plafond exact à +10 % (ms) | Excès au-dessus du plafond (ms) |
| --- | ---: | ---: | ---: |
| STCK — Persistance | 24,16291700 | 186,26078130 | 7,23011870 |
| SMLP — Restauration | 0,55060350 | 5,39774070 | 0,05989980 |

La restauration SMLP reste au-dessus du seuil malgré un excès absolu réduit. La persistance STCK dépasse également la borne annoncée. Ni l'ampleur absolue, ni la dispersion, ni une baisse d'une phase englobante ou voisine n'accorde de tolérance supplémentaire. La qualification `over_budget_with_noise_unresolved` conserve les deux obligations non satisfaites.

## Les deux cohortes restent intégralement visibles

| Cohorte | Médianes dans le seuil | Statut | Dépassements conservés |
| --- | ---: | --- | --- |
| [1](cohort1/comparison.json) | 14/16 | `budget_review_required` | Persistance STCK **+20,788832583 %** ; restauration SMLP **+21,227161869 %** |
| [2](cohort2/comparison.json) | 14/16 | `budget_review_required` | Garde de continuation STCK **+11,226585617 %** ; garde de continuation SMLP **+25,651440529 %** |

| Phase | STCK C1 | STCK C2 | SMLP C1 | SMLP C2 |
| --- | ---: | ---: | ---: | ---: |
| Session complète | +4,407 % | +2,834 % | -1,171 % | +1,055 % |
| Nouvelle décision | +3,473 % | -0,600 % | -4,631 % | -14,350 % |
| Service de continuation | -0,313 % | +2,749 % | -6,595 % | +3,195 % |
| Requête de continuation avec transport | -1,367 % | +1,286 % | -6,240 % | +4,299 % |
| Garde de continuation | +5,549 % | +11,227 % | -15,364 % | +25,651 % |
| Acquisition et persistance | +8,690 % | +1,740 % | -16,399 % | -8,140 % |
| Persistance | +20,789 % | +6,092 % | +4,133 % | -3,709 % |
| Restauration | -15,575 % | -20,461 % | +21,227 % | +4,804 % |

Les deux cohortes sont non conformes, et leur agrégat reste à 14/16. Les critères dépassés diffèrent entre cohortes : cette différence reste visible et ne justifie aucune sélection de cohorte. La restauration SMLP conforme dans C2 ne remplace pas son dépassement dans C1 ou dans la distribution agrégée. L'acquisition/persistance SMLP est conforme dans les deux cohortes.

## p95 disponibles, hors décision des seize médianes

Le p95 est le rang empirique `ceil(0.95 × n)`, publié uniquement pour **n ≥ 20**. Les huit durées de session par cas et version n'ont donc pas de p95 publié. Les observations d'une même session restent corrélées. Les p95 ci-dessous sont descriptifs et leurs hausses ne sont pas masquées.

| Cas | Phase | p95 0.38 (ms) | p95 0.41 (ms) | Variation |
| --- | --- | ---: | ---: | ---: |
| STCK | Nouvelle décision | 511,256196 | 506,693871 | -0,892 % |
| STCK | Service de continuation | 10,602739 | 14,967928 | +41,170 % |
| STCK | Requête de continuation avec transport | 12,352404 | 17,216129 | +39,375 % |
| STCK | Garde de continuation | 0,302587 | 6,544347 | +2062,798 % |
| STCK | Acquisition et persistance | 4 260,526743 | 4 227,862026 | -0,767 % |
| STCK | Persistance | 374,030998 | 382,535909 | +2,274 % |
| STCK | Restauration | 83,831054 | 73,421623 | -12,417 % |
| SMLP | Nouvelle décision | 832,230610 | 918,585755 | +10,376 % |
| SMLP | Service de continuation | 14,813179 | 20,014171 | +35,111 % |
| SMLP | Requête de continuation avec transport | 17,683949 | 22,574103 | +27,653 % |
| SMLP | Garde de continuation | 0,583522 | 0,787819 | +35,011 % |
| SMLP | Acquisition et persistance | 3 104,314005 | 3 057,209036 | -1,517 % |
| SMLP | Persistance | 282,189507 | 309,429616 | +9,653 % |
| SMLP | Restauration | 24,160003 | 24,491454 | +1,372 % |

La garde de continuation STCK présente notamment un p95 passant de **0,302587 à 6,544347 ms**, avec un maximum après de **7,056963 ms**, alors que sa médiane agrégée reste dans le seuil. Cette queue de distribution défavorable est conservée ; elle n'est ni exclue comme valeur extrême ni transformée en dix-septième critère budgété.

## Dispersion observée

L'étendue relative des médianes par session décrit la dispersion de cette fenêtre ; elle n'est ni un intervalle de confiance ni une marge d'acceptation.

| Phase | STCK 0.38 | STCK 0.41 | SMLP 0.38 | SMLP 0.41 |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 15,788 % | 23,291 % | 4,835 % | 8,035 % |
| Nouvelle décision | 21,877 % | 23,886 % | 12,800 % | 18,954 % |
| Service de continuation | 24,503 % | 37,905 % | 39,836 % | 22,906 % |
| Requête de continuation avec transport | 21,772 % | 38,267 % | 37,359 % | 20,972 % |
| Garde de continuation | 36,657 % | 33,774 % | 58,429 % | 34,853 % |
| Acquisition et persistance | 18,019 % | 32,059 % | 19,261 % | 28,812 % |
| Persistance | 24,284 % | 29,731 % | 19,565 % | 23,828 % |
| Restauration | 18,169 % | 31,007 % | 26,539 % | 48,956 % |

## Pause, inspection et mémoire

Toutes les demandes de pause mesurées sont acquittées. La planification initiale atteint une frontière à zéro action avec ticket en attente conservé ; la première action engagée rejoint une frontière sûre après son acquisition, à une action. Cela établit la frontière prévue, pas une préemption arbitraire de recherche.

| Cas et phase | Accusé médian 0.38 (ms) | Accusé médian 0.41 (ms) | Frontière sûre médiane 0.38 (ms) | Frontière sûre médiane 0.41 (ms) |
| --- | ---: | ---: | ---: | ---: |
| STCK, planification initiale | 0,009 | 0,014 | 1 071,415 | 1 115,786 |
| STCK, action engagée | 0,015 | 0,014 | 934,494 | 974,756 |
| SMLP, planification initiale | 0,008 | 0,010 | 1 537,424 | 1 688,147 |
| SMLP, action engagée | 0,006 | 0,006 | 791,366 | 846,399 |

Trois inspections sont demandées après chaque rejeu, soit **24 inspections par cas et par version**. Elles sont exclues de la durée du rejeu et des seize critères. Les valeurs ci-dessous sont recalculées à partir des observations conservées dans les quatre rapports bruts, sans relancer le moteur.

| Cas | Service médian 0.38 (ms) | Service médian 0.41 (ms) | Bout en bout médian 0.38 (ms) | Bout en bout médian 0.41 (ms) | Nœuds observés |
| --- | ---: | ---: | ---: | ---: | ---: |
| STCK | 193,547 | 212,819 | 366,965 | 361,579 | 344 |
| SMLP | 204,616 | 221,103 | 384,964 | 382,194 | 412 |

Les échantillons `heapUsed` et `rss` restent dans les rapports bruts. Ils dépendent notamment du GC et du processus worker ; ces sessions ne prouvent ni une fuite ni une stabilité mémoire pendant plusieurs heures.

## Preuves fonctionnelles et limites de causalité

Le gel `3edffde9…` a passé **1 379/1 379 tests dans 41 fichiers affectés**, avec son [reçu formel](../final/validation/delta-tests-run.json), et [cinq vérifications](../final/validation/checks-run.json) incluant typage, audits, contrôle du diff et build. Les [régressions CATR/RSWP](../final/regressions/regression-summary.json) passent **2/2, 34/34 contrôles historiques**. Elles ne revendiquent aucune couverture propriétaire passive supplémentaire : le manifeste contient `passiveOwnerRequirements: []`. Les décisions RSWP de référence sont celles recomputées par 0.40, tandis que les retours publics restent ceux de la trace 0.38 conservée. Le résultat historique strict 0.38 → 0.39 à 16/17 reste distinct.

La première tentative de ces rejeux avait échoué au chargement d'un prérequis Pyodide, avant toute commande. Son [archive de déplacement](../prebuild-failed/relocation.json) conserve les deux exécutions et sorties. La reprise, après fin du build, utilise les mêmes sources et entrées ; elle n'est pas un nouvel essai de coût.

La [campagne froide CATR](../final/catr-smlp-cost-session/execution-catr.json) et le [contrôle navigateur](../final/browser/browser-qa.json) confirment **12 actions, trois niveaux et huit plans**. Le navigateur utilise le preview de développement des sources gelées ; ce contrôle ne se présente pas comme une exécution du bundle publié en production. Une capture pleine page a expiré, puis deux captures de viewport ont réussi sans relancer le jeu. Trois niveaux terminés ne signifient pas une victoire complète du jeu. Ces succès fonctionnels ne ferment pas un budget échoué.

Le [diagnostic normal SMLP](../diagnostic/comparison.json) compare 0.40 à 0.41 avec **six contrôles exacts**, **15 actions, 24 requêtes et 3 128 échantillons par côté**, comptes de travail et témoins identiques, et **`strictFinalEquality: false` conservé**. Ses résultats temporels sont mixtes : rejeu instrumenté +6,008 %, médiane de `knowledge.commit` +17,891 %, baisse du total de `knowledge.stateValue` et de la médiane du sous-groupe Inventory `restoreNative`. Les quatorze groupes sont reproduits dans le [rapport principal](../../lot3b-smlp-cost-correction.md). Une session diagnostique instrumentée par source ne décide ni du seuil +10 % ni de la cause complète des dépassements officiels. Les profils CPU bruts et leurs compressions fidèles restent conservés.

Le temps du jeu, le réseau de production, le rendu navigateur et les inspections après rejeu sont exclus des métriques du budget. Le protocole fixe l'isolation des travaux ; la revue arithmétique ne vérifie pas indépendamment l'ordonnancement du système d'exploitation ni l'exactitude physique des horloges. Les dépendances entre appels d'une même session limitent les conclusions statistiques. Ces mesures ne prédisent pas la même latence sur tout matériel et ne prouvent pas la stabilité de sessions de plusieurs heures.

La prochaine revue examinera l'évitement d'`Object.entries` pour les tableaux denses certifiés `immutableJson` dans `canonical.encode` ; le travail `jsonEntries` et le GC observés dans le profil CPU SMLP ne prouvent pas la cause du dépassement STCK. Elle examinera aussi la normalisation, la validation du contexte et les copies d'Inventory pour la restauration SMLP, sans retirer de garanties : une nouvelle source réellement modifiée et gelée sera nécessaire avant une comparaison complète contre 0.38 fraîche, avec le seuil +10 % inchangé et toutes les pointes de garde, cohortes et fenêtres antérieures conservées. **Validations fonctionnelles acquises, budget non conforme, 3B ouvert, 3C en attente.**

## Fichiers conservés

- [Référence C1](cohort1/baseline.json), [journal référence C1](cohort1/baseline.log), [correction C1](cohort1/after.json), [journal correction C1](cohort1/after.log).
- [Correction C2](cohort2/after.json), [journal correction C2](cohort2/after.log), [référence C2](cohort2/baseline.json), [journal référence C2](cohort2/baseline.log).
- [Comparaison C1](cohort1/comparison.json), [comparaison C2](cohort2/comparison.json), [agrégat](combined-comparison.json), [revue indépendante](consolidation-review.json), [fenêtre](window.json).
- [Protocole figé](protocol.md), [déclaration](declaration.json), [résultat 0.40 conservé](../../lot3b-cost-evidence/performance-v2/results.md), [rapport principal](../../lot3b-smlp-cost-correction.md).

Aucun reçu mesuré, comparateur, paramètre annoncé ni résultat de cohorte n'a été réécrit pour cette consolidation. Aucune mesure supplémentaire n'a été exécutée.
