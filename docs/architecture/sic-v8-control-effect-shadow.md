# Première tranche SIC V8 en shadow

Cette tranche part de `main` au commit `dbf3c956` avec le moteur natif 0.68. Elle met en œuvre le besoin `know_control_effect` défini dans la [spécification SIC V8](https://github.com/yannick-fontan-1981/sra-playground/blob/b23381aaddc65e152be68315fdecf662f74f34d0/docs/architecture/v8-human-configurable-intelligence.md).

| Cadre prouvé | Méthode proposée |
|---|---|
| Clic sur une commande identifiée | Comparer l’état avant et après le clic |
| Commande directionnelle sur un sujet identifiable | Suivre le même sujet après la commande |
| Transformation après sélection établie | Suivre le sujet sélectionné pendant la transformation |
| Expériences exclues et observation passive démontrée | Chercher la preuve dans un retour ordinaire |

Une expérience exige une commande disponible, un sujet observable, un effet isolable, un risque borné et l’absence d’une autre expérience en attente. Une contre-indication établie exclut la branche. Une inconnue conserve la branche en attente et suspend le fallback. Deux méthodes prouvées sans règle de départage restent ambiguës. L’identité du besoin dépend de la session, du niveau, de la commande et du sujet. Une nouvelle révision dans la même portée produit une nouvelle évaluation.

Le panneau lit la dernière observation stabilisée et les retours V6 qui correspondent à la session, au niveau et à la séquence. Pour un clic exécuté, V6 transmet les références avant et après, le point adressé et un résumé du changement sur le masque de la région mesurée. SIC vérifie ces références avec le retour natif avant de l’afficher. Il distingue un changement de couleur à forme et position identiques, un changement de pixels sur la région et une frontière de niveau. Un retour sans changement visible laisse ouverts les effets différés ou masqués.

Le résultat de la garde V6 et le changement mesuré sont affichés séparément. Le reçu décrit une commande passée. La matrice conserve ses inconnues sur la commande suivante jusqu’à l’arrivée de preuves causales et d’identité adaptées.

## Comparaison des retours dans une session

Le panneau compare jusqu’aux 32 derniers clics de la session. Il groupe les régions selon leur forme à l’échelle mesurée, leur couleur initiale et le point du clic relatif à la région. Il affiche les niveaux, les observations répétées, les écarts et les changements dont le résultat reste indéterminé. Les retours aux frontières et les clics sans région identifiée sont comptés séparément. La comparaison décrit la région cliquée sur le plateau final. Les changements ailleurs, les effets transitoires et le rôle de la région restent hors de cette mesure.

Sur STCK, les trois premiers niveaux ont été résolus en 35 actions. Pour une région de 37 pixels et un clic au point relatif (4, 2), la région garde les mêmes pixels dans 8 retours avec la couleur initiale 8, 5 retours avec la couleur 9 et 3 retours avec la couleur 10. Pour une région de 40 pixels, de couleur initiale 10 et cliquée au point relatif (3, 2), le retour du niveau 1 montre une recoloration vers 9 à forme et position identiques. Trois retours du niveau 3 changent les pixels sans correspondance exacte de la région. Les conditions visibles de ce groupe ne suffisent donc pas à prédire la recoloration.

L’onglet **Perceptions** liste les retours avant/après, avec un filtre par niveau. L’onglet **Information** regroupe les retours comparables et affiche les résultats par niveau. Chaque résultat ouvre un retour correspondant dans Perceptions. La variation entre les niveaux 1 et 3 est affichée en tête de la comparaison STCK. Les onglets sont utilisables à la souris et au clavier avec les flèches, Début et Fin.

Pour les retours qui divergent, SIC compare l’état public avant le clic, les commandes disponibles, le nombre de régions de même signature et les couleurs dans les bandes de deux pixels autour de la boîte de la région, sans les coins. Une mesure distingue les résultats observés quand chaque retour possède le contexte et que les ensembles de valeurs sont disjoints entre résultats. Cette distinction décrit l’échantillon. Elle ne démontre pas de mécanisme causal. La mesure réutilise le plateau public et les régions que V6 possédait avant l’action.

Le replay STCK des trois premiers niveaux conserve les 35 actions. Dans le groupe de quatre clics sur la région de 40 pixels, le voisinage du niveau 1 contient les couleurs 0 et 9 au-dessus, et 0 et 3 à droite. Les trois retours du niveau 3 ont la couleur 4 au-dessus, et 3 et 4 à droite. Les ensembles en dessous et à gauche diffèrent aussi. Le nombre de régions similaires se recoupe entre les deux niveaux. L’état public et les commandes disponibles sont identiques pour les quatre clics. Les couleurs voisines fournissent des pistes à vérifier sur d’autres retours où ces indices varient séparément.

Les prochaines perspectives, **Stratégies**, **Objectifs** et **Plans d’actions**, pourront utiliser la même navigation quand leurs données en lecture seule seront disponibles.

## Recherche d’un contraste isolant les couleurs du dessus

Une paire doit appartenir au même groupe de forme, couleur initiale et point de clic relatif. L’état public, les commandes, le nombre de régions similaires et les palettes à gauche, à droite et en dessous doivent coïncider. La palette du dessus doit différer. Ce test compare des mesures résumées et laisse ouverts les autres facteurs visibles ou cachés.

Le moteur natif 0.68 a résolu les quatre premiers niveaux de STCK en 45 actions. Aucun appariement ne satisfait le filtre dans les 32 clics retenus. Quatre traces publiques de STCK (V39 à V42) fournissent 34 retours distincts après déduplication par niveau, observations publiques et commande. Sur 56 paires partageant la cible mesurée et le point relatif, aucune n’isole les couleurs du dessus. Leur valeur prédictive pour la recoloration reste indéterminée.

Perceptions montre le recadrage du plateau avant et après chaque clic. Informations affiche les mêmes vignettes pour les exemples qui soutiennent les résultats. Le cadre reste fixe autour de la région initiale et le repère indique le point cliqué. Une vignette est échantillonnée quand le cadre dépasse 20 pixels sur un côté. Une frontière de jeu donne seulement l’image avant.

L’avancement global est estimé à environ 12 % sur les 13 phases de la spécification, en leur donnant le même poids. Cette estimation correspond à environ une phase et demie de livrables, principalement la spécification et des parties de l’observation et de la résolution en shadow. Elle ne représente pas une validation des phases entières. Les onglets restants, le registre, l’agenda, les engagements et la boucle active sont encore à construire.

## Intervention visuelle et animation STCK

L’essai `python scripts/check-sic-stck-upper-neighborhood.py` utilise le ZIP livré au navigateur. Il rejoue les commandes publiques jusqu’aux deux états de départ et compare deux copies du même moteur pour chaque clic. Le rendu avant clic échange les palettes `[0, 9]` et `[4]` dans la bande du dessus. Seuls les 16 pixels de cette bande diffèrent. Le rendu normal est rétabli pour comparer les retours complets.

Au niveau 1, les deux copies recolorent de 10 vers 9 en gardant la forme et la position. Au niveau 3, les deux copies produisent le même changement sans conserver la région initiale. À état de jeu fixé, l’apparence de la bande du dessus ne change donc pas le résultat du clic. L’essai ne teste pas un changement de situation jouable et ne valide pas la palette du dessus comme prédicteur.

Le diagnostic interne du moteur, utilisé seulement dans l’essai, identifie un retrait à l’index 0 sur une pile de quatre cartes au niveau 1 et un retrait à l’index 4 sur une pile de cinq cartes au niveau 3. Le moteur affiche les cartes dans l’ordre de la pile. Au niveau 1, la carte suivante occupe la place libérée. Au niveau 3, le retrait de la carte du sommet laisse sa place vide. Le rang dans la pile constitue un meilleur candidat pour une future perception à vérifier sur les seules observations publiques.

Pour un clic, les vignettes montrent la cible et les trois plus grandes régions de pixels modifiés hors de sa boîte. Ces régions sont observées dans le même retour. Leur rôle et leur lien causal restent à établir. Pour Space, le panneau STCK présente les trois derniers retours de la session, avec jusqu’à 12 vignettes par retour, première et dernière images incluses. Informations compte les pixels modifiés sur toutes les images. Les mesures lisent les retours déjà produits par le moteur. La première animation observée dans le navigateur comporte 21 images, avec jusqu’à 391 pixels différents du plateau initial et 335 sur la dernière image.

Estimation après cette étape : environ 13 % de la V8 complète. Le progrès concerne l’observation et la vérification en shadow.

Le résumé natif est construit après la décision, hors de la mesure du temps actif. L’affichage est différé au prochain rendu du navigateur après la fin d’une opération. Les tests couvrent la matrice, la révision, la portée, le fallback, l’ambiguïté, les retours natifs et la parité du transport V6 jusqu’à un retour terminal.
