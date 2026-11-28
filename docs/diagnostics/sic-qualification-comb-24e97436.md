# COMB · ligne 46, réfutation du produit et rejeu local

**Correctif qualifié sur `24e9743683b22b2256104d9f4de2c84abb1a1de3`.** Treize préfixes natifs et 370 tests passent. Les 16 commandes, décisions nominales et retours concordent avec le gel. Critères `81f2d53d`, bilan auteur `9826a266`. Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Premier essai à 00:44:18 le 28 novembre (UTC−3). [Contrôles](sic-comb-contre-exemple-24e97436/banc.json) · [Journaux](sic-comb-contre-exemple-24e97436/recus.zip)

- **Extrapolation réfutée.** Au T3 et au geste global 9 du N2, les deux moteurs reçoivent les mêmes vues, arêtes et contre-exemples de la même portée, reconstruits par le vrai enregistreur à partir de retours présentés construits. Le gel libère le produit aux clics (24,20) et (31,20). Le candidat refuse les deux produits et joue respectivement ACTION1 et le clic (45,20).
- **Rejeu local.** L'arête [4,4,11]→[4,8,11] de la commande (31,20) vient d'une exécution officielle séparée et entre comme hypothèse de mémoire au même T9. Le candidat propose le même clic qu'au nominal, pour un seul pas sans produit compilé. Le vrai paquet confirme le mouvement et le service scelle le pas. La contradiction au tuple exact et l'ancienne preuve conflictuelle sans tuple retirent cette arête du choix.
- **Autre époque.** La réfutation de N1 reste enregistrée avec sa portée. Dès N2, le service conserve le choix nominal du nouveau panneau.

Depuis le checkout candidat, sous Node 24. `$b` désigne le Banc et `$out` un nouveau reçu. La capture détaillée reste sous `artifacts/qualification-comb-contre-exemple-46-24e97436`.

```powershell
node experiments/sic-agenda-offres/comb-contre-exemple-46/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-product-panel-parity.test.ts tests/v6-product-panel-integration.test.ts
py -3.11 "$b/scripts/check-sic-series-corrections.py" COMB $out
```
