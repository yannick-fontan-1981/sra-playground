# Origine et adaptations des niveaux SS03

Guide demandé : https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/

Transcription communautaire : https://github.com/joric/ootss/blob/main/scripts/ootss.pz
Blob Git source : `3b8768a5152c34e0f572e7e66251dfadb4cb6d1d`.

Témoins originaux : https://github.com/joric/ootss/blob/main/data/solutions.json ; blob `25d772c370f51d44632c2e2c4cf337e1b6ea9ab1`.

Les niveaux 1, 2 et 7 sont originaux. Les niveaux 3 et 6 conservent intégralement les cellules et objets de leur transcription PuzzleScript. Les niveaux 4 et 5 adaptent des salles coopératives pour un seul personnage. Le niveau 8 reprend la grille de Heroes and Light, énigme 2, selon le relevé décrit plus bas. Les adaptations ne sont pas présentées comme des reprises exactes des captures du jeu commercial. Le guide français fournit les correspondances et idées ; les cellules viennent du fichier PuzzleScript identifié ci-dessus.

## Correspondances

| SS03 | Titre | Énigme du guide | Transcription | Nature |
|---|---|---:|---|---|
| 1 | L’atelier du Voleur | — | — | Création originale |
| 2 | La presse latérale | — | — | Création originale, difficulté moyenne |
| 3 | Les deux entrepôts | 6 | `heroes1_5_v2` | Grille conservée |
| 4 | Le relais des deux terrasses | 14 | `heroes1_13_v2` | Adaptation solo |
| 5 | Les alcôves de la cathédrale | 15 | `heroes1_12_v2_alt` | Adaptation solo |
| 6 | Trois amarres | 8 | `heroes1_6` | Grille conservée |
| 7 | Les deux presses | — | — | Création originale |
| 8 | Le train des six caisses | Light 2 | `multipush_for_me2` | Grille et circuits reproduits |

## Règles et symboles

La règle du Voleur est celle du guide et de la transcription : une seule caisse adjacente suit automatiquement un déplacement qui s’en éloigne. Les transcriptions brutes de référence, le solveur et les témoins de résolution restent hors du fichier HTML jouable.

Conversion commune : `*` → `o` (caisse), `{` → `b` (bouton), `[` → `D` (porte), `G` → `g` (destination). La palette SRA remplace les couleurs et sprites d’origine. Les deux transcriptions conservées utilisent déjà `T` comme Voleur. Les niveaux 1, 3, 4, 5 et 6 gardent un circuit AND commun et le refus atomique d’une fermeture sur un acteur. Les niveaux 2, 7 et 8 utilisent des circuits indépendants et les portes qui poussent décrites dans `specification.md`. Les anciennes règles de destruction du fichier PuzzleScript ne servent pas de référence au nouveau moteur piston.

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

### Niveau 2 · La presse latérale — création originale

La salle de 11 × 9 cellules contient deux caisses, une presse orientée vers l’est, son bouton de commande et deux boutons alignés qui ouvrent la porte de sortie. Le pilier oblige à préparer les positions de traction avant de charger la presse. La case terminale ne peut pas être remplie par traction.

La recherche complète d’états trouve un parcours de 27 directions, huit tractions et deux poussées de presse. Sans piston, les 6 766 états atteignables sont épuisés sans solution ; sans traction, les 40 états atteignables le sont aussi. Les deux caisses sont conservées. La spécification et ces contrôles sont conservés dans `reference/level2-design.json`.

### Niveau 7 · Les deux presses — coordination supplémentaire

La v0.4.0 conserve la topologie, les trois caisses, les positions des portes et les deux niches de sortie. Une seule case de sol devient un bouton, en (10,5), ajouté au circuit de la presse nord. Ses deux boutons doivent être occupés simultanément.

Le témoin de 54 directions réutilise une caisse de la première file comme poids pour ce second bouton, puis active la presse nord avec le Voleur. Les observations atteignables d’une activation à un seul bouton et à deux boutons sont vérifiées dans `scripts/validate-levels.mjs`. `reference/level7-design.json` conserve la modification exacte, les témoins de contrôle et les limites des affirmations de difficulté.

## Vérification

Les témoins des niveaux 3, 6 et 8 viennent des solutions communautaires ci-dessus. Ceux des créations originales et des deux adaptations ont été trouvés par recherche, puis tous les témoins sont rejoués avec le moteur TypeScript final. Ils prouvent la solvabilité, sans garantie de longueur minimale. `validation/levels-report.json` publie les résultats, dimensions et empreintes des cartes et des témoins.

## Niveau 8 · Heroes and Light, énigme 2

- Guide demandé : https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-2
- Identifiant du niveau : `multipush_for_me2`, groupe `sideways_gates`.
- Capture originale : https://github.com/joric/ootss_tileset/blob/main/images/levels/multipush_for_me2.webp ; blob `7a563399ccef8a36cc0b52910a034080b2b87487`.
- Données de disposition : https://github.com/chenyuyang712/OSS-puzzlewiki/blob/main/data/levels_layout.json.gz
- Recoupement des circuits : https://gamewikistation.com/games/order-of-the-sinking-star/guides/sideways-gates/#six-crystal-train
- Solution : entrée `multipush_for_me2` de `joric/ootss/data/solutions.json`, 154 directions.

La géométrie est reconstruite à partir des cellules `TER_TILE` et des objets du niveau, puis comparée à l’image. Le dump compact coupe les entités au milieu de leur sérialisation : l’asset de l’instance i correspond à la position p de i+1. La conversion est `x = 11 − rawX`, `y = rawY − 4`, rangée de sortie incluse. `reference/light-piston-grid.json` conserve les indices de preuve et les coordonnées finales.

| Élément | Coordonnées avant centrage | Fonction |
|---|---|---|
| Voleur | (1,2) | Départ |
| Destination | (5,0) | Sortie |
| Caisses | (1,4), (0,2), (6,5), (7,1), (8,7), (1,8) | Six charges mobiles |
| Bouton A | (1,4) | Commande la porte centrale et la sortie |
| Bouton B | (6,5) | Commande le piston de droite |
| Porte bleue de la référence | (7,4), vers l’ouest | Fermée quand B est pressé |
| Porte jaune de la référence | (3,4), vers le nord | Fermée quand A est pressé |
| Porte verte de la référence | (6,0), vers le nord | Ouverte quand A est pressé |

L’orientation de la porte verte ouverte est récupérée dans le champ 17 du dump, absorbé par une erreur du parseur : l’entier `72057594038981117` contient les octets `fd 11 10 00 00 00 00 01`. Le champ 0x11 et son octet faible 01 correspondent au code nord, calibré sur la porte jaune ; la porte bleue a le code 3, ouest. Le détail du décodage et la limite des octets conservés sont notés dans le JSON. La pointe supérieure de l’armature visible corrobore ce sens. Le guide confirme les circuits ; il ne donne pas lui-même cette orientation de sortie.

La version ARC conserve la géométrie, les charges, les circuits, les directions et les polarités. Les portes et boutons utilisent le rose demandé pour la série avec un repère commun par circuit. Le fond non praticable utilise le mur gris foncé. Il s’agit d’une reproduction du plateau, pas d’une reprise graphique des sprites commerciaux.

Le parcours original se termine sans blocage, décès ni destruction de caisse. Les poussées ont lieu aux actions 60, 86, 112 et 146 ; la dernière déclenche deux phases successives, ouest puis nord. Ce contrôle valide les interactions actives de la salle ; la poussée de la porte de sortie n’est pas exercée par ce parcours.
