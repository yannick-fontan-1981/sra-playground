# COMB, ligne 46

Node 24 et Pyodide local du Banc. Depuis la branche, le harnais compare le catalogue `8ce7ee35` et le gel `d0e7527c`. Le jeu public part de L1 sous pack natif, 600 gestes par niveau, 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-comb-46 | Out-Null
node experiments/sic-agenda-offres/comb-46/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-comb-46/recu.json
node --test tests/v6-product-panel-parity.test.ts tests/v6-product-panel-integration.test.ts
```

`operateur.mjs` accepte `--variante nominal|catalogue-incomplet|stationnaire|multifactoriel|sans-arete|petite-reserve`. Pour les deux dernières, passer `--tour 3` et `--tour 7` respectivement. Un duplicata de catalogue avec les mêmes vocabulaires et une arête retirée sont fournis au seul producteur. Les retours stationnaire et multifactoriel sont construits après l'exécution du même ticket et le jeu s'arrête avant d'exécuter le prochain. Le harnais commun produit les empreintes des paquets et garde les entrées scellées distinctes des décisions.
