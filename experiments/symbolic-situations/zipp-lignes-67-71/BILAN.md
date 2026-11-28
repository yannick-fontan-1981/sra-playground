# ZIPP · verdicts indépendants des lignes 67 et 71

Les révisions `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `421dc6a58d051e8e418db80a98cf1e01755dab40` ont le même arbre `src`. Six départs, **53 gestes et quatre tests auteur par SHA**. Les décisions et retours concordent. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/89dbff7d/experiments/symbolic-situations/zipp-lignes-67-71/CONTRAT.md)

## Ligne 67 · extension d’une trace

**La composition à partir de deux extensions acquises est qualifiée sur le gel**, sur 8/8 occurrences du catalogue de la ligne dans ZIPP. Les deux premiers clics produisent chacun une extension locale liée à leur ticket. Le service propose alors au T3 un préfixe de six pas à partir de la trace de couleur 12. Retirer le premier ou le second reçu conserve le plateau et le clic T3 (48,28). Chaque retrait ramène la longueur à un pas de sondage. Le vrai retour acquiert une deuxième extension et rétablit les cinq pas suivants. Les deux reçus comptent pour ce seuil.

Au T2 construit à plateau stationnaire, l’extension est réfutée et T3 relève d’une acquisition de contrôle. Au nominal, les sept premières extensions sont observées localement et le vrai T8 valide N1. Le rôle des effets hors du support reste inconnu.

## Ligne 71 · sondage du contour

**La liaison au contour courant et le traitement du retour neutre sont qualifiés sur le gel**, sur le témoin ZIPP qui couvre 1/11 occurrences de la ligne. Cinq observations du niveau courant lient le contour de boîte [11,43,17,49] à l’hypothèse locale du T14. La même ACTION5 est autorisée au T13 sous `containment`, où le jeu change 131 pixels. Au T14, sous `public_outline_service`, le vrai retour change zéro pixel. Le reçu établit `no_visible_local_change`, avec `matched:null`. Le T15 ACTION2 est livré par `acquire_control_for_target` et relève de la ligne 1.

Remplacer le bord ou un seul coin au garde fait refuser la même ACTION5. Quand le refus du contour entier est présenté au service, aucun ticket n’est émis au T14. Supprimer le reçu de frontière de la trace au T8 conserve la décision T14, son retour et le T15. L’autorisation du contour repose ici sur les retours de N2.

Verdicts obtenus en 3 min 10 s. Le premier montage supprimait le reçu de frontière après une mutation de la mémoire, ce que le contrôle d’intégrité a refusé. L’opérateur a déplacé le retrait avant l’enregistrement et rejoué les deux variantes de contour.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','421dc6a58d051e8e418db80a98cf1e01755dab40')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contours')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
