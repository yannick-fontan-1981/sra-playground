# TRIA · ligne 79

**Qualification indépendante au gel.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `735b5e7d9fc3d3b426588e4d619187d925d269f0` ont le même moteur. Sur trois départs et 29 gestes par SHA, les reçus concordent. Deux tests d’auteur passent par SHA.

- Au T1, le sujet `[8,6]` est sélectionné pour rejoindre `[9,6]`. Le vrai T2 essaie l’actionneur et donne le premier passage officiel. En N2, le T3 sélectionne nominalement `[0,9]` en `(4,29)` pour atteindre `[12,9]`.
- La scène construite déplace uniquement ce masque de neuf pixels de `[0,9]` à `[12,9]`, sur une case de terrain de même phase. Les trois valeurs visibles restent 9. Le service reconnaît la relation déjà réalisée et sélectionne désormais `[14,2]` en `(46,8)`. Le clic puis la sonde `(3,57)` sont joués sur le vrai jeu, avec le déplacement de l’autre pièce maintenu dans la présentation. Le sujet `[14,2]` se déplace physiquement vers `[13,3]`. Les deux sujets d’appui gardent les positions présentées et le reçu de déplacement cite la sélection du bon sujet. La scène construite ne produit pas de nouveau niveau.
- Le vrai T9 nominal donne le même déplacement, `[-1,1]`. Servir à ce ticket un retour stationnaire construit conserve l’empreinte du paquet réellement exécuté, mais le service enregistre `no_arrangement_change` et aucune translation. Il choisit la sonde `(17,57)` au lieu de `(21,57)`. Le score reste 1 à cette coupure.
- Les 16 gestes nominaux relèvent de la famille. Les passages officiels des T2 et T13 restent distincts des retours locaux de sélection et de déplacement, qui portent `matched:null`. Les gardes aux T3 et T9 refusent la référence d’observation substituée.

Présélection `1a45d32a`, critères d’auteur `d04c7c6f`. Premier essai à 01:17:15, verdict à 01:20:31 (UTC−3, 3 min 16 s). Reprise du harnais après ajout de l’import de lecture. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-tria-79-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', '735b5e7d9fc3d3b426588e4d619187d925d269f0'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'nominal','contrôles') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
  node qualifier.mjs $sha auteur $jeu (Join-Path $out "$short.auteur.txt")
}
node verifier.mjs $out
```
