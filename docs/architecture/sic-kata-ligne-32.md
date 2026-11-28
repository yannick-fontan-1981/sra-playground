# KATA · préparer le placement d’une pièce annoncée en aperçu

## Critères avant changement

La ligne 32 relève de `preview_packing`. Son témoin KATA N1/T1 porte `ACTION6`. Le départ N1 du catalogue demande six niveaux, 600 gestes par niveau, une limite globale de 16 gestes et aucune curiosité ciblée. Un rejeu prolongé jusqu’à T19 examine la première pièce du niveau suivant. [Catalogue](sic-v8-strategies-observees.md?plain=1#L58) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L72)

| Étape | Épreuve préenregistrée |
|---|---|
| Avant T1 | Identifier les pièces visibles, la première pose visée et ce qui indique une sélection en aperçu. Séparer la partition géométrique du trajet encore inconnu. |
| Premier retour | Comparer le retour physique avec la même commande suivie d’une observation stationnaire. Vérifier l’identité sélectionnée, la couleur d’aperçu et la prochaine offre. |
| Réemploi dans une autre configuration | Suivre le modèle de translation acquis dans le premier niveau, sa reprise éventuelle et les deux premières sélections d’un autre ensemble de pièces. Vérifier le moment où le plan choisit une autre pièce et pourquoi elle devient admissible. |
| Retrait de preuve | Au même aperçu courant, retirer du modèle présenté au producteur les translations déjà mesurées et distinguer le premier geste de transport du premier geste de calibration, même s’ils portent la même commande. |

Le résultat doit relier le retour au même membre, à son masque, à la pose visée et à l’époque. Une couverture géométrique conditionnelle reste distincte de la progression officielle. [Producteur](../../src/logos-engine/v6-preview-packing.ts) · [Calcul de partition](../../src/logos-engine/v6-preview-packing-calculus.ts)

## Parcours sur le gel

Les 16 tickets de `8ce7ee35` et de `d0e7527ca8033bd805a6d7a8bb021eff62e87021` concordent. Ils retrouvent les **16/16** occurrences de la ligne 32. Un rejeu étendu à 33 gestes retrouve les trames et paquets de l’archive publique. Il atteint les deux sélections distinctes de N3 puis la frontière officielle. Les coordonnées de pose ci-dessous sont en [rangée,colonne]. Les points cliqués sont en (x,y). [Archive KATA](../migration/lot6a-evidence/integrated-final-02/kata-public-trace.json.gz) · [Tests du service](../../tests/sic-kata-line-32.test.ts)

| Étape | Preuve et comportement observable |
|---|---|
| **N1/T1 · pièce et cible** | La trame montre les pièces fixes 9 et 8 et une pièce mobile 14, ancre [0,5]. `previewPackingMeasureScene` fixe l’inventaire et le cadre. `previewPackingAssignments` donne une partition admissible avec cible [0,1] pour la pièce mobile. Le plan sélectionne `piece:2` au point (29,4). Le modèle porte encore `selected=null` et `preview_color=null`. L’aperçu effectif est acquis au retour du clic, quand les cellules du même masque passent uniformément à la couleur 0. |
| **N1/T2–T8 · préparer et vérifier le transport** | Le premier essai `ACTION1` ne déplace pas l’ancre [0,5]. T3 mesure [1,5] par `ACTION2`, T4 retrouve [0,5] par `ACTION1` et T5 date la translation de `ACTION3` égale à [0,−1]. T6 compile trois déplacements vers [0,3], [0,2] et [0,1]. La garde compare les poses intermédiaires. T8 atteint la frontière officielle. Le reçu de frontière ne certifie pas une pose finale mesurée dans l’ancienne trame. |
| **N2/T9–T16 · même point, autre pièce** | Le point (29,4) désigne maintenant la pièce mobile 8, tandis que 14 est fixe. La partition lui donne [0,1]. Le retour lie le nouvel aperçu au nouveau membre. Les contrôles acquis persistent et le fournisseur les réutilise après les essais de commande de N2. T16 ouvre N3. |
| **N3/T17–T25 · premier membre à placer** | Deux pièces sont mobiles, palettes 9 et 12. Deux partitions sont disponibles. Le classement conditionnel par coût dont le modèle dispose retient la cible [2,0] pour la première pièce, sélectionnée à (34,4). T18 consomme la translation `ACTION2` déjà mesurée et confirme [1,6]. À T25, la pose acquise de `piece:2` vaut [2,0]. |
| **N3/T26–T33 · membre suivant** | `previewPackingAssignments` est utilisé de nouveau. Le membre déjà à sa pose est écarté des pièces encore à déplacer. Le service sélectionne `piece:3`, palette 12, en (44,24), avec cible [2,1]. Le retour enregistre son propre aperçu. Les poses intermédiaires de la suite sont comparées au même masque, puis T33 ouvre N4. |

Le produit géométrique du calcul est une partition conditionnelle. Le retour de sélection lie seulement l’occurrence au masque d’aperçu. Les réceptions d’édition identifient les translations ou transformations et les tests de pose, tandis que la progression officielle est lue dans le retour de jeu. [Extraction et pose d’aperçu](../../src/logos-engine/v6-preview-packing-geometry.ts) · [Fournisseur et reçu](../../src/logos-engine/v6-preview-packing.ts)

## Épreuves

- **Même T1, aperçu absent.** Le paquet construit conserve l’image d’avant le clic. Le reçu indique `selection_observed=false`. L’occurrence et la couleur d’aperçu restent inconnues. Le ticket suivant repropose la sélection de la même pièce, avec la même commande pointée.
- **Même aperçu N3, translations retirées du calcul.** Au T18, le modèle présenté au fournisseur conserve le membre, la pose et la cible. Sa copie ne contient plus les contrôles acquis. Le service libère `ACTION1` comme calibration avec prédiction nulle. Le jeu maintient l’ancre [0,6]. À la décision suivante, les contrôles acquis redeviennent disponibles et `ACTION2` atteint la pose prévue [1,6].

Les retours de la calibration et de sa reprise viennent du jeu. Le témoin stationnaire après T1 est construit. Le lot attribue au gel le réemploi de la partition et des translations sur de nouveaux membres et de nouvelles configurations. Il ajoute le contrat de preuve et ses tests. [Paquets de la calibration alternative](../../tests/fixtures/sic-kata-alternate-returns.json.gz) · [Calcul de partition](../../src/logos-engine/v6-preview-packing-calculus.ts)

## Reproduire

Depuis la racine sous Node 24. Définir `SIC_KATA_GAME_ROOT` sur le checkout équipé de Pyodide et des archives Python pour jouer les variantes physiques. Définir `SIC_KATA_ENGINE_ROOT` pour importer explicitement le moteur du gel.

~~~powershell
node --test tests/sic-kata-line-32.test.ts
$env:SIC_KATA_GAME_ROOT = (Get-Location).Path
node --test tests/sic-kata-line-32.test.ts
node --test tests/v6-preview-packing-reference.test.ts tests/v6-preview-packing-native.test.ts tests/v6-preview-packing-integration.test.ts
~~~

Les trois tests de caractérisation et les 52 contrats de placement passent. Critères `d48683d5`. Le 27 novembre 2026 (UTC−3), préparation à 22 h 48 min 15 s, premier rejeu du gel à 22 h 48 min 54 s, contrat à 22 h 49 min 32 s et verdict local à 22 h 52 min 46 s, soit 4 min 31 s.
