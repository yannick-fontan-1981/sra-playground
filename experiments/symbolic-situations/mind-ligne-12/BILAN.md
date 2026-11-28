# MIND · verdict indépendant de la ligne 12

**La sélection d’une séquence à partir du retour public est qualifiée sur le gel.** Le moteur de `860835b1b77ae9cde489230be5c1f83c05237302` a le même arbre `src` que `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Les deux SHA donnent les mêmes décisions et reçus sur les quatre départs, soit 54 gestes par SHA. Les 16 gestes du catalogue concordent avec la prolongation. Les deux tests natifs passent sur chaque SHA. [Présélection opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/f7204b11/experiments/symbolic-situations/mind-ligne-12/CONTRAT.md)

- Le T4 soumet `[8,14,9]`. Son retour établit les marques du code soumis et influence le choix T5 de `[8,9,14]`. Le premier clic reste (4,54). Le deuxième, au T6, passe à (10,54) pour ajouter 9. Le véritable contrôle T8 ouvre N2.
- Retirer seulement le reçu de T4 pour le choix T5, au même état et sans changer le jeu, remet `[8,14,9]` en tête. Le T6 joue (4,54) pour ajouter 14. Le vrai retour T8 est compatible avec deux réponses et le score reste à zéro. La mémoire restaurée reprend `[8,9,14]` au T9 et valide au T12. Le vérificateur rejette l’association du deuxième clic alternatif à la séquence nominale.
- En N2, le service relit puis revalide l’entrée de N1. Après la soumission locale T12, il choisit `[14,6,8]` au T13 et marque au T16. Au T17, N3 reçoit la preuve issue de N2.
- La réserve rejoue le véritable retour ambigu de T8 à finale seule. Le retour natif ne contenait déjà qu’une image. Le verdict d’ambiguïté est reproduit sur les deux SHA, sans mesure possible de la perte d’une trame intérieure.

Verdict vérifié 3 min 38 s après le premier essai indépendant, sans modification du moteur ni reprise du rejeu.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf. La sélection scellée reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','860835b1b77ae9cde489230be5c1f83c05237302')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
