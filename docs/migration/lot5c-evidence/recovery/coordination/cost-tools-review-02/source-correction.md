# Correction textuelle de la couverture des acquisitions

Cette correction suit la contre-lecture de Contract et précède toute capture de coût 5C. Elle est rédigée pendant le calme de la fenêtre 6A. Aucun import, contrôle syntaxique, test, calcul d’empreinte, capture ou mesure n’est exécuté pour cette édition.

## Constat

Les validateurs de la revue 01 confondaient `request.sequence` avec le nombre de retours déjà acquis. Un préfixe connu reste ouvert pendant plusieurs commandes : les acquisitions sont alors reportées à son scellement. Contract a identifié dans la fixture publiée 5B STCK des requêtes `advance` de séquences 5, 6 et 7 dont `acquiredTransitions` vaut encore 4. Le compteur de commandes ne peut donc pas remplacer le compteur d’acquisitions.

## Correction dans les quatre lecteurs

Les fonctions de couverture de `finalize-owner-cost-contract.py`, `check-cost-static-inputs.py`, `consolidate-owner-costs.mjs` et `review-owner-costs.py` utilisent désormais :

- `point.sequence == request.sequence` pour l’identité du point public.
- `acquiredReturns == observations[i].acquiredTransitions` pour chaque requête.
- `acquiredReturns == final.acquiredTransitions` pour chaque inspection terminale.
- Des compteurs entiers non négatifs, monotones pour les acquisitions, avec `acquiredReturns <= sequence`.
- Tous les indices `sourceCallIndices == range(acquiredReturns)` et le sous-ensemble exact des appels source de frontière non nuls, recoupé aux faits attribués.

La fin des formes fixes continue d’exiger que tous les retours des commandes mesurées aient été acquis. Aucun fait, nœud, appel, échantillon ou temps n’est retiré pour accepter un préfixe encore ouvert à un point intermédiaire. Les fonctions statistiques restent en dehors de ce correctif.

## Statut des preuves

`cost-tools-review-01/review.json` et ses copies avant/après restent conservés comme preuves de la source antérieure. Leur réussite syntaxique ne qualifie pas cette nouvelle édition. Une nouvelle revue et un nouveau reçu syntaxique seront produits seulement après la libération explicite de la fenêtre 6A. Aucun résultat futur de capture ou de budget n’est affirmé.
