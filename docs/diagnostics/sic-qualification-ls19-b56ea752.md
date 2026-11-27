# LS19 · ligne 92, question de continuité

**Au T14 de LS19, le moteur teste une question de vue avec `view_continuity / test_local_input / ACTION3`. Au T15, il utilise à nouveau `ACTION3`, cette fois pour une question de `observed_frontier`.** Les deux reçus lient l’acquisition à la question et au besoin de leur propre ticket. Le gel et `b56ea7526d8b518296351ea6e6a58124ae82f3ce` ont le même arbre de production, `a1cbde2afc41532c7c047eb05c8637ef02b584d0`. La branche ajoute le harnais et ses preuves. [Captures du banc](sic-ls19-ligne-92/recus.zip) · [Contrat](https://github.com/yannick-fontan-1981/sra-playground/blob/76647ca8/experiments/sic-agenda-offres/continuite-92/ATTENDUS.md)

Depuis L1, le pack d’inventaire exécute 16 commandes avec un plafond de 600 par niveau. Quatorze observations publiques couvrent le départ jusqu’au retour T13. Le deuxième essai stationnaire conserve le blocage. Au choix T14, cinq références de vue justifient l’essai. La famille de vue examine l’obstruction et ne produit aucune offre. Le classement des trajets de bord n’est jamais appelé à ce tour. La recherche d’un trajet de frontière est aussi évitée puisque trois questions locales sont disponibles.

| Tour ou variation | Libération et acquisition observées |
|---|---|
| T14 nominal | Trois questions de priorité 3, ordonnées `ACTION3`, `ACTION4`, `ACTION1`. La garde accepte la première. Le retour `matched:null` acquiert la question `Q_779c7e6fe44602f2b143` et son besoin `1d553a7a…` au statut `observed`. |
| T15 nominal | Même commande, nouvelle famille et nouvelle question `Q_c84b2a436850df62152b`. Le retour acquiert le besoin `8648aa7e…`. |
| Question de vue retirée au T14 | La frontière ordinaire délivre immédiatement `ACTION3` avec la même trame de retour. La famille, les preuves de continuité et la finalité distinguent les deux sélections. |
| Retour au premier arrêt | Une seule immobilité est retenue. `view / confirm_access_obstruction` émet `ACTION2` avant tout appel à la continuité. `view_continuity` revient au geste suivant. |
| Deux manières d’obtenir `ACTION4` | Garder les trois offres et soumettre la seconde produit `Q_fb9d96daaaf3dddd5dd5`. Retirer `ACTION3` du domaine donne `Q_341c0772558c35c3ca3f`. Chaque acquisition cite sa propre question et son propre besoin. |
| Commandes ponctuelles seules | L’intersection est vide à ce tour. Le service s’arrête après 13 tickets avec `frontier_unknown_no_observed_view_access`. |
| Autre vue construite | Une translation (2,0) révèle 32 pixels. Le moteur teste `ACTION1` puis `ACTION2` à partir de la révélation. Les directions épuisées laissent le besoin ouvert, avec `frontier_exhausted`. |

Toutes les sept conditions sont appariées entre preuve et gel. Le départ nominal est aussi apparié à l’historique `8ce7ee35`, et trois conditions à la branche 91 `14db9cd8`. Le reçu d’une seconde exécution nominale directe du gel reproduit l’empreinte `521671c7fc2fc60e8969e3db27629c1a9bec971af196bf71ddca0c8dfdf33c68`. L’opérateur a éprouvé huit départs par SHA. Ses deux épuisements déclenchent une recherche de trajet sans résultat, alors que le compteur au T14 nominal vaut zéro. Il rejette les trois falsifications d’attribution par SHA. La qualification de la ligne 92 porte sur ce choix et sa suite depuis L1. [Qualification opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/8130cd57ce372639aaa38fffb7f44fda4e0c4622/experiments/symbolic-situations/ls19-ligne-92/BILAN.md)

## Reproduire

Depuis le checkout de preuve préparé, avec Node 24.22.3 et les sources d’inventaire accessibles par Git, utiliser un dossier de sortie neuf.

```powershell
$d = 'experiments/sic-agenda-offres/continuite-92'
$py = (Resolve-Path ../sic-comparison-bench/public/vendor/pyodide).Path
node "$d/verifier.mjs" --pyodide $py --recu ./qualification-92.json
node "$d/operateur.mjs" --moteur gel --condition nominal --pyodide $py --recu ./tickets-gel.json
```
