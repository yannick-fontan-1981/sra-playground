# ELAS · verdict indépendant de la ligne 19

**La sélection métrique, sa vérification et la reprise sur une cible remesurée sont qualifiées sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `280a54b5dd589d192d369b690781de057efaec8c`. Par SHA, quatre départs pilotés et 23 gestes, un départ physique complémentaire et 2 gestes, deux tests auteur. Les deux SHA concordent. Onze tickets métriques sont retrouvés sur les 16 gestes de catalogue. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/da3fac98/experiments/symbolic-situations/elas-ligne-19/CONTRAT.md)

- N1 et N2 mesurent respectivement des échelles 2:1 et 3:1. Le vrai clic T1 (28,25) sélectionne la cellule 24 pour le placement (14,10). En N2, T3 sélectionne la cellule 30 pour (8,6). Les deux propositions appartiennent au domaine recalculé pour leur état. Les vrais retours fixent le destinataire de la sélection.
- Un autre clic ACTION6 au même départ, en (17,13), sélectionne la cellule 8. ACTION1 la déplace ensuite vers 1 sans score. Le garde refuse le transfert du ticket nominal sur cette autre sélection. Présenter le retour de l’autre clic au vrai ticket nominal, ou présenter un retour stationnaire, scelle la sélection faute de confirmation. Les deux départs conservent séparément l’empreinte du vrai paquet nominal.
- T4 mesure le premier transfert confirmé en N2. T5 réutilise son reçu dans ACTION1 et déplace effectivement la pièce 30 vers 16. Cette pose et les couleurs visibles concordent avec la projection, tandis que la référence de cible change et que la couleur 9 disparaît de la cible remesurée. Le service scelle T5, puis T6 se lie à la nouvelle cible.
- Dans le contrôle T5, remplacer seulement la référence de cible consultée par la comparaison du retour, avec le vrai paquet et la même projection, confirme le transfert et lève le scellement. Le cas mesure la causalité de la référence. L’émission normale et le résultat officiel restent ceux du parcours nominal.

Le jeu valide N1 au T2 et N2 au T11. Verdict obtenu en 5 min 18 s. Le premier contrôle tentait de conserver la cible en recopiant l’extérieur de la grille. La cible dépend aussi des couleurs visibles dans la grille, et cette manipulation n’a pas changé la référence. Le rejeu isole directement la référence dans la comparaison.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','280a54b5dd589d192d369b690781de057efaec8c')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
