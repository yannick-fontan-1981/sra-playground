# SPOR · qualification indépendante de la ligne 9

**La ligne 9 est qualifiée sur le gel.** `19ffd927` contient le même moteur que `d0e7527c` et produit les mêmes décisions et retours sur les cinq départs. [Critères scellés](CONTRAT.md) · [Reçu vérifié](recu.json)

À T1, le marqueur distingue un seul compartiment fermé parmi onze, dans la boîte (43,44)–(46,57). Le service y joue ACTION6(44,50) sous `contextual_compartments / contextual_compartment_question`. Le vrai retour change 134 pixels. Le reçu date l’essai et constate un effet local, avec la liste de récepteurs vide et `matched:null`. Le ticket T2 choisit un autre compartiment en (53,30) et porte cette preuve. Dans le second contexte en N2, le retour T9 lie le compartiment source (16,48)–(23,57) à un récepteur en (25,20)–(28,37). T10 reprend ce récepteur avec la référence de T9.

| Intervention | Résultat observable |
|---|---|
| Retirer seulement l’offre de T1 | La frontière joue ACTION5, puis la famille de compartiment reprend le clic (44,50). |
| Retour T1 stationnaire construit | Le même vrai clic est joué. Au retour servi, la tentative reste inscrite sans changement local, puis la frontière choisit ACTION5. |
| Une seule composante du retour T1 | Parmi six composantes, la règle scellée conserve celle de 57 pixels sur 134. Le reçu constate encore un changement local et date la tentative. Le ticket T2 revient pourtant à la frontière par ACTION5. Les pixels conservés suffisent à attester une variation locale dans ce départ et conduisent à un prochain choix différent. |

Le vérificateur rejette deux attributions altérées du reçu, l’une au ticket de repli, l’autre à la référence du retour suivant.

**Périmètre.** Cinq départs et **24 gestes par SHA**, dont les 16 du catalogue. SPOR couvre **15 des 17 occurrences** catalogue de la ligne 9. Le ticket T3 est l’unique témoin SPOR de la ligne 56. Sa mémoire d’exemples est vide et retirer l’acquis de compartiment T1 conserve son offre. Ce constat est transmis séparément à la qualification MEMO. Le verdict SPOR a été vérifié **1 min 48 s** après le premier essai indépendant.

### Rejeu

Sous Node 24, depuis ce dossier, `$pyodide` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','19ffd927b588257ce54cf1a35c166ce41ecebf5b')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $pyodide "$p.$g.json" $sélection
  }
}
node verifier.mjs $reçus
```
