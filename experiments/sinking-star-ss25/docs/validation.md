# SS25 — validation de la livraison

**Les Derniers Équilibres** comporte huit cartes finalisées, le quatuor **Guerrier / Voleur / Magicien / Barde** et **39 découvertes** au niveau 1. Les résultats ci-dessous proviennent des sources et des témoins SS25 réellement rejoués. Ils ne reprennent pas la qualification de SS24.

Les contrôles du laboratoire, du HTML compilé, de la conception et de l’adaptateur natif ont réussi. Le rejeu **Chrome Manual N1→N8** est également terminé, avec victoire officielle et Undo final vérifiés. La continuité SIC est également qualifiée ; la traçabilité de publication est portée par le reçu de la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130).

## Résultats acquis

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Tests du laboratoire | **137/137**, zéro échec, annulation ou test ignoré ; exit 0 | [unit-tests.json](../validation/unit-tests.json), [log](../validation/unit-tests.txt) |
| Rejeu des entrées publiques | **8 victoires**, **1 209 entrées**, **201 sélections**, **3 296 images**, aucun refus ni décès | [levels-report.json](../validation/levels-report.json) |
| Tutoriel | **39/39 découvertes** sur N1, aucune acquisition dans les autres salles | Rapports des niveaux et du HTML |
| HTML compilé | **45 configurations de rôles** et **8 parcours de campagne**, pixels et durées exacts, Undo de chaque fin | [ui-dom-report.json](../validation/ui-dom-report.json) |
| Conception | **4 revues, 97 contrôles** réussis ; revue indépendante de **25 contrebranches locales** | [design-report.json](../validation/design-report.json) |
| Diversité géométrique | Huit terrains distincts ; aucun doublon exact parmi **88 cartes SS14–SS24**, rotations et symétries incluses | Rapport de conception et [revue indépendante](../reference/independent-ss25-review.json) |
| Adaptateur et dispatcher natifs | **102/102 tests**, zéro échec, annulation ou test ignoré ; exit 0 | [native-tests-report.json](../../../docs/migration/ss25-evidence/native-tests-report.json) |
| Interface native dans Chrome | Une session **Manual N1→N8**, **39/39 découvertes** en N1, panneau officiel **VICTORY**, Undo final puis reprise vérifiés | [chrome-manual-report.json](../../../docs/migration/ss25-evidence/chrome-manual-report.json) |
| Vérification TypeScript | Réussie à la racine | [typecheck.txt](../../../docs/migration/ss25-evidence/typecheck.txt) |
| Build du Site | Réussi ; galerie **125 jeux / 836 aperçus** | [build.txt](../../../docs/migration/ss25-evidence/build.txt) |
| Manifeste du laboratoire | Produit après succès des quatre rapports de qualification | [delivery-manifest.json](../validation/delivery-manifest.json) |

Le contrôle du HTML s’exécute avec **Happy DOM**, le tampon de pixels du canvas et une file d’animation contrôlée. Il vérifie les commandes clavier, les boutons, les clics, Tab et Maj+Tab, les avertissements de reflet, le rayon revenant, la défaite et la victoire. Undo, Reset, Restart et le choix de niveau interrompent les animations sans laisser une ancienne image repeindre le jeu. La réduction des animations est également contrôlée. Cette preuve n’est pas une session visuelle dans Chrome.

## Parcours reproduits

| Niveau | Salle | Entrées, sélections incluses | Sélections | Images publiques de campagne |
| --- | --- | ---: | ---: | ---: |
| N1 | Le chantier des quatre gestes | 216 | 38 | 588 |
| N2 | Le quai à deux réceptions | 123 | 21 | 339 |
| N3 | Les deux formes du pont | 212 | 26 | 587 |
| N4 | La cale que l’on reprend | 159 | 24 | 434 |
| N5 | La cale qui change de côté | 124 | 19 | 341 |
| N6 | Le dernier usage de la butée | 151 | 39 | 378 |
| N7 | Le retour de la troisième charge | 134 | 19 | 378 |
| N8 | Les deux accès avant le retour | 90 | 15 | 251 |
| **Total** | **Huit victoires** | **1 209** | **201** | **3 296** |

Les **1 008 autres entrées** sont des actions physiques. Ces nombres décrivent les témoins livrés ; ils ne sont ni des minima ni une mesure de difficulté. La revue isolée de N1 compte **587 images** ; son exécution en campagne en compte 588, car elle ajoute l’image initiale de N2. Les deux rejouent les mêmes 216 entrées et acquièrent les mêmes 39 découvertes.

Les cartes, les informations de niveau et les actions numériques correspondent à leurs JSON d’auteur. Les témoins terminent avec quatre héros vivants sur quatre destinations, sans refus ni décès. Les observations, les images intermédiaires et les durées sont comparées entre le moteur, la session, l’adaptateur et le dispatcher. Les sélections utilisent les coordonnées de pixels publiques et n’avancent pas les mécanismes. Undo restaure chaque transition de niveau ; la reprise du dernier geste reproduit l’observation attendue.

Le détecteur pédagogique reçoit uniquement les champs publics nécessaires, y compris des copies JSON de `level`, `frame`, `frames` et `levelsCompleted`. Il ne consulte pas la carte privée ou le témoin. Les découvertes restent une aide d’apprentissage : aucun quota ne conditionne la victoire.

Le [rejeu Chrome](../../../docs/migration/ss25-evidence/chrome-manual-report.json) utilise les flèches, Tab et X sur le canvas public, en **une seule session Manual depuis N1**. Les **1 209 entrées et 201 sélections** des huit témoins sont rejouées et les transitions sont observées. Le compteur affiche **39/39 découvertes** à la fin de N1 ; N8 termine sur le panneau officiel **VICTORY · Les quatre destinations sont occupées**.

Un clic sur Undo masque ensuite ce panneau ; la touche **ArrowDown** rejoue le dernier geste et le rétablit. Ces deux commandes de vérification sont séparées des 1 209 entrées du témoin. Le rapport conserve les empreintes des sources natives et des huit cartes et listes d’actions. Il qualifie la jouabilité dans l’aperçu natif ; la concordance de la publication reste une vérification distincte. Les captures ont été inspectées pendant la session, sans revendiquer de fichiers de capture exportés.

## Conception, contrebranches et variantes

| Revue | Contrôles réussis | Portée | Rapport |
| --- | ---: | --- | --- |
| Introduction | 12 | N1, 39 découvertes, transports passifs, ressources et Undo | [intro-ss25-review.json](../reference/intro-ss25-review.json) |
| Salles centrales | 34 | N2–N4, relèves, pont reconfiguré et réemploi de la cale ; neuf contrebranches consignées | [middle-ss25-review.json](../reference/middle-ss25-review.json) |
| Salles finales | 35 | N5–N8, parcours principaux, variantes gagnantes et conséquences locales | [final-ss25-review.json](../reference/final-ss25-review.json) |
| Indépendante | 16 | Huit témoins, 25 contrebranches, suppressions de segments et comparaison avec SS24 | [independent-ss25-review.json](../reference/independent-ss25-review.json) |

La revue indépendante transmet directement les actions numériques à `stepDetailed`, sans importer `Author`, les générateurs de parcours ou le solveur. Elle recompte les métriques, vérifie les états jalonnés, les circuits et les ressources, puis compare les huit témoins SS24 exécutés par leur propre moteur. Les contrôles des différentes revues peuvent porter sur une même interaction ; leurs nombres ne constituent pas 97 problèmes indépendants ni un score de difficulté.

Les variantes gagnantes sont conservées, avec leurs actions et leur portée :

- **N1, 214 entrées** : omission de la première démonstration de traction, sans rendre les leçons obligatoires pour gagner. La revue d’introduction conserve aussi une permutation de trois arrivées à 216 entrées.
- **N5, 131 entrées** : relève manuelle avec interruption puis rétablissement du service, sans chant. La relève chantée du témoin maintient le service en continu, mais n’est pas une obligation générale.
- **N6, 130 entrées** : installation du Magicien au-dessus avant le dépôt final. Le transport tardif par traction puis poussée répond au placement du témoin, et n’est pas nécessaire dans toutes les stratégies.
- **N7, 139 entrées** : premier pas du retour avant la fin de la troisième livraison, tant que la première commande reste tenue.
- **N8, 74 entrées** : extraction du Magicien après l’ouverture des plateformes. Son départ précoce de la poche n’est pas une nécessité générale.

Le témoin de N2 utilise le Barde comme opérateur de commande sans chant ; celui de N5 n’utilise aucun échange volontaire du Magicien. La coopération n’est pas artificiellement imposée par un compteur de pouvoirs. Le Guerrier pousse les files, mais reste vulnérable aux monstres. Dans N8, les deux monstres disparaissent par contact mutuel ; aucune condition de victoire ne compte leurs éliminations.

Les graphes de marche gèlent les caisses, miroirs, appuis et monstres, recalculent les circuits quand le héros quitte une commande et excluent les contacts orthogonaux avec les monstres. Le modèle généreux ignore les autres héros comme obstacles tout en conservant leurs poids. Aucune salle n’offre dans ce modèle une affectation des quatre buts par marche individuelle. Ce contrôle borné ne simule ni la coopération complète ni les déplacements forcés des presses.

Les contrebranches établissent des effets depuis les postes précis testés. Un refus, une plateforme retirée ou une porte fermée ne prouvent pas une impasse irréparable. Les suppressions de segments rejouent le suffixe avec les intentions de sélection conservées ; leur échec n’exclut pas un autre plan. Les variantes gagnantes restent légales.

Le [dossier des sources](source-audit.md) distingue les idées adaptées des règles effectivement présentes dans SS25. La comparaison de 88 terrains normalise les occupants, recadre les murs extérieurs et considère les huit symétries du plan. Elle détecte les reprises exactes, sans mesurer la ressemblance thématique, l’originalité subjective ou le temps de résolution humain. La difficulté visée par rapport à SS24 repose sur les coordinations et changements d’usage des ressources, sans classement universel démontré.

## Artefact autonome et correspondance

- Fichier : **SS25-demo.html**, **159 970 octets**.
- SHA-256 : `358f1e976aca5754f07a3e9a851d25716b8c8dbf814474a2c88b0c2d24efd895`.
- Format : document HTML autonome ; aucun chargement réseau requis pour jouer.
- Les huit cartes et les aides publiques sont incluses ; les témoins, solveurs et scripts d’auteur sont exclus du jeu livré.
- Le [manifeste](../validation/delivery-manifest.json) conserve les empreintes de cet HTML, des sources et des quatre rapports du laboratoire.

Le champ `nativeBrowserSession: false` est limité au périmètre du manifeste : le laboratoire autonome et son contrôle Happy DOM. Il ne représente pas le statut de la session Chrome native, contrôlée séparément, ni celui de la publication du Site.

## Continuité et traçabilité de livraison

Le contrôle `npm run test:sic-continuity` a réussi : **78 niveaux protégés, 13 jeux et 11 cohortes**, avec vérification des séries réellement exécutées, de leur clôture et des effets physiques. Le [rapport](../../../docs/migration/ss25-evidence/sic-continuity-report.json) et le [log](../../../docs/migration/ss25-evidence/sic-continuity.txt) conservent le résultat ; les 11 traces comprimées et leurs empreintes permettent sa relecture. Aucun apprentissage, planificateur ou arbitrage SIC n’est modifié par SS25.

Consulter le reçu de livraison de la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130) pour les opérations qui suivent la qualification : SHA final poussé, commit intégré sur `main`, version Site, SHA source publié et concordance. Ce reçu distingue le contrôle local, les vérifications GitHub et la publication. La [note d’intégration native](../../../docs/migration/ss25-native-integration.md) relie les mêmes preuves.

## Reproduire les contrôles

Dans le laboratoire, avec les dépendances épinglées :

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
node scripts/package-delivery.mjs
```

À la racine du dépôt :

```sh
node --test --test-reporter=tap tests/ss25-native.test.ts tests/custom4-native.test.ts tests/ss21-native.test.ts tests/ss22-native.test.ts tests/ss23-native.test.ts tests/ss24-native.test.ts
npm run typecheck
npm run test:sic-continuity
npm run build
```

Les preuves doivent être régénérées si leurs sources changent. Une reprise sans modification vérifie la correspondance de l’état exact avant de réutiliser les rapports. Les témoins démontrent la jouabilité ; ils ne prouvent ni optimalité, ni unicité, ni résolution autonome de SS25 par SRA.

## Traçabilité GitHub et Site

Branche de travail : `feat/sinking-star-ss25-20261126`.

| Jalon | SHA | Portée |
| --- | --- | --- |
| Base historique | `4a546a139f9064422c078ef5f40b8c22133c39a8` | État canonique utilisé au départ de SS25 |
| Premier checkpoint poussé | `a5b023acbcf7fbfa63b1d7e64aed8b66da80cee2` | Moteur, intégration native et atelier de 39 découvertes |
| Deuxième checkpoint poussé | `fce2d03ebe994370e79034f589c2ec411a781bc9` | Cartes et parcours intermédiaires ; antérieur à la clôture de livraison |

**Référence de clôture : le reçu de livraison de la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130).** Les checkpoints ci-dessus sont des sauvegardes intermédiaires ; les SHA finaux et la version Site sont relevés dans ce reçu après les opérations effectives.
