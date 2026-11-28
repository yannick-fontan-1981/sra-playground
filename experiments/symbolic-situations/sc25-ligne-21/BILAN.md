# SC25 · ligne 21

**Qualification partielle au gel.** SC25 exerce le calibrage, la modification du motif et son invocation. La recherche indépendante ne trouve aucun ticket de déplacement vers l’accès produit par le motif. Les moteurs du gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et de la remise `6172e2d3579f36af9c0912578f6d58333a298343` ont le même arbre source et produisent des reçus identiques.

- Catalogue natif à 16 gestes. Douze tickets appartiennent à `motif_access / motif_conditioned_access`, aux T2–8 et T11–15. T2 modifie 8 pixels et laisse l’acteur immobile. Les retours de T4 et T7 mesurent les translations horizontales opposées de quatre pixels. Le T8 exploite ces mesures pour proposer un changement dans la grille.
- À image identique au T2, retirer la grille conserve ACTION1, effectivement jouée, sous le propriétaire d’exploration. Retirer seulement les cartes au T8 donne le sondage `(12,19)` à la place de `(30,50)`. Le nominal joue `(30,55)` au T9 sous placement de cellules et au T13 sous motif. Le propriétaire distingue les deux.
- Au T15, ACTION6`(30,60)` donne 17 images et 54 pixels modifiés. Le reçu de l’invocation remonte à la bonne observation et l’enregistreur reconnaît l’effacement de la grille, sans hypothèse de contact distant. Le retour stationnaire construit conserve le geste officiel joué et fait perdre l’acquisition d’effacement. Dans les deux bras, la commande suivante relève du placement de cellules. Elle ne démontre pas un accès du motif.
- Avec un budget de 55, le vrai parcours s’arrête au T51 sur `native_game_over`, toujours en N1 avec zéro niveau terminé. Du T16 au T51, les 36 gestes relèvent tous du placement de cellules. Le départ direct en N2 est refusé par le protocole natif. Deux contrôles construits du noyau différencient la première translation ACTION4 dans le cas de l’ouverture de l’accès et un geste de grille en présence d’un retour contraire. Ils ne fournissent pas un témoin positif sur SC25.

Par version, cinq départs admis et 92 gestes exécutés, un départ rejeté à l’admission, trois tests auteur et deux tests du noyau construit. Préenregistrement opérateur `3c314f46`, attentes auteur `b36d09ed`. Premier essai à 00:11:20, verdict à 00:19:50 (UTC−3, 8 min 30 s). La recherche prolongée a été reprise pour enregistrer le rejet exact de N2. Le vérificateur accepte aussi le format de sortie Node 24. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-sc25-21-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', '6172e2d3579f36af9c0912578f6d58333a298343'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'nominal','contrôles','recherche') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
  foreach ($group in 'auteur','noyau') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.txt")
  }
}
node verifier.mjs $out
```
