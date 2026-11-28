# PIPE, ligne 60

Node 24, Pyodide local du Banc, objets Git `8ce7ee35` et `d0e7527c`. L1, pack natif, 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-pipe-60 | Out-Null
node experiments/sic-agenda-offres/pipe-60/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-pipe-60/recu.json
node --test tests/v6-radial-port-parity.test.ts tests/v6-radial-port-integration.test.ts
```

En checkout partiel, les tests lisent aussi `docs/migration/native-campaigns-v41/diagnostics`.

`operateur.mjs` accepte `nominal`, `stationnaire --tour 1`, `autre-port --tour 1`, `sans-methode --tour 2` et `pixel-exterieur --tour 14`. Chaque variante garde le paquet public exécuté et distingue le retour présenté de l'empreinte physique. Le service natif sélectionne, exécute et reçoit chaque commande. Le reçu expose les ports, le point de rotation, la règle revalidée et la garde de continuation du préfixe.
