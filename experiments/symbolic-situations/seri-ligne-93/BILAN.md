# SERI · ligne 93

**Réemploi et reprise fonctionnels au gel. Provenance des deux témoins de continuation partielle dans le journal dupliqué.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `aa9c4cfe2c4ac65d5f1164c7748a8a2c1f677aec` donnent les mêmes résultats sur cinq départs et 26 gestes par SHA. Quatre tests d’auteur passent par SHA.

- Le catalogue joue neuf gestes, dont huit soumissions de la ligne 93. Six retours remplissent la carte attendue et préservent les autres. Les T4 et T8 font progresser officiellement le jeu. Les huit retours sont scellés avec `matched:null`. L’arrêt après T9 relève d’une autre composition.
- Au T5, l’offre de continuation cite les complétions des révisions 3 et 4 et la frontière officielle 5. Sans deux complétions distinctes, ou sans la frontière officielle, le même clic `(46,54)` est libéré par nouvelle analyse de la rangée. Les deux tickets sont joués et remplissent la même case. Le garde refuse de déplacer la référence d’observation ou de modifier le pixel du clic dans son option.
- En remplaçant la dernière complétion par une copie authentique de la précédente, le journal construit conserve deux questions distinctes au total. Le service réutilise la méthode et cite `[3,3,5]` dans son ticket. Deux références distinctes de complétion restent disponibles dans la mémoire, mais le reçu de continuation n’en cite qu’une deux fois. Le même clic produit le même résultat physique. Aucune duplication d’un reçu n’a été observée sur le parcours nominal.
- Au T1, servir une réponse stationnaire après le vrai clic conserve les autres cartes et laisse la case vide. Le reçu `answer_acceptance_unconfirmed` inscrit l’essai comme refusé. Le repli ACTION1 est joué sur un départ réel réinitialisé à cette vue. Le même clic redevient envisageable au T3 après une nouvelle vue et sous un nouvel identifiant d’essai. Aucun niveau n’est acquis dans cette variante.

Présélection `4715e103`, critères auteur `243c93c0`. Premier essai à 01:06:18, verdict à 01:11:15 (UTC−3, 4 min 57 s). Reprise après correction du chemin du test dans le montage. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-seri-93-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', 'aa9c4cfe2c4ac65d5f1164c7748a8a2c1f677aec'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'nominal','contrôles') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
  node qualifier.mjs $sha auteur $jeu (Join-Path $out "$short.auteur.txt")
}
node verifier.mjs $out
```
