# LS19 · qualification indépendante de la ligne 92

**La sélection et l’acquisition de la question de continuité fonctionnent dès le gel.** Les huit départs donnent des reçus identiques sur `d0e7527c` et sur `b56ea752`, dont l’arbre `src` est identique. Le lot comptabilise 16 exécutions du service. [Critères opérateur figés](https://github.com/yannick-fontan-1981/sra-playground/blob/0d0bb5f89c801dd1feb692f76fa82b8aedf08318/experiments/symbolic-situations/ls19-ligne-92/CONTRAT.md).

| Départs par SHA | Décision vérifiée |
|---|---|
| 1 parcours LS19 L1 réel | Deux arrêts sur la même clé au retour T13. Au T14, `view_continuity / test_local_input` choisit ACTION3 parmi trois questions locales. Le ticket libère `Q_779c7e6fe44602f2b143`. Le retour physique `matched:null` acquiert cette question avec le statut `observed` pour le besoin `1d553a7a…`. Cinq références de vue s’ajoutent à l’occurrence courante. Au T15, le jeu reçoit aussi ACTION3, sous `observed_frontier`, avec la nouvelle question `Q_c84b2a436850df62152b` et le besoin `8648aa7e…`. |
| 1 parcours réel avec la question de vue désactivée au seul choix T14 | Même obstruction acquise et mêmes entrées. ACTION3 passe immédiatement par `observed_frontier`. La question, l’identifiant de besoin et la trame de retour sont identiques au T14 nominal. Seule la référence courante justifie la question ordinaire. Il faut donc la famille effectivement libérée et les preuves pour attribuer la ligne. |
| 2 historiques construits de questions essayées | Un essai stationnaire antérieur de la question ACTION3 rend ACTION4 prioritaire. Dans la réserve, deux essais laissent ACTION1 seule. Les deux tickets sont émis par `view_continuity`. Chaque retour est acquis pour sa propre question et son propre besoin. |
| 2 épuisements construits | Épuiser les trois questions locales par des transitions stationnaires natives, ou retirer toute offre de question ouverte dans la recherche, provoque dans les deux cas un vrai appel de recherche de trajet de frontière. Aucun trajet vers une question admissible n’est trouvé. Le service s’arrête sans ticket. |
| 2 retours construits d’obstruction | Retour fixe : clé présente, deux arrêts, ACTION3 en continuité. Déplacer un seul porteur au retour T13 : clé absente, zéro arrêt retenu, ACTION3 de la frontière ordinaire. Leurs reçus sont attribués séparément. |

Au T14 nominal, le compteur de recherche de trajet de frontière vaut **zéro** et celui de l’entrée dans le classement des trajets de bord vaut **zéro**. Aucune conclusion d’inaccessibilité ne découle de ce choix local. Dans les deux épuisements, le premier compteur vaut **un**, avec un résultat vide. Après mouvement du porteur, le compteur de bord devient positif.

Le besoin concret a le type `observe_untried_input_effect`, le parent `G_protocol_completion` et le contrat `acquire_the_selected_input_return`. Trois falsifications par SHA ont été rejetées : fausse famille, question du tour précédent, besoin du tour suivant. Dans les deux parcours du jeu par SHA, le service a exécuté 16 gestes chacun et l’opérateur a comparé les 14 premières observations à la capture des lignes voisines. Les six autres départs utilisent une transition, une disponibilité ou un historique construit. La mesure porte sur le ticket et son acquisition. [Reçu comparatif](recu.json).

### Rejeu

Depuis ce dossier avec Node 24, définir `$pyodide` (chemin absolu du paquet Pyodide du Banc), `$reçus` (dossier neuf) et, pour le groupe réservé, `$selection` (fichier de graine détenu par l’opérateur).

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','b56ea7526d8b518296351ea6e6a58124ae82f3ce')) {
  foreach ($g in @('jeu','historique','réserve')) {
    node qualifier.mjs $sha $g "$reçus/$($sha.Substring(0,8)).$g.json" $pyodide $selection
  }
}
node verifier.mjs $reçus
```
