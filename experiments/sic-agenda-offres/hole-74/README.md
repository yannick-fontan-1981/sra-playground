# HOLE · ligne 74

Node 24, Pyodide local du Banc, objets Git `8ce7ee35` et `d0e7527c`. Depuis L1, pack natif, 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-hole-74 | Out-Null
node experiments/sic-agenda-offres/hole-74/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-hole-74/recu.json
node --test tests/v6-topological-recolor-kernel.test.ts tests/v6-topological-recolor-reference.test.ts
```

L’opérateur accepte `nominal`, `poche-ouverte`, `stationnaire` et `exterieur`. L’ouverture relie une poche au complément extérieur par un seul pixel du bord. Elle est présentée avant T6 et conservée jusqu’à la première divergence. Les autres variantes présentent un retour construit après le même vrai clic T6 et gardent les empreintes du paquet réellement exécuté. Les offres sont saisies à la sortie de leur producteur, avant leur arbitrage par `RecolorPolicy`.
