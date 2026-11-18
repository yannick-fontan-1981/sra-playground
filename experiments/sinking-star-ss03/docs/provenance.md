# Origine et adaptations des niveaux SS03

Guide demandé : https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/

Transcription communautaire : https://github.com/joric/ootss/blob/main/scripts/ootss.pz
Blob Git source : `3b8768a5152c34e0f572e7e66251dfadb4cb6d1d`.

Témoins originaux : https://github.com/joric/ootss/blob/main/data/solutions.json ; blob `25d772c370f51d44632c2e2c4cf337e1b6ea9ab1`.

Le tutoriel est original. Les quatre grilles solo du Voleur conservent intégralement les cellules et objets de leur transcription PuzzleScript. Les trois autres cartes adaptent des salles coopératives pour un seul personnage. Les adaptations ne sont pas présentées comme des reprises exactes des captures du jeu commercial. Le guide français fournit les correspondances et idées ; les cellules viennent du fichier PuzzleScript identifié ci-dessus.

## Correspondances

| SS03 | Titre | Énigme du guide | Transcription | Nature |
|---|---|---:|---|---|
| 1 | L’atelier du Voleur | — | — | Création originale |
| 2 | Le pont à rebours | 5 | `heroes1_4.5` | Grille conservée |
| 3 | Les deux entrepôts | 6 | `heroes1_5_v2` | Grille conservée |
| 4 | Le relais des deux terrasses | 14 | `heroes1_13_v2` | Adaptation solo |
| 5 | Les alcôves de la cathédrale | 15 | `heroes1_12_v2_alt` | Adaptation solo |
| 6 | Trois amarres | 8 | `heroes1_6` | Grille conservée |
| 7 | Le triple verrou | 18 | `heroes1_18` | Adaptation solo |
| 8 | Le grand détour | 7 | `heroes1_7_v2` | Grille conservée |

## Règles et symboles

La règle du Voleur est celle du guide et de la transcription : une seule caisse adjacente suit automatiquement un déplacement qui s’en éloigne. Les transcriptions brutes de référence, le solveur et les témoins de résolution restent hors du fichier HTML jouable.

Conversion commune : `*` → `o` (caisse), `{` → `b` (bouton), `[` → `D` (porte), `G` → `g` (destination). La palette SRA remplace les couleurs et sprites d’origine. Les quatre niveaux conservés utilisent déjà `T` comme Voleur. Les portes de SS03 partagent un circuit AND pour tous les boutons de leur carte et refusent atomiquement une fermeture sur un acteur.

## Détail des adaptations

Coordonnées `(x, y)` à partir de zéro dans la carte source, avant centrage dans la grille 20 × 20. Le JSON de référence contient toutes les cellules modifiées.

### Niveau 4 · Énigme 14

Extraire une caisse de la pièce haute, en descendre une sur la plaque de la pièce basse puis rejoindre la sortie opposée.

- Un seul Voleur remplace le Guerrier de départ ; l’autre Voleur est retiré.
- Seule la cible supérieure reste active ; la cible inférieure devient du sol.
- Quatre cellules de mur sont ouvertes : (6,2), (6,3), (4,4), (4,5), pour les changements de côté nécessaires à la traction et pour ressortir de la chambre basse.
- La plaque (8,3) descend en (8,4). La plaque (8,5) est déplacée en (2,6) dans la chambre basse gauche ; cette pièce doit ainsi être utilisée.
- Les deux portes restent présentes et dépendent des deux plaques.

### Niveau 5 · Énigme 15

Sortir deux caisses de renfoncements opposés puis tenir deux plaques pour rejoindre la sortie latérale.

- Le Voleur initialement inactif en (4,4) devient l’unique personnage ; le Magicien est retiré.
- La cible inférieure (1,5) est retirée ; la cible supérieure (1,3) est conservée.
- Une cellule de contournement est ouverte à chaque alcôve : (6,2) et (6,7).
- La plaque (5,4) passe en (5,3) pour éviter une traction forcée lors de l’entrée dans la porte ; celle de (11,4) passe en (8,4), car la bordure empêchait d’y tirer une caisse.

### Niveau 7 · Énigme 18

Descendre trois caisses des chambres hautes puis organiser les trois plaques sans bloquer la remontée.

- Le Voleur sur la cible (5,1) devient l’unique personnage et sa cible est retirée ; la cible du Magicien (7,1) est également retirée.
- Le Magicien (7,1) et le Guerrier (6,2) deviennent deux caisses : trois charges mobiles pour les trois plaques.
- La porte gauche (2,4) devient un passage permanent afin de pouvoir extraire la caisse de la chambre gauche.
- Les quatre cellules (4,5), (8,5), (4,7), (8,7) sont ouvertes pour contourner une caisse laissée sur une plaque.
- La plaque droite se décale de (10,6) à (9,6), pour pouvoir monter vers la porte sans arracher automatiquement sa caisse. Les dispositifs violets de la transcription utilisent la palette rose de la série.

## Vérification

Les témoins des quatre niveaux conservés viennent des solutions communautaires ci-dessus. Ceux du tutoriel et des trois adaptations ont été trouvés par recherche, puis sont tous rejoués avec le moteur TypeScript final. Ils prouvent la solvabilité, sans garantie de longueur minimale. `validation/levels-report.json` publie les résultats, dimensions et empreintes des cartes et des témoins.
