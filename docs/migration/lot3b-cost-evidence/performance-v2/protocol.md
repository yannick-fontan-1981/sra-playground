# Correction de coût 3B : protocole préalable du nouvel essai 391a279

Déclaré le **10 novembre 2026 à 02:06:31 UTC**, avant toute mesure officielle du gel `391a279`. Cette fenêtre est distincte du premier essai `f0ba` conservé.

## Objet et références

Vérifier la correction générique du chemin de restauration de **Logos Engine 0.40.0**, après gel de ses sources, contre une référence **0.38.0 fraîchement mesurée**. Le seuil reste **+10 %** sur les seize médianes STCK/SMLP déjà annoncées. La référence de coût est la publication **66**, commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0`, inventaire natif de **245 fichiers**, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff`. Le [manifeste de référence](../base/source-manifest.json) est une copie exacte du manifeste historique ; la fenêtre vérifiera à nouveau son égalité avec les fichiers du checkout de référence.

La base fonctionnelle est la publication **67**, moteur **0.39.0**, commit `81b937373b80e8c92c36856da0ec46b37db38956`. Son [résultat officiel conservé](../../lot3b-evidence/performance/combined-comparison.json) reste `budget_review_required`, **15/16** : restauration STCK **9,104383 → 10,8056025 ms**, soit **+18,6857198 %**. Les deux cohortes historiques, dont la seconde conforme, et toutes leurs mesures restent inchangées. La présente fenêtre ne complète pas cet ancien échantillon et ne remplace pas son résultat par une nouvelle mesure du même code.

Le [premier essai officiel de correction 0.40](../performance/results.md), digest natif `f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece`, reste **`budget_review_required`, 14/16** : restauration STCK **+66,159942506 %**, SMLP **+21,511140301 %**. Ses deux cohortes, 14/16 et 13/16, toutes ses 32 sessions et ses 400 actions sont conservées intégralement. Aucun de leurs échantillons ne participe à la présente fenêtre ; aucune nouvelle mesure de ce même code n'est choisie pour remplacer cet échec.

La nouvelle correction **0.40.0** est déjà gelée dans [final-v3](../final-v3/source-manifest.json) : **249 fichiers natifs**, digest **`391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9`**, [archive de 260 fichiers](../final-v3/source-archive.json). Le manifeste natif a pour SHA-256 `01342c154132a0b5f86c59c4be6e41d48800793ba04916c05b9ff94672c61531`. Par rapport à `f0ba`, quatre fichiers natifs ont effectivement changé : `v6-native-owned.ts`, `v6-native-working-witness.ts`, `v6-observed-inventory.ts` et `v6-shared-series.ts`. Il s'agit d'une nouvelle correction du chemin commun, identifiable par ses octets ; le numéro 0.40.0 seul ne distingue pas les deux essais. Les sources V5/V6 d'origine restent inchangées.

Les [quatre diagnostics normaux v2](../diagnostic/normal-path-v2-protocol.md), une session STCK10 et une session SMLP15 par source, sont distincts du coût officiel. Ils conservent leurs résultats, effectifs et écarts sans ajouter de critère de coût ni compenser l'échec précédent. Leur comparateur limité à six critères ne remplace aucun comparateur officiel. Tous ces profils doivent être terminés avant la présente fenêtre.

Le [manifeste des cas](cases.json) et la [politique](comparison-policy.json) sont des **copies exactes** de ceux du premier essai : respectivement SHA-256 `487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d` et `5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68`. Effectifs, seuil, chauffe, ordre, comparaison, exclusions et règles de clôture sont inchangés. La référence 0.38 sera entièrement remesurée dans cette nouvelle fenêtre ; ses anciens temps ne sont pas réutilisés.

## Effectifs et ordre fixés avant mesure

Deux cohortes de **quatre sessions mesurées par jeu et par version** sont prévues. Les quatre exécutions sont séquentielles :

| Ordre | Exécution | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, référence de la cohorte 1 | 0.38.0 | 4 |
| 2 | B1, correction de la cohorte 1 | 0.40.0 gelée | 4 |
| 3 | B2, correction de la cohorte 2 | Même 0.40.0 gelée | 4 |
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

Les sources natives, le runner, les déclarations et les cas restent inchangés pendant toute la fenêtre. Le wrapper vérifie ces entrées avant chaque exécution et après la dernière. Les mêmes octets du manifeste et de la politique sont copiés aux mêmes chemins relatifs dans les deux checkouts. Les rapports de référence sont recopiés sans modification dans le dossier de livraison. Rapports, sorties brutes, erreurs, résultats de cohortes et résultat agrégé sont tous conservés. Un rapport incomplet ne devient pas une cohorte complète.

La mesure ne commence qu'après le feu vert du responsable de la livraison. Les commandes exactes de lancement et comparaison sont données ci-dessous ; les créer ne les exécute pas.

## Contrôles fonctionnels distincts

La correction conserve la logique générique V5/V6 et les obligations d'identité, révision, invalidation, gardes, acquisition unique, checkpoints et restauration atomique. Le périmètre formel du nouveau gel comporte **35 fichiers de tests**, à exécuter intégralement avant la fenêtre. Les **1 272/1 272 tests dans 33 fichiers** du gel `f0ba` restent rattachés à leur ancienne source, comme les **1 077 tests dans 29 fichiers** de 0.39 ; ils ne valident pas par anticipation le nouveau gel. Le reçu complet de `final-v3/` devra porter son propre résultat, sans transférer ces compteurs historiques.

Le [manifeste de régression préalable](../recorded-regression-cases.json) déclare deux rejeux froids :

| Référence fonctionnelle | Résultat retenu | Source des retours |
| --- | --- | --- |
| CATR 0.39 | 12 actions, 3 niveaux, 8 préfixes, 1 session | Campagne froide et trace publique 0.39 |
| RSWP 0.39 | 19 actions, 3 niveaux, 11 préfixes, 1 session | Rapport de rejeu 0.39 et trace publique 0.38 conservée, dont les paquets complets sont identiques |

Le même comparateur historique effectue **17 contrôles par jeu**, soit 34 au total. Le schéma d'observation Chamber est déjà présent dans les deux rapports de référence 0.39. Le résultat strict historique RSWP 0.38 → 0.39 reste **16/17**, avec sa qualification séparée ; il n'est pas remplacé par ces nouvelles comparaisons. Les nouveaux résultats seront rapportés tels quels.

Ces rejeux recomputent chaque commande avant son retour enregistré ; ils ne constituent pas une nouvelle réussite live ni une mesure de vitesse. Une campagne froide CATR supplémentaire et un contrôle navigateur peuvent confirmer le build corrigé, en restant distincts du coût officiel. La réussite des trois niveaux de CATR acquise en 0.39 et son horloge résolue restent conservées ; la correction n'invente pas une nouvelle capacité de jeu.

Les temps du présent budget excluent le moteur de jeu, le réseau de production et le rendu navigateur. L'inspection est déclenchée après le rejeu, hors de sa durée. Pause vérifie l'accusé du contrôleur et l'arrivée à une frontière sûre pendant la planification initiale et la première action engagée ; elle ne prouve pas la préemption arbitraire d'une recherche. Ces sessions finies ne prouvent pas la stabilité de sessions de plusieurs heures.

## Commandes prévues après gel et validation

Les commandes suivantes partent de la racine du checkout. Le wrapper gère les quatre mesures dans l'ordre annoncé. Le dossier de référence ci-dessous existe déjà ; les sources et dépendances doivent être vérifiées avant le feu vert.

```bash
python -B scripts/run-native-cost-window.py /workspace/scratch/c4dd29871d33/lot3b-baseline docs/migration/lot3b-cost-evidence/performance-v2 docs/migration/lot3b-cost-evidence/base/source-manifest.json docs/migration/lot3b-cost-evidence/final-v3/source-manifest.json
```

Après la fin de la fenêtre, les trois comparaisons et la revue sont successives :

```bash
node scripts/compare-native-loop-costs.mjs docs/migration/lot3b-cost-evidence/performance-v2/comparison-policy.json docs/migration/lot3b-cost-evidence/performance-v2/cohort1/baseline.json docs/migration/lot3b-cost-evidence/performance-v2/cohort1/after.json docs/migration/lot3b-cost-evidence/performance-v2/cohort1/comparison.json
node scripts/compare-native-loop-costs.mjs docs/migration/lot3b-cost-evidence/performance-v2/comparison-policy.json docs/migration/lot3b-cost-evidence/performance-v2/cohort2/baseline.json docs/migration/lot3b-cost-evidence/performance-v2/cohort2/after.json docs/migration/lot3b-cost-evidence/performance-v2/cohort2/comparison.json
node scripts/compare-native-cost-cohorts.mjs docs/migration/lot3b-cost-evidence/performance-v2/comparison-policy.json docs/migration/lot3b-cost-evidence/performance-v2/cohort1/baseline.json docs/migration/lot3b-cost-evidence/performance-v2/cohort1/after.json docs/migration/lot3b-cost-evidence/performance-v2/cohort1/comparison.json docs/migration/lot3b-cost-evidence/performance-v2/cohort2/baseline.json docs/migration/lot3b-cost-evidence/performance-v2/cohort2/after.json docs/migration/lot3b-cost-evidence/performance-v2/cohort2/comparison.json docs/migration/lot3b-cost-evidence/performance-v2/combined-comparison.json
python -B scripts/review-native-cost-consolidation.py docs/migration/lot3b-cost-evidence/performance-v2
```

## État au moment de la déclaration

La source corrigée et son archive sont gelées ; aucun `window.json`, rapport ou résultat de cohorte de `performance-v2/` n'existe au moment de cette déclaration. Les preuves fonctionnelles et les diagnostics de la nouvelle source sont encore à terminer. Les commandes ci-dessus sont préparées, **pas exécutées** par la rédaction de ce protocole. La mesure ne démarre qu'après leur achèvement, l'arrêt du preview et le feu vert du responsable.

La fenêtre précédente `performance/`, son protocole et amendement, ses deux cohortes échouées, son agrégat 14/16 et sa revue indépendante de 231 vérifications restent intacts. Aucun succès futur ne les réécrit. **3B reste ouvert tant que la nouvelle source n'a pas satisfait ses obligations fonctionnelles et l'ensemble du budget annoncé ; 3C attend cette clôture.**
