# SC25 · ligne 21 · transfert du motif avant ouverture

**Transfert causal vérifié au gel dans le terrain construit, entre deux poses de la même époque.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et la remise `88e8abe8389ba9e5809de6aa8e2f911053f14959` donnent les mêmes reçus. Quatre départs, 37 gestes et un test auteur par SHA.

- Le terrain issu des fixtures calcule positions, contacts et trames d’animation à partir des vrais tickets du service. Au T3, ACTION4 échoue à franchir le premier obstacle. L’invocation T5 produit les centres `(21,9)` puis `(25,9)` en coordonnées doublées. Le moteur rattache à ce reçu le motif `[0,3]`, le récepteur stable `[25,3,29,8]` et l’obstruction mesurée.
- Au T8, le corps est en `[7,5]` et la voie reste fermée. Tous les départs ont les mêmes images jusque-là. Le lien valide fait rejouer `[0,3]`. Retirer seulement le lien, ou lui attribuer un récepteur spatialement étranger, conserve l’invocation historique et les deux vecteurs mais fait essayer `[1,2]`. Les clics et les deux invocations sont réellement exécutés dans les terrains. Les bits s’effacent dans les deux cas.
- Seul `[0,3]` ouvre les six pixels de la rangée attendue. Ensuite ACTION4 est admise et le corps entre en `[9,5]`, avec deux pixels de son empreinte sur le support neuf et un retour `matched:true`. Masquer les seuls six pixels nouveaux dans le paquet présenté, avec le même motif physiquement exécuté et les bits effacés, suspend la marche et fait revenir à `toggle`.
- Le lien justifie donc le choix du motif avant ouverture. Le support rendu visible justifie le déplacement. Aucun niveau officiel n’est gagné dans ces terrains. Le [SC25 officiel](../sc25-ligne-21/BILAN.md) reste partiel au T51, en N1 sans déplacement d’accès du motif.

Présélection `a7040ffa`, critères d’auteur `17579803`. Premier essai à 01:10:41, verdict à 01:14:00 (UTC−3, 3 min 19 s). Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24. Le terrain charge la fixture Git.

```powershell
$out = Join-Path $env:TEMP ('sic-sc25-transfert-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', '88e8abe8389ba9e5809de6aa8e2f911053f14959'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  node qualifier.mjs $sha contrôles (Join-Path $out "$short.contrôles.json")
  node qualifier.mjs $sha auteur (Join-Path $out "$short.auteur.txt")
}
node verifier.mjs $out
```
