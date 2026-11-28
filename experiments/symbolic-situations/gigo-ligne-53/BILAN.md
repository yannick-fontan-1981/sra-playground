# GIGO · verdict indépendant de la ligne 53

**La sélection et la mesure de la sonde imbriquée sont qualifiées sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `b2eef22648f3a511bed0783d938013bae8673a8a`. Six départs, **16 gestes et quatre tests auteur par SHA**, avec parité des décisions et des retours. Deux occurrences nominales sur les six cataloguées sont rejouées, une sur GIGO et une sur VALV. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/d1363d4e/experiments/symbolic-situations/gigo-ligne-53/CONTRAT.md)

- **GIGO N1/T1.** ACTION6 (26,20) est liée à l’unique cadre admissible, de cœur 4×4. Le garde refuse un autre point au même raster. Le vrai retour change 20 pixels dans le cadre, tous de 15 vers 0, et 400 en dehors. Le reçu lie ces mesures au ticket, avec `matched:null` et sans gain officiel. Le service s’arrête sur `nested_control_effect_requires_composition`.
- **Contre-épreuves GIGO.** Deux cadres d’aire minimale 36 écartent le fournisseur et donnent ACTION1 de frontière. Après le vrai clic nominal, présenter zéro changement consigne une tentative sans sélection ni impossibilité et livre le même repli de frontière. Présenter seulement les 20 pixels locaux ou seulement les 400 pixels distants donne le même arrêt de composition. Les deux observations filtrées conservent l’empreinte du vrai paquet. Elles éprouvent l’interprétation du retour par le service.
- **VALV N1/T1.** La même sonde et la même garde choisissent (32,50). Le vrai retour change 72 pixels, tous hors du cadre. Il fournit un contexte de remplissage à trois champs, avec les deux références du T1, reprises par le ticket de répétition T2 au même point. Onze gestes ont été joués. Les tickets T2, T5 et T11 et leurs retours vérifient l’enveloppe et la mesure communes avec les lignes 44, 47 et 48, dont les besoins et preuves aval restent propres.

Verdict obtenu en **2 min**. Le rejeu physique a réussi au premier lancement. Le vérificateur a été ajusté à la valeur `null` qui représente l’absence de ticket dans le reçu.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','b2eef22648f3a511bed0783d938013bae8673a8a')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
