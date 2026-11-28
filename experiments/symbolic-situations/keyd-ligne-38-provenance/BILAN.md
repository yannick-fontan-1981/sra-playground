# KEYD · ligne 38 · provenance du reçu d’accès

**Correctif qualifié sur la branche `51d983a7243289d2ebb2cef365dd536cbeaf59b1`.** Le parent caractérisé `f710f2e13f252ca0ec1b7de7e25768e13a5e5bf4` a l’arbre moteur du gel et reproduit le [défaut indépendant](../skbn-ligne-38/BILAN.md). Cinq départs et 62 gestes par SHA. Quatre tests d’auteur passent sur le correctif.

- Le vrai T8 atteste `local_access_return` sous la paire 8→9. Au T9 et au T10, le correctif conserve la sonde de capacité sous les références originales. Les 16 tickets et retours KEYD, et les 16 SKBN, sont identiques au parent en nominal.
- À vue T9 identique, substituer 8→6 ou 7→8 au seul reçu d’accès. Le parent conserve la sonde de capacité avec les références étrangères au T9 et au T10. Le correctif libère l’approche de rôle inconnu dans les deux cas, comme dans le témoin sans preuve. Le reçu authentique produit au T8 et les huit premiers gestes concordent toujours.
- Le repli passe le garde courant et refuse la référence d’observation périmée. Il joue réellement ACTION4 au T9 puis ACTION2 au T10. Les deux retours physiques concordent avec le nominal. Au T9, le corps atteint `[30,7,32,9]` avec `matched:true`. Les replis ne produisent aucun nouvel accès. Le T10 reste une approche, sans rétablir la sonde de capacité.
- SKBN reste un témoin de deux approches contredites. Le corps arrive aux T14 et T16, mais les 16 pixels étrangers font échouer la conservation et aucune preuve d’accès n’est acquise.

Présélection `f516e051`. Premier essai à 00:45:43, verdict à 00:49:49 (UTC−3, 4 min 06 s), première passe indépendante complète. Voir [reçu compact](recu.json).

Depuis ce dossier avec Node 24 et les actifs locaux du Banc.

```powershell
$jeu = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench'
$out = Join-Path $env:TEMP ('sic-keyd-provenance-' + [guid]::NewGuid())
New-Item -ItemType Directory $out | Out-Null
$versions = 'f710f2e13f252ca0ec1b7de7e25768e13a5e5bf4', '51d983a7243289d2ebb2cef365dd536cbeaf59b1'
foreach ($sha in $versions) {
  $short = $sha.Substring(0, 8)
  foreach ($group in 'catalogue','jeu-KEYD','preuve-KEYD') {
    node qualifier.mjs $sha $group $jeu (Join-Path $out "$short.$group.json")
  }
}
node qualifier.mjs $versions[1] auteur $jeu (Join-Path $out '51d983a7.auteur.txt')
node verifier.mjs $out
```
