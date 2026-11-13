# Lot 3A : coûts mesurés, réserve maintenue

## Décision

**12 médianes sur 16 respectent +10 % ; quatre restent hors budget. Le coût 3A reste ouvert.** Le résultat fonctionnel et les trois niveaux RSWP sont acquis. Le sous-lot ne peut pas être annoncé clôturé dans son ensemble.

La première cohorte de trois sessions par jeu et par version conserve **10/16** critères dans le budget. Un unique suivi annoncé de cinq sessions conserve **14/16**. La décision finale agrège **toutes les huit sessions** : 32 sessions mesurées au total, 200 actions mesurées par version sur STCK10/SMLP15, sans exclusion, sélection de cohorte ni supplément de tolérance lié au bruit. Les chauffes déclarées restent seules hors des distributions mesurées.

La [politique initiale](comparison-policy.json), le [suivi déclaré](followup/protocol.json), les [fenêtres initiales](window.json) et de [suivi](followup/window.json) restent distincts. La source native est inchangée pendant toutes les mesures : 0.36 `ac7225dd…` contre 0.37 `f3f795a3…`. Les [trois premières sessions](comparison.json), les [cinq suivantes](followup/comparison.json) et le [bilan agrégé](combined-comparison.json) conservent leurs résultats propres.

## Huit sessions par jeu et version

Toutes les durées sont en millisecondes. Les phases sont imbriquées et ne doivent pas être additionnées.

### STCK

| Phase | Effectif par version | Médiane avant | Médiane après | Variation | p95 avant | p95 après | Budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Session complète | 8 | 11372.078 | 11258.222 | -1.001 % | Non publié | Non publié | Respecté |
| Nouvelle décision | 48 | 291.445 | 315.231 | +8.161 % | 518.646 | 465.026 | Respecté |
| Service de continuation | 32 | 10.244 | 11.430 | +11.578 % | 18.220 | 15.490 | **Ouvert** |
| Requête de continuation | 32 | 12.317 | 13.504 | +9.632 % | 19.897 | 17.371 | Respecté |
| Garde de continuation | 32 | 0.233 | 0.265 | +14.144 % | 0.325 | 0.371 | **Ouvert** |
| Acquisition et persistance | 48 | 964.811 | 946.486 | -1.899 % | 4099.446 | 4156.809 | Respecté |
| Persistance | 104 | 180.604 | 180.050 | -0.307 % | 383.878 | 337.062 | Respecté |
| Restauration | 96 | 10.642 | 11.653 | +9.500 % | 75.350 | 61.684 | Respecté |

### SMLP

| Phase | Effectif par version | Médiane avant | Médiane après | Variation | p95 avant | p95 après | Budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Session complète | 8 | 24596.645 | 25232.564 | +2.585 % | Non publié | Non publié | Respecté |
| Nouvelle décision | 72 | 422.912 | 490.291 | +15.932 % | 3359.461 | 3324.350 | **Ouvert** |
| Service de continuation | 48 | 10.484 | 11.571 | +10.365 % | 17.693 | 19.924 | **Ouvert** |
| Requête de continuation | 48 | 13.212 | 13.768 | +4.206 % | 19.686 | 22.456 | Respecté |
| Garde de continuation | 48 | 0.348 | 0.364 | +4.493 % | 0.549 | 0.602 | Respecté |
| Acquisition et persistance | 72 | 1689.307 | 1792.318 | +6.098 % | 3072.037 | 3058.326 | Respecté |
| Persistance | 152 | 143.883 | 153.529 | +6.704 % | 266.034 | 288.096 | Respecté |
| Restauration | 144 | 5.138 | 5.266 | +2.482 % | 24.099 | 26.902 | Respecté |

Les quatre surcoûts médians sont **+1,186 ms** pour la continuation STCK, **+0,032898 ms** pour sa garde, **+67,378 ms** pour une nouvelle décision SMLP et **+1,087 ms** pour sa continuation. Les médianes de session évoluent de **−1,001 %** et **+2,585 %** ; elles ne soldent pas les quatre dépassements locaux. Les minima, maxima et dispersions par session restent dans les JSON complets.

## Vérifications de la consolidation

L’agrégateur reproduit exactement les seize métriques budgétées, distributions de session, p95, dispersions et classifications de chacune des deux comparaisons avant de regrouper leurs échantillons. Il vérifie sources, runner, environnement, déclarations et travail enregistré. Les manifests ne diffèrent que par le nombre de tours ; toutes les sessions mesurées restent identifiées. Les métadonnées de requêtes, observations, échantillons, pauses et inspections correspondent ; durées, RSS et heap ne sont pas assimilés à des identités métier. Aucun résultat d’un nouveau runner n’est fabriqué : le rapport possède son propre schéma de consolidation.

## Diagnostic du nouveau chemin Panel

Trois sessions froides supplémentaires rejouent chacune les **19 commandes réellement recalculées** sur les retours publics de la campagne RSWP. La médiane de session est **23 578,598 ms**, avec un intervalle observé de **22 844,685 à 25 167,936 ms**. Il ne s’agit ni d’un temps de jeu live ni d’un ratio de vitesse face à une base incapable de suivre le même parcours.

| Phase | Effectif | Médiane | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 3 | 23578.598 | Non publié | 25167.936 |
| Nouvelle décision | 33 | 310.554 | 485.999 | 552.413 |
| Service de continuation | 24 | 23.186 | 30.309 | 36.124 |
| Requête de continuation | 24 | 25.194 | 32.213 | 38.179 |
| Garde de continuation | 24 | 6.672 | 10.173 | 13.228 |
| Acquisition et persistance | 33 | 1117.148 | 3679.126 | 3921.847 |
| Persistance | 69 | 215.861 | 395.295 | 489.838 |
| Restauration | 66 | 6.333 | 73.246 | 100.885 |

L’inspection mesure service et transport, avec une médiane de **319,810 ms** côté service et **595,499 ms** au total, sur neuf échantillons. Elle ne comprend pas le rendu de l’inspecteur. Pause est reconnue immédiatement dans ce dispositif, mais l’arrêt sûr attend la computation engagée : médianes **1 086,303 ms** pendant la planification initiale et **959,536 ms** après engagement de la première action, trois échantillons par cas. Ces mesures ne prouvent pas une préemption arbitraire pendant toute recherche.

## Attribution et prochaine correction

Le [diagnostic de projection](../diagnostics/panel-measurement-cost.md) trouve environ deux millisecondes réutilisables sur les rasters initiaux refusés. Le [profil STCK unique](../diagnostic/panel-entry-stck-results.md) mesure un seul appel de la nouvelle entrée par décision, médiane **6,283 ms**, total **53,429 ms sur six décisions**. Il ne permet pas d’attribuer les hausses de 50 à 67 ms à cette seule entrée ni d’exclure des effets indirects d’allocations ou de GC. Le [diagnostic par position](../diagnostics/cost-position-audit.json) et sa [reproduction](../diagnostics/cost-position-reproduction.json) conservent le caractère non uniforme et les mélanges de populations. Ces observations n’annulent aucun critère.

**Prochaine étape prioritaire : clôturer le coût 3A**, en ciblant les nouvelles décisions SMLP et le retour de continuation du service, puis vérifier une correction générique sur les mêmes critères. La chambre relationnelle 3B vient après cette clôture. Aucun cache spéculatif ni modification métier n’a été ajouté pour faire varier le benchmark.

## Limites

Les mesures concernent le runtime, le contrôleur et le transport natifs sur des retours publics enregistrés. Elles ne mesurent ni moteur de jeu réel, ni réseau de production, ni rendu du navigateur. Les échantillons d’une session sont corrélés. Le p95 est absent sous vingt observations et n’est pas un critère budgété supplémentaire. Huit sessions par jeu ne constituent pas une preuve de stabilité sur plusieurs heures. Les réserves des deux cohortes et du bilan agrégé restent disponibles, même quand les médianes de session baissent.
