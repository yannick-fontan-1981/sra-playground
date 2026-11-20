# SIC Fallback · Inventer une capacité par composition

## Ce que signifie « il doit être possible de faire cela »

L’inconnue X est un **effet à produire**. Le moteur peut par exemple annoncer « déplacer cette pièce de quatre pixels vers la droite tout en maintenant cette autre pièce fixe ». Il inscrit la prédiction, les rôles, l’effet témoin et le programme avant sa première commande. Les positions observées après chaque action permettent de réfuter une étape ou d’inscrire la capacité dans son répertoire pour une composition ultérieure.

Pour un changement de repère P et un contrôle élémentaire U, l’équation est P ∘ X = U ∘ P. Sa solution symbolique est X = P⁻¹ ∘ U ∘ P. Dans le jeu, cela revient à appliquer P, puis U, puis l’inverse supposé de P. L’égalité est exacte pour les opérateurs symboliques. Une forme qui change, un blocage ou une collision peuvent réfuter le modèle dans la partie. Le solveur vérifie le programme sur le jeu réel.

## VOIS · Commander l’autre pièce

Au départ de l’action 11, B se trouve en (14, 22) et A en (43, 23). SIC prévoit que trois commandes déplaceront B de quatre pixels vers la droite en maintenant A en (43, 23). À ce moment, il a vu un échange. Il en infère un inverse possible. La séquence complète n’était apparue ni dans sa propre partie ni dans la trace VOIS du corpus initial.

| Intervention depuis le même préfixe | Position finale de B | Position finale de A |
| --- | --- | --- |
| ACTION4 | (14, 22) | (47, 23) |
| ACTION5, ACTION5, ACTION4 | (14, 22) | (47, 23) |
| **ACTION5, ACTION4, ACTION5** | **(18, 22)** | **(43, 23)** |

À l’action 13, SIC a vérifié exactement l’effet annoncé. À l’action 14, il utilise la disposition pour faire arriver A en **(19, 23)**. Déclencher le même échange avant la préparation l’envoyait en **(15, 23)**. L’agent a ainsi testé une capacité nouvelle, puis une conséquence distincte de cette capacité.

Dans la session autonome de 90 actions sur VOIS, deux programmes de déplacement indépendant et onze compositions avec un déplacement local ont atteint leurs buts. Les **13 dispositions** sont distinctes. Douze ont donné lieu à un accès ultérieur prédit, effectivement tenté et vérifié. Les 13 résultats diffèrent de ceux de l’action témoin et de ceux des mêmes commandes réordonnées. [Schéma des interventions réelles](sic-capability-equations-witnesses.png)

## ZIPP · Atteindre une position malgré une commande bloquée

À l’action 53, SIC formule un autre effet possible. La pièce pourrait passer de (29, 25) à (29, 9), bien qu’ACTION1 seule l’ait laissée en place. Il prédit la composition ACTION5, ACTION1, ACTION4. Cette suite de trois commandes était absente de la trace ZIPP initiale et du préfixe précédant l’essai. À l’action 55, la pièce se trouve à l’endroit annoncé. Les mêmes commandes dans l’ordre ACTION5, ACTION4, ACTION1 la laissent en (29, 25). Les douze commandes unitaires examinées depuis le même préfixe n’ont pas produit l’arrivée. Elles comprennent les contrôles discrets disponibles et les six coordonnées de clic déjà observées. Les coordonnées de clic inédites n’ont pas été énumérées. Cette intervention vérifie le contournement du blocage mesuré. La nature physique de l’obstacle reste indéterminée.

## Épreuves sources

Le rejeu prospectif des 100 traces originales vérifie les empreintes des 2 904 actions, formule douze hypothèses pendant la lecture de ces préfixes, puis les éprouve en repartant du même départ. Trois sont confirmées, toutes dans VOIS. Ces replays guidés par les actions historiques et les sessions autonomes de qualification mesurent deux situations différentes.

| Sources jouées à un plafond de 90 actions | Hypothèses choisies | Capacités vérifiées en jeu | Effets différents du témoin à commandes réordonnées | Accès ultérieurs vérifiés |
| --- | ---: | ---: | ---: | ---: |
| VOIS | 15 | 13 | 13 | 12 |
| ZIPP | 4 | 1 | 1 | 0 |
| SIGN | 19 | 0 | 0 | 0 |
| SWCH | 5 | 0 | 0 | 0 |
| KEYD | 2 | 0 | 0 | 0 |
| SKBN et KLOT | 0 | 0 | 0 | 0 |

Dans la régression des 100 jeux à 60 actions, le candidat gagne **65 niveaux**, contre **66** pour le témoin. CGWL est le seul changement de victoire. Le témoin le gagnait en 15 actions. Les trajectoires divergent à l’action 14, quand l’essai d’un contournement prend la priorité. Le candidat échoue également dans un rejeu de CGWL à 120 actions. Six trajectoires sur les 100 ont changé.

Les 100 sessions autonomes totalisent 2 967 actions. SIC y formule 34 hypothèses, en vérifie neuf dans le budget et vérifie huit accès ultérieurs. Une dixième hypothèse, commencée à l’action 60 de VOIS, réussit dans le banc de rejeu une fois la suite terminée. Elle est exclue du compte des succès autonomes.

Le contrôle unitaire inclut tous les contrôles discrets et les coordonnées déjà utilisées dans le préfixe. Une perte d’identité visuelle reste enregistrée comme une issue indéterminée. Le contrôle de l’ordre des commandes est distinct de la simple vérification de leur nombre. [Protocole antérieur à l’essai Custom 4](sic-capability-equations-protocol.md)

## Transfert à SS01 L2

**SS01 L2 reste invaincu.** À 600 actions, le candidat couvre 149 images publiques distinctes, contre 97 pour le témoin. La première différence entre leurs commandes survient à l’action 327. Cette augmentation de couverture n’a débloqué aucun îlot vérifiable.

| Session en entrée directe | Actions réellement exécutées | Images distinctes | Nouvelles capacités proposées | Nouvelles capacités vérifiées | Fin de session |
| --- | ---: | ---: | ---: | ---: | --- |
| Témoin spatial, quatre travailleurs déclarés | 1 200 | 97 | s. o. | s. o. | Plafond d’actions |
| Candidat, quatre travailleurs déclarés | 825 | 166 | 11 | 0 | Budget de temps actif du niveau |
| Même candidat, huit travailleurs déclarés | 1 200 | 173 | 18 | 0 | Plafond d’actions |

La première session du candidat avait un plafond de 1 200 actions. Son budget natif de temps actif d’environ 514 secondes a été atteint à l’action 825. L’essai supplémentaire a utilisé le réglage natif de 720 secondes. **Les 825 premières commandes et empreintes publiques coïncident exactement.** Les 18 propositions du second essai incluent les onze premières. Il s’agit de 18 essais de contournement. Aucun n’a produit l’effet annoncé, y compris dans les rejeux où le banc termine le programme malgré l’échec d’une étape intermédiaire.

La famille de placement déjà présente dans le témoin a correctement prédit quatre arrivées aux actions 683, 942, 1 000 et 1 080. Elles utilisent toutes un déclenchement immédiat, aux deux mêmes destinations. L’audit des 336 translations de composantes identifiables sur la trajectoire complète n’a trouvé aucun passage entre deux régions distinctes dans les deux segmentations temporelles indépendantes. La dernière image nouvelle apparaît à l’action 1 191. L’agent explore donc encore, mais une nouvelle image ne constitue pas une preuve d’accès à un autre îlot. [Résultats et interventions appariées](sic-capability-equations-results.json)

## État du code

Les 40 tests ciblés et la vérification TypeScript passent. Une énumération algébrique supplémentaire vérifie l’équation et l’identité inverse sur 1 234 combinaisons synthétiques d’un à quatre rôles. Les succès dans les parties réelles sont comptés séparément.

La branche expérimentale `codex/sic-symbolic-access-source100` est publiée sur GitHub. Le candidat `7a27dc24` et le témoin `3253d5b1` ont été figés avant ce nouvel essai Custom 4. Les seuls changements apportés après le gel concernent l’évaluation et le compte rendu. SS01 avait déjà servi dans les expériences précédentes. SS09 L2 reste en réserve. Cette branche expérimentale n’a pas été intégrée dans `main` ni déployée sur le Site.
