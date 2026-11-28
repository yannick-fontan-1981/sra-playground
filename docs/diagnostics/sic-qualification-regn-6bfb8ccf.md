# REGN · ligne 80 sur le gel et 6bfb8ccf

**La même fonction `closedReturnContrast` construit les deux plans consommés par le service.** Elle prend le graphe des transitions observées, l’épisode de retour, l’index courant et la capacité du préfixe. Elle vérifie le cycle, retrouve ses arêtes avec leurs témoins et interroge les questions ouvertes au dernier embranchement. Elle renvoie les arêtes d’accès et une question enrichie des preuves du cycle. `NativeCallerCoordinator.returnedBranchOffer` appelle `ObservedFrontier.propose`, qui consomme cette paire, puis la garde lie chaque ticket à l’observation attendue. [Plans et preuves scellés](sic-regn-6bfb8ccf/banc.json)

| Départ depuis N1 | Plan émis et réellement consommé | Retour physique |
|---|---|---|
| N1/T3 | Une arête, deux preuves du cycle, `ACTION3` puis la question `Q_ff0507d93b4cedfb1964` par `ACTION4` au T4 | T3 confirme la projection `f73347ff08ba2da9` et garde le préfixe ouvert. T4, effet inconnu, le clôt et termine N1. |
| N2/T8 | Deux arêtes, trois preuves, `ACTION3` aux T8 et T9, puis la question `Q_b9f0860a784151238c29` par `ACTION4` au T10 | Les deux accès confirment leur projection. T10 clôt le préfixe et termine N2. |

Chaque domaine interrogé au dernier embranchement contient une seule question. Le crédit de composition porte sur le réemploi de cette construction d’accès et de son suffixe dans deux trajets de longueurs différentes. Au même état du T3, retirer seulement le dernier retour ou seulement la question empêche cette offre. La frontière locale prend la main, émet `ACTION4`, observe un effet sans prédiction et reste en N1. Un nouveau contraste de retour est admis au T5. L’inversion de l’ordre du domaine singleton laisse la décision identique.

**Deux réglages distincts.** Sur le gel et sur `6bfb8ccf`, quatre paires de captures sont identiques, interventions incluses. Avec le budget global 16 ou une simple coupure du relevé à 16, le premier changement de famille est en N3/T16. Dans le premier cas, `observed_frontier/reach_open_input` clôt l’accès. Dans le second, `returned_branch_contrast` maintient son préfixe. Les deux émettent `ACTION4` et atteignent `aa7d9c16b3d8fb20`. La ligne 22 dispose de son propre protocole.

Les onze parcours du vérificateur couvrent l’historique `8ce7ee35`, le gel `d0e7527c` et la preuve `6bfb8ccf9df3aa8597e74f0fd3f30a5744c55b35` selon sa matrice. Les huit captures supplémentaires du banc couvrent le gel et la preuve. Leur arbre `src` est identique, `a1cbde2a`. Départ catalogue REGN N1, plafonds de 600 gestes par niveau, horloge de journal fixe, aucune graine fournie. Les cartes donnent les budgets et les limites de lecture exacts. Préenregistrement `37eb151c`, verdict opérateur `93d0af42`. [Reçus et cartes supplémentaires](sic-regn-6bfb8ccf/recus.zip)

Depuis le checkout de preuve, sous Node 24.22.3, avec le banc voisin préparé et Pyodide local :

```powershell
$d = 'experiments/sic-agenda-offres/regn-80'
$p = '../sic-comparison-bench/public/vendor/pyodide'
node "$d/verifier.mjs" --pyodide $p --recu qualification.json
node "$d/operateur.mjs" --moteur gel --fiche "$d/public/sans-retour.json" --pyodide $p --recu retrait.json
```

Pour reproduire la comparaison de plafonds, utiliser tour à tour les deux fichiers `*.fiche.json` de l’archive avec `--moteur gel` puis `--moteur candidat`. Les fichiers de travail sont sous `artifacts/qualification-regn-6bfb8ccf/` dans le banc.
