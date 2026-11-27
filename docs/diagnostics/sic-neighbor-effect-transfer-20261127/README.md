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

## Premier strict et préparation continue de la sélection

Le strict du candidat local `dad93b27` (GitHub `043615e5`) reste à 5/6. Les cinq premiers parcours ont exactement les mêmes empreintes que la capture de départ. Le L6 exécute maintenant 61 commandes sur 80, puis le watchdog s'arrête à 27 secondes, avant la fin du placement. Les 186 commandes sont autorisées par SIC ; le bilan tronqué ne permet pas d'affirmer le nombre final d'acquisitions ou de récupérations. Les fichiers `first-vois-strict-dad93b27.*.gz` conservent ce verdict sans le remplacer par une relance.

Une seconde perte de préparation est présente dans le préfixe public inchangé : à la commande 37, L3, le pion à sélectionner, son repère et les quatre déplacements sont déjà connus. La proposition expose un seul clic alors que la mémoire contient la route calculée du même pion. Le clic confirme réellement le repère ; le mouvement suivant ouvre pourtant une nouvelle décision. L'extrait est dans `selection-prefix-public.json.gz`.

Le second correctif conserve cette sélection connue et les déplacements mesurés du même pion dans un préfixe d'au plus 16 commandes, borné avant la sélection suivante. Une sélection non encore mesurée reste unitaire. Après le clic, un repère unique doit se trouver sur le pion attendu ; le garde contrôle ce repère, la population, la référence et la prochaine case. Une absence ou un doublon ferme le préfixe avant tout mouvement. Les changements de voisin continuent de clore la série pour acquérir leur effet avant de replanifier. L'acquisition rejoue les seuls gestes réellement exécutés, dans l'ordre, une fois à la clôture.

Les 21 tests ciblés passent, ainsi que TypeScript. Les deux variantes natives vérifient maintenant un clic et les mouvements suivants sous la même révision de décision, l'état inchangé avant la clôture, les indices de tous les retours et une réconciliation unique. Les contre-exemples ajoutés retirent le repère, en ajoutent un second ou contredisent le premier déplacement après le clic. Le second strict reste à exécuter ; aucune victoire complète n'est encore annoncée.

## Rejeu strict complet

La source locale `00f4f66080c092f3c2a02ba559bc77b082970843`, sauvegardée sur GitHub `3404e61b38d942ecb5f17aeb0c1b0ba06224da2e` (arbre `ae6aadf8f0cea06868ab97cac31abd2f24e2b4d2`), termine les six niveaux depuis L1 en une seule session SIC : **14, 18, 34, 23, 36, 71 commandes**, soit **196**. Les 196 commandes sont autorisées et acquises, sans reset ni undo. Les cinq premiers préfixes sont identiques au premier candidat ; les nouvelles séries regroupent les sélections confirmées et les déplacements connus.

Le L6 marque à **17,045 s** sous le plafond inchangé de **27 s**, avec 71 commandes sur 80 ; la réconciliation finale se termine à 19,478 s. Les bruts comprimés et leurs empreintes figurent dans le manifeste. Ce succès natif précède l’intégration combinée, le contrat de continuité, la publication et le rejeu par les boutons du viewer ; ces étapes restent nécessaires avant de qualifier VOIS de livré.
