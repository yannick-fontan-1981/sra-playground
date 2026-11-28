# SELE · ligne 51, sélection et fronts mesurés

**Ligne 51 qualifiée sur le gel.** Sept préfixes et 59 tests sur `77df94e33aa8bae8ecc7f81c8b57e062943dffa6`, arbre du gel et 16 gestes nominaux concordants avec `8ce7ee35`. Critères `421e12dc`, auteur `22f992a1`, opérateur `12f289c1`. Premier essai à 00:48:40 le 28 novembre (UTC−3). [Contrôles](sic-sele-77df94e3/banc.json) · [Journaux](sic-sele-77df94e3/recus.zip)

- **Sélection.** Le retour de T1 relie le motif de commande au seul support intérieur modifié, en (30,24). Le retour stationnaire construit retire cette liaison et donne ACTION3 de frontière. En N2 au geste global 10, les décorations réciproques attribuent la sélection au nouveau support. Changer seulement le centre de l'ancien support à paquet officiel identique bloque cette attribution. Le service reteste (43,52).
- **Front acquis.** T4 ACTION5 donne 16 images et revient au même raster. Un segment [8,13] est attribué au support déjà lié. T5 utilise le lancement et le trajet mesurés pour choisir ACTION3. Donner seulement la dernière image du même vrai retour supprime le lancement et rend le clic de frontière (10,61).
- **Score et ordre.** Sous plafond 20, le geste 18 du N2 observe deux fronts dans la même réponse, [5,9] puis [12,15]. La dernière image seule conserve le score officiel de deux niveaux et le premier clic du N3. Les deux acquisitions de front disparaissent.

Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total pour le catalogue. Node 24 et Pyodide local. Depuis la version de preuve, `$b` désigne le Banc et `$out` un nouveau reçu. Le paquet détaillé reste en local sous `artifacts/qualification-sele-77df94e3`.

```powershell
node experiments/sic-agenda-offres/sele-51/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-linked-packet-reference.test.ts tests/v6-linked-packet-kernel.test.ts
py -3.11 "$b/scripts/check-sic-packet-panel-returns.py" SELE $out
```
