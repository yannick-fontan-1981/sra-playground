# RE86 · qualification indépendante de la ligne 7

**Le gel acquiert deux supports et réutilise la couverture après une autre disposition.** `8e820aa6` possède le même arbre moteur que `d0e7527c`. Les six départs donnent les mêmes décisions et retours sur les deux révisions. [Critères scellés](CONTRAT.md) · [Reçu vérifié](recu.json)

| Étape | Preuve observée |
|---|---|
| T1 à T4 | ACTION1 ouvre à table vide. Les quatre sondes mesurent successivement (0,−3), (0,+3), (−3,0) et (+3,0). Le T4 attribue au propriétaire 0 le support de couleur 9, avec 53 pixels. |
| T5 à T9 | ACTION5 observe une occultation locale et change le focus. Le T8 acquiert 45 pixels du support de couleur 11, propriétaire 1. Il rend l’attribution complète aux poses (36,45) et (18,24). T9 consomme ce reçu en mode déplacement et le retour confirme la projection. |
| T20 à T27 | T20 sélectionne un autre propriétaire. T21 consomme les poses (48,24) et (18,24) avec le propriétaire actif 1. T26 termine le niveau avec un reçu de frontière officielle. T27 repart en acquisition, à zéro support. |

Retirer seulement ACTION1 du domaine fourni à la famille change le premier ticket en ACTION2. Le vrai retour lie son vecteur (0,+3), puis T2 choisit ACTION1. Cette branche atteint une seconde pose (18,30), effectivement consommée par la couverture et confirmée au T9. Le vrai jeu termine le niveau au T28, puis T29 revient à la mesure à froid.

Dans le retour T1 construit, garder le plateau antérieur écarte les 61 changements physiques. L’essai est inscrit sans vecteur ni support et T2 sonde ACTION2 avec une table vide. Le vérificateur rejette un reçu qui attribue le support de couleur 11 au propriétaire 0.

**Réserve T8.** Le vrai retour change trois pixels dans trois composantes. La sélection scellée retient un seul pixel. La mémoire peut encore enregistrer les deux supports, mais le focus devient ambigu et l’attribution complète échoue. T9 passe à ACTION2 sous la frontière. Un retour T8 entièrement stationnaire réfute la sélection et rend T9 à l’accès au contact. Ces deux suites diffèrent de la couverture admise avec le vrai retour.

Six départs et **89 gestes par SHA**, dont les **16 occurrences catalogue sur 16**. Les suites auteur passent, trois tests par révision avec le vrai jeu. Le verdict a été vérifié **2 min 23 s** après le premier essai indépendant.

### Rejeu

Sous Node 24, depuis ce dossier, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. Utiliser un dossier de sortie neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','8e820aa64f321153bb858040d462d7f766178947')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','prolongé','alternative','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
