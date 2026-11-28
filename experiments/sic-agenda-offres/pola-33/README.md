# POLA, ligne 33

Le vérificateur joue le parcours officiel public depuis L1, avec le pack natif, 600 gestes par niveau, et 16 gestes au total. Il lance Node 24 avec le Pyodide local du Banc. Depuis le checkout expérimental, avec les objets Git `8ce7ee35` et `d0e7527c` présents :

```powershell
New-Item -ItemType Directory -Force artifacts/qualification-pola-33 | Out-Null
node experiments/sic-agenda-offres/pola-33/verifier.mjs --pyodide ../sic-comparison-bench/public/vendor/pyodide --recu artifacts/qualification-pola-33/recu.json
node --test tests/v6-axial-question-reference.test.ts tests/v6-axial-question-kernel.test.ts
```

Pour l'opérateur, le point d'entrée `operateur.mjs` prend `--variante nominal|sans-attestation|axe-perpendiculaire|stationnaire|sans-methode` et, pour le cas géométrique, `--pair 41,25`. Le quart de tour du bloc témoin est appliqué à la seule entrée de perception de la famille au T4. Le service et le jeu continuent avec le vrai paquet. La variante stationnaire présente une observation construite à même niveau après le quatrième ticket, et son reçu est identifié séparément du paquet exécuté.

Le relevé d'`AxialQuestion.offers` est pris avant le choix du DRM et scellé. Il contient les deux corps, le but, les commandes publiques et les attestations disponibles. `contraste.mjs` utilise le cas géométrique froid public indépendant `kernelCold`, sous la garde d'`AxialQuestion`, pour vérifier un sens observé opposé à l'a priori et le retrait de cette preuve. Le service garde la libération des tickets.
