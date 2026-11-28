# RECR · ligne 70

Node 24, Pyodide local du Banc, objets Git `8ce7ee35` et `d0e7527c`. Depuis L1, pack natif, 600 gestes par niveau et 16 au total.

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-recr-70 | Out-Null
node experiments/sic-agenda-offres/recr-70/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-recr-70/recu.json
node --test tests/v6-ordered-recruitment-reference.test.ts tests/v6-ordered-recruitment-kernel.test.ts
```

L’opérateur accepte `nominal`, `ordre-permute --tour 2` et `sans-ajout --tour 2`. Les deux variations conservent le paquet exécuté. La première permute les couleurs des deux sujets de même empreinte, conserve les salles, leurs liens et le multiensemble des types, et scelle le nouveau front. La seconde présente un retour stationnaire. La coupe contient les offres produites avant la politique locale et le reçu distingue les duels calculés du résultat officiel.
