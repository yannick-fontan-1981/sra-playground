# SS23 — Les Chambres de Résonance

Laboratoire de la campagne **SS23** de SRA Playground : huit salles, un tutoriel de **36 découvertes**, quatre héros — **Marchand, Guerrier, Magicien, Barde** — et quatre destinations à occuper ensemble.

Le Marchand pousse une pièce, le Guerrier avance une file, le Magicien échange deux occupants et le Barde entraîne les pièces de sa portée. Les salles combinent ces capacités avec les caisses, l’eau, les appuis immergés, les miroirs, les monstres, les boutons, les portes, les presses latérales et les plateformes hydrauliques. Les règles réutilisent les contrats établis dans les campagnes précédentes ; le remplacement du Voleur par le Magicien ne crée pas de traction implicite.

## Campagne et validation

Les huit cartes définitives, leurs références et leurs témoins sont synchronisés. Le parcours complet atteint `WIN` en **947 commandes**, dont **173 sélections**, avec **2 537 images publiques** contrôlées, aucun refus et aucune mort. Les 36 découvertes sont acquises dans la première salle seulement. Undo et le rejeu de chaque victoire sont vérifiés.

Les preuves détaillées figurent dans [la note d’intégration native](../../docs/migration/ss23-native-integration.md) : **114 tests du laboratoire**, **94 tests natifs** incluant Custom 4 et les régressions SS21/SS22, validation des huit témoins et contrôle complet du HTML compilé. Le build du Site et le contrôle de continuité SIC des **41 niveaux protégés** sont également passés. Le parcours a ensuite été reproduit dans Chrome en mode Manual, depuis N1 jusqu’au panneau de victoire finale, avec 36/36 découvertes. La [validation de livraison](docs/validation.md) décrit les preuves ; la [PR 127](https://github.com/yannick-fontan-1981/sra-playground/pull/127) conserve le relevé d’intégration sur `main` et de publication.

| Salle | Problème principal | Commandes du témoin |
| --- | --- | ---: |
| 1. Le conservatoire des échanges | Les 36 découvertes : quatre pouvoirs, déplacements imposés, appuis, reflets, presses et contacts | 221 |
| 2. La grille des places libres | Sas sec encombré de neuf caisses : déplacer les postes de travail par échange et ouvrir un passage par chant | 91 |
| 3. La case de trop | Un croisement serré, deux files et une case supplémentaire pour déformer le groupe | 43 |
| 4. Le poste emprunté | Envoyer le Barde au poste de travail, récupérer la balise et réemployer les charges pour traverser l’eau | 132 |
| 5. Les deux côtés du sort | Préparer les deux extrémités d’un échange de monstre et les contacts après une visée déviée | 50 |
| 6. Le poste derrière la file | Séparer une charge, changer le Guerrier de poste et utiliser une fermeture latérale | 126 |
| 7. Le pas qui laisse un appui | Choisir les appuis qui suivent le chant et ceux qui doivent rester pour les traversées | 172 |
| 8. La forme et la place vide | Réunir deux fragments décalés, retirer le Barde silencieusement et compléter neuf poids | 112 |

Les commandes incluent les sélections ; ce ne sont pas des longueurs optimales. Le nombre de découvertes n’est pas une condition cachée de victoire : ce sont les quatre destinations occupées par les quatre héros vivants qui terminent une salle.

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
| `src/levels.ts` | Les huit cartes expédiées, synchronisées avec leurs références |
| `src/level-info.ts` | Objectifs et liens publics de référence de chaque salle |
| `src/browser.ts`, `index.template.html` | Interface autonome et commandes |
| `tests/*.test.mjs` | Contrats moteur, monstres et pédagogie |
| `tests/witnesses.json` | Commandes d’auteur utilisées par les validations ; jamais importées en production |
| `reference/` | Cartes sources de travail, décisions d’adaptation et scripts d’auteur |
| `validation/` | Rapports de qualification de l’état réellement testé |

Le contrat complet figure dans [specification.md](docs/specification.md), le protocole de reprise dans [codex-integration-prompt.md](docs/codex-integration-prompt.md) et l’avancement de création dans [roadmap.md](docs/roadmap.md).

## Sources et portée

La première salle est un atelier original. Les sept suivantes adaptent des énigmes identifiées de *Heroes of Hauling*, *Heroes and Light*, *Heroes and Artifacts*, *Heroes 2: Monsters* et *Heroes and Stones, West*. Chaque dossier distingue le principe conservé des changements apportés à la géométrie, aux rôles et aux mécanismes. Les liens détaillés sont exposés par `src/level-info.ts` et les dossiers d’auteur ; leur correspondance figure aussi dans [la spécification](docs/specification.md#10-références-adaptations-et-preuves). Une référence de walkthrough ne constitue pas, à elle seule, une certification de reproduction exacte.

Les témoins établissent la jouabilité des salles par les commandes publiques. Ils ne prouvent ni optimalité, ni unicité, ni nécessité de chaque capacité. Leur rejeu n’est pas une résolution autonome par SRA ; ce lot ne modifie aucun apprentissage, planificateur ou arbitrage SIC.
