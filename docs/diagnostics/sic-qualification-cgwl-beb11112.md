# CGWL · ligne 37, déplacement, attache et reprise

**Ligne 37 qualifiée sur le gel.** Sept préfixes dans le vrai service avec `beb11112bc53afdb80d46b843f42d01474254126`, arbre du gel, critères `36d4c259`. Nominal historique `8ce7ee35` concordant. Rejeu indépendant de 23:54:11 à 23:57:20 le 27 novembre (UTC−3). Les 118 tests de liaison passent. [Journaux](sic-cgwl-beb11112/recus.zip) · [Contrôles](sic-cgwl-beb11112/banc.json)

- **T2–T3.** `ACTION2` est une exploration sans prédiction, après le corps mesuré à T1. Le vrai retour acquiert le déplacement [0,4] avec ses deux références. T3 utilise cette mesure et prédit le centre [20,24]. Retirer la mesure donne un nouvel essai `ACTION3`. Le retour stationnaire construit après T2 ne produit aucune mesure d’`ACTION2`.
- **T12–T13.** L’interaction de T12 observe une forme visible compatible avec la translation [−1,−6]. Le résultat est une hypothèse d’attache locale. Les parties occultées restent inconnues. T13 cite l’observation et l’objet pour `ACTION4`. Retirer seulement l’attache rend `ACTION5`, une question de liaison.
- **T14 et suite.** Le déplacement conjoint est mesuré, alors que la projection du T14 est contredite et scellée. T15 reprend avec le centre remesuré. Les reçus distinguent expérience, transport et accès.

Départ N1, ouverture native, graine implicite 0, 16 gestes par session et 600 par niveau. Le reçu détaillé reste sous `artifacts/qualification-cgwl-beb11112/qualification.json`. L’index conserve son empreinte et les faits mesurés.

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/cgwl-37'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-cgwl-binding.py" qualification.json
node --test tests/v6-observed-binding.test.ts tests/v6-observed-binding-reference.test.ts tests/v6-object-binding-common.test.ts
```
