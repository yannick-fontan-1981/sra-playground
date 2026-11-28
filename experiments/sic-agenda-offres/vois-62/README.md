# VOIS · ligne 62

Node 24, Pyodide local du Banc, objets Git `8ce7ee35` et `d0e7527c`. Départ L1, pack natif, 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-vois-62 | Out-Null
node experiments/sic-agenda-offres/vois-62/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-vois-62/recu.json
node --test tests/v6-reference-population-access.test.ts tests/v6-reference-population-observation.test.ts tests/v6-reference-population-integration.test.ts tests/v5-reference-population-calculus.test.ts
```

En checkout partiel, ajouter `docs/migration/lot3f-evidence/diagnostic` et le manifeste de la référence `786dcf5`.

L'opérateur offre `nominal`, `reference-retiree`, `reference-deplacee`, `stationnaire` et `reference-changee`. Les deux premières variations de motif sont présentées à l'initialisation. Le déplacement utilise uniquement la géométrie disponible avant la sélection. Le retrait est vérifié avec une seconde lecture autorisant le surplus à seule fin de mesure. Les deux interventions en cours de parcours conservent l'empreinte du paquet réellement exécuté. Chaque coupure scelle le domaine, l'occupation et les contrôles connus avant la proposition.
