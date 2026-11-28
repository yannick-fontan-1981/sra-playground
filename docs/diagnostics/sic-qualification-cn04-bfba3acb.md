# CN04 · ligne 30, compatibilité, trajet et contact

**Ligne 30 qualifiée sur le gel.** Le scénario prolongé concorde sur `d0e7527c`, `bfba3acb8de4c3f13fc10651b2aa22490def5070` et `674b0dd1`. Le harnais partage le moteur du gel. Critères `4928e5d1`, opérateur `486b943c`. Rejeu du 27/11 23:57:35 au 28/11 00:00:13 (UTC−3). [Reçus](sic-cn04-bfba3acb/recus.zip) · [Contrôles](sic-cn04-bfba3acb/banc.json)

- **T1, puis T5–T8.** T1 calibre `ACTION1` et mesure [0,−1]. Au T5, le but conjoint est déjà compatible, alors que le calcul ne trouve aucun trajet. Trois `ACTION5` tournent la première pièce. Le trajet de T8 donne sept `ACTION2` et quatre `ACTION4`. Retirer le mouvement associé à `ACTION2` rend le but inaccessible. Le garde refuse aussi la vue antérieure utilisée avec le même plan.
- **T17–T19.** Le déplacement T17 est conforme mais sans contact. Dans les deux premières trames du vrai T18, les points [12,11] et [12,13] prennent la valeur 3 et l’accord est mesuré. La troisième trame montre N2. Le vrai gain ferme l’ancien niveau. T19 repart en calibrage avec quatre matériaux.
- **Couverture.** Le catalogue de 16 gestes compte 16/16 offres de la famille, aucun gain. Le scénario de 19 gestes vérifie séparément le contact et le passage après T18.

Départ N1, curiosité native, graine implicite 0, six niveaux visés et 600 gestes par niveau.

```powershell
$out = 'artifacts/rejouer-cn04-30'
foreach ($sha in 'd0e7527c','bfba3acb','674b0dd1') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha --game CN04 $out --game-root ../sic-main-delivery
}
node scripts/sic-recapture-strategy-inventory.mjs ../sic-main-delivery "$out/catalogue.json" --target-levels 6 --offer port_assembly '*' rigid_port_assembly CN04
py -3.11 scripts/check-sic-cn04-ports.py $out
```
