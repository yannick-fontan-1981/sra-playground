# Ligne 41 · placement mesuré dans TICT, sélection remplaçable dans SP80

**Le gel acquiert déjà un modèle de placement sur le vrai retour TICT et en confirme une prédiction au tour suivant.** Sur SP80, le candidat `bb4a99b5` permet de choisir une autre cellule admissible au même état. La révision de preuve `e8df1757` a exactement le même arbre moteur que ce candidat. Les deux jeux éprouvent des étapes complémentaires de la ligne 41. [Méthode opérateur](METHODE.md) · [Reçu](recu.json)

Au tour 1 de TICT, le ticket `public_occurrence_recall / cell_patch_composition / cell_patch_placement` clique en (31,28), cellule (1,1), avec un motif attendu nul. La comparaison indépendante des pixels par cellule montre le nouveau motif local dès la première image, puis le motif distant en (1,2) à partir de la troisième. Les deux motifs sont distincts et persistent jusqu’à la cinquième image. Le moteur lie le modèle au champ et aux références avant et après le ticket. Au tour 2, il utilise ces deux références pour rechercher un placement en (15,12), y prédit le motif local et reçoit `matched:true`. L’image jouée à T2 contient bien ce motif dans la cellule choisie.

| Présentation du retour de T1 | Acquisition et décision de T2 |
|---|---|
| Animation réelle, cinq images | Le modèle date les motifs par leurs deux indices d’image, 0 et 2. T2 joue (15,12) avec une prédiction confirmée par le jeu. |
| Deux pixels de la ligne d’état | Aucune cellule ne change. Le service n’acquiert aucun modèle et sonde à nouveau (31,28). |
| Image finale seule | Les deux motifs sont visibles. L’ordre reste indéterminé. Le service sonde (15,12) sans modèle, motif prédit ni recherche. |
| Cellule distante d’abord, cinq images et même image finale | Le service voit les mêmes deux motifs à la fin et n’acquiert aucun ordre local puis distant. Il sonde (15,12) avec les mêmes limites que dans le cas de l’image finale seule. |

Dans un cinquième départ, le moteur reçoit le vrai T1 puis un retour de T2 limité à la ligne d’état. Il marque la prédiction comme contredite, conserve la référence du contre-exemple et reprend (15,12) au tour 3 avec une sonde sans motif attendu.

Le vérificateur SP80 reproduit son reçu publié depuis les données opérateur. Les clics alternatifs (13,25) et (33,17) ne changent que les deux pixels (4,63) et (5,63). Aucun placement dans le champ n’y est confirmé. La substitution de sélection est démontrée sur la branche, l’acquisition et la consommation du modèle sur le gel dans TICT. [Bilan SP80](../sp80-lignes-4-41/BILAN.md)

| Mesure | Résultat |
|---|---|
| Contrôles TICT par SHA | 5 départs et 21 gestes, dont 16 gestes catalogue et 5 dans les variantes. |
| TICT catalogue | 16 tickets de la ligne 41, 9 confirmations, 7 retours indéterminés, aucune contradiction sur le parcours nominal. |
| SP80 catalogue | 5 tickets de la ligne 41, 5 retours indéterminés. |
| Couverture cumulée | 21 des 45 occurrences catalogue recapturées physiquement. Les 24 autres restent hors périmètre. |
| Tests de l’auteur sur jeu actif | 8 sur 8 applicables au gel et 12 sur 12 sur la révision de preuve, suites TICT et SP80 comprises. |

Le verdict a été vérifié environ 4 min 12 s après le début du lot opérateur, le 27 novembre 2026.

### Rejeu

Depuis ce dossier sous Node 24, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. `$reçusTICT` désigne un dossier de sortie neuf et `$reçusSP80` les reçus des commandes du bilan SP80.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','e8df1757272cae3da1669b3e7ddb2e7bf65e8e02')) {
  $prefixe = "$reçusTICT/$($sha.Substring(0,8))"
  node qualifier.mjs $sha nominal $jeu "$prefixe.nominal.json"
  node qualifier.mjs $sha variantes $jeu "$prefixe.variantes.json"
  node qualifier.mjs $sha auteur $jeu "$prefixe.auteur.txt"
}
node verifier.mjs $reçusTICT $reçusSP80
```
