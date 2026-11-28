# RSWP, ligne 55

Depuis ce checkout avec Node 24, Pyodide local du Banc et objets Git `8ce7ee35` et `d0e7527c`. L1, pack natif, 600 gestes par niveau et 16 au global.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-rswp-55 | Out-Null
node experiments/sic-agenda-offres/rswp-55/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-rswp-55/recu.json
node --test tests/v6-panel-service.test.ts
```

L'opérateur accepte `nominal`, `stationnaire`, `sans-selection --tour 4`, `sans-effets --tour 8` et `sans-relation --tour 8 --panneau 0` ou `--tour 16 --panneau 0`. Le numéro de panneau commence à zéro. L'ablation de relation retire une pièce dans la zone de jeu, à l'entrée du seul producteur. Les pixels des panneaux et les deux autres zones restent les mêmes. Le retour stationnaire est construit après le vrai ticket et conservé à part.

Les réductions de paquets contiennent les géométries, motifs remesurés, matériaux, sélections et différences de pixels des zones et panneaux. Le service prend seul les décisions et émet les éventuels tickets.
