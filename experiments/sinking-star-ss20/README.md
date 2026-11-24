# SS20 — Le Relais des Îles

**Laboratoire autonome 0.1.0 · huit niveaux · Marchand, Voleur et Barde.**

Le Marchand pousse une seule pièce, le Voleur en tire une derrière son pas et le Barde déplace un groupe choisi par sa position et les butées. SS20 construit ses puzzles autour des accès, des changements de côté, des transports entre quais et du réemploi des ressources. Les monstres restent stables : chaque déplacement a une cause physique visible.

## Jouer

```sh
npm ci
npm run build
```

Ouvrir `dist/SS20-demo.html` dans un navigateur. Ce HTML est autonome et ne requiert aucun accès réseau pour jouer. Le fichier qualifié mesure 136 889 octets ; son identité et son SHA-256 sont consignés dans `validation/delivery-manifest.json`.

Commandes : flèches ; 1 / 2 / 3 ou Tab pour changer de héros ; clic sur un personnage ; Espace / X pour les reflets ; Z pour Annuler ; R pour Recommencer. Les boutons tactiles offrent les mêmes commandes. Undo restaure le geste, les presses, les contacts, les effets de l’eau et une éventuelle transition de salle.

Les boutons sont lisibles sur fond gris, avec un plus rose et le pixel de leur circuit au centre. Les presses ont un centre noir fermé / gris ouvert, sur une case distincte de leur commande. Un reflet bloqué fait clignoter en rouge les miroirs concernés.

## Une campagne qui change de problème

| Niveau | Titre | Raisonnement dominant |
| --- | --- | --- |
| 1 | **L’atelier des marées** | Trente découvertes : manipulation de partenaires, relève des poids, chant sélectif, presse, miroir, appui mobile. |
| 2 | **Le chargement à rebours** | Grand détour de fret, changements de côté et relais de deux caisses ; salle entièrement terrestre. |
| 3 | **Le poids qui reste** | Installer un écran optique pour stabiliser un bouton pendant que l’autre alterne. |
| 4 | **Les quais en décalage** | Préparer la réception d’un transport par deux miroirs et livrer la caisse après le dernier passager. |
| 5 | **Le pas qui manque** | Corriger une diagonale, provoquer une rencontre puis tourner une charge dans un coude fermé. |
| 6 | **Les pierres voyageuses** | Réutiliser un appui immergé pour plusieurs passages et conserver la caisse sèche. |
| 7 | **La relève du passeur** | Faire passer le Barde sans chant, remplacer le héros sur sa commande et extraire une réserve dans deux axes. |
| 8 | **Le chantier à démonter** | Exploiter puis démonter un chantier ; répartir trois caisses entre deux ponts et un poids final. |

Le **niveau 1** porte le tutoriel de **30 découvertes**, suivi uniquement depuis les images publiques. Son témoin pédagogique comporte 256 entrées et montre les 30 découvertes. Les coches sont des aides : elles ne conditionnent jamais la victoire. Les trois héros doivent occuper les trois destinations simultanément ; la campagne exige les huit salles terminées.

Les plans et circuits sont propres à SS20. Les contraintes adaptées viennent des guides [Nord](https://sinkingstarwalkthrough.com/fr/north/) et [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/), avec des énigmes numérotées et des écarts décrits pour chaque salle. Le montage des quais conserve notamment l’atomicité des reflets SS20, sans duplication d’acteur. Aucun échange magique, empilement ou déplacement autonome des monstres n’est ajouté au trio.

## Vérifier et reproduire

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

La qualification réussit **90 tests**, les **huit victoires** depuis N1 et **30/30 découvertes**. Le vrai HTML compilé a été rejoué via ses commandes DOM : **1 344 entrées**, **3 821 images** et leurs durées comparées, sans refus ni perte. Quatre revues totalisent **91 contrôles ciblés** ; les terrains ne répètent exactement aucune des 48 cartes SS14–SS19 après recadrage et symétries.

Ces résultats concernent le laboratoire et son exécution dans Happy DOM. La revue d’un navigateur natif, l’adaptateur SRA et le Site publié restent des vérifications distinctes. Les preuves et limites sont décrites dans [docs/validation.md](docs/validation.md) et les rapports de `validation/`.

Les références d’auteur contiennent cartes, crédits, étapes et routes gagnantes. Elles servent à vérifier le jeu et ne sont ni embarquées dans le HTML ni exposées à SRA. Un témoin prouve la résolubilité de sa carte ; sa longueur n’est ni une difficulté mesurée ni un minimum. Une variante légale reste acceptée même si elle utilise un autre ordre ou évite un mécanisme du témoin.

La revue des niveaux 3–5 contrôle notamment l’écran optique, le conflit de deux miroirs, une livraison prématurée réversible et l’ordre interchangeable du chant et du reflet avant une rencontre. Le niveau 5 sans aucun chant est vérifié insoluble par épuisement de la file de recherche, sous cette restriction précise.

## Documentation et prochaine intégration

- [Contrat moteur, interface et frontière publique](docs/specification.md)
- [Conception des huit salles et variantes](docs/level-design.md)
- [Sources exactes et écarts d’adaptation](docs/source-audit.md)
- [Qualification et portée des preuves](docs/validation.md)
- [Feuille de route : SS20 puis les cinq quatuors](docs/roadmap.md)
- [Prompt Codex : intégration native puis publication du Site existant](docs/codex-integration-prompt.md)

Le dépôt canonique est `yannick-fontan-1981/sra-playground` ; le laboratoire SS20 est livré sur `main` par la [PR #123](https://github.com/yannick-fontan-1981/sra-playground/pull/123), depuis `feat/sinking-star-ss20-20261123`. SS19 reste une campagne distincte déjà présente sur `main`. SS20 doit rejoindre le catalogue et Custom 4 en préservant les jeux existants. La conformité de l’adaptateur natif, la continuité SIC et la publication du Site se vérifient dans cette phase d’intégration ; les rapports du laboratoire ne valent pas preuve de déploiement.
