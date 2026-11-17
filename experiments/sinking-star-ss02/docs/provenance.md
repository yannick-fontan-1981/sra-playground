# Sources et différences explicites

Demande : un niveau 1 chargé en tutoriel, puis reprendre des niveaux de :
https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/

La route française n'était pas récupérable par l'outil web. Le contenu de la
même page a été consulté dans sa version portugaise, sans changer la numérotation :
https://sinkingstarwalkthrough.com/pt-br/heroes-of-hauling-solutions/

Grilles textuelles : `joric/ootss`, `scripts/ootss.pz`, blob Git
`3b8768a5152c34e0f572e7e66251dfadb4cb6d1d`. Les sept extraits exacts retenus sont
conservés dans `reference/hauling-grids.json`. Chaque niveau est testé contre la
conversion de son extrait. Les dimensions, murs, cases libres, pierres, boutons,
portes et destination ne changent pas par rapport à cette transcription.

| SS02 | Énigme du guide | Transcription | Traitement |
|---|---:|---|---|
| 1 | — | Création originale | Tutoriel : chaînes, eau, pont, boutons, porte |
| 2 | 3 | heroes1_3 | Guerrier conservé |
| 3 | 2 | heroes1_2_v2 | Guerrier conservé, poussée de files |
| 4 | 6 | heroes1_5_v2 | Voleur remplacé par Guerrier |
| 5 | 10 | heroes1_8_v2 | Magicien remplacé par Guerrier |
| 6 | 11 | heroes1_10_inv_v4_b | Magicien remplacé par Guerrier |
| 7 | 4 | heroes1_4 | Guerrier conservé |
| 8 | 8 | heroes1_6 | Voleur remplacé par Guerrier |

Les cartes aux rôles remplacés sont des adaptations assumées, pas les mêmes
énigmes sous une autre couleur. Leur difficulté et leurs solutions peuvent
changer. Ces changements sont indiqués dans la démonstration.

La transcription publique est un port PuzzleScript de la démo : elle ne certifie
pas une copie exacte de la version commerciale ni des captures du guide. En
particulier, le guide décrit quatre cristaux dans son énigme 4 tandis que la
grille `heroes1_4` en contient trois. SS02 conserve ici les trois pierres de la
transcription, et ne prétend pas avoir vérifié la capture originale case par case.

La carte 7 du guide (`heroes1_7_v2`) n'a pas été retenue : sa pierre initiale,
adaptée à la traction, ne peut pas être dégagée par une simple poussée sans
modifier la carte. Aucune modification géométrique silencieuse n'a été faite.

La poussée de files est attestée par les règles du port : propagation de mouvement
`Moveable` vers le `Moveable` suivant lorsque `Fighter` est actif. Le parcours
public de `heroes1_2_v2` dans `data/solutions.json` a été rejoué en ajoutant ACTION5
après les directions qui poussent : 39 commandes dans SS02. Les autres témoins
proviennent de la recherche de validation locale, pas d'une solution transmise au SRA.

Attribution : conception des énigmes d'origine — Order of the Sinking Star ;
transcriptions publiques — Joric ; sélection, adaptation ARC et tutoriel — projet
SRA Playground de Yannick Fontan. Aucun graphisme ou fichier audio original n'est
inclus. L'attribution n'est pas une revendication de propriété des énigmes sources.
