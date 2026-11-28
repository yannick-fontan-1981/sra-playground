# GRIL · soumission de catalogue 54 et changement de vue 40

**Les lignes 54 et 40 sont qualifiées sur le gel.** Les quatre scénarios produisent des reçus identiques sur `d0e7527c` et `915e0601e3aad82653733ac602909bef2286343d`, qui partagent le même arbre moteur. Les 16 tickets nominaux comprennent neuf décisions de 54 et deux de 40. [Index des deux contextes](sic-gril-915e0601/banc.json) · [Reçus du banc](sic-gril-915e0601/recus.zip)

| Ligne | Témoin de N1 et intervention | Second contexte |
|---|---|---|
| **54** | T2 clique en (11,53) pour la palette 8. Le retour change 63 pixels. Le reçu `catalogue_response` date la soumission, avec deux références d’observation et aucune progression officielle. T3 sélectionne la palette 9. Retirer uniquement le reçu de soumission sur la même observation fait répéter (11,53) au T3. Le vrai retour de ce second clic laisse la trame identique. | N3/T12 soumet le candidat 3 pour la palette 8, avec un reçu propre au nouveau champ. T13 sélectionne la palette 9. |
| **40** | T4 émet `ACTION3` à partir du témoin `catalogue_field_input_observed` de T1. Le retour change 39 pixels et ramène les trois candidats à un seul. Retirer uniquement le témoin T1 à préfixe identique donne `ACTION4` par la frontière. Son vrai retour change 50 pixels et porte ses propres références d’accès. | N3/T15 lit le témoin de T11 et ramène quatre candidats à un seul. |

La soumission T2 influe sur le choix de palette T3, qui fournit la vue courante pour T4. Sur cette même vue après T3, la reconstruction de la proposition sans les deux événements issus de T2 restitue l’offre T4 à l’identique. Pour 40, les preuves effectivement citées sont celles de T1, puis de T11 dans le second contexte. Les interventions retirent des événements de la mémoire utilisée pour proposer. Les retours des commandes alternatives proviennent du jeu. Une réponse datée de 54 demeure une soumission, avec `matched:null` au ticket étudié.

Départ N1, six niveaux, ouverture native, budget global 16, 600 gestes par niveau et graine implicite 0. Critères `cb05fadc`. L’index rattache les décisions à leurs observations et donne le temps depuis la première capture.

Depuis le banc avec Node 24.22.3 et les jeux préparés :

```powershell
$r = 'artifacts/rejeu-gril'
foreach ($revision in 'd0e7527c','915e0601') {
  py -3.11 scripts/test-sic-catalogue-lines.py $revision $r --game GRIL --game-root ../sic-main-delivery
}
py -3.11 scripts/check-sic-gril-catalogue.py $r
```
