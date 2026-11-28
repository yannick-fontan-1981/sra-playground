# AR25 · deux qualifications sur les mêmes trames

**La ligne 8 apprend déjà les déplacements sur le gel. Le candidat `f6ff40f5` permet de remplacer ou retirer le calibrage choisi. La ligne 77 choisit, contrôle et peut retirer sa propre offre dès le gel.** Le parcours nominal est identique sur les deux moteurs. [Contrat scellé](CONTRAT.md) · [Reçu indépendant](recu.json)

### Ligne 8 · mesurer le contenant et le contenu

Au T1, `containment_and_contact` choisit ACTION1 dans un domaine de cinq commandes. Le retour déplace la pièce de couleur 4 de (36,15) à (36,12). Les 35 pixels contrôlés au bord de la cavité restent de couleur 9. Le reçu associe le déplacement (0,−3) à la seule pièce 4 et le prochain choix cite ce retour. Le vérificateur rejette une attribution de ce vecteur à un autre objet.

Sur la branche, remplacer le calibrage par ACTION2 déplace la même pièce en (36,18), conserve le bord et donne (0,+3). T2 choisit alors ACTION1. Retirer le calibrage donne le même ACTION1 sous `observed_frontier`, avec un paquet physique identique au nominal. La famille de contenant n’acquiert pas ce vecteur. Elle redemande ACTION1 à T2. La famille de réflexion acquiert quand même sa covariation à partir de ces pixels.

Dans la réserve T1, le même ticket est joué et le plateau antérieur est servi. La mémoire consigne l’essai sans déplacement à cette pose, garde le sujet actif indéterminé et ne lie aucun vecteur. Le prochain calibrage est ACTION2.

### Ligne 77 · projeter et vérifier la couverture réfléchie

La réflexion interprète la couleur 5 comme le corps direct et la couleur 4 comme son reflet. Ses propres mesures en cellules de trois pixels donnent (0,−1), (0,+1) et (−1,0) sur les trois premiers retours. Les deux axes sont attestés avant que T4 libère ACTION3. Retirer seulement son troisième retour laisse intactes les données du contenant et supprime l’axe horizontal de la mémoire de réflexion. T4 devient ACTION4 sous le contenant. Retirer seulement le résultat de `ReflectedCover.solve` donne le même repli et la réflexion revient au T5.

Les treize projections de T4 à T16 sont confirmées, avec N1 toujours en cours. Une autre coupe d’horizon, limitée à douze pas du plan initial, produit les mêmes commandes et paquets jusqu’à T16. Le nouveau placement à T16 garde la cellule réfléchie (17,15) et couvre (17,16), ce que le jeu confirme.

La réserve après le vrai T4 sert 64 des 109 changements de pixels en filtrant d’après les bornes du corps déplacé. Le reste du vrai retour reste disponible pour comparaison. La prévision est contredite, le pas scellé et le ticket suivant revient à ACTION4 sous le contenant. Le vérificateur rejette aussi une preuve de covariation qui emprunte la référence du retour précédent.

### Périmètre et rejeu

Huit départs et **55 gestes par SHA**, dont un catalogue de 16 gestes. Ce catalogue couvre **3 des 39 occurrences** de la ligne 8 et **les 13 occurrences** de la ligne 77. Le verdict a été vérifié environ **1 min 15 s** après le premier essai indépendant. Les mesures portent sur le choix des deux familles et sur les preuves locales de leurs retours. Les 157 tests natifs reconstitués par l’auteur sont consignés dans son propre bilan. [Verdict de l’auteur](https://github.com/yannick-fontan-1981/sra-playground/blob/54c99566/experiments/sic-agenda-offres/ar25-8-77/VERDICT.md)

Sous Node 24, depuis ce dossier, `$pyodide` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf. Le fichier de sélection de la réserve reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','f6ff40f5e6c870ab5f897eaccdd1d43873944c5c')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $pyodide "$p.$g.json" $sélection
  }
}
node verifier.mjs $reçus
```
