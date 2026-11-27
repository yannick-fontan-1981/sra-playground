# UPST · départager les explications d’un clic

## Contrat de qualification de la ligne 16

La branche part de `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. L’inventaire historique vient de `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`. Depuis L1, les deux moteurs choisissent trois fois `observed_frontier`, puis `information_goal / point_contrast / experiment` au tour 4 et `observed_frontier` au tour 5. Le premier contraste de la ligne 16 est le clic en (21,13). Le besoin parent est `G_protocol_completion`. La ligne 15 de LOGI a un autre producteur et conserve son propre verdict.

| Expérience enregistrée avant les variations | Critère |
|---|---|
| Repartir de L1, relever toutes les offres et la mémoire avant chaque ticket | Les retours des trois premiers clics expliquent pourquoi T4 est le premier contraste. Le point choisi doit séparer des prédictions encore vivantes et produire un plan admis. |
| Garder la même observation de T4, les mêmes actions, le même budget et les mêmes règles, puis changer uniquement la preuve disponible | Une comparaison déjà épuisée ou privée de son témoin positif doit disparaître. La nouvelle élection ou la reprise de la frontière doit identifier une autre question. Distinguer ce cas construit du tour historique. |
| Rattacher la mesure du support au ticket | Chaque prédiction gelée reçoit son verdict, les paires testées entrent en mémoire et le tour suivant doit découler des options encore ouvertes. |
| Rejouer EVAS L1 depuis un état neuf | Le producteur de points et l’élection natifs doivent servir un autre besoin, mesurer son retour puis libérer un autre essai. |

Le crédit fonctionnel sur le gel demande les trois preuves distinctes de réemploi, variation causale et retour suivi d’une reprise. Une extraction de production n’est justifiée que si une décision nécessaire reste locale au jeu.

## Du préfixe public à la reprise

Le témoin de la matrice est « Départager les explications possibles d’un clic », ligne 16. L’inventaire compte cinq commandes pour ce triplet. Une ligne désigne une stratégie, quel que soit le nombre de ses tickets. Le rejeu repart de L1 avec le pack natif par défaut, une limite de session de 16 commandes et un plafond de 600 par niveau, comme dans la capture historique. Sur UPST, les 16 commandes, les projections de décisions et de retours enregistrées, ainsi que les 17 observations publiques historiques concordent entre `8ce7ee35` et `d0e7527c`. Le gel fournit en plus la palette. La fixture publiée s’arrête à T5 sur UPST et T16 sur EVAS. [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L56) · [Inventaire](sic-v8-strategies-observees.md?plain=1#L42) · [Lanceur](../../tests/helpers/sic-qualification.ts)

| UPST L1 | Preuve avant l’action | Ticket et mise à jour |
|---|---|---|
| T1 et T2 | Aucun clic antérieur n’a changé son support. Le producteur de contrastes renvoie une liste vide. | La frontière libère `ACTION6(10,17)` puis `ACTION6(10,1)`. Les deux retours laissent les pixels du support inchangés. |
| T3 | Les deux essais sans changement sont en mémoire. | La frontière propose `ACTION6(10,31)`. Son retour est le premier changement local mesuré. Il fonde trois modèles encore compatibles, `pattern`, `ring` et `signature`, dans l’époque et l’état courants. |
| T4 · options | À la révision 4, image `8bca50d987f9fdee`, les trois modèles prédisent tous « inchangé » pour (53,17). Le point est adressable mais ne produit aucune offre discriminante. Les points (21,13), (42,13) et (52,31) opposent tous la signature aux deux autres modèles. Aucune offre des afficheurs, du mouvement ou d’un producteur supplémentaire n’entre dans l’élection. | La séparation garantie est 1/3. L’élection compare les relations, puis départage les ex æquo par leur commande stable. Le reçu compte trois offres admissibles et zéro rejet à l’élection. La suppression de (53,17) a déjà eu lieu chez le producteur. |
| T4 · exécution | Le besoin `distinguish_public_hypotheses` lie les relations au composant `component:278760af31efc691:0`. Les prédictions sont gelées sur ce support, pour cette observation. | `selectInformationStrategy` obtient un plan d’un pas. Le garde admet le point et le service libère `ACTION6(21,13)` pour `C_information_3933a7d377dfe34b0b87`. Le jeu change le support. `signature` concorde, `pattern` et `ring` sont contredits. Le reçu porte le même objectif et la référence de l’observation suivante. |
| T5 | Les deux paires comparées sont mémorisées. Les deux modèles réfutés désignent le retour de T4 comme contre-exemple. Le producteur ne trouve plus de point discriminant. | Le service reprend `observed_frontier / test_local_input` avec `ACTION6(12,1)`. Le support demeure inchangé. |

**Deux variations construites sur la présentation exacte de T4.**

- Au niveau de l’élection, on conserve les trois offres et on remplace uniquement la référence courante de l’offre (21,13) par celle de l’observation précédente. Le reçu donne deux offres admissibles et un rejet `stale`. La nouvelle question porte sur le support de (42,13). Ce test porte sur la sélection, sans exécuter cette alternative.
- Au niveau du service, on rejoue les trois vrais tickets et leurs retours. Juste avant l’élection de T4, on inscrit dans la mémoire les deux paires signature/pattern et signature/ring comme déjà comparées. Les observations, options, modèles et budgets restent identiques. Le producteur fournit zéro offre. Le garde admet une nouvelle question de frontière en (10,48). Cette histoire de comparaisons est construite pour éprouver le contrat.

**Second contexte natif, EVAS L1.** Un service neuf joue les quatorze premiers tickets. À T15, onze offres départagent sept modèles. Le clic (31,30) produit un changement. Trois modèles concordent et quatre sont contredits. T16 ouvre un autre sous-objectif, compare exactement les trois survivants, cite le retour précédent et retient (32,35) parmi cinq offres. Cette fois le support est inchangé. Une prédiction concorde et deux sont contredites. Le même producteur sert ainsi un autre jeu et un nouveau besoin. La preuve publiée couvre ces deux préfixes de L1, sans verdict sur les autres occurrences historiques ni sur une campagne complète.

## Frontière et attribution

`SceneRelations.features` lie une coordonnée au support observé. `contrastModels`, `forecast` et `contrastOffers` partent des essais locaux, écartent les modèles réfutés, les points déjà testés dans ce contexte et les paires sans contraste neuf. `PointExperimentMemory.offers` fournit les expériences. `pointGoal` traduit chacune en offre au format commun. `NativeCallerCoordinator.informationOffer` réunit les producteurs. `electInformationGoals` vérifie la portée, les prédictions distinctes et les conditions de préservation, puis classe les offres. `selectInformationStrategy` sollicite un plan pour l’offre retenue. [Producteur](../../src/logos-engine/v6-point-contrasts.ts#L162) · [Adaptation et élection](../../src/logos-engine/v6-information-goals.ts#L11) · [Appelant](../../src/logos-engine/v6-native-caller.ts#L439) · [Sélection](../../src/sic/information-strategy.ts#L35)

La commande passe ensuite par le garde du moteur. Au retour, `PointExperimentMemory.observe` mesure les pixels de l’occurrence liée avant le clic, vérifie la liaison de l’expérience et enregistre les paires. `reconcileInformationGoal` compare la mesure aux prédictions gelées. Le moteur publie `sic_information_return` sous l’objectif libéré. Un changement d’époque ou une fin de partie ferme la portée de la mesure. [Mesure](../../src/logos-engine/v6-point-contrasts.ts#L170) · [Raccord au retour](../../src/logos-engine/v6-native-caller.ts#L557) · [Réconciliation](../../src/logos-engine/v6-information-goals.ts#L79) · [Reçu](../../src/logos-engine/v6-native-runtime.ts#L1840)

| Ligne | Référence de production | Preuve ajoutée | Statut |
|---|---|---|---|
| 15 · LOGI, 24 commandes dans l’inventaire | `d0e7527c`, `coupled_displays` | Tests `7bf3c85a` sur LOGI et REWI. Contrat TypeScript `48472784` à émission JavaScript identique. | Une stratégie fonctionnellement composable sur le gel. [Parcours et commandes LOGI](https://github.com/yannick-fontan-1981/sra-playground/blob/48472784f1ee59b1117dddb53ef5c9fced929ec8/docs/architecture/sic-logi-ligne-15.md) |
| 16 · UPST, 5 commandes dans l’inventaire | `d0e7527c`, `point_contrast` | Critères `5e1280ac`, puis fixture publique et trois tests sur cette branche. | Une autre stratégie fonctionnellement composable sur le gel. Le réemploi, la variation de question et le retour suivi d’une reprise sont attestés sur le moteur existant. |

Pour LOGI, les qualifications indépendantes sont acquises. L’opérateur retrouve neuf départs sur chacun des trois SHA. Le Banc reproduit 22 des 24 occurrences historiques et vérifie les 9 977 octets de JavaScript émis. Le typage ajoute zéro stratégie au décompte. Pour UPST, le présent verdict provient du rejeu de production et des contre-épreuves de cette branche. [Opérateur LOGI, 3351f379](https://github.com/yannick-fontan-1981/sra-playground/blob/3351f37932bc527f2851ec21f6a1cc40cb000187/experiments/symbolic-situations/logi-ligne-15/BILAN.md) · [Banc LOGI, bbe4450e](https://github.com/yannick-fontan-1981/sra-playground/blob/bbe4450e6529e9ff20bd4cc2569f6efa86f760db/docs/diagnostics/sic-qualification-logi-48472784.md)

Le lot ajoute uniquement les témoins de la ligne 16. Les décisions requises appartiennent déjà au producteur de contrastes, au sélecteur et au moteur. L’arbre de production est identique à celui du gel. [Assertions sur UPST et EVAS](../../tests/sic-information-points.test.ts) · [Fixture publique](../../tests/fixtures/sic-point-contrasts-public.json.gz)

## Reproduction

Les trois caractérisations passent sur fixture. Les quatre suites passent 117/117 avec les jeux sources. Depuis la racine du lot, avec Node 24, la première commande rejoue les observations de la fixture. Pour le jeu source, désigner un checkout contenant `public/python` et `public/vendor/pyodide`. Le test charge le niveau 1, transmet chaque commande du service au jeu et vérifie chaque paquet renvoyé avant de le soumettre au moteur. Le cas construit utilise exclusivement la fixture. Empreinte SHA-256 du fichier compressé `72ba64fea5d81508bda021561dcdc0b913360b36c8014e2824f10c9b55607c22`.

```powershell
node --test tests/sic-information-points.test.ts
$env:SIC_POINT_GAME_ROOT = (Resolve-Path ../sic-cartographie-p05).Path
node --test tests/sic-information-points.test.ts tests/v6-point-display.test.ts tests/v6-goal-attention.test.ts tests/v6-control-attention-reference.test.ts
Remove-Item Env:SIC_POINT_GAME_ROOT
git diff --exit-code d0e7527ca8033bd805a6d7a8bb021eff62e87021 HEAD -- src
```
