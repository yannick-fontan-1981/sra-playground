# SP80 · routage des branches et sonde de placement

Le parcours nominal est identique sur le gel `d0e7527c` et sur le candidat `bb4a99b5`. Il comprend 16 tickets exécutés depuis N1 avec le budget du catalogue. Les 17 observations et les 16 commandes concordent avec la trace de référence. [Présélection opérateur](CONTRAT.md) · [Reçu indépendant](recu.json)

| Ligne | Offres positives observées à l’appel du fournisseur | Tickets joués et retours | Confirmés / contredits / indéterminés |
|---|---:|---:|---:|
| 4 · routage des branches | 9 | 11 / 11, soit les 11 occurrences du catalogue | 6 / 0 / 5 |
| 41 · sonde de placement | 5 | 5 / 5, soit 5 des 45 occurrences du catalogue | 0 / 0 / 5 |

Les tickets de routage T6 et T7 poursuivent le plan déjà libéré. Cela explique les deux tickets supplémentaires par rapport aux offres observées.

### Ligne 4 · qualifiée

À N1/T1, une source à l’indice transversal 9, deux cavités aux indices 5 et 11 et un contributeur de longueur 5 orientent la préparation. Le contributeur actif en (12,16) va en (12,12) après ACTION1. Le reçu de calibrage associe le déplacement (0,−4) au ticket de `branch_routing`. Le gel exécute quatre calibrages, trois déplacements, l’essai de propagation à T8, puis deux déplacements et une sélection en N2.

Sur les deux révisions, retirer l’offre complète au T1 laisse jouer ACTION1 sous `observed_frontier`. Le routage n’acquiert alors aucun vecteur sur ce clic et redemande ACTION1 au T2. Sur le candidat, la nouvelle opération `selectCalibration` accepte les cinq contrôles disponibles. Le départage réservé choisit **ACTION4**. Le même contributeur passe de (12,16) à (16,16), le reçu porte le vecteur (+4,0), puis le service choisit ACTION1. Le branchement remplace ainsi le calibrage au sein de la même famille. Le retrait au sélecteur et le retrait de l’offre complète produisent les mêmes tickets et retours.

### Ligne 41 · sélection qualifiée, effet de placement non établi

Après les onze vrais retours du préfixe, l’offre de `cell_patch_composition` est admise sur un champ 2 × 2. Le ticket T12 appartient à `public_occurrence_recall / cell_patch_placement` et joue ACTION6 en **(13,25)**. La seule image de retour diffère de deux pixels, **(4,63) et (5,63)**. Aucun pixel du champ ne change. Le service enregistre le reçu, n’acquiert aucun modèle de pose et redemande (13,25) au T13. Les cinq retours nominaux restent indéterminés.

Sur le candidat, `selectProbeCell` peut choisir l’autre cellule également admissible, **(33,17)**. Elle produit les mêmes deux changements hors champ et T13 revient à (13,25). Sur les deux révisions, retirer l’offre entière à T12 libère ACTION4 sous `branch_routing`. Le retour confirme les poses prédites, dont le déplacement du contributeur actif de (8,16) à (12,16). T13 poursuit le déplacement. La substitution à l’intérieur de la sélection des cellules est propre au candidat.

La réserve conserve le clic T12 et le nombre d’images mais masque les deux changements de bord. Le plateau entier apparaît alors stationnaire. La famille consigne le refus de cet essai sur la configuration courante. T13 devient ACTION4 sous `branch_routing` et son propre retour confirme la pose. Les observations réelles et construites conduisent donc à deux suites distinctes malgré le même champ inchangé. Le contrôle d’attribution rejette le reçu de T12 portant l’identifiant du ticket T13, bien que ces deux tickets nominaux aient exactement la même commande et les mêmes coordonnées. Il rejette aussi le reçu de T1 porteur de l’identifiant de T2.

### Périmètre et rejeu

| Révision | Départs opérateur | Gestes joués | Tests auteur exécutés avec le jeu |
|---|---:|---:|---:|
| Gel `d0e7527c` | 5, dont une lecture initiale seule | 44 | 4 réussis et 4 réservés aux nouveaux sélecteurs |
| Candidat `bb4a99b5` | 9, dont une lecture initiale seule | 74 | 8 réussis |

Les cinq départs communs produisent les mêmes résultats. Les quatre départs supplémentaires sur branche exercent les deux nouveaux sélecteurs en substitution et en retrait. Le reçu vérifié a été obtenu 4 min 37 s après la présélection. La comparaison porte sur ces décisions, leurs retours et le tour suivant.

Sous Node 24, depuis ce dossier, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. Utiliser un dossier de reçus neuf. La sélection privée est nécessaire pour le groupe de substitution.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','bb4a99b5ba41531eb70f1dccb6a97a919cefec56')) {
  $prefixe = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','topologie','retrait','réserve')) {
    node qualifier.mjs $sha $g $jeu "$prefixe.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$prefixe.auteur.txt"
}
node qualifier.mjs bb4a99b5ba41531eb70f1dccb6a97a919cefec56 substitution $jeu "$reçus/bb4a99b5.substitution.json" $sélection
node verifier.mjs $reçus
```
