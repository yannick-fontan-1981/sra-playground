# SS22 — intégration native dans SRA Playground

SS22, **Les Cortèges Mécaniques**, est inscrit après SS21 dans Custom 4. L’intégration utilise directement le laboratoire TypeScript `experiments/sinking-star-ss22`, avec le Marchand, le Guerrier, le Voleur et le Barde. Elle ne passe ni par une iframe ni par Python.

## Raccordements

- `src/games/sinking-star-ss22.ts` adapte les six commandes publiques, Undo, Reset, Restart et le choix de niveau au contrat du dispatcher. Les sélections utilisent ACTION6 et les coordonnées pixels du plateau.
- `src/runtime/native-game-dispatcher.ts` charge cet adaptateur pour SS22. Le contrat d’observation reste celui de `browser-games.ts` : images 64 × 64, palette de 16 couleurs, séquences et durées d’animation, état officiel et progression de la campagne.
- `src/games/catalog.ts` place **Les Cortèges Mécaniques** dans la famille `sinking_star_quartet`, avec huit niveaux.
- `src/main.ts` importe les détecteurs pédagogiques publics et les métadonnées de sources du laboratoire. Les commandes 1, 2, 3 et 4 correspondent au Marchand, au Guerrier, au Voleur et au Barde. Tab, les boutons de rôle et les clics sur le plateau utilisent la même sélection publique. Les objectifs et la victoire demandent quatre destinations occupées simultanément.
- `src/games/sinking-star-ss22-help.ts` décrit les quatre pouvoirs, les appuis mobiles, les ancrages, les miroirs et les cascades. Le panneau contient les 33 découvertes de **L’école des cortèges**. Les aides des presses, des plateformes et des monstres suivent le contexte de la salle ; les liens de référence proviennent du laboratoire.
- `src/styles.css` conserve deux colonnes tactiles pour les quatre boutons, la couleur de sélection propre à chaque rôle et la lisibilité des explications.
- `scripts/native-game-gallery.mjs` enregistre la session SS22 après SS21 et produit ses vignettes depuis les observations réelles des huit salles lors de la compilation du site.

## Règles conservées

Le moteur SS22 conserve le chant, l’aura de 5 × 5, les appuis mobiles et leurs ancrages, les monstres, les reflets et les circuits de SS20. L’ajout physique est la poussée de file du Guerrier, reprise de SS21. Un héros transporté ne déclenche pas sa capacité : le Barde poussé ne chante pas et le Guerrier déplacé par le chant ne pousse pas une autre file.

L’appui immergé peut glisser d’eau en eau sous l’effet du chant lorsqu’il est libre. Un héros posé dessus au début du geste l’ancre ; le prochain appui du Barde est également protégé. Le Guerrier reste vulnérable au contact des monstres. Les quatre identités et les quatre destinations sont vérifiées à la compilation de chaque salle.

## Vérifications effectuées

Le 25 novembre 2026 (UTC−3), `npm test` dans le laboratoire SS22 a réussi : **104 tests sur 104**, après compilation TypeScript et reconstruction du HTML autonome. Les suites `quartet.test.mjs`, `monsters.test.mjs` et `tutorial.test.mjs` couvrent les règles héritées de SS20, le nouveau quatuor, les files du Guerrier, les mouvements forcés sans capacités imbriquées, les appuis, les circuits, les combats, les animations et l’annulation complète des cascades. Le parcours réel du tutoriel obtient les 33 découvertes par ses 321 commandes publiques ; sa copie au niveau 2 n’en obtient aucune. La reconnaissance distingue le Guerrier rouge d’un monstre et n’attribue pas une poussée au Guerrier déplacé par le Barde ou une presse.

`npm run typecheck` a réussi après le raccordement de l’interface native.

Les sorties originales de ces 104 tests sont conservées dans `experiments/sinking-star-ss22/validation/unit-tests.txt`. Le rapport `unit-tests.json` du même dossier enregistre `success: true`, 104 tests, 104 réussites, zéro échec, zéro test ignoré et la sortie complète. Ces preuves ont été sauvegardées depuis le journal du contrôle réussi, sans relancer les tests.

## Équivalence de la campagne native

`node --test tests/custom4-native.test.ts tests/ss21-native.test.ts tests/ss22-native.test.ts` a réussi : **90 tests sur 90**, avec les campagnes SS01–SS22 et les collections précédentes conservées.

La sortie originale est conservée dans `docs/migration/ss22-evidence/native-tests.txt`.

`tests/ss22-native.test.ts` compare chaque observation des huit témoins depuis le niveau 1 avec la session du laboratoire, via l’adaptateur direct puis via le dispatcher. Les comparaisons portent sur toutes les images intermédiaires, leurs durées, les transitions, les sélections et l’annulation de chacune des huit victoires. Le test obtient les 33 découvertes dans le tutoriel du niveau 1 et vérifie qu’un autre niveau ne les acquiert pas.

Parcours par niveau : **321 / 185 / 106 / 203 / 198 / 136 / 149 / 116 commandes**, soit **1 414 commandes**, dont **173 sélections**, pour **3 932 images**. Le résultat officiel final est `WIN`. Ces mesures concernent les témoins d’auteur transmis par les commandes publiques.

## Interface autonome

Le HTML autonome expose le même ordre de quatre rôles, les mêmes 33 découvertes et les mêmes règles. Les commandes sont sélectionnables par les touches 1 à 4, Tab, les boutons et le clic. Les descriptions sont affichées en 16 px, les repères et commandes en au moins 14 px ; les quatre boutons occupent deux colonnes.

`node scripts/verify-ui-dom.mjs` a réussi sur le HTML reconstruit avec les huit salles. Le rapport `experiments/sinking-star-ss22/validation/ui-dom-report.json` porte `success: true` et `scope: focused-ui-and-full-campaign`. Il compare les pixels réellement peints et les durées de chaque action, vérifie les commandes, les aides contextuelles, les arrêts d’animation, les 33 découvertes, les huit victoires avec Undo et rejeu, puis le `WIN` final.

Le contrôle conserve un reflet bloqué issu de la campagne réelle : après 61 commandes du niveau 1, une sélection et un déplacement latéral créent le blocage. Ce détour est exécuté dans le DOM ; les dos des miroirs concernés clignotent, les diagonales restent blanches et répéter l’avertissement n’ajoute pas d’étape à Undo. Les témoins gagnants eux-mêmes n’ont pas à visiter cet état refusé.

Ce contrôle utilise Happy DOM, des pixels de canvas capturés et des temporisations contrôlées. Il ne remplace pas la revue visuelle dans un navigateur de l’interface native livrée.

## Qualification finale avant publication

La campagne native a été reproduite dans Chrome depuis le niveau 1 jusqu’au niveau 8 et à la victoire finale, avec les **1 414 commandes publiques** des témoins et les **33 découvertes** du tutoriel. L’annulation puis le rejeu de la fin du niveau 1 et de la victoire du niveau 8 ont été contrôlés dans cette interface.

`npm run build` a réussi. Le contrôle obligatoire `npm run test:sic-continuity` s’est terminé avec le code de sortie **0** et conserve le contrat des **41 niveaux protégés**. Sa sortie est conservée dans `docs/migration/ss22-evidence/sic-continuity.txt`.

Les témoins et outils d’auteur sont réservés aux tests et à la création des niveaux. Ils ne sont pas importés par l’application. Leur rejeu établit la jouabilité et l’équivalence du moteur natif ; il ne constitue pas une résolution autonome par SRA. Aucun apprentissage, raisonnement, planificateur ou arbitrage SIC n’est modifié.

La livraison doit consigner le commit poussé, son intégration sur `main`, la version Site et son SHA source après les contrôles finaux.
