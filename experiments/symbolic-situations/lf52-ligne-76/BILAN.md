# LF52 · ligne 76

**Qualification indépendante au gel sur appuis fixes.** Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le harnais `a2bd031cff2fb2ce7c919b2213f0ba5a8b75a36a` ont le même moteur. Cinq départs, 25 gestes et trois tests par SHA donnent les mêmes résultats.

- Les huit tickets de la ligne se répartissent en quatre sélections et quatre sauts. Aucun support mobile n’intervient. Le premier retour de sélection garde cinq pions. Le premier saut réduit de cinq à quatre et le suivant repart du pion arrivé en `[4,3]`. Les trois premières réductions sont confirmées localement. Le dernier saut reçoit le passage officiel avec `matched:null`. Les huit autres gestes du catalogue appartiennent à d’autres familles.
- L’appui `[4,3]` contient 16 pixels de valeur 1 avant la sélection. Le vrai retour en montre huit et le guide en occupe huit. Masquer les huit pixels restants dans la seule réponse publique garde le guide et le retour de sélection. En conservant l’appui fixe mémorisé, le service choisit le point `(30,19)` dans la même case. Le saut est joué et la vraie population passe à quatre.
- Au même raster masqué, retirer seulement l’appui `[4,3]` change le ticket en ACTION1 de frontière. Le repli ne gagne aucun niveau. Son retour remet l’appui visible et le nouveau ticket propose le saut. Retirer à la place l’appui témoin `[1,2]` conserve le clic `(30,19)` et le saut confirmé.
- Servir au vrai ticket de saut un stationnaire construit conserve les cinq pions et donne `matched:false`. Le plan se ferme et le service propose ACTION1. L’hypothèse éprouvée est la permanence d’un appui fixe sous occultation. Une disparition physique de cet appui et le transfert à un support mobile restent hors de cette preuve.

Présélection `ee04aeef`, critères auteur `df2f4813`. Premier essai à 01:24:21, verdict à 01:28:02 (UTC−3, 3 min 41 s). Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-lf52-76-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021', 'a2bd031cff2fb2ce7c919b2213f0ba5a8b75a36a'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'nominal','contrôles') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
  node qualifier.mjs $sha auteur $jeu (Join-Path $out "$short.auteur.txt")
}
node verifier.mjs $out
```
