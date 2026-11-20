# SS10 — Conception des huit niveaux

| Niveau | Titre | Actions du témoin | Rôle ludique |
|---|---|---:|---|
| 1 | L’atelier du contrepoids | 57 | Extraire les caisses, construire les appuis et préparer le miroir pour les deux héros. |
| 2 | Les deux réserves | 76 | Extraire les caisses avec le Voleur, puis les caler sur les deux boutons avec le Guerrier. |
| 3 | L’appui du prochain pont | 62 | Construire trois appuis dans le bon ordre et utiliser le premier pour aborder la caisse suivante du bon côté. |
| 4 | Le miroir désenclavé | 39 | Sortir le miroir de sa niche, refléter le monstre proche pour dégager la traversée, puis laisser le Guerrier verrouiller la porte ouverte. |
| 5 | Les deux diagonales du relais | 17 | Extraire un miroir par traction, régler la réception par poussée et laisser deux diagonales conduire les héros à deux îlots distincts. |
| 6 | Le dernier changement de sens | 93 | Construire deux appuis, provoquer un duel derrière une caisse, puis garer et replacer le miroir pour transformer la caisse de combat en clé du dernier reflet. |
| 7 | Le convoyeur à trois charges | 69 | Alimenter une presse à distance, faire avancer trois caisses jusqu’au bouton du pont, récupérer une caisse sans fermer le pont, puis reprendre la main avec le Guerrier. |
| 8 | Les cinq points d’appui | 90 | Traverser six secteurs en chicane. Le Voleur extrait les caisses retenues aux bords et le Guerrier construit cinq appuis vers l’est, le sud, l’ouest, le sud puis l’est. |

Les nombres incluent les sélections de héros ; ils ne constituent ni des records ni des preuves d’optimalité. Les étapes d’auteur sont stockées dans `reference/levelN-design.json` et ne sont pas chargées par le jeu.

## Tutoriel

Le premier niveau enseigne douze points, suivis depuis les pixels publics : marcher ; sélectionner ; pousser ; pousser une chaîne ; tirer ; séparer deux caisses ; lâcher par un pas latéral ; déplacer le miroir ; créer un appui ; activer le reflet ; commander une porte-presse ; occuper les deux destinations.

## Revue des éléments

La finale possède cinq caisses mobiles, cinq coupures d’une case et deux destinations après la dernière coupure. La validation ouvre toutes les coupures sauf une et ignore les obstacles mobiles. Pour chacune des cinq coupures testées, les deux héros restent séparés des deux destinations. Le témoin convertit les cinq caisses et atteint les deux cibles.

Chaque carte possède des poids, passages et ressources affectés à une étape du parcours. Les recherches de nécessité distinguent les files d’états épuisées et les limites de calcul. Un mécanisme présent dans un témoin n’est pas, à lui seul, prouvé indispensable. Les résultats détaillés sont dans `reference/*necessity.json` et les revues associées.
