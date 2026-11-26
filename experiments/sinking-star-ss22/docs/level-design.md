# SS22 — progression et conception des huit salles

## Intention

**Les Cortèges Mécaniques** associe Marchand, Guerrier, Voleur et Barde. La progression part de gestes comparables, puis demande de prévoir ce qui doit suivre l’opérateur, ce qui doit rester en place et depuis quel poste le prochain mouvement sera possible.

Chaque salle possède exactement quatre héros et quatre buts. Les grilles font au plus 20×20 cases et sont centrées dans le terrain commun. Le rendu public est de 64×64 pixels, avec des cases de 3×3 pixels. La scène, les étapes d’animation et les commandes de sélection fournissent les observations utilisées par l’interface et le suivi pédagogique ; les solutions d’auteur n’entrent pas dans le jeu livré.

## Les capacités que le joueur compare

| Rôle | Ce qui suit son déplacement | Question à résoudre |
| --- | --- | --- |
| Marchand | Un occupant immédiatement devant lui | L’arrivée de cet occupant est-elle libre ? |
| Guerrier | La file contiguë entière | Où finit la file, et chaque occupant peut-il y arriver ? |
| Voleur | L’occupant immédiatement derrière lui | Comment quitter une livraison sans la reprendre ? |
| Barde | Les participants possibles dans son carré initial de portée | Quels objets ou partenaires vont suivre, et quelles butées vont en retenir d’autres ? |

Un héros transporté ne déclenche pas sa capacité. Cette distinction relie les courses de N2, le décrochage de N3, l’accès assisté de N5 et la relève de N8. Les appuis occupés par un héros restent ancrés : le joueur organise les passages à pied et déplace ensuite les appuis vides.

## Tutoriel : 33 découvertes

Le niveau 1, **L’école des cortèges**, est une salle complète : atelier de manutention, annexe avec miroir, extraction sous un auvent, bassin, presse et gardiens, puis salle commune. Son témoin contient 321 entrées et observe toutes les découvertes avant la sortie. La collecte est effectuée dans [src/tutorial.ts](../src/tutorial.ts) à partir des images publiques ; les découvertes ne constituent pas un péage de victoire.

| Ensemble | Découvertes suivies | Nombre |
| --- | --- | ---: |
| Commandes | Sélectionner un héros ; se déplacer | 2 |
| Manutention | Poussée du Marchand ; poussée du Guerrier ; file ; file mixte ; traction du Voleur ; traction d’un seul occupant ; poussée d’un partenaire ; traction d’un partenaire ; déplacement d’un miroir ; relève de poids ; retrait de la Barde par traction | 11 |
| Chant et observation des monstres | Immobilité des monstres hors d’un effet ; chant sur les charges ; partenaire entraîné ; sélection par une butée ; coin diagonal de portée ; chant à travers une cloison ; monstre déplacé au chant | 7 |
| Eau | Création d’un appui par immersion ; glissement d’un appui vide ; ancrage ; franchissement à pied | 4 |
| Reflets | Reflet ; reflet d’un héros ; reflet d’une caisse | 3 |
| Dispositifs et arrivée | Bouton ; circuit et porte ; poussée d’une presse ; monstre poussé par une presse ; rencontre de monstres ; quatre buts occupés | 6 |

Le tutoriel montre notamment le Guerrier poussant une file composée de deux caisses et du Voleur, puis une traction qui sépare un occupant de son voisin. Le Voleur et le Guerrier déplacent successivement la Barde sans faire repartir ses charges. L’annexe fait distinguer le glissement d’un appui vide, son ancrage sous un héros et le déplacement séparé de ce héros.

## Les huit salles

### 1. L’école des cortèges

**Références :** Heroes 3: Bard, Druid 12/14 et Low Heroes 11. **Plan :** atelier et annexe reliés par le dispositif optique. **Témoin :** 321 entrées.

Le plan introduit les quatre rôles dans des situations rapprochées, puis les réemploie lors de l’extraction et du retour vers les quatre buts. Deux commandes permanentes doivent rester alimentées pendant les derniers départs. Les exercices de comparaison enrichissent la découverte sans devenir une condition cachée.

### 2. La marche à deux temps

**Référence :** Low Heroes 11. **Plan :** atelier sec et galerie de fret séparée. **Témoin :** 185 entrées.

La Barde effectue une courte course qui avance la caisse. Revenir volontairement ferait revenir le chargement ; le Guerrier la replace donc sans chant. Le témoin répète ce cycle quatre fois, puis le Voleur extrait la réserve et le Marchand la livre sur la seconde commande.

La référence aquatique est transposée en mécanisme sec. Le rôle du Guerrier est démontré par le témoin ; le Voleur reste lui aussi capable de fournir un transport imposé. Le plan ne prétend pas imposer un unique partenaire pour tous les parcours possibles.

### 3. L’atelier du décrochage

**Référence :** Heroes, Doubled 5. **Plan :** deux voies de manutention et un pupitre séparé. **Témoin :** 106 entrées.

Le Guerrier engage deux caisses qui prennent ensuite des fonctions différentes. Le Voleur dépose le poids de sortie dans un couloir sans dégagement latéral. Une deuxième caisse, déplacée au chant à travers une cloison, ferme la presse qui le fait partir sans traction.

La [revue indépendante](../reference/independent-ss22-review.json) conserve une variante gagnante de 170 entrées sans impulsion de presse. Le Guerrier déplace alors le Voleur et sa caisse, puis restaure le poids depuis l’autre côté. Le décrochage forcé et le maintien de la livraison sont les problèmes de la salle ; la presse est une solution qualifiée, pas une obligation universelle.

### 4. La frontière du chant

**Référence :** Heroes, Doubled 8. **Plan :** deux galeries, une réserve et un passage final séparé. **Témoin :** 203 entrées.

La Barde se place à la limite de sa portée pour déplacer le gardien sans déplacer la caisse basse. Le poste inférieur risque au contraire d’immerger cette réserve dans une petite mare distincte du passage à construire. Après la rencontre des gardiens, le Voleur extrait la caisse selon deux axes, puis la livraison l’amène jusqu’au bon bassin.

Le témoin termine la construction par une file mixte poussée par le Guerrier. Une variante gagne sans cette poussée : la ressource sèche et son lieu d’immersion sont les contraintes documentées, pas l’usage exclusif du Guerrier à cet endroit.

### 5. Les entrées décalées

**Référence :** Heroes and Light 42. **Plan :** trois livraisons aux accès différents. **Témoin :** 198 entrées.

La tête de file est déposée en haut ; l’autre caisse doit changer d’axe avant de descendre ; la charge centrale demande de conserver un décalage de deux cases avec la Barde. L’accès haut ménage un départ autonome qui quitte la portée sans reprendre cette dernière charge.

L’accès bas demeure une possibilité coopérative : le Voleur peut tirer la Barde hors du poste sans chant. Cette variante de 216 entrées figure dans la revue centrale. La salle oppose donc deux modes de départ, autonome ou assisté, sans interdire artificiellement le second.

### 6. Le quartier des reprises

**Référence :** Heroes 3: Bard, Druid 18. **Plan :** rue de fret sinueuse et réseau de rues de commande. **Témoin :** 136 entrées.

La caisse traverse une rue entièrement inaccessible aux héros à pied. La Barde la reprend depuis le nord, l’est, puis l’ouest. Au dernier coude, le Marchand relâche une commande : la presse chasse la caisse vers l’est et les accès de la galerie basse s’ouvrent. La portée progressive du chant fait ensuite avancer la caisse et le gardien vers leurs deux commandes.

La revue vérifie la fermeture prématurée, le déchargement effectif et le départ qui conserve les poids. Elle contient aussi un parcours de 144 entrées où le gardien est préparé avant la dernière livraison de la caisse. La géométrie interdit de remplacer ces livraisons par la marche d’un héros sur les boutons de fret.

### 7. Les cales du bassin

**Référence :** Heroes and Water 33. **Plan :** deux colonnes d’eau, trois butées et deux débarcadères distincts. **Témoin :** 149 entrées.

Les trois voyageurs quittent d’abord le débarcadère supérieur. La Barde déplace ensuite les deux appuis vides : la première butée les décale, un changement de poste les met en file, puis les butées inférieures permettent de reformer une paire devant l’entrée finale.

Il y a vingt mouvements d’appuis dans le témoin, sans passager transporté. Essayer de déplacer le pont avant le débarquement est refusé. Après le calage final, remonter directement déplace de nouveau un appui ; la Barde rejoint donc le passage par un détour. Une variante de 141 entrées fait partir les voyageurs sur la rangée initiale, avant la première descente du pont.

### 8. La dernière traverse

**Références :** Low Heroes 19 et Heroes and Water 34. **Plan :** cour de préparation, réserve au nord, trajet d’eau coudé et cour finale. **Témoin :** 116 entrées.

Les trois appuis ne conservent pas la même fonction. La Barde en dépose un dans la branche de la réserve, où il complète la plateforme alimentée par le Marchand. Les deux autres contournent la cour et forment le passage final. Le Voleur rapporte alors la caisse sèche ; le Guerrier pousse cette caisse et le Marchand ensemble, remplaçant le poids vivant sans interrompre le circuit.

La dépose possède un effet contrôlé : la reprendre trop tôt laisse le Voleur bloqué devant une case d’eau. La plateforme reste également nécessaire à ce retour. Dans une autre branche testée, un Voleur sur l’appui peut être entraîné vers la plateforme, tandis que son appui reste ancré et que sa traction ne s’active pas.

Le témoin comporte trente mouvements d’appuis, huit tractions et une poussée mixte de relève. Un parcours alternatif de 162 entrées ramène la caisse avant la construction de la traverse finale. L’utilité de la dépose est conservée, et l’ordre global reste ouvert.

## Variété et qualification

La campagne alterne atelier, course courte, voies de déchargement, galeries sélectives, trois entrées, réseau de rues, bassin à butées et trajet coudé. Les nouveautés portent sur les positions relatives et sur la préparation des départs, au-delà du maintien de poids déjà utilisé dans la série.

Les huit témoins totalisent **1 414 entrées**, dont **173 sélections**, sans refus ni mort. Les revues d’introduction, centrales, finales et indépendante totalisent **69 contrôles**. Les images, les animations, les changements de salle et les annulations sont qualifiés séparément dans les rapports de `validation/`.

La comparaison de terrain avec SS14–SS21 couvre 64 salles et ne détecte aucun doublon exact, y compris après rotation ou réflexion. Elle ignore les acteurs et dispositifs pour comparer la silhouette du terrain ; elle ne suffit pas à mesurer toute ressemblance de raisonnement.

Les preuves sont volontairement circonscrites. Un exemple de poussée ne rend pas ce rôle obligatoire dans toutes les solutions. Un retour bloqué après retrait d’un appui établit une conséquence locale, pas une impasse irréparable. Les variantes légales sont conservées dans les rapports plutôt que supprimées par des règles supplémentaires.

## Fichiers de référence

- `reference/level1-design.json` à `reference/level8-design.json` : carte, parcours, étapes, métriques, crédit et adaptation.
- [reference/intro-ss22-review.json](../reference/intro-ss22-review.json) : les deux premières salles.
- [reference/middle-ss22-review.json](../reference/middle-ss22-review.json) : salles 3 à 5 et variantes.
- [reference/final-ss22-review.json](../reference/final-ss22-review.json) : 24 contrôles des salles 6 à 8.
- [reference/independent-ss22-review.json](../reference/independent-ss22-review.json) : rejeux indépendants, raccourcis examinés et comparaison des terrains.
- [docs/source-audit.md](source-audit.md) : URLs et différences avec les références.
