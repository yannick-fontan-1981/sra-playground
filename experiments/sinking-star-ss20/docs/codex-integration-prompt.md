# Prompt Codex — intégrer SS20 et publier SRA Playground

Intègre **SS20 — Le Relais des Îles, laboratoire 0.1.0**, trio **Marchand / Voleur / Barde**, dans **SRA Playground**, puis publie le **Site SRA Playground existant** depuis le code intégré sur GitHub.

Le dépôt canonique est `yannick-fontan-1981/sra-playground`. Le laboratoire SS20 est livré sur `main` par la [PR #123](https://github.com/yannick-fontan-1981/sra-playground/pull/123), à partir de la version qualifiée `aa1fe3f2aa3d864698ec623d033dae6d5b3d8bcd`. Pars du `main` distant courant contenant cette livraison, préserve SS19 déjà intégré ainsi que les changements concurrents, notamment les évolutions SIC de la PR #122, et lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md`, puis les documents de `experiments/sinking-star-ss20`. Le laboratoire est la référence fonctionnelle ; ses rapports ne prouvent ni une intégration native déjà faite, ni une résolution autonome de SRA, ni une publication du Site.

## Identifier et intégrer la bonne référence

Reconstruis le laboratoire à partir des sources. Identifie les huit cartes et parcours dans `reference/levelN-design.json`, ainsi que les rapports réellement présents dans `validation/`. Compare le SHA-256 du HTML reconstruit à l’empreinte de `validation/delivery-manifest.json` et contrôle la liaison aux quatre rapports réussis. Un écart doit être expliqué par une différence de source ou de construction avant de qualifier l’intégration.

Inspecte les conventions courantes du catalogue, de Custom 4, du dispatcher, de la galerie, des captures de départ et des liens directs. Ajoute SS20 après SS19 dans la série ; complète une éventuelle intégration partielle sans doublon. Réutilise les huit cartes, leur ordre, leurs crédits, le tutoriel et le comportement du laboratoire. Préserve les accès et la visibilité existants du Site.

SS20 démarre au **niveau 1, L’atelier des marées**, avec le **Marchand** sélectionné. Ce niveau porte les **30 découvertes pédagogiques**, observées uniquement depuis les pixels publics. Le niveau 2 est **Le chargement à rebours** ; il n’est pas le tutoriel. Ne réimporte ni l’inversion des deux premières salles de SS19, ni ses 31 découvertes, ni son trio Guerrier / Magicien / Barde.

## Contrat physique à conserver

- **Marchand orange (`M`, palette 12)** : pousse une seule pièce devant lui. Deux occupants contigus bloquent la poussée ; aucune poussée en file propre au personnage.
- **Voleur vert (`T`, palette 14)** : avance sur une case libre et tire un seul occupant immédiatement derrière lui. Il ne pousse pas et ne propage pas la traction à une file.
- **Barde magenta (`B`, palette 6)** : son pas volontaire entraîne les pièces éligibles du carré 5 × 5 calculé avant le pas, diagonales et cloisons comprises. Les butées peuvent retenir une partie du groupe. Les miroirs ne suivent pas le chant.
- Un partenaire déplacé par poussée, traction, reflet ou presse n’exécute pas sa capacité. SS20 ne possède aucun échange magique.
- Une caisse déposée dans l’eau nue devient un appui permanent. Le chant peut déplacer un appui libre d’eau en eau. Un héros présent au départ, ou l’arrivée du Barde sur cet appui, l’ancre. Un appui n’est pas un poids de circuit.
- Les monstres sont stables. Leurs seuls mouvements sont ceux effectivement imposés par les mécanismes ; ni marche distante, ni sélection, ni ouverture de porte ne déclenche de poursuite. Les contacts orthogonaux sont simultanés et dangereux pour les héros inactifs aussi.
- Une presse agit à sa fermeture sur sa propre case, dans sa direction et selon sa polarité. Elle peut pousser une file, même si le Marchand ne pousse qu’une pièce. Fermer une presse vide ne déplace aucun voisin.
- Les boutons d’un circuit doivent tous être occupés. Boutons et presses restent sur des cases distinctes. Préserve les plateformes, cascades hydrauliques, arrivées forcées et l’annulation complète de leurs effets.
- ACTION5 déclenche un reflet global : priorité au plus proche, échange à distance égale, refus atomique des conflits. Un même acteur ne se duplique pas entre deux miroirs.

Conserve les avertissements : dos des miroirs concernés clignotant deux fois en rouge, diagonales blanches intactes, durées **110 / 70 / 110 / 0 ms**, aucun Undo supplémentaire. Les boutons ont un fond gris opaque, un plus rose et la couleur du circuit au centre ; une presse pure a un centre noir fermé / gris ouvert, sans pixel bleu parasite. Les buts et les faces de miroir gardent leurs marques lisibles.

La condition de victoire reste trois héros vivants sur les trois destinations simultanément, puis les huit salles achevées. N’ajoute aucun quota de coups, de chant, de reflet, de combat ou de découverte. Les témoins d’auteur ne définissent pas une solution unique.

## Conserver les huit problèmes

Lis `docs/level-design.md` et les revues propres à chaque salle avant d’adapter les données :

1. **L’atelier des marées** : trente enseignements, relais de poids, manipulation de partenaires, presse latérale, miroir déplacé et travail d’un appui. Les sorties ne sont pas ouvertes par une simple marche initiale.
2. **Le chargement à rebours** : route de fret et relais de deux caisses ; manutention et accès, sans monstre, eau ni reflet.
3. **Le poids qui reste** : un écran installé par une presse laisse le vert actif tandis que le violet alterne ; la traversée utilise les deux polarités.
4. **Les quais en décalage** : un montage de deux miroirs transporte les passagers et la caisse entre deux quais. L’escale masque un bras ; la réception est préparée avant la livraison qui retire le quai de départ.
5. **Le pas qui manque** : une correction sélective du monstre rend la rencontre possible ; la caisse est ensuite extraite et descendue au coude. Le reflet peut précéder le chant dans une variante gagnante.
6. **Les pierres voyageuses** : un même appui dessert plusieurs traversées, alors que la caisse sèche doit rester disponible comme poids final.
7. **La relève du passeur** : déplacement forcé du Barde sans chant, remplacement du héros sur sa commande et extraction d’une réserve dans deux axes.
8. **Le chantier à démonter** : conserver le chantier pendant l’extraction, récupérer sa caisse après démontage et former deux ponts indépendants. Après élimination du gardien, trois caisses sont nécessaires aux deux appuis et au poids sec final. Le Barde aide le dernier Voleur à partir sans tirer ce poids. Le contre-exemple du gardien posé trop tôt sur le bouton ne prouve pas l’impossibilité de toute installation tardive ; préserver la géométrie et ne pas ajouter un quota de caisses au moteur.

Les variantes effectivement qualifiées dans les revues restent légales. Un mauvais ordre observé n’établit pas à lui seul une impasse permanente. Une recherche limitée ne démontre pas l’impossibilité : seule une file complètement épuisée le fait sous ses restrictions explicites.

## Adaptateur public, interface et SRA

Raccorde `TrioPuzzleSession` à ACTION1–6. ACTION6 reçoit des coordonnées pixel entières 0–63 et sélectionne sans avancer le monde. Expose uniquement le contrat public défini dans `docs/specification.md` : images 64 × 64, palette, actions, état de session, progression, images d’animation et durées. Aucun état auteur, témoin, solveur, plan de reflet ou indice sémantique privé ne doit parvenir à SRA.

Conserve clavier, clic, commandes tactiles, Undo, Reset, Restart et sélection de salle. Un héros arrivé reste sélectionnable. Maj+Tab doit sortir de la grille. Les commandes ordinaires sont bloquées pendant une animation ; les commandes d’interruption invalident les anciens callbacks. Les panneaux finaux attendent la dernière image. La réduction des animations demeure fonctionnelle.

Le tutoriel ne lit que les images publiques et n’ajoute aucune condition de victoire. Vérifie **30/30** sur le témoin pédagogique de N1, aucune attribution au N2 ou après, et le bon retour au N1 avec Restart. La transition N1 → N2, son Undo et son rejeu doivent conserver cartes, crédits et aides de chaque salle.

## Qualification native

Dans le laboratoire, exécute les commandes décrites dans sa documentation, notamment `npm ci`, `npm test`, `npm run validate`, `npm run validate:ui` et `npm run validate:design`. Rejoue ensuite les huit témoins **à travers l’adaptateur et le dispatcher natifs**, et compare observations, pixels, images et durées à la référence. Conserve les compteurs exacts de cette version, sans les traiter comme minima.

Contrôle pertes, reprises, sélections, changements de salle, interruptions, Undo des huit victoires et résultat final depuis L1. Les tests DOM du laboratoire ne remplacent pas une revue du rendu natif dans un navigateur autorisé. Vérifie ordinateur et mobile : rôles, dispositifs, couleurs, aura, appuis, mouvements des monstres, clignotements rouges, commandes, galerie et lien direct.

Exécute le typage, le build et les tests exigés par le dépôt. **`npm run test:sic-continuity` est requis avant intégration** de l’adaptateur, du pack, du runtime ou du moteur. La continuité doit être prouvée par les tickets et clôtures natifs, y compris les poussées successives, les transports et les préparations précédant les transferts. Une victoire ou un plan annoncé ne suffit pas. Préserve les garanties des jeux précédents, notamment SS19, et documente tout changement d’un chemin partagé.

Si l’intégration demande une modification de l’apprentissage, de la reconnaissance des rôles, du passage de niveau, de la planification ou de l’arbitrage SIC, applique aussi le contrat de généricité de `AGENTS.md`. Ne décide pas du comportement de production par identifiant de jeu, numéro de niveau, couleur absolue, coordonnées fixes ou parcours témoin. Reproduis le premier échec par les observations publiques, conserve les preuves des rôles appris et vérifie leur réemploi sur la campagne depuis N1 ainsi que sur deux scénarios de transfert distincts, avec un cas ambigu et un cas contradictoire.

Une exécution du témoin démontre la conformité native ; elle ne démontre pas une résolution autonome de l’agent SRA. Qualifie séparément toute exécution autonome annoncée, avec son mode et son résultat officiel.

## Sauvegarde puis publication du Site existant

Suivre la chaîne obligatoire : **tests → commit → push GitHub → intégration sur main → vérification du commit distant → publication du Site existant → vérification GitHub/Site**. Préserve les évolutions parallèles. Ne crée pas un second Site et ne publie pas depuis une source conservée uniquement dans un checkout temporaire.

La destination connue est **https://sra-playground.yannick-fontan.chatgpt.site**, projet Sites `appgprj_6adbc388d79081918581b93b919d7258`. Vérifie cette identité et son état courant avant publication ; conserve son audience et ses accès existants. N’utilise pas une ancienne version Site comme référence implicite du code à déployer.

Si GitHub et le Site divergent, préserve les deux états, identifie leurs différences, réconcilie les sources puis reprends la publication. Après déploiement, vérifie le lien direct SS20 et les commandes sur la version publiée. Relève la version Site et le SHA source quand il est disponible ; sinon consigne le commit GitHub exact à partir duquel le déploiement a été produit.

Le compte rendu final doit donner le résultat fonctionnel, les tests et leurs limites, la branche, les SHA local/poussé/intégré, l’URL du Site, le lien SS20, la version publiée, le SHA source et la preuve de correspondance. Si une étape est bloquée, sauvegarde les changements utiles et nomme précisément cette étape. N’annonce jamais une publication accomplie à partir des seuls rapports du laboratoire.
