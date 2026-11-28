# KATA · verdict indépendant de la ligne 32

**La sélection, l’acquisition de l’aperçu et le réemploi du contrôle sont qualifiés sur le gel.** Les révisions `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `d22d706c8c148da1b6bde090d3c6c53d20c69d50` ont le même arbre `src`. Les six départs et 89 gestes par SHA donnent les mêmes décisions et retours. Vérification de 16/16 gestes du catalogue, et prolongation distincte jusqu’à T33. Trois tests auteur passent par SHA. [Présélection opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/a9b4bec9/experiments/symbolic-situations/kata-ligne-32/CONTRAT.md)

- Le T1 sélectionne par ACTION6 en (29,4) la pièce 2 de couleur 14 à la pose (0,5), pour une cible (0,1). L’offre ne connaît pas encore la couleur de l’aperçu. La capture du vrai clic donne la couleur 0 sur les cinq cellules de son masque. Le retour stationnaire ne lie aucun aperçu et T2 propose de sélectionner la même pièce.
- Au T5, ACTION3 mesure la translation (0,−1) avec les deux références publiques. T6 l’utilise pour prédire la pose (0,3), que le jeu confirme.
- En N3, T18 consomme le contrôle ACTION2 à aperçu identique et le jeu confirme (1,6). Retirer seulement la mesure ACTION2 laisse la même ACTION2 et le même retour matériel. Le geste est alors une calibration sans projection, puis T19 prédit et confirme (2,6). Retirer tous les contrôles déclenche une calibration ACTION1 à la place. T19 reprend ACTION2 et confirme (1,6).
- Le retour T25 confirme la pièce 2 à la cible (2,0) avec le masque attendu. T26 sélectionne la pièce 3 pour (2,1) et son propre aperçu est confirmé. Le jeu confirme le troisième niveau au T33, hors catalogue.
- À T1, le vérificateur accepte le vrai reçu pour la pièce 2 et rejette une référence à une autre pièce tirée selon la présélection, à plateau identique. Le vrai retour comporte déjà une seule image. Le cas vérifie l’identité de la pièce avec la finale seule et ne mesure pas la suppression de trames intérieures.

Verdict obtenu en 2 min 22 s au premier rejeu indépendant.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf. La sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','d22d706c8c148da1b6bde090d3c6c53d20c69d50')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
