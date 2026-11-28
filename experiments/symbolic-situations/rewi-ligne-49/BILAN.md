# REWI · verdict indépendant de la ligne 49

**La correspondance courante et la clôture par le retour officiel sont qualifiées sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `9b41b8ba322fceb2737a99dfa264a4d809055bad`. Les deux SHA concordent. Un ticket de la ligne 49 sur un dans le catalogue, avec gain officiel. Les six tickets d’information précédents sont attribués à leur propre famille. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/2acbcbf9/experiments/symbolic-situations/rewi-ligne-49/CONTRAT.md)

- L’énumération indépendante retrouve **une fenêtre exacte sur 1 749 positions** au T9. Le ticket lie (33,24) à cette fenêtre. Jouer le même point un tour plus tôt laisse l’image et le score inchangés. Le garde du ticket T9 refuse le raster antérieur.
- Une modification d’un pixel dans la fenêtre supprime la seule égalité. Recopier la référence ailleurs donne deux égalités tout en préservant les cadres. L’énumération et la mesure native concordent sur les deux variantes. Le garde refuse le ticket initial et le service replie sur ACTION3 au T9.
- Le vrai clic T9 fait passer le jeu en N2. Le service rattache le gain au ticket et scelle la question avec `matched:null`. T10 reprend sous la frontière et demande de relier l’hypothèse à la nouvelle époque.
- Le contrôle stationnaire joue le même ticket et garde l’empreinte du vrai paquet de frontière. L’observation servie reste en N1. Elle inscrit une tentative sans changement ni gain et bloque seulement sa clé courante.

Par SHA, **4 départs pilotés et 36 gestes**, dont 11 au nominal. Le même témoin physique du clic précoce est joué deux fois, une fois pour chacun des groupes, soit 16 gestes complémentaires. Quatre tests auteur passent sur chaque SHA. Verdict en **2 min 35 s** au premier rejeu indépendant.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','9b41b8ba322fceb2737a99dfa264a4d809055bad')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
