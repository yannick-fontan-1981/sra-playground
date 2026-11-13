# Correction générique des coûts SMLP : protocole officiel 0.41

Déclaré le **2026-11-10T03:27:40.663165+00:00**, avant toute mesure officielle du gel `3edffde9`. Ce protocole est définitif pour la fenêtre annoncée ; sa rédaction ne lance aucune mesure.

## Objet et références

Vérifier la correction générique des coûts de **Logos Engine 0.41.0**, après gel de ses sources, contre une référence **0.38.0 fraîchement mesurée**. Le seuil reste **+10 %** sur les seize médianes STCK/SMLP déjà annoncées. La référence fonctionnelle est la publication **68 / native 0.40.0**. Les diagnostics instrumentés restent distincts de cette validation du budget.

| Rôle | Publication et version | Commit ou digest natif | Inventaire |
| --- | --- | --- | ---: |
| Référence de coût A | 66 / 0.38.0 | Commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0` ; digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff` | 245 fichiers natifs |
| Référence fonctionnelle publiée | 68 / 0.40.0 | Commit `512ac2cd7270b669aca0a12dbc9c4702174f1c0f` ; digest `391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9` | 249 fichiers natifs |
| Correction B | 0.41.0 | Digest `3edffde9b21f4fc8af9dda9a1dbd40707c015d9f7cba8a41460021e39acb7605` | 249 fichiers natifs ; archive de 260 fichiers |

Le [manifeste de coût A](../base/source-manifest.json), SHA-256 `0024028577107a7dbcc65ea0cc3ffa929a0ce5a6e7f11bf4515a169fc5cb1146`, est une copie exacte de la référence historique 0.38. Le [manifeste publié](../published/source-manifest.json) est une copie exacte du gel final 0.40. Le [manifeste B](../final/source-manifest.json), SHA-256 `12b765bcd7348af0f7e3e4325862cae570c2b81470475839fdfe9df79fa2078b`, et son [archive](../final/source-archive.json) identifient les octets à mesurer. L'archive compressée a pour SHA-256 `608b5fba673d4854a3d51bdc8e99b8ab2aea3479e3b79af3756514567955a769`.

**Cinq fichiers natifs changent** par rapport à la source publiée : `canonical.ts`, `v6-native-state-graph.ts`, `v6-inventory-caller-context.ts`, `v6-observed-inventory.ts` et `v6-native-runtime.ts` (version). `canonical.ts` expose le prédicat de propriété immuable utilisé par le cache. Les deux corrections portent sur le chemin commun : cache borné de fragments terminaux dont l'identité immuable est vérifiée ; réduction des copies de contexte scalaires et d'une double copie du tracker. Elles restent génériques et conservent les contrats des agents V5/V6. Les sources V5/V6 d'origine ne sont pas modifiées.

Le [résultat officiel 0.40 conservé](../../lot3b-cost-evidence/performance-v2/combined-comparison.json) reste **`budget_review_required`, 14/16** : acquisition/persistance SMLP **+11,641662058 %** et restauration SMLP **+14,988511609 %**. La restauration STCK y est à **+4,218399745 %**. Ses deux cohortes, 14/16 et 13/16, et tous leurs échantillons restent intacts. Le [premier essai 0.40](../../lot3b-cost-evidence/performance/combined-comparison.json), digest `f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece`, conserve son résultat 14/16 et ses deux dépassements de restauration. Le [résultat 0.39](../../lot3b-evidence/performance/combined-comparison.json) conserve son résultat 15/16 et sa restauration STCK hors budget. Aucun essai, diagnostic ou rapport historique n'est remplacé.

Cette nouvelle fenêtre mesure une source différente. Elle ne complète aucun ancien échantillon et ne sélectionne aucune cohorte historique favorable. Tous les temps de référence 0.38 seront remesurés dans cette fenêtre.

## Entrées exactes et clarification de leur prose historique

Le [manifeste des cas](cases.json) et la [politique de comparaison](comparison-policy.json) sont des **copies octet pour octet** de `lot3b-cost-evidence/performance-v2/` :

| Entrée | SHA-256 |
| --- | --- |
| `cases.json` | `487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d` |
| `comparison-policy.json` | `5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68` |

**Leurs champs de prose `qualification` mentionnent encore 0.40 parce que les fichiers historiques sont conservés sans altération. Cette mention décrit leur provenance ; la correction B de la présente fenêtre est exclusivement le gel 0.41 `3edffde9…` déclaré ci-dessus.** La référence de coût A reste 0.38. Les deux manifestes transmis au wrapper, leur inventaire vérifié et les empreintes enregistrées dans chaque rapport déterminent les sources effectivement mesurées. Aucun seuil, cas, effectif, outil, critère, ordre, chauffe, exclusion ou règle de clôture n'est changé par cette clarification.

Les traces publiques sont celles déjà annoncées : STCK `native-campaigns-v39/stck-public-trace.json.gz`, SHA-256 `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b` ; SMLP `native-campaigns-v57/final/smlp-public-trace.json.gz`, SHA-256 `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9`. Le wrapper vérifie ces octets avant l'exécution.

## Effectifs et ordre fixés avant mesure

Deux cohortes de **quatre sessions mesurées par jeu et par version** sont prévues. Les quatre exécutions sont séquentielles :

| Ordre | Exécution | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, référence de la cohorte 1 | 0.38.0 | 4 |
| 2 | B1, correction de la cohorte 1 | 0.41.0 gelée | 4 |
| 3 | B2, correction de la cohorte 2 | Même 0.41.0 gelée | 4 |
| 4 | A2, référence de la cohorte 2 | Même 0.38.0 | 4 |

Chaque exécution suit le même [manifeste des cas](cases.json), dans l'ordre **STCK puis SMLP**. L'ordre A1, B1, B2, A2 limite une dérive temporelle simple ; il n'établit pas l'identité des conditions de GC, de JIT ou d'ordonnancement.

Les deux cohortes doivent être exécutées quelle que soit l'issue de la première. Le bilan final regroupe **toutes les huit sessions par jeu et par version** : **32 sessions mesurées**, **200 actions mesurées par version** et **400 actions au total**. Aucune session défavorable, valeur extrême ou cohorte ne sera exclue. Aucun suivi supplémentaire de la même correction ne sera choisi à partir du résultat pour obtenir une comparaison favorable. Une modification ultérieure du code constitue une nouvelle révision, avec un nouveau gel et un nouveau protocole.

## Travail et chauffe

| Cas | Actions par session mesurée | Niveaux visés par le contrôleur | Chauffe préalable par exécution du cas |
| --- | ---: | ---: | --- |
| STCK | 10 | 3 | Une session de **3 actions** |
| SMLP | 15 | 3 | Une session de **3 actions** |

`warmupActions: 3` signifie trois actions dans une seule session de chauffe. Le worker Node est créé séparément pour chaque cas de chaque exécution ; il sert ensuite la chauffe et les quatre sessions mesurées. Chaque session reçoit un nouveau runtime et une mémoire de connaissances froide. Le processus et son JIT ne sont donc pas redémarrés entre toutes les sessions d'un même cas.

Les seules exclusions sont les chauffes annoncées : **deux sessions de chauffe par jeu et par version**, soit huit chauffes et 24 actions hors budget au total. Les traces publiques, empreintes, actions, niveaux visés et chauffes sont ceux du budget précédent. Aucun état appris n'est importé. Le moteur calcule chaque commande ; le rejeu ne retourne le paquet public correspondant qu'après avoir vérifié la commande calculée. Le plafond de dix actions STCK ne signifie pas que ses trois niveaux sont terminés dans chaque mesure.

## Mesures et décision

Le runner `scripts/measure-native-loop-costs.mjs`, les comparateurs `scripts/compare-native-loop-costs.mjs` et `scripts/compare-native-cost-cohorts.mjs`, ainsi que le wrapper `scripts/run-native-cost-window.py` restent inchangés. La [politique](comparison-policy.json) conserve huit phases pour chacun des deux jeux :

1. `session_elapsed` : durée du rejeu complet par le contrôleur.
2. `new_decision` : appel natif à `plan`.
3. `known_prefix_service` : traitement complet d'une requête `advance` retournant une autre action du préfixe.
4. `known_prefix_request` : même requête, avec transport worker et ordonnancement jusqu'à son acceptation.
5. `known_prefix_guard` : appel à `authorize` lorsque l'index du préfixe est supérieur à zéro.
6. `acquisition_and_persistence` : appel à `seal`.
7. `persistence` : appel à `persistFamilies`.
8. `restoration` : appel à `restoreFamilies` ; les autres restaurations restent dans leurs phases englobantes.

Les phases sont imbriquées : leurs durées ne s'additionnent pas. L'instrumentation conserve les arguments, résultats et ordre des appels. Un changement d'effectifs, de placement des phases ou de travail exige une qualification ; il n'autorise pas à supprimer des échantillons pour retrouver l'égalité.

Chaque cohorte conserve son propre résultat. L'agrégateur reproduit exactement les distributions, médianes, p95, dispersions et classifications de chaque cohorte avant de réunir tous les échantillons mesurés. Il vérifie les manifestes, entrées, environnement, runner et métadonnées du travail. La distribution réunie est calculée directement ; aucune moyenne des ratios de cohortes ne la remplace.

Pour chaque phase et jeu, la variation est `médiane_après / médiane_avant - 1`. La clôture exige **16/16 médianes au plus à +10 %**, un statut final `passed` et `unresolved: []`. Un résultat au-dessus du seuil avec dispersion élevée reste non résolu. **Le bruit n'ajoute aucune tolérance.** Une diminution du temps de session ne compense pas un dépassement local.

La médiane utilise la valeur centrale ou la moyenne des deux valeurs centrales. Le p95 est le rang empirique `ceil(0.95 × n)` et reste absent pour **n < 20**. Les huit durées de session par version n'ont donc pas de p95 publié. Les autres phases en ont un lorsque l'effectif le permet ; les observations d'une même session restent corrélées. Le p95 n'est pas un critère budgété supplémentaire, mais ses hausses doivent rester visibles. L'étendue relative des médianes par session décrit une dispersion observée, sans constituer un intervalle de confiance.

La revue indépendante `scripts/review-native-cost-consolidation.py` recalculera l'arithmétique et vérifiera les effectifs, les empreintes et l'ordre de la fenêtre. Son éventuel statut `passed` signifie cohérence des calculs et du protocole ; son `budgetStatus` demeure distinct et peut rester `budget_review_required`.

## Isolation et conservation

Tous les profils, tests, exports, builds, campagnes, relectures exécutant le moteur et contrôles navigateur doivent être terminés avant la fenêtre officielle. Le preview doit être arrêté. Aucun de ces travaux ne s'exécute en parallèle des mesures. Seules une lecture légère ou la rédaction documentaire peuvent continuer.

Les sources natives, le runner, les déclarations et les cas restent inchangés pendant toute la fenêtre. Le wrapper vérifie ces entrées avant chaque exécution et après la dernière. Les mêmes octets du manifeste des cas, de la politique et du protocole sont copiés aux mêmes chemins relatifs dans les deux checkouts. Les rapports de référence sont recopiés sans modification dans le dossier de livraison. Rapports, sorties brutes, erreurs, résultats de cohortes et résultat agrégé sont tous conservés. Les sorties sont créées de manière exclusive ; aucun essai défavorable ne peut être écrasé. Un rapport incomplet ne devient pas une cohorte complète.

La mesure ne commence qu'après le feu vert du responsable de la livraison. Les commandes exactes de lancement et comparaison sont données ci-dessous ; les créer ne les exécute pas.

## Contrôles fonctionnels distincts

La correction conserve la logique générique V5/V6 et les obligations d'identité, révision, invalidation, gardes, acquisition unique, checkpoints et restauration atomique. Le [périmètre formel gelé](../final/release-scope.json) contient **41 fichiers de tests** : les 35 fichiers affectés précédemment déclarés et six fichiers couvrant les copies d'Inventory, l'hydratation, le magasin de connaissances, les caches et le Kernel. Il doit être exécuté intégralement contre le gel final avant la fenêtre officielle. Le nombre de tests effectivement exécutés sera celui du reçu de ce gel. Les **1 322 tests dans 35 fichiers** de 0.40 ne sont pas transférés à 0.41. Typage, audits, export et build doivent également porter leurs propres résultats.

Le [manifeste de régression](../recorded-regression-cases.json) déclare deux rejeux froids contre des rapports 0.40 :

| Cas | Référence fonctionnelle | Provenance exacte des retours publics |
| --- | --- | --- |
| CATR | Campagne froide 0.40 : 12 actions, 3 niveaux, 8 préfixes, 1 session | Trace publique de cette campagne 0.40 |
| RSWP | Décisions recomputées par 0.40 : 19 actions, 3 niveaux, 11 préfixes, 1 session | Trace publique historique 0.38, conservée sans modification |

La [prévalidation en lecture seule](../recorded-regression-preflight.json) a vérifié les entrées : elle n'a exécuté aucun rejeu. Le comparateur historique inchangé effectue **17 contrôles par cas**, soit **34 contrôles**. La provenance RSWP n'est pas réétiquetée 0.40 : les décisions de référence ont été recomputées par 0.40, tandis que les retours publics restent ceux de 0.38. Le résultat strict historique RSWP 0.38 → 0.39 reste **16/17**, avec sa qualification séparée. Les nouveaux résultats, réussites comme échecs, seront conservés tels quels. Le manifeste déclare `passiveOwnerRequirements: []` : ces rejeux ne démontrent aucune couverture supplémentaire de propriétaires passifs, même si un booléen de présence non contraint vaut `true`.

Ces rejeux recomputent chaque commande avant son retour enregistré ; ils ne constituent pas une nouvelle réussite live ni une mesure de vitesse. Une campagne froide CATR supplémentaire et un contrôle navigateur peuvent confirmer le build corrigé, en restant distincts du coût officiel. La réussite des trois niveaux de CATR déjà acquise reste conservée ; la correction n'invente pas une nouvelle capacité de jeu.

Le [protocole diagnostique](../diagnostic/protocol.md), déclaré avant exécution, prévoit une session normale SMLP15 par source (0.40 puis 0.41), sans chauffe, complétée par un profil CPU brut et sa compression fidèle. Il conserve les six critères de comparaison normaux v2, les différences de travail, les résultats des témoins et le booléen réel `strictFinalEquality`. Ces diagnostics restent distincts du budget officiel, ne valident pas son seuil et doivent tous être terminés avant la fenêtre. Leur protocole n'est pas modifié après le premier profil.

Les temps du présent budget excluent le moteur de jeu, le réseau de production et le rendu navigateur. L'inspection est déclenchée après le rejeu, hors de sa durée. Pause vérifie l'accusé du contrôleur et l'arrivée à une frontière sûre pendant la planification initiale et la première action engagée ; elle ne prouve pas la préemption arbitraire d'une recherche. Ces sessions finies ne prouvent pas la stabilité de sessions de plusieurs heures.

## Commandes prévues après gel et validation

Les commandes suivantes partent de la racine du checkout. Le wrapper gère les quatre mesures dans l'ordre annoncé. Le dossier de référence ci-dessous existe déjà ; les sources et dépendances doivent être vérifiées avant le feu vert.

```bash
python -B scripts/run-native-cost-window.py /workspace/scratch/c4dd29871d33/lot3b-baseline docs/migration/lot3b-smlp-cost-evidence/performance docs/migration/lot3b-smlp-cost-evidence/base/source-manifest.json docs/migration/lot3b-smlp-cost-evidence/final/source-manifest.json
```

Après la fin de la fenêtre, les trois comparaisons et la revue sont successives :

```bash
node scripts/compare-native-loop-costs.mjs docs/migration/lot3b-smlp-cost-evidence/performance/comparison-policy.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort1/baseline.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort1/after.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort1/comparison.json
node scripts/compare-native-loop-costs.mjs docs/migration/lot3b-smlp-cost-evidence/performance/comparison-policy.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort2/baseline.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort2/after.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort2/comparison.json
node scripts/compare-native-cost-cohorts.mjs docs/migration/lot3b-smlp-cost-evidence/performance/comparison-policy.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort1/baseline.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort1/after.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort1/comparison.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort2/baseline.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort2/after.json docs/migration/lot3b-smlp-cost-evidence/performance/cohort2/comparison.json docs/migration/lot3b-smlp-cost-evidence/performance/combined-comparison.json
python -B scripts/review-native-cost-consolidation.py docs/migration/lot3b-smlp-cost-evidence/performance
```

## État au moment de la déclaration

La source 0.41, son archive et le périmètre formel de 41 fichiers sont gelés ; aucun `window.json`, dossier de cohorte ou résultat officiel de `performance/` n'existe au moment de cette déclaration. Les validations fonctionnelles du gel sont encore en cours de consolidation. Les commandes ci-dessus sont préparées, **pas exécutées** par la rédaction de ce protocole. La mesure ne démarre qu'après leur achèvement, l'arrêt du preview et le feu vert du responsable.

Les preuves 0.38, 0.39 et des deux essais 0.40 restent séparées et intactes. Rapports, erreurs, sorties brutes et résultats défavorables de ce nouveau gel seront également conservés. Aucun succès futur ne réécrit un échec historique. **3B reste ouvert tant que la nouvelle source n'a pas satisfait ses obligations fonctionnelles et l'ensemble du budget annoncé ; 3C attend cette clôture.**
