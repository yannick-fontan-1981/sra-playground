# Lot 3B : acceptation du coût global selon la nouvelle règle utilisateur

**Décision : le coût de native 0.42 satisfait la règle globale explicitement autorisée par l'utilisateur. Les deux cas passent ; le lot 3B peut être clôturé dans son périmètre fonctionnel déjà validé et le lot 3C peut commencer.** Le résultat historique de la règle par phase reste **14/16, `budget_review_required`**. Aucun rapport, protocole, échantillon ou résultat antérieur n'est réécrit.

## Autorisation et définition du critère

Le 10 novembre 2026, après la publication 70 / native 0.42, l'utilisateur précise :

> si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté.

Le « global » est appliqué à la **durée complète d'une session pour chaque cas testé**, à travers la médiane des huit sessions par version. Chaque jeu doit satisfaire **strictement moins de +10 %**. Cette interprétation évite de compenser une régression d'un jeu par l'amélioration d'un autre, ou d'additionner des phases imbriquées. Les dépassements de phase et les p95 restent visibles comme diagnostics.

Il s'agit d'un **changement de règle de décision autorisé après la mesure**, appliqué aux preuves conservées. Ce n'est ni une nouvelle fenêtre de mesure ni une prétention que l'ancien protocole avait déjà ce critère.

## Application aux mesures conservées

Le [nouveau reçu](lot3b-global-budget-acceptance.json) relit les quatre rapports bruts et recalcule les médianes globales. Il vérifie leurs empreintes, les effectifs, les identités de session et la concordance avec l'[agrégat historique](lot3b-state-cost-evidence/performance/combined-comparison.json). Les **32 sessions et 400 actions** sont toutes retenues ; les seules chauffes exclues restent celles du protocole original.

| Cas | Médiane 0.38 fraîche | Médiane 0.42 | Variation globale | Nouvelle décision |
| --- | ---: | ---: | ---: | --- |
| STCK | 11 507,6884395 ms | 9 459,8053905 ms | **−17,795781 %** | Accepté |
| SMLP | 18 844,4015975 ms | 16 311,280257 ms | **−13,442302 %** | Accepté |

Le [manifeste de 0.42](lot3b-state-cost-evidence/final/source-manifest.json) conserve le digest `2de70025ae08845efd491929416e091e9dc9e8e4b473440b9c6a86838e0b3d19`. La référence 0.38 garde `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff`. Le reçu lie les empreintes exactes de l'agrégat et de ses quatre rapports. Il ne compare pas les durées de fenêtres historiques différentes.

## Réserves toujours conservées

La règle historique reste **14/16** : service de préfixe connu STCK **+27,720363 %** et requête correspondante **+26,350748 %**. Les deux cohortes conservent leurs résultats **14/16 et 13/16**. Ces variations sont acceptées pour la clôture du coût selon la nouvelle règle, puisque les sessions complètes respectent le seuil ; elles ne deviennent pas des baisses ou des phases conformes à l'ancienne règle.

Les pointes de latence restent dans le [rapport officiel](lot3b-state-cost-evidence/performance/results.md), notamment le p95 du garde SMLP **0,756828 → 7,512366 ms** et celui de nouvelle décision SMLP **800,527360 → 892,998337 ms**. L'[analyse de continuation préparée](lot3b-state-cost-evidence/diagnostic/known-prefix-followup.md) conserve son utilité future sans bloquer 3C par le seul seuil de phase. La cause précise des variations et la stabilité sur plusieurs heures ne sont pas établies.

Les obligations fonctionnelles restent séparées : **1 396/1 396 tests**, **5/5 contrôles de projet**, CATR froid/navigateur **12 actions, trois niveaux, huit plans**, rejeux CATR/RSWP **34/34**, avec leurs [reçus et qualifications](lot3b-state-cost-evidence/README.md). La nouvelle acceptation de coût ne modifie ni leur périmètre ni la couverture globale de migration.

## Reproduction et règle pour la suite

Le script [review-native-global-cost-budget.py](../../scripts/review-native-global-cost-budget.py) est distinct des comparateurs historiques. Il recalcule uniquement les sessions complètes depuis les fichiers retenus, conserve tous les résultats de phase, refuse un fichier de sortie déjà présent et ne lance aucun moteur :

```bash
python -B scripts/review-native-global-cost-budget.py \
  docs/migration/lot3b-state-cost-evidence/performance/combined-comparison.json \
  docs/migration/lot3b-global-budget-acceptance.json \
  --lot 3B --native-version 0.42.0
```

La commande ci-dessus documente la génération initiale. Une vérification ultérieure doit utiliser un nouveau chemin de sortie temporaire plutôt que remplacer le reçu. Le seuil exact **+10 % est refusé**, conformément à « en dessous » ; les cas immédiatement inférieurs et supérieurs, ainsi que les valeurs non finies ou non positives, ont été vérifiés séparément.

Pour les prochains gels, la même règle doit être déclarée avant leur fenêtre : durée globale par cas inférieure à +10 %, phases et p95 publiés, mêmes travaux et aucune session mesurée exclue. La clôture de 3B vaut pour son périmètre annoncé ; les branches de composition non transférées et la parité V5/V6 globale restent ouvertes.
