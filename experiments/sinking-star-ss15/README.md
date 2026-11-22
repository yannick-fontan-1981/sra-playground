# SS15 — Les Accords Transposés

Laboratoire autonome **0.2.0**, quinzième jeu de la série Sinking Star du projet ARC-3-AGENT / SRA Playground. Le duo associe le **Magicien violet (15)** et le **Barde magenta (6)** dans huit salles. Le Magicien commence sélectionné.

Le Magicien échange sa place avec la première caisse, le premier monstre ou son partenaire rencontré par son rayon. Le Barde transporte les occupants de son voisinage lorsqu’il marche. Cette différence permet de conserver un poids en place, libérer le Barde de son propre chant et transférer des ressources entre des rives que les seuls échanges ne suffisent pas à réunir.

## Jouer

La construction produit **`dist/SS15-demo.html`**, un fichier autonome contenant le moteur, les huit salles, l’interface et leurs aides. Il fonctionne sans dépendance réseau à l’exécution. Le livrable destiné au joueur est nommé **SS15-demo-v2.html**.

| Commande | Action |
| --- | --- |
| Flèches ou boutons directionnels | Marcher, échanger avec le Magicien, chanter avec le Barde |
| Clic sur un héros, 1, 2 ou Tab | Choisir le héros actif |
| Espace ou X | Activer les reflets géométriques de tous les miroirs |
| Annuler | Revenir sur l’entrée précédente, y compris une fin de salle |
| Recommencer | Reprendre la salle courante |
| Repartir | Reprendre toute la campagne |
| Sélecteur des salles | Explorer directement une salle |

Les deux héros doivent occuper simultanément les deux destinations jaunes. La sélection ne fait pas avancer le monde. Un déplacement forcé ne déclenche ni chant ni échange supplémentaire.

## Un tutoriel de vingt découvertes

La quatrième salle propose un atelier contraint, après trois salles d’introduction : sélection, marche, échange avec une caisse, échange de partenaires, rayon dévié, relève sur une commande, chant de groupe, transport du Magicien, membres retenus par une butée, portée diagonale, chant à travers un mur, extraction du Barde sans chant, création d’un appui dans l’eau, déplacement de cet appui, ancrage sous un héros, reflet global, commande de porte, dépôt par presse et combat des monstres. L’arrivée commune complète la découverte des destinations.

Les vingt cases de progression sont déduites des images publiques. Elles expliquent ce qui vient de se produire ; elles ne lisent ni solution, ni état caché. Les sorties de cet atelier dépendent désormais de passages et de ressources à préparer. Les vingt découvertes restent observées à partir des pixels ; elles ne servent pas de serrure artificielle. Le joueur peut trouver une autre route légale.

## Progression

| Salle | Problème principal | Entrées du témoin |
| --- | --- | ---: |
| 1 — L’appui des deux traversées | Réemployer le même bloc immergé pour deux traversées | 56 |
| 2 — Le départ qui garde le poids | Extraire le Barde en laissant sa caisse sur la commande | 49 |
| 3 — Le remplaçant derrière le reflet | Libérer un partenaire enfermé et maintenir deux passages | 56 |
| 4 — L’atelier des passages croisés | Vingt découvertes dans un atelier à passages conditionnés | 142 |
| 5 — Les gardiens qu’il faut garder | Conserver deux monstres comme poids et ajouter une caisse | 39 |
| 6 — La visée et le dernier appui | Déplacer un miroir par presse, récupérer une caisse sèche et préparer le dernier passage | 47 |
| 7 — Le relais des trois rives | Un appui pour trois bras, une caisse pour plusieurs fonctions et un sauvetage par double reflet | 162 |
| 8 — Le compte des deux rives | Pont provisoire puis durable, caisse transportée entre rives et gardiens réaffectés | 181 |

Les 732 entrées comprennent 56 sélections. Ce sont des parcours gagnants reproductibles, pas des minima ni des mesures automatiques de difficulté. Les finales exigent surtout de conserver, déplacer puis réaffecter les mêmes ressources. Leurs branches alternatives sont décrites dans les références d’auteur et les rapports.

## Sources et adaptations

Les index demandés sont [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/) et [North](https://sinkingstarwalkthrough.com/fr/north/). Les salles adaptent des contraintes de **Heroes of Hauling**, **Heroes and Mirrors**, **Heroes and Water**, **Heroes and Light**, **Heroes 2: Monsters** et **Heroes 3: Bard, Druid**. Chaque salle expose sa référence principale et une référence complémentaire.

Les cartes, distances et relais ont été recomposés pour les règles de cette série. Il ne s’agit pas d’une transcription des cartes commerciales. Le [détail des sources](docs/source-audit.md) distingue le principe repris et les modifications ; le [dossier des niveaux](docs/level-design.md) explique la progression.

## Construire et vérifier

Depuis ce répertoire, avec Node 22 ou ultérieur :

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
npm run validate:workshop
```

`npm test` construit le moteur et le HTML puis exécute les tests moteur. `validate` rejoue les huit routes et contrôle les observations, images, durées et vingt découvertes. `validate:ui` exerce les vrais événements du HTML compilé dans Happy DOM et compare le tampon canvas ; `HAPPY_DOM_MODULE` peut désigner une installation externe de Happy DOM. `validate:design` exécute les contrôles locaux indépendants des finales ; `validate:workshop` contrôle les contraintes du nouvel atelier L4.

Pour régénérer les données publiques après une modification volontaire des références : `node scripts/sync-levels.mjs`. Les cartes de `src/levels.ts`, les crédits de `src/level-info.ts` et `tests/witnesses.json` proviennent des huit JSON de `reference/`. Les constructeurs de `reference/author/` reproduisent les parcours documentés.

## Organisation et frontière publique

- `src/core.ts` : moteur déterministe, rendu et session publique ACTION1–6.
- `src/levels.ts`, `src/level-info.ts` : cartes et crédits de la campagne.
- `src/tutorial.ts`, `src/browser.ts`, `index.template.html` : suivi visuel des découvertes et interface autonome.
- `tests/`, `reference/`, `scripts/solver.mjs` : outils d’auteur et validation, exclus des observations de SRA.
- `validation/` : résultats reproductibles ; [validation.md](docs/validation.md) en précise la portée.

Le laboratoire ne raccorde pas encore SS15 au catalogue natif Custom 4. Le [prompt d’intégration et de publication](docs/codex-integration-prompt.md) prépare cette étape, avec préservation des animations, des aides et de la frontière publique. La [feuille de route](docs/roadmap.md) sépare le laboratoire livré et cette intégration à venir.
