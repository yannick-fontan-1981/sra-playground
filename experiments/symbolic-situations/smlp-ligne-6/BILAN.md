# SMLP · qualification indépendante de la ligne 6

**La composition des arrivées est qualifiée sur le gel.** Les arbres moteur de `d0e7527c` et `1e11472a` sont identiques. Les quatre départs rejoués sur chacun donnent les mêmes tickets et retours. [Contrat scellé](CONTRAT.md) · [Reçu vérifié](recu.json)

| Étape | Observation et décision |
|---|---|
| **N1/T1, lancement** | La frontière libère ACTION5. Le paquet de 75 images permet de suivre les croix 9 et 12. Dans les deux cas, la dernière partie du trajet est inférée à partir de la disparition de la croix sur son segment d’approche. Une lecture des pixels retrouve les échantillons estimés 52 puis 68. L’unité de base observée est de quatre échantillons et 24 priorités restent compatibles. |
| **N1/T2, édition** | `configured_arrivals` utilise cette preuve pour essayer (32,26). Le retour modifie le motif local et 216 pixels au total. Le ticket T2 ne porte pas encore de preuve de coïncidence. |
| **N1/T3, usage de l’édition** | Avec le réseau modifié, les 24 priorités restantes prédisent `[17,17]`. La preuve lie les deux acteurs à une cohorte unique à l’intervalle 17. Le lancement ouvre N2. Le reçu officiel est séparé de la prédiction de coïncidence. |
| **N2, trois acteurs** | T4 acquiert les trois dates 84, 148 et 68, sur une base de quatre échantillons. Les 12 priorités retenues prédisent `[17,17,17]` après les éditions préparées à T5. Le lancement T7 ouvre N3. |
| **N3, discrimination** | La première comparaison laisse six priorités. La préparation T10 distingue les intervalles `[8,17,16]` et `[8,18,16]`. Le lancement T11 fournit des dates qui laissent trois priorités. T12 utilise ce nouvel acquis pour préparer la coïncidence à l’intervalle 18. Le lancement T15 ouvre N4. |

Servir seulement l’image finale au même ticket T1 laisse les arrivées indéterminées et n’acquiert aucun paquet de chronologie. Le service choisit (10,32) par la frontière, dont le vrai retour est stationnaire. À T10 en N3, retirer la preuve de priorité à état identique suspend la composition. La frontière essaie (10,18). Le retour stationnaire laisse la preuve originale disponible et le service reprend en (22,21) au T11.

La réserve remplace l’image d’indice 52 par sa devancière, avec 75 images et la même finale. Le dernier segment de la croix 9 reste visible un échantillon de plus. L’arrivée inférée passe de 52 à 53, celle de 12 reste à 68 et l’ordre est conservé. Le même ticket d’édition (32,26) est libéré. Le vérificateur rejette un reçu de chronologie attribué à l’image finale seule.

**Périmètre.** Quatre départs et 33 gestes par SHA, dont les 16 du catalogue. Les 13 occurrences de la ligne 6 sont couvertes. Les trois tests de l’auteur passent sur chaque révision avec le jeu actif. Le verdict a été vérifié **3 min 06 s** après le premier essai. Le vérificateur a été repris sur les reçus conservés pour dater la dernière visibilité sur le segment d’approche. Une croix réapparaît à son point de départ au reset et cette apparition ne date pas son arrivée.

### Rejeu

Sous Node 24, depuis ce dossier, `$jeu` désigne la racine du Banc contenant le jeu et Pyodide. Utiliser un dossier de sortie neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','1e11472a8acfe8d4287cf33e58fe3f629e532fb9')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json" $sélection
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
