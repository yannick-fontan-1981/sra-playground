# SC25 · ligne 21, portée du motif

**Qualification partielle sur gel.** Le harnais `6172e2d3579f36af9c0912578f6d58333a298343` et le gel `d0e7527c` ont le même arbre moteur. Les trois scénarios natifs donnent des reçus identiques. Critères `b36d09ed`, verdict opérateur `fb5a2091`. Premier essai à 00:07:45 le 28 novembre (UTC−3). [Contrôles](sic-sc25-6172e2d3/banc.json) · [Reçus](sic-sc25-6172e2d3/recus.zip)

- **Catalogue.** Les douze commandes du motif comprennent le calibrage immobile T2, les translations opposées de quatre pixels acquises aux T4/T7 et le changement de carte T8. Retirer la grille à observation identique réattribue le même ACTION1 au repli. Retirer la carte change le ticket T8. Le même clic (30,55) aux T9/T13 appartient à des plans différents.
- **Invocation.** Les 17 images de T15 conduisent à un reçu d'effacement de la grille, à la bonne référence, sans hypothèse de contact distant. T16 relève du placement de cellules. Avec un budget de 55 transmis, le jeu s'arrête effectivement après 51 gestes, sans gain. Du T16 au T51, le placement de cellules possède toutes les commandes.
- **Campagne historique.** Le reçu de référence atteste 6 niveaux et 153 commandes. Deux nouvelles captures depuis L1 en mode `sic` donnent 147 puis 142 décisions, toutes `sic_reproduce_cue`. Le plafond mural de N6 les arrête après respectivement 41 puis 36 des 47 gestes historiques de ce niveau. Le meilleur préfixe laisse six commandes historiques sans trace de décision. L'accès conditionné par le motif reste à démontrer.

### Rejouer

Depuis le checkout du Banc, sous Node 24, avec un checkout d'actifs du gel et Pyodide local. Créer une nouvelle sortie pour chaque essai. Le catalogue ouvre N1, graine implicite 0 et 600 gestes par niveau. Le harnais de contrôle parcourt le nominal jusqu'à T16.

```powershell
$m = '../sic-main-delivery'
$out = 'artifacts/sc25-rejeu'
foreach ($sha in 'd0e7527c','6172e2d3') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $out --game SC25 --game-root $m
}
node scripts/sic-recapture-strategy-inventory.mjs $m "$out/prolongation.json" --session-budget 55 --offer '*' '*' '*' SC25
$b = (Get-Location).Path
$h = New-Item -ItemType Directory "$out/historique"
$env:SIC_REPLAY_REFERENCES = Join-Path $b 'docs/architecture/sic-replay-reference-levels-20261126.json'
$env:SIC_DECISION_TRACE = Join-Path $h.FullName 'SC25-A.jsonl'
Push-Location $m
try { node (Join-Path $b 'scripts/check-sic-chronological.mjs') SC25 auto (Join-Path $h.FullName 'SC25.receipt') 1 sic }
finally { Pop-Location }
py -3.11 scripts/check-sic-sc25-motif.py $out --historical $h.FullName
```

Les deux traces historiques mesurées restent locales dans `artifacts/qualification-sc25-6172e2d3-historique*`.
