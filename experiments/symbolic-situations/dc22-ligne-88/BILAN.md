# DC22 · verdict indépendant de la ligne 88

**L’acquisition du déplacement et la reprise sur support reconfiguré sont qualifiées sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `d713024aa7f9b45c8fbd114b86209d36c4efd6ba`. Par SHA, trois départs pilotés par le service et 27 gestes, un départ physique complémentaire et 10 gestes, deux tests auteur. Les deux SHA concordent. Le catalogue contient 15 tickets de la ligne parmi les 16 gestes. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/d75ed60b/experiments/symbolic-situations/dc22-ligne-88/CONTRAT.md)

- Au T2, ACTION2 part du porteur en (10,38) sur fond 2, sans déplacement prédit. Le vrai retour mesure (2,0) en coordonnées ligne-colonne et se lie aux deux observations. Un retour construit à plateau stationnaire n’acquiert aucun vecteur et le ticket suivant réessaie ACTION2 sans prédiction.
- Au T9, ACTION6 en (48,36) modifie huit pixels de 4 vers 9 et huit de 9 vers 4. Le service acquiert la reconfiguration et clôt la question de ce contexte. L’utilité reste encore ouverte. Les tickets T10 et T11 utilisent les supports visibles nouvellement mesurés. ACTION1 entre alors en (10,36).
- Le départ physique complémentaire suit les huit mêmes gestes, omet le clic T9 et retrouve le même porteur en (10,38), face à une surface [4,9,9,4] au lieu de [9,9,9,9]. La même ACTION1 n’y produit aucun changement de plateau. Le garde admet le ticket courant à sa propre surface et rend `support_binding_changed` sur la seconde.
- À même T9, retirer seulement l’offre de reconfiguration donne le repli `nested_control_experiment` en (24,20). Le vrai retour n’ouvre pas la surface. Il appartient à ce repli, puis le service rend `nested_control_effect_requires_composition`.

La mesure porte sur un accès intermédiaire. Le catalogue ne marque aucun niveau. Verdict en 3 min 43 s. Le premier essai opérateur s’est arrêté sur une variable de collecte masquée. Le rejeu corrigé a produit les reçus, puis le vérificateur a distingué les sept pas du plan T10 de ses deux premiers pas.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','d713024aa7f9b45c8fbd114b86209d36c4efd6ba')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
