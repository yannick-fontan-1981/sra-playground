# SS21 — feuille de route

## Campagne 0.1.0 : Les Quatre Destinations

SS21 est le premier quatuor de la série : **Marchand / Guerrier / Voleur / Magicien**, sans Barde. Ses huit salles commencent par **L’école des quatre**, un atelier de **31 découvertes**. Les sept autres problèmes alternent chambres isolées, manutention d’un miroir, boucle optique, interception, conservation des occupants, écluse et gardien utilisé comme poids.

| Étape | État et preuve |
| --- | --- |
| Huit cartes, sources et parcours complets | Réalisé — `reference/level1-design.json` à `level8-design.json`. |
| Moteur à quatre rôles et tutoriel public | Réalisé — 103 tests réussis, sans échec ni test ignoré. |
| Campagne depuis N1 | Réussie — huit victoires, 1 486 entrées dont 208 sélections, aucun refus et aucune perte. |
| Tutoriel | 31/31 découvertes acquises à partir des pixels publics, uniquement au N1. |
| HTML autonome | `dist/SS21-demo.html` ; identité et qualifications dans `validation/delivery-manifest.json`. |
| Conception et variantes | Revues d’introduction, du milieu, de finale et indépendante ; portée de chaque conclusion explicitée. |
| Intégration native | Raccordement réalisé — 86 tests natifs et typage réussis ; vérification de continuité SIC avant publication. |
| Sauvegarde et publication | GitHub canonique ; pousser et intégrer sur main avant publication du Site existant. |

Les témoins prouvent la solvabilité. Leurs compteurs ne sont ni des minima ni des quotas de victoire. Une résolution autonome par SRA doit être qualifiée séparément.

## Avancement de la série

La création de SS21 porte la série à **21 campagnes sur 25 (84 %)**, soit **168 salles sur 200**. Ce décompte concerne les campagnes créées, pas les performances de l’agent. Les quatre compositions restantes couvrent chacune l’absence d’un des quatre personnages présents dans SS21 :

| Composition restante | Personnage absent |
| --- | --- |
| Guerrier / Magicien / Voleur / Barde | Marchand |
| Marchand / Magicien / Voleur / Barde | Guerrier |
| Marchand / Guerrier / Voleur / Barde | Magicien |
| Marchand / Guerrier / Magicien / Barde | Voleur |

**Prochaine étape de création : SS22**, puis SS23–SS25, soit 32 salles. Le quatuor précis de chaque numéro restant doit suivre le plan de série confirmé ; cette livraison n’en réattribue pas l’ordre.

## Traçabilité

- Baseline GitHub et Site au début de cette reprise : `a4af366b4b8c7d4b882b876f3cbe7aa617784af3`, après intégration native de SS20 ; Site version 193.
- Checkpoint SS21 conservé : copie locale `2e21bbe`, sauvegarde GitHub `67766259472fa3db6f5a73c83ea8d08d47292e54` sur `feat/sinking-star-ss21-20261124` ; les deux arbres Git sont identiques (`f36d740fc08fcda73e7c69ff16438336940ffe68`).
- Qualification et documentation du laboratoire : `feat/ss21-completion-20261124`.
- Intégration native : `feat/ss21-playground-20261124`.
- Le compte rendu final consigne le commit poussé, son intégration, la version Site et son SHA source vérifiés.

[Jouer à SS21 sur le Site existant après publication](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS21#playground).
