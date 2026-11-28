# Préparation de l’assemblage au seuil de 45 lignes SIC

Le point de départ est le moteur d’essai `09aeb9e14e40b6115269e47267b47ba8d71708fd`, qualifié sur 35 lignes. Le SHA suivant sera figé avec le premier ensemble doublement qualifié qui atteint 45. Le verdict portera sur cet arbre et sur une campagne unique des 107 jeux. [Archive des 35](sic-coexistence-09aeb9e1.md)

| Candidat | Fichiers moteur à examiner | Rejeux ciblés |
|---|---|---|
| 41, `e8df1757` | `v6-cell-placement.ts`, chemin identique au gel dans le parent | TICT avec animation complète, dernière image seule et retour hors champ. SP80 au même état avec l’autre cellule et retrait de l’offre. |
| 84 et 97, `484f3f0d` | `v6-sliding-cavity.ts`, chemin identique au gel dans le parent | Les deux réglages AS66 depuis N1. Retrait de l’accès statique de 84, horizon horlogé et reprise de 97. Rejouer aussi les sondes de 83 sur l’arbre commun. |
| 26 et 31, `14a185d9` | `v6-oriented-coupling.ts` et `v6-effect-access.ts`, chemins identiques au gel dans le parent | WA30 avec les limites 16 et 19, preuve distincte de la relation puis de la translation, substitution et retrait du contact donnant le même paquet. |
| 5, `0da75640` | Arbre moteur identique au gel | Exécution froide en N1, recherche de code à partir des opérateurs datés, seconde démonstration en N2 et finale seule. |
| 86, préparation | `v6-subset-diagnosis.ts` contient déjà une modification pour 87 | Rejouer le témoin N1/T2, ses substitutions et le passage de la navigation à la requête selon le corpus épinglé de 86. Rejouer les choix de partition 87 et les trois ordres de 98 en curiosité active sur ce même moteur. |

Le programme DICO part du blob du parent. Il incorpore les trois blocs propres à la navigation et vérifie qu’en les retirant il retrouve octet pour octet le fichier parent, avec `selectSubsetQuery`. Il vérifie aussi les blobs de partition et d’ouverture par rapport à leurs révisions qualifiées. Le premier essai local sur la révision de travail `7b5758b4` produit le blob combiné `48bc80861831deac3325312d1acfee1722849e57`. Le SHA scellé et les deux verdicts fixeront la contribution effective de 86.

```powershell
py -3.11 scripts/prepare-sic-dico-coexistence.py 09aeb9e1 7b5758b4 artifacts/dico-navigation-et-partition.ts
```

Ce fichier de sortie est une préparation locale. Le verdict de coexistence exigera les trois parcours sur un seul SHA moteur.
