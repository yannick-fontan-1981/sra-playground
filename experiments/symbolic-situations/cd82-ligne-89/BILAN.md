# CD82 · ligne 89

**Qualification indépendante au gel, dans la portée des deux surfaces jouées.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `a6f7b0de19f013b132ff133b1084be86988b2dc1` ont le même moteur. Quatre départs, 49 gestes et deux tests par SHA donnent les mêmes reçus.

- En N1, ACTION1 au T1 réduit le catalogue des commandes possibles de 240 à 96 sans écrire de pixel. Le T9 choisit ACTION5 avec une affectation unique. Son retour officiel passe en N2 et la mémoire retient cette affectation. La progression acquise est distincte des mesures de pose.
- La nouvelle référence N2 demande le programme `[[6,15],[1,12]]`. Au T10, le modèle acquis donne ACTION5 avant toute écriture sur cette référence. Le vrai retour confirme 50 pixels modifiés dans la surface `[27,34,36,43]` et aucun dans le modèle fixe `[3,3,12,12]`. Au même ticket, changer un pixel du modèle, un pixel de la surface ou la référence d’observation suffit séparément à faire refuser la garde. Le parcours continue par `ACTION6(46,4)` et donne le deuxième passage officiel au T15.
- À vue T10 et programme identiques, retirer le modèle ou rendre son domaine de commandes étranger rouvre 240 possibilités. Le service joue ACTION1 au T10, puis ACTION2 après un retour sans écriture qui laisse 96 possibilités.
- Une hypothèse encore compatible après T1 mais écartée avant le gain N1 est réinjectée dans le bon domaine au T10. Elle propose ACTION4 comme écriture. Le vrai paquet laisse la surface intacte, réfute la projection, vide les modèles et le service passe à un autre propriétaire. Le contrôle porte sur une mémoire explicitement construite. La garde de rattachement de la surface ne certifie pas l’origine d’un modèle ainsi substitué.

Présélection `e63c9424`, critères auteur `ee9574b1`. Premier essai à 01:02:57, verdict à 01:05:21 (UTC−3, 2 min 24 s). Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-cd82-89-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', 'a6f7b0de19f013b132ff133b1084be86988b2dc1'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'nominal','contrôles') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
  node qualifier.mjs $sha auteur $jeu (Join-Path $out "$short.auteur.txt")
}
node verifier.mjs $out
```
