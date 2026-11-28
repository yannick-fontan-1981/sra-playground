# WEAV, ligne 43

Depuis ce checkout avec Node 24, le Pyodide local du Banc et les objets Git `8ce7ee35` et `d0e7527c`. Le jeu public part de L1 sous pack natif avec 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-weav-43 | Out-Null
node experiments/sic-agenda-offres/weav-43/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-weav-43/recu.json
node --test tests/v6-crossed-prefix-access.test.ts tests/v6-crossed-prefix-integration.test.ts
```

`operateur.mjs` accepte `--variante nominal`, `stationnaire --tour 1`, `stationnaire --tour 2`, `sans-progression --tour 3` et `sans-paire --tour 7`. Les réductions du retour stationnaire s'appliquent après que le moteur a délivré et exécuté le ticket. Au T3, l'ablation retire le pas acquis de ses trois projections, compteur, action et question de croisement. Au T7 elle retire la paire du seul appel de planification. Les deux ablations gardent la vraie vue et les commandes publiques, puis le service natif émet la décision.

Le harnais scelle les entrées observées avant `crossQuestion`. Il relève ensuite la décision du moteur et le reçu d'acquisition séparément. La mutation de la référence pour la contre-épreuve de garde se fait sur une copie. Aucun ticket expérimental n'est injecté.
