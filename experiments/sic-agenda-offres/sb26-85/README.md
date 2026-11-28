# SB26 · ligne 85

Node 24, Pyodide local du Banc, objets Git `8ce7ee35` et `d0e7527c`. Depuis L1, pack natif, 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-sb26-85 | Out-Null
node experiments/sic-agenda-offres/sb26-85/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-sb26-85/recu.json
node --test tests/v6-interface-families.test.ts tests/v6-native-interface-families.test.ts tests/v6-support-caller-integration.test.ts
```

L’opérateur accepte `nominal`, `ordre-reference`, `ordre-entrees` et `autre-contenu`. Les variantes conservent des empreintes du paquet public réel. Dans `ordre-reference`, le même échange des deux bordures de référence est présenté jusqu’au premier choix local. Dans `ordre-entrees`, seul le tableau des commandes candidates est inversé au T3. Dans `autre-contenu`, seule la couleur déposée dans le premier emplacement est remplacée après l’exécution.
