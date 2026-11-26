# SS23 — Les Chambres de Résonance

Laboratoire de la campagne **SS23** de SRA Playground : huit salles prévues, un tutoriel de **36 découvertes**, quatre héros — **Marchand, Guerrier, Magicien, Barde** — et quatre destinations à occuper ensemble.

Le Marchand pousse une pièce, le Guerrier avance une file, le Magicien échange deux occupants et le Barde entraîne les pièces de sa portée. Les salles combinent ces capacités avec les caisses, l’eau, les appuis immergés, les miroirs, les monstres, les boutons, les portes, les presses latérales et les plateformes hydrauliques. Les règles réutilisent les contrats établis dans les campagnes précédentes ; le remplacement du Voleur par le Magicien ne crée pas de traction implicite.

## État du chantier

Les raccordements natifs, le moteur, le tutoriel public et l’interface autonome sont préparés. Les cartes et leurs références sont en cours de finalisation. La qualification complète des huit salles, l’intégration sur `main` et la publication de SS23 restent en attente.

Les vérifications déjà réussies sont décrites dans [la note d’intégration native](../../docs/migration/ss23-native-integration.md). À ce stade, elles couvrent 81 tests moteur/monstres, 33 tests pédagogiques (dont le parcours réel N1), l’aide native, le contrôle TypeScript et les fixtures du HTML compilé. Elles ne remplacent pas le rejeu des huit cartes définitives ni la vérification du Site publié.

Les noms, parcours et totaux de commandes des salles seront consignés seulement après leur stabilisation. Le nombre de découvertes n’est pas une condition cachée de victoire : ce sont les quatre destinations occupées par les quatre héros vivants qui terminent une salle.

## Jouer

La version intégrée s’ouvre depuis **Custom 4 → SS23 — Les Chambres de Résonance**. Elle utilise le moteur TypeScript du laboratoire dans le dispatcher natif de SRA Playground.

Le build du laboratoire produit `dist/SS23-demo.html`, une version autonome avec son moteur et ses ressources locales. Ce HTML ne charge aucun solveur, parcours témoin ou outil d’auteur.

| Commande | Effet |
| --- | --- |
| Flèches | Agir avec le héros sélectionné : marcher, pousser, échanger ou chanter |
| 1 / 2 / 3 / 4 | Sélectionner Marchand / Guerrier / Magicien / Barde |
| Tab | Sélectionner le héros suivant ; Maj+Tab quitte la grille |
| Clic sur un héros | Sélection par les pixels du plateau |
| Espace ou X | Activer les reflets globaux |
| Z | Annuler l’action entière et ses conséquences |
| R | Recommencer la salle |
| Sélecteur de niveau | Choisir une salle ; le suivi pédagogique repart de zéro |

Le point blanc indique le héros actif et sa dernière direction. Le cadre magenta du Barde montre son carré de chant, mesuré avant son déplacement. Les signes gris clair annoncent les arrivées possibles d’un reflet global.

## Développer et vérifier

Depuis ce répertoire, avec les dépendances installées :

```sh
npm run build
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

`validate` et le contrôle UI complet exigent les huit cartes, leurs références et les témoins synchronisés. Pendant la création des salles, `node scripts/verify-ui-dom.mjs --fixtures-only` contrôle les interactions du HTML sans qualifier la campagne finale.

Depuis la racine du dépôt, les tests natifs doivent inclure explicitement `tests/custom4-native.test.ts`, en plus du glob `tests/ss*-native.test.ts`. Le build final et `npm run test:sic-continuity` sont requis avant intégration selon `AGENTS.md`.

## Repères dans le laboratoire

| Emplacement | Responsabilité |
| --- | --- |
| `src/core.ts` | Règles déterministes, rendu 64 × 64, animations, historique et session |
| `src/tutorial.ts` | Sélection et découvertes tirées uniquement des observations publiques |
| `src/levels.ts` | Les huit cartes expédiées, une fois synchronisées |
| `src/level-info.ts` | Objectifs et liens publics de référence de chaque salle |
| `src/browser.ts`, `index.template.html` | Interface autonome et commandes |
| `tests/*.test.mjs` | Contrats moteur, monstres et pédagogie |
| `tests/witnesses.json` | Commandes d’auteur utilisées par les validations ; jamais importées en production |
| `reference/` | Cartes sources de travail, décisions d’adaptation et scripts d’auteur |
| `validation/` | Rapports de qualification de l’état réellement testé |

Le contrat complet figure dans [specification.md](docs/specification.md), le protocole de reprise dans [codex-integration-prompt.md](docs/codex-integration-prompt.md) et l’avancement de création dans [roadmap.md](docs/roadmap.md).

## Sources et portée

Chaque salle adaptée doit relier son objectif et ses choix à une référence identifiée, en distinguant le principe conservé des changements apportés à la géométrie, aux rôles et aux mécanismes. Les liens détaillés seront exposés par `src/level-info.ts` et les dossiers d’auteur. Une référence de walkthrough ne constitue pas, à elle seule, une certification de reproduction exacte.

Les témoins établissent la jouabilité des salles par les commandes publiques. Ils ne prouvent ni optimalité, ni unicité, ni nécessité de chaque capacité. Leur rejeu n’est pas une résolution autonome par SRA ; ce lot ne modifie aucun apprentissage, planificateur ou arbitrage SIC.
