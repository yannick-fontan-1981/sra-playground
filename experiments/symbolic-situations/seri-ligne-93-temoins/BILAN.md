# SERI · provenance des complétions de la reprise (93)

Le correctif `eb5611b3` qualifie sur branche la provenance des deux sorties. Comparaison indépendante au gel `d0e7527c`, **5 départs et 29 gestes natifs par SHA**, avec présélection `c1cd20bc`. Le seul fichier moteur qui diffère entre les deux arbres est `src/logos-engine/v6-visual-sequences.ts`. Premier essai au verdict opérateur en 6 min 03 s. Les 19 tests complémentaires du candidat passent également. Leur montage a dû réintégrer la fixture et ses sources Python historiques.

| Historique présenté au N2/T5 | Plan au gel | Plan corrigé | Gabarit au gel | Gabarit corrigé |
| --- | --- | --- | --- | --- |
| Nominal | 3, 4, 5 | 3, 4, 5 | 5, 3, 4, 5 | 5, 3, 4, 5 |
| Deux questions distinctes, journal finissant par 2, 3, 3 | 3, 3, 5 | 2, 3, 5 | 5, 3, 3, 5 | 5, 2, 3, 5 |
| Duplication à l’autre position, deux questions distinctes | 3, 4, 5 | 3, 4, 5 | 5, 3, 4, 5 | 5, 3, 4, 5 |
| Une seule question répétée et borne retirée de l’historique | Aucune continuation | Aucune continuation | 5 | 5 |

La révision initiale 5 du gabarit désigne la vue courante. La révision finale 5 des continuations désigne la frontière officielle. Dans les quatre départs, le clic admis `(46,54)` remplit la même rangée. Le départ sans continuation utilise directement la vue. T6 rétablit la reprise avec les références 4, 6 et 5, puis le retour réel confirme une nouvelle rangée. Le retour stationnaire au T1 déclenche le même ACTION1 de repli sur les deux SHA. Le parcours nominal garde ses neuf gestes, ses deux gains officiels et son arrêt au ticket suivant.

## Rejeu

Depuis ce dossier, avec Node 24, les objets Git vérifiés et une racine de jeu dotée des actifs et de Pyodide du Banc. Choisir un dossier de reçus vide. Utiliser les SHA complets de [recu.json](recu.json) et leurs huit premiers caractères pour les noms des reçus.

```powershell
node qualifier.mjs <SHA gel> nominal <racine jeu> <reçus>/d0e7527c.nominal.json
node qualifier.mjs <SHA gel> contrôles <racine jeu> <reçus>/d0e7527c.contrôles.json
node qualifier.mjs <SHA candidat> nominal <racine jeu> <reçus>/eb5611b3.nominal.json
node qualifier.mjs <SHA candidat> contrôles <racine jeu> <reçus>/eb5611b3.contrôles.json
node qualifier.mjs <SHA candidat> auteur <racine jeu> <reçus>/eb5611b3.auteur.txt
node verifier.mjs <reçus>
```

Pour le seul verdict indépendant, exécuter le vérificateur avec l’argument supplémentaire `operateur`. Le rejeu des tests complémentaires demande les sources Python historiques référencées par leur fixture.
