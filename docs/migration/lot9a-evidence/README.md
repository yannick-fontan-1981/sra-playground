# Lot 9A : composant ChartNavigation et raccordement commun qualifiés

## Résultat courant

Le propriétaire `chart_navigation` est transféré et raccordé au caller réel. Le candidat atteint **70/76 entrées raccordées (92,1 %), dont 27/33 entrées matérielles**, sans revendiquer une parité V6 complète. Le [bilan machine](validation-summary.json) conserve les périmètres, les exécutions, les échecs et les réserves.

Le code qualifié est sauvegardé au commit **`9cabf9b98a5421c5541351d94788105f6b442ce2`**, poussé et vérifié sur `lot9a-chart-navigation-checkpoint-20261112`. La documentation de clôture peut avoir un commit ultérieur sans changer ces sources. Le checkout propre est `/workspace/sites/sra-lot9a-chart-navigation-20261112/.sites-checkout`, branche locale `lot9a-chart-navigation-20261112`.

Le [gel natif](candidate-native.json) comporte **334 fichiers**, digest canonique **`80173ed808e90e721939070f4d0087cba1d51fd396cc700dede3699333215bb7`**. Par rapport au gel publié 0.67, trois fichiers Chart sont ajoutés et seul `v6-native-runtime.ts` change parmi les fichiers natifs existants. Le programme compilé n'est pas régénéré : le workflow original était déjà présent.

**Le publié reste Site 108 / native 0.67.0**, source `8462204043aa368faa7df280d796bb706eb53b38`, à 69/76. L'[observation du Site](site-observation.json) du 12 novembre 2026 conserve sa source, son accès propriétaire privé et son état actif. Le candidat conserve provisoirement le littéral de développement 0.67.0, mais ses sources et son digest sont différents. Aucun numéro final, enregistrement Site ou déploiement 9A n'a été effectué.

## Contrat transféré

Les sources originales sont celles du commit immuable `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, dossier `agents/yf_arc3_v6/morphology_policy/chart_navigation`. Le port reprend le propriétaire, la policy et la géométrie locale, ainsi que le seul chemin V5 consommé : `ChartNode`, `ChartLink`, `ChartFragment`, `_chart_decode` et le reçu mécanique associé. Les autres services de navigation V5 restent partiels.

Le contrat conserve les coordonnées rationnelles exactes, les liens orientés réellement divulgués, les alternatives de localisation et le choix d'une direction commune à toutes les alternatives. Une annotation statique ne devient pas un objet possédé. Une perte d'inventaire ne devient une permission que dans le contexte local et sous les conditions de frontière originales. Les digests restent des SHA-256 complets ; les clés de points et d'arêtes gardent leur forme Python.

La policy exécute `v6.chart_navigation.choose` et le callback `chart.select`, avec le tri exact priorité, distance, action, index. Elle ne relâche aucune autorité d'action. Le propriétaire est consulté à la **position matérielle source 24**, après `ordered_reaction`. L'acquisition passive suit Channels, Regions, Chart, Recolor ; Channels et Regions restent à transférer. Le propriétaire actif n'est pas acquis une seconde fois par cette voie.

Le caller transmet le paquet d'images intermédiaires, conserve `chart_navigation_event:<revision>` et publie/restaure `chart_navigation_state` seulement si une carte ou une méthode portable existe. Le checkpoint natif complet reste distinct et conserve les **14 champs** source. Les refus de délai ou d'abandon sont locaux à l'invocation et à l'observation courante ; ils n'ajoutent aucune preuve physique.

## Vérifications obtenues

| Volet | Résultat frais |
| --- | ---: |
| Référence originale, policy et séquences de composant | **134/134 tests** |
| Frontière native, checkpoints et interruption | **11/11 tests** |
| Raccordement et acquisitions du caller commun | **6/6 tests** |
| Cinq modules de régressions affectées | **24/24 tests** |
| **Total des passages réussis retenus** | **175 tests, 8 modules** |
| Audit des entrées | **70/76**, zéro entrée partielle |
| Audit de migration final | **219 composants vérifiés, 149 transferts partiels, 1 001 modules en attente**, aucun échec d'inventaire |
| Build final avec TypeScript | **Passé** |

Les 24 régressions couvrent les checkpoints communs, les replays publics HANO, SYME et DNOI, les tickets du service, les horloges, les entrées ordonnées, OrderedReaction et Recolor. Les suites historiques ne sont pas ajoutées aux 175 tests frais. Aucun nouveau succès de jeu n'est déduit de ces replays.

Le [corpus indépendant](reference-01/QUALIFICATION.md) comporte **29 observations directement en 64 × 64**, 30 cas géométriques, 80 opérations du propriétaire, 15 cas DRM/SRC et quatre séquences froides. Les 723 fichiers source consommés sont vérifiés contre le manifeste original. La fixture compressée a pour SHA-256 `0770706db16249ac4ab1c7c8b9533d571f2fc2cdaeaf5dae2d990806e412cfe8`.

Le [manifeste du build](build-manifest.json) couvre 74 fichiers, 30 149 887 octets. Le worker construit est `dist/assets/v6-agent-worker-CHbq5p5y.js`, SHA-256 `87e4e87e3d676c8556dfdbb23d34e7611dd87643825d7fccd2beb8d961112d65`. Il s'agit d'un build local, pas d'une preuve de déploiement ou de transport navigateur.

## Contribution et restauration dans le caller réel

La seconde tentative commune qualifiée utilise les groupes de sélection de la factory de production, sans forcer la priorité Chart et sans injecter un état appris. Elle comporte cinq sessions initialisées et une factory supplémentaire pour le seul contrat d'enregistrement.

| Cas du passage qualifié | Retours physiques | Acquisitions actives Chart | Acquisitions passives Chart | Acquisitions supprimées |
| --- | ---: | ---: | ---: | ---: |
| Gain, perte, image intermédiaire et permission locale | 3 | 3 | 0 | 0 |
| Ancre actuelle contraire | 1 | 1 | 0 | 0 |
| Ablation de l'acquisition | 1 | 0 | 0 | 1 |
| Action étrangère, scène identique | 2 | 1 | 1 | 0 |
| Action étrangère, scène changée | 2 | 1 | 1 | 0 |
| **Total** | **9** | **6** | **2** | **1** |

Les deux cas passifs commencent par une acquisition froide réelle puis désactivent la sélection Chart par l'édition de graphe officiellement supportée. `observed_frontier` choisit l'action étrangère. Chart reçoit ce retour une seule fois, avec proposition `null` et toutes les images, et conserve ou retire sa position conformément à la référence.

L'ablation conserve le retour physique dans le caller mais retire l'acquisition Chart. La continuation apprise disparaît : l'offre revient à la dépendance d'annotation. Ce test ne revendique pas nécessairement un changement de commande physique.

Dans la séquence primaire, **trois restaurations réelles du fait source** sont observées. Deux remises à froid contrôlées s'ajoutent à ces appels et expliquent le diagnostic `sourceRestores: 5`. Six appels à `restoreNative` sont instrumentés. Ces appels ne sont ni six acquisitions ni six états distincts. Le [lecteur indépendant](common-independent-review.json) conserve cette distinction. Aucun niveau officiel résolu n'est revendiqué.

## Échecs conservés et corrections délimitées

Les deux reçus de l'oracle original restent en statut **`failed`**. Le premier a terminé les cas mais refusé les imports tardifs lors de la clôture. La reprise a vérifié les imports avant leur exécution, terminé les contrôles et écrit le gzip, puis échoué lors de la création des métadonnées d'un chemin relatif. Aucun troisième oracle n'a été lancé. Le cumul est **90,423350 secondes sur 120**, dans la limite de deux tentatives.

La récupération séparée et sa [revue indépendante](reference-01/independent-recovery-review.json) n'exécutent aucun source. Elles établissent l'égalité profonde des 154 enregistrements et des séquences, l'identité des bruts des deux tentatives, et la concordance des empreintes. Cette récupération qualifie le corpus écrit ; elle ne transforme aucun wrapper échoué en wrapper réussi.

La première tentative commune conserve ses deux réussites et quatre échecs. La seule correction remplace un comparateur textuel sensible à l'ordre des membres JSON par une égalité structurelle complète. Le source et les observations restent identiques ; aucun champ n'est retiré. La seconde tentative passe les six cas.

Le premier audit de migration conserve son rapport échoué : deux archives historiques complètes étaient absentes du nouveau checkout. Les [deux concaténations opaques](reference-materialization.json), issues de parties déjà suivies dans Git, reproduisent exactement les archives vérifiées. Aucun oracle, jeu ou contenu décodé n'a servi à cette préparation. Le second audit passe.

## Réserves précises

Le protocole commun annonçait `maximumSessions: 8` sans préciser si la borne était par lancement ou cumulée. Les observations réelles sont **cinq sessions par lancement, dix cumulées**, et deux factories d'enregistrement séparées. Les **14 retours cumulés** restent sous la borne de 24, et les deux lancements respectent leurs délais et leur nombre maximal. Le bilan ne prétend pas satisfaire une borne cumulative de huit sessions. Les déclarations suivantes devront distinguer explicitement les deux plafonds et conserver cet historique.

La [revue statique](static-review.json) a conduit au rejet atomique des structures imbriquées malformées et des coordonnées de pixels négatives. Cette validation n'authentifie pas un état externe et ne garantit pas que des coordonnées positives artificiellement forgées tiendront dans une future trame. Aucun producteur source nominal de ce cas n'a été identifié.

Ce jalon ne qualifie ni un nouveau trajet public Chart par worker/navigateur, ni une campagne différentielle complète des graphes, ni les sessions longues, ni le coût officiel. Les six portes globales du lot 11 restent fausses. LKEY demeure définitivement fermé.

## Feuille de route immédiate

1. Qualifier les formes de livraison et les graphes exécutés de 9A, en conservant ce corpus et ses cas contraires. Déclarer sans ambiguïté les limites par lancement et cumulées, sans effacer les tentatives précédentes.
2. Vérifier le prédécesseur réellement publié, réserver une identité de version distincte et établir le gel final.
3. Mesurer le coût officiel sous exclusivité courte. Chaque médiane globale, STCK et SMLP séparément, doit augmenter de **strictement moins de +10 %**. Un dépassement de phase reste admissible si les deux globaux passent, sans élimination d'échantillon ni compensation entre jeux.
4. Publier sous exclusivité courte, avec le même accès privé, puis poursuivre **9B `region_intervention`** et **9C `joint_channels`**. `discrete_network` reste hors compteur 76.

Le travail courant, les tests fonctionnels, les commits et les push ont été réalisés **sans verrou global ni attente de disponibilité d'un autre lot**. Aucun verrou de performance ou de publication n'a été acquis dans ce jalon, et aucun fichier de verrou n'a été supprimé.
