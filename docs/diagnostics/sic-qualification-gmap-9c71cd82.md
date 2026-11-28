# GMAP · ligne 34, accès appris et localisation ambiguë

**Ligne 34 qualifiée sur le gel.** Six préfixes natifs et un contraste public, avec `9c71cd820b59ef3456455b637a0a062abe1d03d0`, arbre du gel, critères `d9097a5b`. Le nominal historique `8ce7ee35` concorde. Rejeu indépendant de 23:51:03 à 23:53:55 le 27 novembre (UTC−3). Opérateur `5026d009`. Les 152 tests de carte passent. [Reçus](sic-gmap-9c71cd82/recus.zip) · [Contrôles](sic-gmap-9c71cd82/banc.json)

- **Accès de portée locale.** T1 observe une arrivée conditionnelle en [29,28], que T2 lit avant d’acquérir la valeur 10. T3 perd cette valeur et mesure le changement local. Le reçu permet d’essayer la liaison [29,28]→[35,28] au T4. Il porte une hypothèse de permission avec ses trois références. Enlever cette permission fait revenir `ACTION3` de frontière.
- **Localisation ambiguë.** Au T2, les deux localisations possibles produisent une abstention du fournisseur de navigation quand leurs routes ne donnent aucun pas commun. Le repli garde la même commande. Après le vrai retour stationnaire du T4, les deux localisations [29,28] et [35,28] admettent toutes deux `ACTION4` au T5. Le fournisseur conserve les deux routes et le jeu valide N1.
- **Contraste public.** Une observation contradictoire replace le repère sur son vrai point. À même scène et même localisation, retirer seulement la possession fait disparaître l’offre d’accès. Le retour du niveau suivant reste séparé de la mesure de l’ancien niveau.

Départ N1, graine implicite 0, mode natif, 16 gestes par session et 600 par niveau, Node 24 et Pyodide local.

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/gmap-34'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-gmap-navigation.py" qualification.json
node --test tests/v6-chart-navigation.test.ts tests/v6-chart-navigation-native-contract.test.ts tests/v6-chart-navigation-kernel.test.ts
```
