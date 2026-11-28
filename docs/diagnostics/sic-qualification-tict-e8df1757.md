# Ligne 41 · placement daté dans TICT et substitution dans SP80

**Le banc confirme la ligne 41 sur deux témoins complémentaires.** Le gel acquiert et utilise un modèle de placement dans TICT. Le sélecteur ajouté à `bb4a99b5` rend la cellule remplaçable dans SP80. Les deux tests portent sur `cell_patch_placement`, sous la question `cell_patch_composition`. L’arbre moteur de `e8df1757272cae3da1669b3e7ddb2e7bf65e8e02` est identique à celui de `bb4a99b5`. [Reçus du banc](sic-tict-e8df1757/recus.zip) · [Contrôle opérateur 49e6f325](https://github.com/yannick-fontan-1981/sra-playground/blob/49e6f325/experiments/symbolic-situations/tict-ligne-41/BILAN.md)

| Cas | Ticket, retour et décision suivante |
|---|---|
| TICT N1/T1, vrai jeu | Le service émet `ACTION6(31,28)`. La cellule (1,1) change à l’image d’indice 0, puis (1,2) à l’indice 2. `recordPacket` acquiert un modèle qui cite les observations avant et après T1. N1/T2 consomme ces références, prédit le motif en (15,12) et reçoit `matched:true`. |
| TICT T1, retour limité à la ligne d’état | Le même ticket reçoit deux pixels changés hors champ. Aucune cellule ne change, aucun modèle n’est acquis et T2 sonde de nouveau (31,28). |
| TICT T1, dernière image seule | Deux motifs sont visibles simultanément. À (15,12), T2 émet une sonde sans prédiction ni recherche de ligne. |
| TICT T2, retour limité à la ligne d’état après le T1 physique | La prédiction est réfutée avec la référence de ce retour. T3 conserve (15,12) et retire le motif attendu. |
| SP80 N2/T12, même préfixe jusqu’au T11 et même observation | Sur la branche, choisir l’autre cellule admissible donne `ACTION6(33,17)` au lieu de `ACTION6(13,25)`. Le vrai jeu renvoie le même plateau dans les deux bras. Seuls (4,63) et (5,63) changent, sans modèle de placement. T13 sonde (13,25). En retirant l’offre, le routage libère `ACTION4` et confirme sa projection. |

TICT reproduit **16 occurrences nominales** avec 9 confirmations et 7 retours indéterminés. SP80 reproduit **5 occurrences nominales** avec des retours indéterminés. Ces **21 des 45 occurrences** sont recapturées dans les conditions catalogue. Les variantes restent des épreuves ciblées. Les quatre scénarios TICT donnent des reçus identiques sur les deux SHA. Les sept scénarios SP80 à `e8df1757` reproduisent les reçus du banc à `bb4a99b5`. La permutation de l’ordre des images fait partie du contrôle opérateur associé.

Départ de N1, curiosité native, budget global 16, 600 gestes par niveau, graine implicite 0. Pour reproduire depuis le banc, avec Node 24 et la racine des jeux préparée :

```powershell
foreach ($version in 'd0e7527c','e8df1757') {
  py -3.11 scripts/test-sic-catalogue-lines.py $version artifacts/rejeu-41/TICT --game TICT --game-root ../sic-main-delivery
}
py -3.11 scripts/test-sic-catalogue-lines.py e8df1757 artifacts/rejeu-41/SP80 --game SP80 --game-root ../sic-main-delivery
```
