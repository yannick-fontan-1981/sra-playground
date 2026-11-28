# THER · ligne 65

Node 24, Pyodide local du Banc, objets Git `8ce7ee35` et `d0e7527c`. Départ L1, pack natif, 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-ther-65 | Out-Null
node experiments/sic-agenda-offres/ther-65/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-ther-65/recu.json
node --test tests/v6-rooted-quota-parity.test.ts tests/v6-rooted-quota-mark-support.test.ts
```

En checkout partiel, ajouter `docs/migration/native-campaigns-v42` et le manifeste de la référence `786dcf5`.

L'opérateur offre `nominal`, `stationnaire` et `soeur-modifiee`. Les deux retours construits conservent la commande et l'empreinte du paquet réellement exécuté. La mesure des marques, les longueurs occupées et l'acquisition du geste sont scellées aux moments correspondants. `archive.mjs` travaille sur une observation publique V42 distincte, après 15 retours acquis. Il ajoute une seule unité de marque et ne transmet aucune commande au jeu.
