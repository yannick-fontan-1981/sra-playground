# Prompt Codex — intégrer SS18 et publier SRA Playground

Intègre **SS18 — La Galerie Résonante (0.1.2)**, trio **Marchand / Magicien / Barde**, dans le SRA Playground natif, puis publie le Site SRA Playground existant.

Le dépôt canonique est `yannick-fontan-1981/sra-playground`. Pars du `main` distant courant, préserve ses évolutions concurrentes et lis ses instructions `AGENTS.md` ainsi que la politique de synchronisation GitHub/Site. Le laboratoire qualifié se trouve dans `experiments/sinking-star-ss18`. Lis son README et les documents `specification.md`, `level-design.md`, `source-audit.md`, `validation.md` et `roadmap.md`. `validation/delivery.json` et les rapports de validation identifient le HTML de référence et son empreinte SHA-256 ; reconstruis-le pour vérifier que tu pars de la version qualifiée.

Réutilise `src/core.ts`, les huit cartes de `src/levels.ts`, les crédits de `src/level-info.ts` et les découvertes de `src/tutorial.ts`. Inspecte le raccordement actuel des SS précédents, le catalogue, le dispatcher et Custom 4, puis adapte l’intégration à la structure réelle du dépôt. Les contenus de `reference/`, les témoins et le solveur sont des outils d’auteur et de qualification.

## Résultat attendu

1. Ajouter l’adaptateur natif, l’entrée de catalogue/Custom 4, la vignette, les éléments de galerie, le sélecteur et le lien direct selon les conventions actuelles. Conserver les huit salles dans l’ordre livré et le tutoriel de **27 découvertes au niveau 3**. Le **Marchand** est sélectionné à chaque départ de salle.
2. Raccorder **`TrioPuzzleSession`** avec trois héros distincts, trois destinations simultanées et les trois héros exposés aux pertes. Un héros sur une destination reste sélectionnable. La fin d’une salle ouvre la première salle encore inachevée ; `WIN` exige les huit salles réussies, y compris avec un ordre de visite choisi dans le sélecteur.
3. Conserver ACTION1–6, les observations publiques 64 × 64 à seize couleurs, toutes les images d’animation et leurs durées. ACTION6 reçoit des coordonnées pixel entières 0–63 et sélectionne sans faire avancer le monde. Une sélection réellement différente participe à Undo. Les commandes malformées, les coordonnées invalides et les campagnes invalides ne doivent pas muter une session existante.
4. **Marchand :** pousser une seule pièce devant lui, sans traction et sans poussée de file. **Magicien :** échanger sa place avec la première caisse, le premier monstre ou le premier partenaire atteint par la visée ; sans cible, tenter la marche. Les faces blanches dévient le rayon, les dos noirs le bloquent ; les appuis et les miroirs ne sont pas des cibles. Conserver les boucles de visée animées sans déplacement ni combat.
5. **Barde :** un pas volontaire entraîne les pièces éligibles du carré **5 × 5 avant le pas**, diagonales comprises, même derrière une cloison. Les butées peuvent retenir une partie du groupe ; si le Barde bloque, tout le pas est refusé. Les deux partenaires peuvent suivre. Les miroirs ne suivent jamais. Aucun déplacement forcé d’un héros ne déclenche sa capacité.
6. **Appuis mobiles :** une caisse dans l’eau sans soutien devient un appui. Une caisse déposée dessus reste mobile. Seul le chant déplace l’appui, d’eau en eau. Un héros présent au début du pas, ou l’arrivée prévue du Barde, l’ancre. Un miroir ou une caisse n’est pas un ancrage, mais retirer volontairement le soutien d’un miroir ou noyer un héros refuse le pas entier. Préserver la stabilisation hydraulique avant les arrivées forcées, la conversion d’une caisse après retrait d’une plateforme et la possibilité d’annuler une perte forcée.
7. Conserver les **reflets globaux** : priorité au plus proche, échange à distance égale, conflits atomiques et prévisions grises adaptées à la forme de l’occupant. Un reflet refusé par un obstacle ou un conflit fait clignoter deux fois les dos des miroirs concernés en rouge : **110 / 70 / 110 / 0 ms**, diagonales blanches intactes, autres miroirs inchangés et aucun Undo supplémentaire pour ce refus signalé. Préserver le mode de réduction des animations.
8. Garder les corrections visuelles : **bouton opaque gris, plus rose, pixel de circuit au centre** ; **presse pure avec centre noir fermé / gris ouvert**. Les presses des cartes ne sont pas des boutons. Aucun pixel bleu parasite ne traverse leur fond. La diagonale blanche et le dos noir d’un miroir passent au-dessus des marques de bouton. Préserver les portes à plusieurs boutons, les polarités, les presses latérales, les cascades et le combat orthogonal simultané.
9. Raccorder flèches, clic, boutons tactiles, **1 / 2 / 3 et Tab**, Espace/X, Annuler, Recommencer et Repartir. Respecter Maj+Tab pour quitter la grille, le blocage des commandes pendant l’animation, l’invalidation des callbacks après interruption et l’affichage des panneaux terminaux seulement après la dernière image. Sur mobile, garder les commandes proches du plateau.
10. Conserver les aides détaillées, les références principales et secondaires de chaque salle et les **27 découvertes déduites des pixels publics**. Les coches ne participent pas à la victoire. Ne transmettre à SRA ni état privé, ni route auteur, ni plan de réflexion, ni réponse du solveur. Aucun traitement spécifique ne doit résoudre SS18 à sa place.

## Préserver la variété et les corrections des cartes

Conserver l’ordre établi en 0.1.1, qui place **Les trois pièces du chœur au niveau 1** et **Le jardin des trois issues au niveau 3**, avec son tutoriel. Cette permutation doit aussi s’appliquer aux crédits, témoins, sélecteur et commandes de reprise. Repartir commence toujours au niveau 1 ; les découvertes ne sont suivies qu’au niveau 3.

Les huit problèmes sont distincts : tri de caisses sans dispositifs ; contrôleur à distance et sas ; jardin pédagogique ; départ croisé des trois héros ; arène de monstres/contrepoids ; miroir itinérant ; navette à alcôves ; réaffectation de ressources autour de destinations centrales. Conserver ces cartes, leurs silhouettes et la répartition des destinations.

Préserver les alternatives élaborées archivées dans les audits. En particulier, N4 possède une victoire sans échange et N7 une variante de 43 entrées ; elles restent valides. L’utilisation d’un pouvoir dans un témoin ne prouve pas que toutes les solutions doivent l’utiliser. Aucun compteur caché, ordre imposé par script ou découverte obligatoire ne doit remplacer les contraintes visibles.

Conserver le durcissement visible de **N8 en 0.1.2** : quatre boutons distincts du circuit `accord`, tous hors des trois buts ; une presse sur une destination, fermée au relâchement de cet accord ; exactement trois caisses mobiles et un miroir pour tenir ces quatre boutons ; un appui immergé initial indépendant pour le franchissement. Les boutons sont en `(13,5)`, `(3,15)`, `(9,14)` et `(15,11)` ; la presse du but `(10,11)` pousse vers le nord au relâchement ; l’appui initial est en `(7,13)`. Le miroir doit pouvoir changer de rôle après son usage optique. Préserver aussi l’extraction de la réserve nord-est, le retour hydraulique, les deux libérations du Barde sans déplacement de sa charge, les cinq murs de la glissière sud qui empêchent la poussée directe par-dessous et les obstacles qui organisent le détour de l’appui. Les cartes N1–N7 et le moteur sont inchangés par cette révision.

Préserver la preuve matérielle dans l’adaptateur : à `WIN`, les trois héros sont sur les buts, hors boutons, et les quatre autres objets doivent tenir l’accord. La réserve nord-est est nécessaire ; convertir une caisse en appui ou perdre un poids rend la victoire impossible. Ne remplacer cette contrainte ni par un contrôle de l’historique ni par un compteur de capacités. Un autre chemin d’accès à la cour doit toujours respecter l’accord final.

Le témoin qualifié de N8 compte **184 entrées, dont 168 actions hors sélection**. Rejouer les contre-branches de visée, de retour hydraulique, de séparation du chant et de déplacement prématuré de l’appui. Rejouer aussi les deux anciens contournements archivés — miroir en poids de remplacement et entrée sud par deux appuis — ainsi que le retrait réel d’un poids sous un héros occupant la presse de destination. Vérifier l’expulsion, Undo et les repères jaunes du but sur la presse fermée.

## Qualification

Depuis le laboratoire :

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

L’état qualifié comporte **56 tests réussis**, huit témoins gagnants sans refus ni mort, 27 découvertes au niveau 3 et cinq scripts de revue de conception. Les huit témoins totalisent **739 entrées : 650 actions hors sélection et 89 sélections**, avec **2 096 images publiques**. Les rapports et documents du laboratoire donnent le détail par salle et l’empreinte exacte du HTML.

Rejouer les huit témoins à travers l’adaptateur et le dispatcher natifs, puis comparer chaque observation, chaque image et chaque durée au laboratoire. Vérifier Undo après chaque victoire, Reset/Restart, ordre arbitraire de visite, sélection des trois rôles, erreurs atomiques, défaite et victoire finale. La qualification des témoins ne vaut pas réussite autonome SRA et n’établit ni optimum ni solution unique.

Contrôler le jeu intégré dans un **navigateur autorisé** : huit salles, tutoriel, commandes, interruptions, lien direct, ordinateur et mobile. Inspecter particulièrement boutons, presses, miroir sur bouton, aura du Barde, appuis mobiles, ancrages et avertissement rouge au niveau 8. Happy DOM et la vérification des pixels du laboratoire ne remplacent pas cette revue CSS et navigateur native.

Exécuter le typage, le build et les tests requis par le dépôt, ainsi que les non-régressions Custom 4 pertinentes. Si un chemin partagé du runtime est modifié, comparer son coût avant/après dans les mêmes conditions et respecter la tolérance de **+10 %** appliquée à la série.

## Publication et compte rendu

Suivre **tests → commit → push GitHub → intégration main → publication Site → vérification GitHub/Site**. Intégrer sans écraser les avancées concurrentes, vérifier le SHA distant, puis publier le **Site SRA Playground existant** depuis ce code durable.

Vérifier le lien direct SS18 et les commandes dans la version déployée. Relever la version Site et son SHA source lorsqu’il est disponible, et vérifier leur correspondance avec GitHub. Si le SHA n’est pas exposé, consigner le commit effectivement utilisé et cette limite. Préserver et réconcilier les deux états en cas de divergence.

Mettre à jour la feuille de route et livrer : résultat fonctionnel, tests, revue navigateur, branche de travail, SHA local/poussé/intégré, URL du Site, lien direct SS18, version Site, SHA source disponible et éventuelles limites restantes. Si une capacité manque, sauvegarder les changements utiles sur GitHub et nommer le blocage exact.
