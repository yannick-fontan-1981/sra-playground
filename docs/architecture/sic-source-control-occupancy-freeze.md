# Protocole v20 · dispositions, arrivée et usage

Le candidat apprend sur les observations publiques. Dans la mémoire d’un épisode, il associe les orientations d’une pièce par sa forme et sa couleur. Une arrivée de P sur la position précédente de R lui permet d’imaginer plusieurs placements de R, la commande d’arrivée et l’usage qui suivrait. Une covariation fournit aussi une première expérience réfutable. Le candidat scelle le rôle, les positions, les destinations rivales et les références aux actions déjà observées. L’échec d’un placement interrompt la suite. Les dispositions et leurs effets restent des hypothèses jusqu’à leur exécution.

Le replay contrôle la provenance antérieure, le contenu de chaque prévision et les deux coordonnées. Pour une arrivée après préparation, il recommence depuis le même préfixe en supprimant la préparation puis en remplaçant son premier geste à durée égale. Une absence de sujet observable ne suffit pas pour compter un déplacement différent.

| Partie source de qualification | Placements exacts / annoncés | Arrivées exactes / annoncées | Arrivées après placement | Arrivées perdues en supprimant la préparation / en la remplaçant à durée égale | Actions suivantes exactes ayant un effet différent sans l’activation |
|---|---:|---:|---:|---:|---:|
| VOIS L1, 90 commandes | 6/8 | 39/39 | 6 | 6/6 | 12 |
| KLOT L1, 90 commandes | 0/4 | 4/8 | 0 | 0/0 | 0 |
| GRAV L3, 100 commandes | 19/35 | 1/27 | 0 | 0/0 | 0 |

Dans VOIS, 19 arrivées mènent à une position jamais observée auparavant pour ce sujet. Les vérifications de substitution portent sur la destination précise annoncée. Elles n’établissent pas que toute autre séquence échouerait à atteindre cette destination.

L’expérience distincte sur un troisième centre déplaçable a produit huit prévisions dans ESCT L1, sur 118 niveaux parcourus. Trois positions de l’indicateur, cinq déplacements du centre et deux configurations complètes se vérifient. Aucune nouvelle arrivée par la commande suivante n’est démontrée. Cette équation à trois rôles reste une étude hors du solveur.

## Comparaison enregistrée avant Custom 4

- Exporter le témoin `sic-projected-affordances-source100-control-v1` et le candidat `sic-projected-affordances-source100-candidate-v20` depuis leurs commits Git. Vérifier les deux références distantes et les fichiers exportés avant le premier essai.
- Lancer directement SS01, SS06, SS07 et SS08 au niveau 2 dans le moteur `f4d28aee`, avec le même budget de temps actif de la configuration quatre travailleurs et un plafond de 1 200 commandes. Vérifier l’image initiale de chaque paire, le verdict officiel et le nombre d’images distinctes à longueur de préfixe identique. SS09 L2 reste réservé.
- Distinguer victoire autonome, arrivée annoncée, nouvel emplacement du sujet et effet attribuable à la préparation. Un trajet dirigé sert au diagnostic. SS01 est un niveau déjà étudié. Les résultats des quatre niveaux ne constituent pas une validation indépendante sur un niveau encore inconnu.
- Évaluer les 100 niveaux sources et les 18 niveaux supérieurs avec la procédure source de référence afin de quantifier les régressions en résolution.
