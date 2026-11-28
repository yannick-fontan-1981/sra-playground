# CN04 · verdict indépendant de la ligne 30

**La compatibilité, le trajet et le contact sont qualifiés sur le gel dans deux horizons distincts.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `bfba3acb8de4c3f13fc10651b2aa22490def5070`. Quatre départs, **60 gestes et un test auteur par SHA**. Les 16 gestes du catalogue concordent et la prolongation est jouée jusqu’au premier geste de N2. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/b2dc9b57/experiments/symbolic-situations/cn04-ligne-30/CONTRAT.md)

- T1 calibre ACTION1 et le retour mesure le déplacement (0,−1). Les ports compatibles sont déjà identifiés au T5, alors que la recherche ne trouve aucun trajet depuis cette orientation. Les trois ACTION5 suivantes mesurent les orientations intermédiaires. À la troisième, présenter le plateau précédent conserve l’ancienne pose et fait réessayer la rotation.
- Le T8 donne un trajet de onze translations, sept ACTION2 puis quatre ACTION4. Retirer ACTION2 du domaine calculé laisse ce trajet indisponible. Le garde refuse aussi le ticket T8 sur l’ancienne pose. Sous plafond communiqué de 16, seuls neuf pas du trajet sont proposés et joués. Les poses correspondant aux neuf gestes sont identiques à la prolongation.
- Au T17 prolongé, le déplacement est confirmé mais les deux points de contact (12,11) et (12,13) portent encore 8. Au T18, les deux premières images du vrai paquet montrent les deux points en palette 3 et l’accord des ports. La dernière affiche N2. Le gain officiel vaut un, avec `matched:null` pour la comparaison de pose.
- Lorsque seule la finale est servie, le service enregistre le même gain officiel et émet le même T19 de calibrage en N2. La mesure externe de contact n’a plus de trame attestante. Les deux preuves ont donc une portée observable distincte.

Verdict en **2 min 19 s**. Premier rejeu physique réussi. Le vérificateur a été ajusté au plan tronqué par le vrai plafond du catalogue.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','bfba3acb8de4c3f13fc10651b2aa22490def5070')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
