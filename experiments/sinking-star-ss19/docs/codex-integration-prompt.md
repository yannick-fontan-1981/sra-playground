# Prompt Codex — intégrer SS19 et publier SRA Playground

Intègre **SS19 — Les Gardiens Noirs, version 0.2.1**, trio **Guerrier / Magicien / Barde**, dans SRA Playground, puis publie le Site SRA Playground existant.

Le dépôt canonique est `yannick-fontan-1981/sra-playground`. Pars du `main` distant courant et conserve ses évolutions concurrentes. Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md`, puis les documents du laboratoire `experiments/sinking-star-ss19` : README, spécification, conception, audit des sources, validation et feuille de route. Reconstruis le HTML autonome et compare son SHA-256 à `validation/delivery.json` pour identifier la référence qualifiée.

## Intégration attendue

Réutilise le moteur, les huit cartes, les crédits et le tutoriel du laboratoire. Inspecte les conventions réelles des SS précédents et l’état actuel du catalogue, de Custom 4, du dispatcher, de la galerie et des liens directs. Complète l’intégration existante de SS19 si elle existe déjà, sans doublon. Préserve la visibilité et les accès actuels du Site.

Le jeu commence au niveau 1, **Le gardien du seuil**, avec le Guerrier sélectionné. Le niveau 2 est **Les galeries des gardiens** et porte seul le tutoriel de **31 découvertes**. L’ordre 1–2 est inversé par rapport à la version 0.2.0 : déplacer avec les salles leurs cartes, crédits, témoins, aides et affichages, sans remettre le tutoriel au niveau 1. Conserve l’ordre et les géométries des huit salles, les trois rôles distincts (`W` Guerrier, `Z` Magicien, `B` Barde), leurs couleurs et les trois destinations simultanées. Un héros arrivé reste présent et sélectionnable. La campagne n’est gagnée qu’après les huit salles, y compris si le sélecteur permet de les visiter dans un autre ordre.

## Contrat moteur à préserver

- **Guerrier rouge, palette 8 :** pousse toute la file contiguë. Le dernier occupant doit pouvoir avancer ; sinon le geste entier est refusé. Aucune traction. Un partenaire déplacé ne déclenche pas sa capacité.
- **Magicien violet, palette 15 :** échange sa place avec la première caisse, le premier monstre ou le premier partenaire atteint. Les faces blanches dévient le rayon, les dos noirs et murs l’arrêtent. Sans cible, il tente de marcher. Les miroirs et appuis ne sont pas des cibles. Un rayon en boucle anime son trajet et les pulsations du Magicien, sans avancée du monde.
- **Barde magenta, palette 6 :** son pas volontaire déplace les pièces éligibles du carré de 5 × 5 calculé avant le pas, diagonales et cloisons comprises. Les butées peuvent retenir une partie du groupe. Les miroirs ne suivent jamais ; un mouvement imposé au Barde ne chante pas.
- **Eau :** une caisse dans l’eau nue devient un appui permanent. Seul le chant le déplace, d’eau en eau. Un héros présent au départ, ou la case où arrive le Barde, l’ancre. Préserver les arrivées hydrauliques, les refus de noyade volontaire et la restauration de toute cascade par Undo.
- **Monstres stables :** aucun déplacement autonome dans aucune salle. Une marche sans transport provoqué par un pouvoir, un changement de héros ou l’ouverture d’une porte ne les fait pas avancer. Ils changent de place uniquement par poussée, chant, échange, reflet ou fermeture d’une presse sur leur case. Après le geste, stabiliser les dispositifs, l’eau et les contacts, puis évaluer les buts. Aucun second pas, cible liée au héros actif, calcul d’axe dominant ou type caché de garde. Un monstre déposé sur un bouton reste un poids tant qu’un mécanisme ne le déplace pas.
- **Combat :** contacts orthogonaux simultanés, après les transports imposés et leurs effets ; les héros inactifs restent vulnérables. Deux monstres voisins s’éliminent mais frappent encore pendant cette vague. Les caisses ne sont pas des armes d’écrasement. Certaines cartes exigent de conserver des monstres vivants comme poids.
- **Miroirs :** ACTION5 global, priorité au plus proche, échange à distance égale, conflits atomiques. Un blocage fait clignoter les dos concernés deux fois en rouge, sans effacer les diagonales blanches : 110 / 70 / 110 / 0 ms. Aucun Undo supplémentaire pour l’avertissement. Préserver les prévisions grises de forme distincte.
- **Commandes :** tous les boutons d’un circuit doivent être occupés ; les appuis immergés ne sont pas des poids. Une presse pousse à sa fermeture, selon sa direction et sa polarité. Boutons et presses des cartes restent sur des cases distinctes.

Conserve le rendu demandé : bouton sur fond gris opaque, plus rose et pixel de circuit au centre ; presse pure au centre noir fermé / gris ouvert, sans pixel bleu parasite. Un but placé sur une presse fermée conserve ses quatre coins jaunes. Les marques de bouton ne recouvrent pas les faces des miroirs.

## Interface et frontière publique

Raccorder `TrioPuzzleSession` et ACTION1–6. ACTION6 reçoit des coordonnées pixel entières 0–63 ; la sélection ne fait pas avancer le monde. Exposer uniquement le contrat public de la spécification : images 64 × 64, palette, actions, état de session, progression, images d’animation et durées. Ne transmettre à SRA ni état auteur, ni témoin, ni plan de reflet, ni solution de recherche. Les répertoires de référence et les témoins servent seulement à la qualification.

Conserver flèches, clic, boutons tactiles, 1/2/3, Tab, Espace/X, Z, R et les commandes de reprise. Maj+Tab permet de quitter la grille. Pendant une animation, les commandes ordinaires sont bloquées ; Undo, Reset, Restart et changement de salle annulent les anciens callbacks. Les panneaux de victoire et défaite apparaissent après la dernière image. Le mode de réduction des animations reste fonctionnel.

Les coches pédagogiques viennent uniquement des images publiques et ne verrouillent jamais la victoire. Conserver les aides sur les transports provoqués des monstres et les références de chaque salle.

## Préserver les contraintes et les variantes

N1 utilise un monstre et une caisse comme deux poids finaux. N2 conserve les trois galeries pédagogiques et leurs accès verrouillés. N3 alterne un contrôleur à distance et deux charges. N4 associe la réserve du gardien, un soutien escamotable et un passage à construire ; conserver les deux réserves utilisées ne signifie pas imposer deux immersions ni une noyade avant le chantier. N5 conserve son troisième gardien et les deux presses de la carte, sans imposer l’usage de chacune à toute solution. N6 différencie les deux premières images du reflet. N7 retire un relais puis rouvre la presse qui obstruerait encore le rayon.

En N8, la caisse unique doit permettre l’entrée sur l’île initialement vide par l’eau `13,17`. Le miroir fixe ne permet pas de refléter un premier occupant sur cette île. Les deux autres buts sont des presses exigeant les deux monstres vivants sur leurs commandes. À la victoire, les trois héros occupent les buts et aucun n’est disponible comme poids de remplacement ; l’appui immergé ne pèse pas et le miroir ne peut quitter son socle. Un héros peut néanmoins tenir une commande pendant les préparatifs. Conserver ces contraintes géométriques, sans ajouter de contrôle d’historique ni de minimum de coups.

Les audits reconnaissent des variantes légales dans `reference/*review*.json`. Conserver celles requalifiées pour la version 0.2.1 : les anciens parcours dépendant de la poursuite 0.1.0 ne font pas foi. Le niveau 7 peut garder son monstre vivant ; le niveau 8 possède notamment un transport par chant remplaçant la presse verte et une récupération optique de la caisse. Ces solutions emploient toujours les ressources finales nécessaires. Un parcours auteur n’est ni une solution minimale ni l’unique solution.

## Qualification puis publication

Dans le laboratoire : `npm ci`, `npm test`, `npm run validate`, `npm run validate:ui`, `npm run validate:design`. Rejouer ensuite les huit témoins à travers l’adaptateur et le dispatcher natifs, comparer chaque observation, chaque image et chaque durée à la référence. Vérifier les interruptions, pertes, reprises, changements de salle, Undo des huit victoires et la victoire finale depuis L1. Relever les comptes exacts de la référence dans `validation/delivery.json` ; ils ne sont ni des minima ni des conditions à imposer au joueur. Les témoins ne démontrent pas une réussite autonome de SRA.

Effectuer une revue dans un navigateur autorisé, ordinateur et mobile : lisibilité des pièces, transport des monstres, boutons, presses, appuis, aura, avertissements rouges, commandes et lien direct. La qualification Happy DOM du laboratoire contrôle les entrées et pixels, mais ne revendique pas cette revue CSS native.

Exécuter le typage, le build et les tests requis par le dépôt, notamment **`npm run test:sic-continuity`** avant intégration. Pour un chemin partagé du runtime modifié, comparer le coût avant/après dans les mêmes conditions et respecter la tolérance de +10 % de la série. Aucun changement propre à SS19 ne doit favoriser artificiellement l’agent.

Suivre la chaîne **tests → commit → push GitHub → intégration main → publication du Site existant → vérification GitHub/Site**. Ne pas créer un second Site. Si les états divergent, les préserver et les réconcilier. Vérifier le lien direct SS19 et les commandes dans la version publiée ; relever la version Site et le SHA source quand il est fourni.

Compte rendu final : résultat fonctionnel, tests et limites, branche, SHA local/poussé/intégré, URL du Site, lien direct SS19, version publiée, SHA source et preuve de correspondance. Si une capacité manque, pousser les changements utiles et nommer le blocage exact sans annoncer une publication réussie.

## Contrôles propres à la version 0.2.1

Le niveau 1 ne doit attribuer aucune découverte. Vérifier la transition **N1 → N2**, l’activation des 31 découvertes au N2, puis l’absence d’attribution dans les salles suivantes. Undo de la victoire de N1 doit revenir au Gardien du seuil ; Restart doit repartir de cette même salle. Le tutoriel conserve 31 découvertes, avec `monster-still`, `monster-song` et `monster-press` à la place des trois leçons de poursuite. Tous les textes, feedbacks et aides doivent présenter les causes physiques. Les niveaux 3 et 6 conservent leurs cartes et témoins ; le niveau 7 conserve sa géométrie. Le fichier `tests/monsters.test.mjs` qualifie notamment l’immobilité après marche et sélection, la stabilité d’un poids sans mur de blocage, chaque transport sans second pas et le rôle exact d’une presse. Rejouer aussi les 29 cas de mécanismes dans le HTML compilé et vérifier le feedback qui identifie le chant ou la presse.
