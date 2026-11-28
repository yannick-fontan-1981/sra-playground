# CATL, ligne 50

Depuis ce checkout avec Node 24, Pyodide local du Banc, et objets Git `8ce7ee35` et `d0e7527c`. Le jeu public part de L1 sous pack natif, 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-catl-50 | Out-Null
node experiments/sic-agenda-offres/catl-50/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-catl-50/recu.json
node --test tests/v6-labeled-sequence-parity.test.ts tests/v6-labeled-sequence-integration.test.ts tests/v6-labeled-composition-mechanics.test.ts tests/v6-labeled-composition-soundness.test.ts
```

Le test de parité composée requiert aussi le dossier suivi `docs/migration/native-campaigns-v44`. `operateur.mjs` accepte `nominal`, `stationnaire`, `sans-controles-retenus`, `sans-reutilisation` ou `--variante permute --tour 1 --echanges 0,1` et `--variante permute --tour 9 --echanges 0,2`. Les indices commencent à zéro. Chaque permutation envoie au service le paquet public construit puis s'arrête au nouveau ticket, avant de l'exécuter dans le jeu officiel. Un retour stationnaire construit est aussi isolé du vrai paquet exécuté.

Le reçu sépare le mot et les exemples mesurés, l'accord des prédicats, la garde du bouton puis le retour. Le test du cache stable conserve le bouton et refait les calculs d'exemples dans la même scène. La variante sans contrôles prive seulement la perception de ses enveloppes de boutons revalidables.
