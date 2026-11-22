# SS01 L8 · Reconfigurer un mécanisme pendant qu’un autre sujet conserve son placement

## Oracle du trajet proposé

Les cellules sont numérotées à partir de zéro depuis le coin supérieur gauche. H, B, G et D sont les déplacements, X active le miroir, C sélectionne l’autre marchand en cliquant sur sa cellule. Chaque symbole compte pour une action.

| Coups | Commandes | Effet contrôlé dans le moteur |
|---|---|---|
| 1–9 | `B G B G G G G G G` | Amener la caisse en (6,7), au dernier emplacement sec sur cette ligne. |
| 10–21 | `D H D D D D D H H G B B` | Pousser le miroir de (12,5) à (12,7). Il reste possible de se placer sous lui. |
| 22 | `X` | La caisse part de (6,7) et crée du sol en (12,13). |
| 23–30 | `G B G G G G G X` | Le premier marchand prend la même origine et atterrit sur la plateforme. |
| 31 | `C` | Cliquer sur le marchand en (14,7), pixel (45,24). Le premier reste sur la plateforme. |
| 32–37 | `B G G H H H` | Le second remonte le miroir de trois cases, jusqu’en (12,4). |
| 38–39 | `G X` | Le second sort du rayon. Le premier est envoyé de (12,13) à la sortie isolée en (3,4). |
| 40–43 | `D D D D` | Le second atteint la sortie en (15,5). Les deux sorties sont occupées et le moteur crédite le niveau. |

Le premier échange utilise une portée de six cases, le second une portée de neuf. Une portée absolue maximale est inutile. Pour le vérifier, un second oracle décale le miroir d’une colonne vers la droite. Avec les réglages (13,7) et (13,4), les portées sont sept et dix et la partie est également gagnée. Sa séquence de comparaison est `BGBGGGGGGDHDDHDDHDBBXGBGGGGGGXCBGHHHGXDDD` (même clic sur le second marchand). Cette variante et l’oracle principal servent uniquement au diagnostic.

## Première divergence du témoin 201

La première décision est une offre de contact avec la sortie proche. SIC joue droite, arrive en (15,5) puis quitte cette sortie dès le coup 2. La première action reste réversible. Le planificateur de contact traite les marqueurs terminaux comme des occurrences uniques et écarte initialement la paire de sorties. Sa recherche d’un support de réception suppose aussi que ce support jouxte la région visée. Or la plateforme voulue est isolée et sert de départ à un **second** transport. La connaissance du clic vérifiée au L1 perdait en outre son lien avec les rôles visuels au changement de niveau.

Au coup 10, le témoin transporte la caisse en (10,5), puis annule ce transfert au coup 15. Au coup 92, il immerge l’unique caisse en (10,4). Il termine sans crédit au plafond de 120 actions et a vu 68 images distinctes. Le premier clic sur le second marchand arrive au coup 46.

## Déduction et exécution

Partir de la sortie isolée et inverser le transport sous un réglage futur du mécanisme donne des sites intermédiaires. Pour chaque site, chercher un réglage antérieur qui puisse y envoyer une charge puis un sujet. Tester ensuite les contraintes physiques, en particulier la case où se placer pour chaque poussée future. Un bord extrême peut être atteignable tout en supprimant le geste nécessaire pour en revenir.

Le sujet qui doit quitter le site intermédiaire peut y rester pendant qu’un autre réconfigure le mécanisme. Le clic est justifié par une observation antérieure du changement de marque et par le déplacement vérifié du nouveau sujet avec immobilité du premier. Chaque geste du plan vérifie la réponse publique attendue. Le dépôt, la sélection, le maintien du sujet et son transfert distant figurent dans le reçu. Dès qu’une réponse contredit le plan, sa suite est abandonnée. Les deux destinations sont une hypothèse à satisfaire ensemble, validée par le crédit du moteur.

Le pilote emploie les limites de recherche du pack et les opérations apprises. Le mécanisme, la couleur, les coordonnées et la suite de commandes sont absents du programme de décision. Un jeu de test distinct avec un échange horizontal, des commandes symboliques différentes et deux opérateurs vérifie la même composition.

## Qualification en campagne

Sur le site local 64925, le mode SIC démarré au L1 affiche « The game reports WIN. » au **445e coup**, avec huit niveaux crédités. Les crédits du L1 au L7 apparaissent aux coups 36, 68, 110, 189, 251, 367 et 404. La révision 203 gagne donc le L8 en **41 coups autonomes**, contre un échec en 120 pour la révision 201. Le banc et les deux oracles utilisent le moteur du jeu. Le pilote reçoit uniquement les images, les commandes disponibles et les retours publics.

Les 404 premières commandes du témoin et du candidat, leurs paramètres et les empreintes des images avant et après chaque action sont identiques. Le premier reçu du L8 cite la vérification du changement de contrôle au L1 et un transfert de la caisse observé au L7. Le candidat sélectionne le second marchand une seule fois, au coup 31. Au coup 38, il dégage le rayon par la droite, du côté de la sortie locale. Il lui reste ainsi deux pas après l’activation du coup 39. Le rejeu des 445 commandes, avec l’unique reset au L6, reproduit chaque image et le statut officiel WIN.

La portée qualifiée couvre une paire de sujets, deux occurrences d’une destination connue, un mécanisme reconfigurable et une charge dont le transfert et l’effet sur le terrain ont été observés. Le scénario à échange horizontal contrôle la réutilisation de la méthode sur une géométrie différente. La mesure de victoire concerne SS01 en campagne. Le départ direct au L8 et les 100 jeux sources restent hors de cette qualification.

## Reproduire

Avec Node 24, lancer `node docs/diagnostics/sic-plan-arbitration/ss01-l8-verifier-relais.mjs` depuis la racine du dépôt. Pour comparer deux campagnes, utiliser un fichier JSONL neuf pour chacune et le même moteur. Fixer `SIC_STUDY_SOLVER=sic`, `SIC_STUDY_WORKERS=1`, `SIC_STUDY_RECORD_COMMANDS=1`, puis exécuter `node scripts/compare-source100.mjs . . campagne.jsonl SS01 1 8 120`. Le vérificateur accepte en arguments les fichiers du témoin et du candidat, dans cet ordre.
