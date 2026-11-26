# SS22 — feuille de route

## Campagne 0.1.0 : Les Cortèges Mécaniques

SS22 réunit **Marchand / Guerrier / Voleur / Barde**, sans Magicien. Le Marchand est sélectionné au départ. Les huit salles commencent par **L’école des cortèges**, un atelier de **33 découvertes**. La campagne développe les déplacements imposés sans capacité, le chant à portée limitée, les commandes derrière une cloison, les accès de manutention décalés et le réemploi d’appuis immergés.

| Étape | État et preuve |
| --- | --- |
| Huit cartes, références et témoins complets | Réalisé — `reference/level1-design.json` à `level8-design.json`, cartes synchronisées dans `src/levels.ts`. |
| Moteur et tutoriel public | Réalisé — **104 tests de laboratoire réussis**. |
| Campagne par témoins depuis N1 | Réussie — huit victoires, **1 414 entrées**, dont **173 sélections** et **1 241 actions physiques**, sur **3 932 images** ; aucun refus ni perte de héros. |
| Tutoriel | **33/33 découvertes** reconnues à partir des images publiques, uniquement au niveau 1. |
| Démonstration autonome | `dist/SS22-demo.html` ; identité, empreintes et portée de qualification dans `validation/delivery-manifest.json`. |
| Revues de conception | Revues d’introduction, du milieu, de finale et indépendante ; variantes et limites consignées dans les rapports `reference/*-ss22-review.json`. |
| Variété des terrains | Aucun terrain identique entre les huit salles ni avec les **64 salles de SS14–SS21**, après normalisation, translation, rotations et symétries ; portée exacte dans la revue indépendante. |
| Intégration native | Déjà codée — adaptateur, dispatcher, catalogue, aide et interface ; **90 tests natifs SS01–SS22 réussis**. |
| Parcours dans Chrome depuis N1 | Réussi — campagne manuelle N1→N8, 1 414 entrées, 33/33 découvertes, victoire officielle ; Undo/rejeu de N1 et N8 vérifié. |
| Continuité SIC | Réussi — `npm run test:sic-continuity` terminé avec code 0 ; contrat protégé préservé, sans qualification autonome de SS22. |
| Sauvegarde et publication | Checkpoint distant conservé ; finaliser les changements, pousser, intégrer sur `main`, puis publier le Site existant avec ses accès owner-only. Version et SHA finaux à relever. |

Les compteurs décrivent les témoins de solvabilité, sans annoncer un minimum ni une solution unique. Une victoire dans le laboratoire, par dispatcher ou dans l’interface ne prouve pas une résolution autonome par SRA. Les résultats Chrome et SIC ne sont pas déduits des tests DOM ou des tests natifs ; [validation.md](validation.md) et le compte rendu final enregistrent leur qualification effective.

## Progression des huit salles

| Salle | Intitulé | Préparation et réemploi enseignés | Entrées du témoin |
| --- | --- | --- | ---: |
| 1 | L’école des cortèges | Comparer les quatre capacités, déplacer un partenaire sans sa capacité, régler un miroir, déplacer et ancrer un appui, organiser presses et monstres. | 321 |
| 2 | La marche à deux temps | Alterner des courses chantées et un replacement silencieux du Barde pour déplacer une charge dans une galerie parallèle. | 185 |
| 3 | L’atelier du décrochage | Laisser une charge du Voleur sur une commande grâce à un transport imposé, puis organiser les départs. | 106 |
| 4 | La frontière du chant | Choisir le bord de portée qui déplace les gardiens tout en conservant la caisse requise pour le franchissement final. | 203 |
| 5 | Les entrées décalées | Distinguer trois livraisons ; choisir un accès permettant de quitter la charge centrale sans annuler sa mise en place. | 198 |
| 6 | Le quartier des reprises | Suivre une charge derrière des cloisons, utiliser une presse de déchargement et conserver un gardien comme poids. | 136 |
| 7 | Les cales du bassin | Évacuer les voyageurs, libérer deux appuis et les réorganiser autour des butées du bassin. | 149 |
| 8 | La dernière traverse | Déposer un appui de service, réemployer les deux autres et remplacer le Marchand par une caisse sans interrompre la plateforme. | 116 |

La revue conserve les alternatives utiles : le N3 possède notamment une variante gagnante sans fermeture de presse, plus longue, et le N5 accepte l’accès inférieur si le Voleur vient extraire silencieusement le Barde. Ces variantes réemploient les règles physiques ; elles limitent les affirmations de nécessité. La comparaison des terrains établit une absence de copie géométrique exacte dans le périmètre examiné, sans mesurer à elle seule la nouveauté de toute stratégie.

## Avancement de la série

La création de SS22 porte la série à **22 campagnes sur 25 (88 %)**, soit **176 salles sur 200**. Ce décompte concerne les campagnes créées. Il ne mesure ni leur résolution autonome par SRA ni le statut de leur publication.

| Campagne suivante | Composition prévue | Personnage absent | Salles |
| --- | --- | --- | ---: |
| **SS23** | Marchand / Guerrier / Magicien / Barde | Voleur | 8 |
| **SS24** | Marchand / Voleur / Magicien / Barde | Guerrier | 8 |
| **SS25** | Guerrier / Voleur / Magicien / Barde | Marchand | 8 |

La prochaine étape de création est **SS23**. Il reste trois campagnes et **24 salles** pour atteindre le plan de 25 campagnes et 200 salles. Chaque nouvelle campagne devra vérifier sa variété par rapport aux salles déjà créées et conserver la distinction entre adaptation d’une idée source, contrainte localement vérifiée et nécessité non démontrée.

## Traçabilité et publication

- Baseline GitHub et Site au début de la reprise : `3d75e7bb72a2669eaa8511473721f7eb952f21bb`, Site **version 194**.
- Branche de travail : `feat/sinking-star-ss22-20261125`.
- Checkpoint local conservé : `65ef876f90bec248aa79053c75ab0edf7c0e1f89`.
- Checkpoint distant conservé : `b48114dad0b1955199eb65fc9a34bd5768574f92`.
- Les deux checkpoints ont le même arbre Git : `b9ebc4398351931c26fc40f1bb24bf45874eb789`. Cette égalité d’arbre ne signifie pas que leurs identifiants de commit sont identiques.
- Ces checkpoints précèdent la clôture de livraison. Le compte rendu final doit relever le dernier SHA local, le SHA poussé, le commit intégré à `main`, la version Site et le SHA source publié, puis signaler toute divergence éventuelle.

La chaîne de livraison reste **tests → commit → push GitHub → intégration sur main → publication du Site existant → vérification GitHub/Site**. L’intégration SS22 existe déjà ; une reprise doit la vérifier et la compléter sans créer une deuxième entrée de jeu. Les accès owner-only du projet sont conservés.

[Jouer à SS22 sur le Site existant après publication](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS22#playground).
