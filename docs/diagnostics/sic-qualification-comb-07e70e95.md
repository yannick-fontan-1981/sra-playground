# COMB · ligne 46, arêtes mesurées et indépendance contredite

**Qualification partielle sur le gel.** Les sept préfixes natifs du harnais `07e70e95d36a9c9543927fda8dc1a9193a011fdd` reproduisent le catalogue historique. Critères `8eec03c6`, 370 tests de produit et d’intégration. Rejeu et contre-épreuves du 00:07:42 au 00:12:00 le 28 novembre (UTC−3). [Journaux](sic-comb-07e70e95/recus.zip) · [Comparaison](sic-comb-07e70e95/banc.json)

- **Arêtes mesurées.** T1 choisit expérimentalement (24,20) et le vrai retour acquiert le facteur 0, 4→9. T2 (38,20) acquiert le facteur 1, 4→8. T3 exploite les deux arêtes pour calculer une route. Retirer la seconde ramène une question de calibrage. Une des continuations nominales utilise un pas déjà observé au T9, dans une autre époque.
- **Contre-exemple à portée égale.** Le bras multifactoriel du harnais présente deux changements à partir du même vrai ticket T1. Le paquet physique est conservé et le retour présenté est construit. Le producteur inscrit `changed_factors:[0,1]` avec les références du retour et n’acquiert aucune arête par ce geste. À l’appel nominal T3, la même observation, la même géométrie, la même époque et les deux arêtes sont conservées. Ajouter ce contre-exemple mesuré et ses références laisse le plan calculé, ACTION6(24,20), la prédiction conditionnelle [4,8] et la garde admise. Le vrai paquet de T3 reste identique.
- **Contre-exemple acquis dans une seule session.** Continuer après ce retour présenté, puis restituer les retours physiques suivants. Le premier ticket conditionnel avec les deux arêtes et les contre-exemples est admis au T5. Ce bras et celui du T3 éprouvent un plan dont le prochain pas reste expérimental. Le nominal de 16 gestes fournit zéro contre-exemple multifactoriel naturel. La persistance d’un plan à plusieurs pas sur cette même portée reste hors de cette preuve.

Le planificateur continue à compiler une hypothèse d’effets indépendants alors que son état contient un contre-exemple au même contexte. Le ticket garde sa garde et sa projection conditionnelle. La ligne reste hors du compteur strict au Banc pour ce défaut de consommation. [Acquisition et proposition](../../src/logos-engine/v6-product-panel-access.ts)

Départ N1, ouverture native, graine implicite 0, 16 gestes de session et 600 par niveau. Les reçus détaillés restent dans `artifacts/qualification-comb-07e70e95/` et `artifacts/qualification-comb-07e70e95-contre-exemple/`. Pour refaire le contrôle, produire le premier reçu avec le vérificateur du harnais, puis utiliser Node 24 et le checkout du gel depuis le banc :

```powershell
py -3.11 scripts/test-sic-comb-counterexample.py ../sic-main-delivery artifacts/qualification-comb-07e70e95/qualification.json artifacts/rejouer-comb-contre-exemple
```
