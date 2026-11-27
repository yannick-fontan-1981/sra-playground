# Décisions du prototype

Base SIC `d0e7527c`. Table produite par `experiences.mjs` après les assertions.

| Expérience | Attendu | Obtenu | Égalité départagée par | Nœuds / feuilles actives |
| --- | --- | --- | --- | --- |
| Besoin de contraste | selectionner / comparaison | selectionner / comparaison | — | 3 / 1 |
| Seul le besoin devient accès | selectionner / acces | selectionner / acces | — | 3 / 1 |
| Retour diagonal absent | ouvrir_preuve / comparaison / retourDiagonalUnique | ouvrir_preuve / comparaison / retourDiagonalUnique | — | 4 / 1 |
| Même état sur le même arbre | suspendre / comparaison / retourDiagonalUnique | suspendre / comparaison / retourDiagonalUnique | — | 4 / 0 |
| Le témoin arrive, retour au parent | selectionner / comparaison | selectionner / comparaison | — | 4 / 1 |
| Le même relevé contredit le prérequis | selectionner / acces | selectionner / acces | — | 4 / 1 |
| Le prérequis est rétabli | selectionner / comparaison | selectionner / comparaison | — | 4 / 1 |
| Ordre des offres inversé | selectionner / comparaison | selectionner / comparaison | — | 3 / 1 |
| Besoin commun, assimilation | selectionner / comparaison | selectionner / comparaison | usage étayé dans le mode courant | 3 / 1 |
| Prérequis absent, assimilation | ouvrir_preuve / comparaison / retourDiagonalUnique | ouvrir_preuve / comparaison / retourDiagonalUnique | — | 4 / 1 |
| Besoin commun, exploration | selectionner / comparaison | selectionner / comparaison | usage étayé dans le mode courant | 3 / 1 |
| Prérequis absent, exploration | ouvrir_preuve / comparaison / retourDiagonalUnique | ouvrir_preuve / comparaison / retourDiagonalUnique | — | 4 / 1 |
| Besoin commun, solving | selectionner / acces | selectionner / acces | usage étayé dans le mode courant | 3 / 1 |
| Prérequis absent, solving | ouvrir_preuve / comparaison / retourDiagonalUnique | ouvrir_preuve / comparaison / retourDiagonalUnique | — | 4 / 1 |
| Égalité résiduelle | selectionner / acces | selectionner / acces | identifiant de branche croissant | 3 / 1 |
| Même égalité, ordre inversé | selectionner / acces | selectionner / acces | identifiant de branche croissant | 3 / 1 |
| Témoin de portée, avant refus | selectionner / comparaison | selectionner / comparaison | — | 4 / 1 |
| Refus limité à une entrée | selectionner / acces | selectionner / acces | identifiant de branche croissant | 4 / 1 |
| Arrêt du reste du groupe | selectionner / suite | selectionner / suite | — | 4 / 1 |
| Refus qui arrête le parcours | suspendre / explore_available_inputs/sic_compare_available_controls | suspendre / explore_available_inputs/sic_compare_available_controls | — | 4 / 0 |
| Offre antérieure au refus de parcours | selectionner / comparaison | selectionner / comparaison | — | 4 / 1 |

21 décisions conformes aux attentes.
