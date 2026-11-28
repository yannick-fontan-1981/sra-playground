# WEAV · ligne 43, première contribution et paire de croisement

**Ligne 43 qualifiée sur le gel.** Six préfixes natifs avec `fab19fba7cc5e5ac5cd79da53c81fb3ab23b492a`, arbre moteur du gel, critères `67012fdd`. Rejeu indépendant de 00:05:06 à 00:07:35 le 28 novembre (UTC−3), 137 tests de référence et d’intégration. Le nominal historique `8ce7ee35` concorde. [Journaux](sic-weav-fab19fba/recus.zip) · [Contrôles](sic-weav-fab19fba/banc.json)

- **T1 et T2.** Le clic (15,20) choisit le contrôleur et reste une hypothèse. T2 `ACTION1` change la cellule [0,0], acquiert l’entrée de l’axe 0 et prête son retour à la question de croisement. Un retour stationnaire construit au même T2 ne crée aucune contribution et bloque seulement l’essai dans ce contexte.
- **T5 puis T7.** À l’intersection, le vrai T5 acquiert la paire axe 0/ACTION1, axe 1/ACTION3, avec les deux références de l’observation. T7 cite ces références avant de reprendre le premier axe. À la même vue et au même préfixe T1–T6, retirer seulement la paire de l’appel d’offre fait reprendre par `information_goal`, clic (28,61).
- **Portée du refus.** La garde accepte le ticket lié. Sur les mêmes observations, une référence de croisement contraire est refusée même quand son empreinte descriptive correspond. Présenter cette référence au retour scelle la projection. Le refus vise le contexte de la paire. Dans les 16 gestes de catalogue, aucun niveau n’est marqué.

Départ N1, curiosité native, graine implicite 0, 16 gestes par session et 600 par niveau. Le reçu détaillé reste dans `artifacts/qualification-weav-fab19fba/qualification.json`. L’index conserve son empreinte.

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/weav-43'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-weav-crossing.py" qualification.json
node --test tests/v6-crossed-prefix-access.test.ts tests/v6-crossed-prefix-integration.test.ts
```
