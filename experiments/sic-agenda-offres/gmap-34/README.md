# GMAP, ligne 34

Node 24, Pyodide local du Banc et objets Git `d0e7527c` et `8ce7ee35`. Depuis ce checkout, rejouer L1 en mode natif, 600 gestes par niveau et plafond global 16 :

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-gmap-34 | Out-Null
node experiments/sic-agenda-offres/gmap-34/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-gmap-34/recu.json
node --test tests/v6-chart-navigation.test.ts tests/v6-chart-navigation-native-contract.test.ts tests/v6-chart-navigation-kernel.test.ts
```

Les tests requièrent le corpus et ses sources suivis sous `docs/migration/lot9a-evidence` et `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. `operateur.mjs` permet de lancer une seule variante `nominal|sans-repere|stationnaire|sans-localisation|sans-permission`. Le raster du jeu et les commandes disponibles parviennent au service sans intervention dans les ablations d'entrée de la famille. Le stationnaire présente un paquet de retour construit après l'exécution et termine à la première décision de reprise.

Les offres de `ChartNavigation.offers` sont enregistrées avant le DRM. Le reçu garde un identifiant, une empreinte de raster et les repères réduits, puis ouvre la décision et le retour dans des champs distincts. Le témoin public `reference-01` contrôle les repères en contradiction et l'inventaire vide sur une même scène.
