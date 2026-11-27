# Dépendance de voisinage conservée après un score public

## Première décision en défaut

La capture publique de `fe822410` (même arbre que le `main` publié `c9779742`) part du L1 de VOIS, dans une session SIC avec les plafonds archivés. Elle gagne les cinq premiers niveaux en 14, 18, 34, 23 et 36 commandes, puis conserve les dix premiers retours L6. C'est une capture de diagnostic, sans qualification chronométrique.

À la commande globale 126, première du L6, le témoin de placement a bien l'époque et le score courants. Ses quatre déplacements et quatorze relations locales sont conservés. La mémoire du L5 porte également une preuve publique qu'un voisin stationnaire change d'apparence après le déplacement du pion sélectionné. Cette dernière preuve n'est pas copiée dans le témoin à la frontière. Aucun plan n'est proposé ; l'exploration réessaie les directions sans sélection et sans effet.

La lecture des contours retrouve plusieurs zones. L'arrangement compatible emploie neuf pions pour huit positions de référence et un support extérieur à la zone comparée. Il demande une relation de voisinage non encore mesurée (masque relatif 11). Les relations connues ne la contredisent pas, mais l'absence de la preuve de dépendance interdit d'en faire une expérience préparée.

Le diagnostic de composition réintroduit uniquement la référence publique réellement acquise, sans modifier les commandes, la grille ou les couleurs attendues. Le plan atteint alors cette expérience en 71 commandes ; il conserve `unknownMasks: [11]`. La zone incompatible n'obtient toujours aucun plan. Ce diagnostic ne vaut pas victoire.

## Rôle, réutilisation et réfutation

Le rôle acquis est une dépendance observable entre le déplacement d'un pion et l'apparence d'un voisin stationnaire. Le correctif transporte sa référence avec le témoin de placement, sous les conditions existantes d'époque, de score et de pas de grille compatibles. Les positions sont mesurées à nouveau. Il ne donne aucune apparence à un masque inconnu et ne transforme pas l'hypothèse en loi.

Le calcul de support refuse une relation connue contradictoire. Les retours des mouvements restent contrôlés ; un changement de voisin clôt le préfixe, acquiert le fait réel et provoque la réévaluation du support. Une sélection absente ou ambiguë interdit le déplacement aveugle. Une commande contredite perd son association, tout en conservant les autres déplacements et la preuve indépendante de dépendance.

## Vérifications du candidat

Seize tests ciblés et TypeScript passent. Les deux nouveaux parcours natifs acquièrent la dépendance avant le score du premier niveau, réutilisent la preuve dès la première sélection utile au niveau suivant, puis gagnent le second niveau. Ils changent la taille des cases, la forme de la référence, la palette, les positions et les commandes. Leurs tickets montrent des continuations réellement exécutées et une clôture native. Les contre-épreuves couvrent la preuve absente, la sélection absente ou ambiguë, le déplacement contredit et une apparence de voisin incompatible.

Le rejeu strict du candidat, la continuité complète, l'intégration et le viewer restent à effectuer. Aucun nouveau jeu complet n'est revendiqué à ce checkpoint. Le manifeste conserve les empreintes des captures et les budgets de leur source.
