# SS16 — qualification

La version **0.1.0** est qualifiée sur les huit cartes finales. Les résultats faisant autorité sont les rapports JSON générés à partir du moteur, des cartes et du HTML livrés.

## Résultats du lot livré

| Vérification | Résultat |
|---|---|
| Compilation TypeScript stricte et construction du HTML autonome | Réussies |
| Tests du moteur et de la session | **36 / 36**, aucun échec ni test ignoré |
| Parcours de référence | **8 / 8** gagnants, les trois héros vivants |
| Entrées rejouées | **1 064**, dont **108 sélections** |
| Images d’animation et durées contrôlées | **3 078 images** |
| Mouvements refusés / morts dans les parcours de référence | **0 / 0** |
| Découvertes pédagogiques dans le niveau 1 | **20 / 20**, en 158 entrées |
| Scénarios ciblés dans le HTML | **24** : 17 de rôles, 3 de réflexion, 2 de glyphes, 2 d’interférence de miroirs |
| Campagne rejouée dans le HTML compilé | **8 / 8**, pixels, temporisations, annulation et rejeu de chaque victoire |
| Revue de conception | Réussie dans les périmètres documentés ci-dessous |

Commandes exécutées depuis `experiments/sinking-star-ss16` :

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Le HTML final mesure **123 971 octets**. Son SHA-256 est :

```text
ba288a63c7c0ac0b92613e6a95b23395bbcb0c2f255b6e1cd12260dddc3b6c39
```

Il est construit sous `dist/SS16-demo.html` et livré sans changement de contenu sous le nom `SS16-demo-v1.html`. `validation/delivery.json` conserve cette empreinte. Le fichier fonctionne sans réseau et ne contient ni témoins de solution ni outils d’auteur.

| Salle | Entrées du parcours de référence | Images vérifiées |
|---|---:|---:|
| 1 — L’atelier des trois passeurs | 158 | 476 |
| 2 — Récupérer avant de combler | 214 | 610 |
| 3 — Lâcher le miroir, garder son poids | 160 | 445 |
| 4 — Le quai des deux impulsions | 64 | 182 |
| 5 — La relève du gardien | 86 | 258 |
| 6 — Le chantier avant la marée basse | 82 | 230 |
| 7 — Les deux postes du miroir | 120 | 350 |
| 8 — Le gardien et les trois lests | 180 | 527 |

## Vérifications disponibles

- `tests/trio.test.mjs` : 36 tests de capacités, interactions du trio, eau, miroir, commandes, presses, combat, rendu, animation et session.
- `scripts/validate-levels.mjs` : huit témoins de solvabilité, contrat public, images et durées, progression, étapes d’auteur et couverture du tutoriel.
- `scripts/verify-ui-dom.mjs` : vrai HTML compilé exécuté dans Happy DOM, événements clavier/boutons/clic, buffers du canvas, temporisation contrôlée, interruptions et huit salles.
- `reference/author/review-level1.mjs` : reproduction de deux anciens raccourcis gagnants, blocage dans la carte corrigée et recherches directes restreintes.
- Audits des finales et contre-branches de construction : voir les scripts de `reference/author/` et les rapports de `reference/`.

Les vingt découvertes sont obtenues dans le niveau 1 par un parcours réel. Aucune donnée sémantique privée ni condition pédagogique n’est nécessaire pour gagner.

`validation/design-report.json` agrège cinq contre-branches locales des niveaux 2 à 4, vingt contrôles de conception des niveaux 5 à 8, ainsi que les revues indépendantes du tutoriel et des finales. Les cartes compilées sont comparées aux huit spécifications de référence ; les presses et boutons sont distincts, et aucune sortie n’est accessible par simple marche dans l’état initial à circuits fixes.

La revue indépendante du tutoriel reproduit deux anciens raccourcis gagnants et vérifie leur blocage sur la carte corrigée. Elle exécute **96 recherches restreintes**, soit **9 576 états** et **47 880 transitions**, avec toutes les files épuisées.

La revue indépendante des finales reproduit trois anciens raccourcis sur des cartes historiques immuables, puis vérifie leur rejet sur les cartes finales : transport de héros évitant le chantier du niveau 7, traversée sans appui permanent au niveau 8, et maintien du pont hydraulique jusqu’à la sortie du niveau 8. Trois sondes géométriques ou locales bornées complètent cette revue. Une solution alternative élaborée du niveau 8 reste acceptée : **224 entrées**, un appui permanent, les trois héros vivants et aucun mouvement refusé. Elle conserve la clef de réserve, les deux charges de presse, les poids de commande et le retrait des plateformes ; deux appuis permanents ou un miroir utilisé comme lest ne sont donc pas annoncés comme des nécessités globales.

## Portée et limites

Un témoin gagnant prouve une possibilité de terminer. Les comptes d’actions sont ceux de parcours explicatifs, sélections comprises ; ils ne mesurent pas la difficulté et ne sont pas annoncés comme des minimums.

L’audit du tutoriel conserve les ressources et les deux autres héros fixes lors de ses recherches locales. Les files épuisées prouvent seulement l’absence de solution dans ce modèle restreint. La chambre finale a une entrée sèche par la porte `(18,4)` et une frontière d’eau en `(14,3)` : elle n’est pas décrite comme entièrement murée. Le parcours utilise la presse pour produire l’appui hydraulique et rapprocher les monstres ; la nécessité exclusive de cette presse pour créer cet appui n’est pas démontrée.

Les tests Happy DOM vérifient le HTML et ses interactions, pas le rendu CSS réel d’un navigateur. La prévisualisation native a été tentée puis arrêtée : lancement CLI empêché par les sockets de l’environnement, entrée native indisponible, puis protocole `file:` refusé par la politique du navigateur fourni. Aucun contournement n’a été tenté après ce refus. `validation/browser-review-status.json` conserve cette limite.

Le laboratoire ne modifie pas le runtime partagé de SRA Playground. Il ne fournit aucune mesure de résolution autonome par SRA. Le raccordement natif, le contrôle visuel ordinateur/mobile et la publication du Site seront qualifiés lors de l’étape d’intégration.
