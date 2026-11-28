# HANO · qualification indépendante de la ligne 25

**La ligne 25 est qualifiée sur le gel.** Le même calcul borné choisit et fait vérifier des transferts sur les piles de N1 et sur les quatre supports de N2. La révision `f768bac6` contient exactement le moteur de `d0e7527c`. Les budgets de 16 et 19 gestes donnent les mêmes 16 premiers tickets et retours. [Contrat scellé](CONTRAT.md) · [Reçu vérifié](recu.json)

| Étape | Décision et preuve |
|---|---|
| N1/T1 | De `[[11,7],[],[]]`, la famille choisit de transférer la largeur 7 du support 0 vers le support 1. Le clic (13,51) produit 28 changements. La marque encadre le membre de couleur 14. Le reçu atteste sa sélection et la garde suivante autorise le dépôt. |
| N1/T2 et T3 | Le clic (31,51) dépose 7 et confirme `[[11],[7],[]]`. T3 s’appuie sur ce retour. Le même point (13,51) sélectionne désormais la largeur 11 pour le support 2. |
| N2/T7 et T8 | Avec quatre supports et `[[15,11,7],[],[],[]]`, le calcul choisit 0→1 pour la largeur 7. Les clics (11,50) et (25,50) confirment `[[15,11],[7],[],[]]`. Après cinq transferts, le jeu ouvre N3, où T17 appartient au transfert de cadre. |

L’énumération indépendante des piles confirme que les premiers choix aux T1, T3 et T7 appartiennent à des chemins minimaux de trois, deux et cinq transferts respectivement. Les deux franchissements officiels T6 et T16 sont comptés séparément des dépôts confirmés par lecture des piles.

Retirer l’offre ordonnée au T1 donne au transfert de cadre les clics (13,50) puis (13,48). Leurs vrais retours changent le plateau. La famille ordonnée reprend ensuite (13,51) puis (31,51) et confirme le dépôt.

**Réserve sur la marque.** Seuls six des 28 pixels modifiés sont dans la boîte du membre. Les autres supports sont vides. La règle scellée sert donc le plateau antérieur. Le ticket T1 réel est joué et la garde refuse ensuite le dépôt faute de marque, scelle le pas et rend la main au transfert de cadre. Dans un contrôle supplémentaire, servir au même ticket la véritable image de la sélection du membre 11 à T3 produit aussi un refus. Le vérificateur rejette un reçu de T1 qui attribue la sélection au membre 11.

**Réserve sur le dépôt.** Le vrai T2 change 47 pixels. En présentant l’image d’avant le dépôt, la sélection déjà acquise reste distincte du retour de dépôt refusé. Le service scelle le pas et libère (13,48) sous le transfert de cadre.

Six départs et **43 gestes par SHA**, avec **16 occurrences catalogue sur 16**. Les trois tests de l’auteur passent sur chacune des références avec le jeu actif. Le verdict a été vérifié **2 min 32 s** après le premier essai indépendant.

### Rejeu

Sous Node 24, depuis ce dossier, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. Utiliser un dossier de sortie neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','f768bac6c4c9c34d230b63fe6cec39663164b6ae')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
