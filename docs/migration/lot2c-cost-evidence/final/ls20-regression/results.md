# LS20 — régression froide finale 0.36.0

Les trois niveaux visés sont terminés dans une seule session froide. Les 142 commandes et les 143 paquets publics, paquet initial compris, sont exactement égaux à la campagne publiée 0.35.0. La trace complète conserve sa différence de `sourceDigest` ; elle ne satisfait donc pas une égalité stricte de tous ses champs.

| Niveau terminé | Actions du niveau | Préfixes du niveau | Secondes actives du niveau |
| --- | ---: | ---: | ---: |
| 1 | 17 | 11 | 15.687467557 |
| 2 | 67 | 28 | 75.071498650 |
| 3 | 58 | 19 | 79.190257040 |

Total : **142 actions**, **58 préfixes**, **169.949223247 secondes actives**. État final officiel : `NOT_FINISHED` ; niveau natif 4, 3 niveaux terminés, arrêt `target_levels_completed`. Ce résultat revalide les trois premiers niveaux et ne constitue pas une victoire sur le jeu entier.

Exécution terminée réellement à `2026-11-09T21:23:24.948343+00:00` (code 0). Horloge conservatrice : 215.519107 s depuis la sélection + 1251.193258 s conservées = **1466.712365 s cumulées**, sous la limite de 2 400 s. Le temps de scellement documentaire ne repousse pas l'heure de résolution.

Manifest natif : `ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b` ; sources et code d'exécution inchangés durant la campagne.

## Comparaison publique exacte

`public-comparison.json` contient chaque différence avec son chemin et ses valeurs exactes : 1 différence(s), 1357209 feuilles scalaires égales. Les commandes et chaque champ de chaque paquet public sont comparés sans suppression de champ ni normalisation de provenance.

- `/sourceDigest` : `3cd17565b114a40ed71870bf8d7875a1b91102440b92d14a9258bfa98d4f7779` → `ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b`.

Les reçus initiaux ne sont pas réécrits. `summary.json` conserve les compteurs et les frontières extraits du dernier enregistrement JSON du journal, avec une vérification indépendante des actions par niveau sur la trace publique. Les préfixes par niveau sont les différences des compteurs cumulatifs de frontière. La mesure de coût officielle et la parité V6 complète restent des validations distinctes.
