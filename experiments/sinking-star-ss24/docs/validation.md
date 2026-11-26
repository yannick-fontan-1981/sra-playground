# SS24 — validation de la livraison

**Les Voies de Traverse** comporte huit cartes finalisées, le quatuor **Marchand / Voleur / Magicien / Barde** et **37 découvertes** dans le niveau 1. Les preuves ci-dessous appartiennent à cette campagne. Elles ne reprennent aucun résultat de SS23 comme qualification de SS24.

## Résultats sur l’état final

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Tests du laboratoire | **129/129**, zéro échec ou test ignoré | [unit-tests.json](../validation/unit-tests.json) |
| Rejeu et contrat public | **8 victoires**, **1 051 entrées**, **176 sélections**, **2 875 images**, aucun refus ni décès | [levels-report.json](../validation/levels-report.json) |
| Tutoriel | **37/37** sur N1, aucune acquisition dans les autres salles | Rapports niveaux et interface |
| HTML compilé | **42 configurations de rôles**, huit parcours complets, pixels/durées exacts et Undo de chaque fin | [ui-dom-report.json](../validation/ui-dom-report.json) |
| Conception | **5 revues, 92 contrôles**, variantes et contre-branches reproductibles | [design-report.json](../validation/design-report.json) |
| Diversité géométrique | Huit terrains distincts, aucun doublon exact parmi **80 cartes SS14–SS23**, symétries incluses | Rapport de conception |
| Adaptateur et dispatcher natifs | **98/98 tests**, incluant Custom 4 et SS21/22/23, exit 0 | [native-tests-report.json](../../../docs/migration/ss24-evidence/native-tests-report.json) |
| Continuité SIC | Les **41 niveaux protégés** existants passent leurs contrôles de séries et d’effets physiques | [sic-continuity-report.json](../../../docs/migration/ss24-evidence/sic-continuity-report.json) |
| Compilation du Site | TypeScript et build réussis ; galerie **124 jeux / 828 aperçus** | [build.txt](../../../docs/migration/ss24-evidence/build.txt) |
| Interface native dans Chrome | Manual, départ N1, huit salles, **VICTORY** visible ; Undo final puis reprise vérifiés | [chrome-manual-report.json](../../../docs/migration/ss24-evidence/chrome-manual-report.json) |

Le contrôle DOM a révélé une attente de couleur héritée de SS23 dans le validateur de campagne : elle attendait un Guerrier rouge au lieu du Voleur vert. Cette assertion a été corrigée, puis la totalité du contrôle HTML a réussi. Aucun changement du moteur jouable n’a été nécessaire pour cette correction du test.

## Parcours reproduits

| Niveau | Salle | Entrées, sélections incluses | Sélections | Images publiques de campagne |
| --- | --- | ---: | ---: | ---: |
| 1 | L’atelier des départs | 212 | 38 | 575 |
| 2 | L’escalier à rebours | 154 | 36 | 392 |
| 3 | Les tiroirs décalés | 118 | 21 | 313 |
| 4 | Le pas et la visée | 85 | 21 | 215 |
| 5 | Le relais interrompu | 127 | 21 | 344 |
| 6 | Trois postes, un seul retour | 122 | 15 | 342 |
| 7 | La place qui restera sûre | 92 | 11 | 273 |
| 8 | Le dernier pas sans échange | 141 | 13 | 421 |
| **Total** | **Huit victoires** | **1 051** | **176** | **2 875** |

Les 875 autres entrées sont des actions physiques. Ces nombres décrivent les témoins d’auteur et non une longueur optimale. Le contrôle isolé de N1 compte 574 images ; le rejeu en campagne en compte 575, car il ajoute l’image initiale de N2. Cette différence attendue ne change ni les 212 entrées ni les 37 découvertes.

Les observations, leurs images intermédiaires et les durées sont comparées entre moteur, session, adaptateur et dispatcher. Chaque entrée de sélection est contrôlée pour ne modifier que le héros actif. Chaque action des témoins produit un changement et reste sans refus ni décès. Undo annule chaque transition de niveau, puis sa répétition reproduit exactement l’observation finale.

Le rejeu Chrome utilise les flèches, Tab et X du canvas public. Les huit transitions ont été observées dans une même session Manual. Le panneau final porte « VICTORY · Les quatre destinations sont occupées ». Le dernier geste a ensuite été annulé et rejoué ; le panneau disparaît puis revient. Ces deux contrôles supplémentaires ne font pas partie des 1 051 entrées du témoin. Les empreintes des fichiers jouables sont conservées dans le rapport Chrome. Ce test porte sur l’aperçu natif local ; la correspondance de la publication est contrôlée séparément par ses SHA.

## Conception et variantes

Les revues N1, N2, centrales, finales et indépendante totalisent respectivement **13, 9, 24, 29 et 17 contrôles**. La dernière exécute directement les actions numériques avec `stepDetailed`, sans `Author`, solveur ni fonction de rejeu des auteurs. Elle vérifie les ressources, les transports, les appuis, les contacts et les quatre destinations réellement occupées.

Les variantes connues restent admises. N2 peut gagner en 180 entrées sans chant. N3 peut créer un passage supplémentaire dans son unique case d’eau et gagner en 83 entrées. N4 permet un échange initial suivi de la récupération du Voleur, en 97. N5 peut déclencher la presse en tirant le Magicien, sans chant, en 123. N8 possède notamment une variante indépendante de 137 entrées qui échange avant de chanter la caisse ; le témoin de 141 chante d’abord le Magicien puis échange. Ces variantes conservent des contraintes différentes et empêchent de confondre un chemin d’auteur avec une nécessité générale.

Le contrôle des marches gèle les ressources, recalcule les circuits au départ du héros et teste aussi un modèle généreux ignorant les autres héros comme obstacles. Aucune salle n’offre dans ce modèle une affectation des quatre buts par simple marche individuelle. Il ne s’agit pas d’une recherche exhaustive des coopérations : les mécanismes de déplacement, les retours et les réorganisations peuvent ouvrir d’autres stratégies. Les essais locaux ne prouvent pas une impasse globale après une erreur.

Le [dossier des sources](source-audit.md) distingue les idées des walkthroughs des règles effectivement présentes dans SS24. Le contrôle géométrique détecte les répétitions exactes de terrain ; il ne certifie ni l’originalité subjective ni le niveau de difficulté.

## Artefact autonome et correspondance

- Fichier : **SS24-demo.html**, **153,039 octets**.
- SHA-256 : `1871dfedeffe3e5992b260bb75733c724ca60605b63ecda957f2523ec3d169b7`.
- Format : un document HTML autonome, un script local, aucun chargement réseau requis pour jouer.
- Les huit cartes et les aides publiques sont incluses ; les témoins, solveurs et scripts d’auteur sont exclus.
- Le [manifeste](../validation/delivery-manifest.json) lie cet HTML aux rapports et aux sources exactes.

Le champ `nativeBrowserSession: false` du manifeste est limité à son périmètre : il qualifie le laboratoire autonome par Happy DOM. La session Chrome native de SRA Playground est une preuve distincte, liée à ses propres sources et au rapport ci-dessus.

## Reproduire les contrôles

Dans le laboratoire, après installation des dépendances épinglées :

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
node scripts/package-delivery.mjs
```

À la racine du dépôt :

```sh
node --test tests/ss24-native.test.ts tests/custom4-native.test.ts tests/ss21-native.test.ts tests/ss22-native.test.ts tests/ss23-native.test.ts
npm run typecheck
npm run test:sic-continuity
npm run build
```

Les résultats doivent être régénérés si les sources correspondantes changent. Une reprise sans modification peut réutiliser les preuves de l’état exact et vérifier seulement la concordance nécessaire. La campagne n’altère ni l’apprentissage, ni le planificateur, ni l’arbitrage de SIC. Aucune résolution autonome de SS24 par SRA n’est revendiquée.

## GitHub et publication

La branche de travail est `feat/sinking-star-ss24-20261126`. Le premier jalon a été poussé au SHA `bcb3e0828472e0cee9cc6de31a7a4945ccd01951`. Il s’agit d’une sauvegarde intermédiaire, antérieure aux cartes et aux rapports finaux.

La [PR 128](https://github.com/yannick-fontan-1981/sra-playground/pull/128) porte l’intégration sur `main` et le reçu de publication : SHA local, SHA poussé, commit intégré, version Site, SHA source et concordance. Le Site est publié uniquement depuis l’état canonique qui contient cette campagne. Une reprise consulte les valeurs réelles de la PR et des deux services ; elle ne repasse pas à la base historique SS23.
