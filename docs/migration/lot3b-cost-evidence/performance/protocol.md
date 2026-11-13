# Correction de coût du lot 3B : protocole préalable

Déclaré le **10 novembre 2026 à 00:55:34 UTC**, avant toute mesure officielle de cette correction.

## Objet et références

Vérifier la correction générique du chemin de restauration de **Logos Engine 0.40.0**, après gel de ses sources, contre une référence **0.38.0 fraîchement mesurée**. Le seuil reste **+10 %** sur les seize médianes STCK/SMLP déjà annoncées. La référence de coût est la publication **66**, commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0`, inventaire natif de **245 fichiers**, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff`. Le [manifeste de référence](../base/source-manifest.json) est une copie exacte du manifeste historique ; la fenêtre vérifiera à nouveau son égalité avec les fichiers du checkout de référence.

La base fonctionnelle est la publication **67**, moteur **0.39.0**, commit `81b937373b80e8c92c36856da0ec46b37db38956`. Son [résultat officiel conservé](../../lot3b-evidence/performance/combined-comparison.json) reste `budget_review_required`, **15/16** : restauration STCK **9,104383 → 10,8056025 ms**, soit **+18,6857198 %**. Les deux cohortes historiques, dont la seconde conforme, et toutes leurs mesures restent inchangées. La présente fenêtre ne complète pas cet ancien échantillon et ne remplace pas son résultat par une nouvelle mesure du même code.

Le moteur corrigé doit être gelé avant la fenêtre. Son manifeste natif, son archive et son digest identifieront les octets effectivement mesurés. La version `0.40.0` désigne la correction prévue ; seul le gel final et les reçus d'exécution établissent sa réalisation. Les profils et diagnostics servent à identifier du travail et sont conservés séparément. Ils ne constituent pas une cohorte officielle ni une preuve du budget.

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

La correction conserve la logique générique V5/V6 et les obligations d'identité, révision, invalidation, gardes, acquisition unique, checkpoints et restauration atomique. Le périmètre formel sera fixé à partir des contrats réellement modifiés. Les **1 077 tests dans 29 fichiers** de 0.39 restent un résultat historique, pas une validation anticipée de la correction.

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
python -B scripts/run-native-cost-window.py /workspace/scratch/c4dd29871d33/lot3b-baseline docs/migration/lot3b-cost-evidence/performance docs/migration/lot3b-cost-evidence/base/source-manifest.json docs/migration/lot3b-cost-evidence/final/source-manifest.json
```

Après la fin de la fenêtre, les trois comparaisons et la revue sont successives :

```bash
node scripts/compare-native-loop-costs.mjs docs/migration/lot3b-cost-evidence/performance/comparison-policy.json docs/migration/lot3b-cost-evidence/performance/cohort1/baseline.json docs/migration/lot3b-cost-evidence/performance/cohort1/after.json docs/migration/lot3b-cost-evidence/performance/cohort1/comparison.json
node scripts/compare-native-loop-costs.mjs docs/migration/lot3b-cost-evidence/performance/comparison-policy.json docs/migration/lot3b-cost-evidence/performance/cohort2/baseline.json docs/migration/lot3b-cost-evidence/performance/cohort2/after.json docs/migration/lot3b-cost-evidence/performance/cohort2/comparison.json
node scripts/compare-native-cost-cohorts.mjs docs/migration/lot3b-cost-evidence/performance/comparison-policy.json docs/migration/lot3b-cost-evidence/performance/cohort1/baseline.json docs/migration/lot3b-cost-evidence/performance/cohort1/after.json docs/migration/lot3b-cost-evidence/performance/cohort1/comparison.json docs/migration/lot3b-cost-evidence/performance/cohort2/baseline.json docs/migration/lot3b-cost-evidence/performance/cohort2/after.json docs/migration/lot3b-cost-evidence/performance/cohort2/comparison.json docs/migration/lot3b-cost-evidence/performance/combined-comparison.json
python -B scripts/review-native-cost-consolidation.py docs/migration/lot3b-cost-evidence/performance
```

## Amendement préalable : gel corrigé `final-v2`

Ajouté le **2026-11-10T01:13:59.574602+00:00**, avant le début de toute cohorte officielle. La déclaration initiale et ses octets ci-dessus restent conservés ; le présent amendement remplace uniquement le chemin du gel corrigé dans la commande de fenêtre.

Le [reçu de gel préliminaire](../diagnostic/preliminary-freeze.json) conserve le premier digest `55192314213367a8c35e579b8cba17a022146359e1a76efcc1ae9caf5f6ce9cc`, ses 249 fichiers natifs, son archive et ses **1 270/1 270 tests dans 33 fichiers**. La dernière relecture a identifié un `Map` avec prototype entièrement détaché et itérateur hérité dépendant d'une fermeture mutable. Il faut refuser la certification de ce cas, conserver le repli source, puis refaire la suite formelle complète sur la correction.

Le premier dossier `final/` reste immuable et identifiable. La source **0.40.0 corrigée** sera gelée dans **`final-v2/`**, avec un nouveau digest. L'unique diagnostic STCK10 après correction prévu depuis le départ utilisera ce nouveau gel. Il conserve l'instrumentation identique, qui personnalise `family.state` et provoque donc le repli de l'inventaire ; il ne mesure pas un succès de son cache. Le runner officiel conserve les identités de projection de famille intactes et reste inchangé.

**Paramètres, cas, ordres, effectifs, chauffe, seuil +10 %, règles d'exclusion et décision agrégée sont inchangés.** Les mêmes quatre exécutions A1, B1, B2, A2 restent annoncées, soit 32 sessions mesurées et 400 actions. Aucune mesure officielle n'a été exécutée sur le premier gel. Aucune cohorte supplémentaire ni tolérance liée au bruit n'est introduite.

La commande de fenêtre applicable devient :

```bash
python -B scripts/run-native-cost-window.py /workspace/scratch/c4dd29871d33/lot3b-baseline docs/migration/lot3b-cost-evidence/performance docs/migration/lot3b-cost-evidence/base/source-manifest.json docs/migration/lot3b-cost-evidence/final-v2/source-manifest.json
```

Les commandes des deux comparaisons de cohortes, de l'agrégat et de revue indépendante restent celles de la section précédente. Les régressions froides utiliseront aussi le gel corrigé :

```bash
python -B scripts/run-recorded-public-regressions.py docs/migration/lot3b-cost-evidence/recorded-regression-cases.json docs/migration/lot3b-cost-evidence/final-v2 --workers 1 --timeout-seconds 180
```
