# KLOT · ligne 82 · attribution du récepteur

**Correctif qualifié sur `37983796259ab45f3366364896a72c55752e332d`.** Le parent caractérisé `03fba8c827c9a4725d1fda343695fe6e9fbb533d` reproduit le défaut du gel. Six départs, 48 gestes de service et 17 gestes auxiliaires par SHA. Quatre tests auteur passent sur le correctif.

- T7 ACTION1 attend la pièce 6. Le vrai jeu auxiliaire sélectionne et déplace seulement 11. T9 ACTION1 attend 12. L’autre retour auxiliaire sélectionne et déplace seulement 6. Tout le préfixe nominal est conservé jusqu’aux deux tickets éprouvés.
- Dans les deux cas, le parent écrit `observed_exclusive_receiver` sous le sujet attendu. Le correctif écrit `blocked_or_unselected_remains_conditional`. Dans les deux moteurs, les poses et les références du retour sont conservées, le modèle tombe à zéro, `matched:false` scelle le plan et aucun nouveau ticket n’est émis. Le premier écart est le rôle du reçu.
- Au T7, un contrôle sert le résultat de deux ACTION1 successives sur le bon sujet. Seule 6 passe de `[0,3]` à `[0,1]`. Le nombre de modèles tombe aussi à zéro. Les deux moteurs préservent le statut de déplacement exclusif, car son sujet est établi par les poses. La distance mesurée réfute la loi unitaire sans faire perdre l’observation physique.
- Les 16 gestes nominaux concordent, dont les vrais déplacements exclusifs de 11, 6 et 12, et le passage officiel au T12. La décoration seule et le stationnaire conservent leur portée.

Présélection `a7040ffa`, critères auteur `cb25f346`. Premier essai à 00:57:38, verdict à 01:05:21 (UTC−3, 7 min 43 s). Les contrôles étendent le [lot initial](../klot-ligne-82/BILAN.md) au T7, avec le même harnais et une session auxiliaire. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-klot-recepteur-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = '03fba8c827c9a4725d1fda343695fe6e9fbb533d', '37983796259ab45f3366364896a72c55752e332d'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'catalogue','retours') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
}
node qualifier.mjs $versions[1] auteur $jeu (Join-Path $out '37983796.auteur.txt')
node verifier.mjs $out
```
