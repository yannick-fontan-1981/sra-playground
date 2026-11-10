# Lot 7B — transactions symboliques

## Candidat intégré et preuves figées

Le propriétaire `public_symbol_transaction` est porté et raccordé à l'entrée
matérielle `observed_symbol_transaction`, avec son état distinct de Workshop.
Les validations fonctionnelles finales portent sur **native 0.55.0**, après
intégration du véritable prédécesseur 4B **Site 87**, commit
`dd355400264b50942486559b8ca56ee6dfc6a3cc`, native **0.54.0**. Les identités sont
conservées dans le [reçu de publication du prédécesseur](lot7b-evidence/coordination/published-4b-site87.json)
et sa [liaison au baseline](lot7b-evidence/coordination/published-base-binding.json).

Le gel final contient **291 fichiers natifs** et une archive de **302 entrées**.
Son digest est
`ea25603262a7473e5ab9994d2e2e86dd64a8291dd7c1dc18ede4d1f443cdc53b` ;
le commit conservé avant mesure est `ab0829f`.
Le [manifeste source](lot7b-evidence/integrated-final/source-manifest.json),
l'[archive déclarée](lot7b-evidence/integrated-final/source-archive.json) et le
[reçu d'intégrité](lot7b-evidence/integrated-final/delivery-integrity.json)
identifient les octets réellement validés. La publication 7B et le verdict de coût
ont leurs sections distinctes ci-dessous.

<!-- LOT7B_INTEGRATED_RESULTS_START -->
## Résultats fonctionnels intégrés terminés

| Preuve finale | Résultat observé | Reçu |
| --- | --- | --- |
| Périmètre formel hérité et contrats Symbols | **4 327/4 327 tests**, **112 fichiers**, aucun échec, skip, todo ou annulation | [Tests officiels](lot7b-evidence/integrated-final/validation/delta-tests-run.json) |
| Vérifications de livraison | **5/5** : types, entrées, migration, diff et build ; sources inchangées | [Checks et worker compilé](lot7b-evidence/integrated-final/validation/checks-run.json) |
| Régressions publiques conservées | **8/8 cas, 136/136 contrôles**, 309 actions, 227 préfixes, 24 frontières | [Résumé des régressions](lot7b-evidence/integrated-final/regressions/regression-summary.json) |
| LKEY partiel conservé | **157/157 contrôles** ; résultat brut toujours `failed`, **2/3 niveaux**, arrêt `frontier_unknown` | [Qualification partielle](lot7b-evidence/integrated-final/lkey-partial/qualification.json) |
| CRAF froid sur le gel final | **3 niveaux, 36 actions et 36 préfixes**, sélection Symbols par la stratégie commune | [Exécution finale](lot7b-evidence/integrated-final/execution-craf.json) |
| Rejeu du Python original | **144/144 appels et 432/432 comparaisons exactes** | [Parité de composant](lot7b-evidence/integrated-final/original/craf-public-parity.json) |
| Checkpoints et restaurations réellement observés | **36 préfixes, 252/252 contrôles**, **72 appels `restoreNative`** capturés | [Même reçu, preuve de checkpoint](lot7b-evidence/integrated-final/original/craf-public-parity.json) |
| Navigateur sur le build final | **3 niveaux CRAF, 36 actions**, Pause et incrément d'une action observés, même session de raisonnement | [QA navigateur](lot7b-evidence/integrated-final/browser/browser-qa.json) |

Les huit régressions couvrent CATR, RSWP, FOGW, VOIS, CONN, MIND, WEAV et TRIA.
Elles rejouent leurs retours publics archivés et conservent leurs critères
déclarés ; elles ne constituent pas huit nouvelles campagnes live. LKEY reste
un rejeu partiel distinct : 25 commandes, 26 paquets, 25 préfixes et deux
frontières sont conservés, sans prétendre avoir résolu le troisième niveau.

Le rejeu original de CRAF part d'une instance froide et reconstruit son état à
partir des appels publics effectivement atteints. **Aucun état appris natif
n'est injecté dans le Python.** Les 36 préfixes sont reliés aux arguments et
résultats des véritables restaurations natives, puis à l'état vivant observé ;
les 72 appels `restoreNative` sont conservés séparément des 144 appels source.
La comparaison exécutée comprend l'enveloppe, les faits, les événements et les
gardes ordonnées, avec `--require-checkpoints`.

Les ablations du rejeu final suppriment **27 propositions** lorsque les méthodes
acquises sont retirées, et **18** lorsque la liaison courante est retirée. Les
quatre cas liés au compteur de transitions gardent **la même décision physique
avec des preuves différentes**. Ces contre-factuels consomment les états
reconstruits par l'original ; ils ne sont pas des campagnes live supplémentaires.
Le [rapport de contribution](lot7b-evidence/integrated-final/original/craf-contribution.json.gz)
conserve les détails et les limites.

L'horloge cumulée du cas, sans remise à zéro, est arrêtée à **1 646,100543 secondes**,
avec **753,899457 secondes restantes** sur 40 minutes. Le
[checkpoint final immuable](lot7b-evidence/integrated-final/craf-case-checkpoint-final.json)
conserve le cumul après campagne intégrée, comparaison originale et QA navigateur.
Ces preuves ne revendiquent pas la parité de sélection de tout l'appelant Python.
<!-- LOT7B_INTEGRATED_RESULTS_END -->

## Comportement ajouté

La famille dispose des deux chemins de la source : un guide mesuré dans l'image,
ou une méthode d'interface acquise et revalidée. Le repli n'a lieu que lorsque la
projection du guide manque ou que son activation échoue. Une ambiguïté du guide
activé reste une abstention.

Les callbacks `symbols.measure` et `symbols.select` exécutent réellement le
workflow existant `v6.symbol_transactions.choose`. Les règles déclarées
s'appliquent dans leur ordre, les offres équivalentes sont regroupées par action
entière, et les alternatives de lignes affichées sont conservées. Les listes
d'opérandes restent ordonnées ; les multiplicités sont comparées où la source
les exige, sans inventer les quantités de stock inconnues.

La proposition `symbol_transaction_plan` distingue le cadre mesuré et l'entité
qui possède le point cliqué. La garde vérifie l'action disponible, l'observation,
l'époque, le score officiel, l'image, l'entité, sa signature et les faits courants.
L'action conserve un effet inconnu et son retour scelle le préfixe avant acquisition.

L'état appartient à un propriétaire distinct de Workshop. **Seul le retour de sa
proposition sélectionnée appelle son enregistrement.** Une action étrangère peut
continuer à renseigner l'atelier, sans devenir un essai de transaction symbolique.
Les tests de la fabrique commune établissent cette différence avec le même retour.

## Connaissances acquises et revalidation

L'interface acquiert les contrastes de sélection, chargement, transformation et
réception. À une frontière officielle, la présence de ces quatre effets permet
de construire une méthode conditionnelle. Au niveau suivant, les supports et
leurs signatures doivent être retrouvés ; une méthode ancienne n'autorise pas
une action à elle seule.

Les cinq champs source sont conservés : époque, rejets, événements, compteur de
transitions et état d'interface. Les méthodes et réfutations historiques survivent
aux changements d'époque, tandis que les échantillons, contrastes et liaison
courante de l'interface sont remis à zéro. Les reçus utiles à la revalidation
restent bornés ; les pixels masqués, les quantités exactes et les recettes non
essayées restent inconnus.

Une action sans changement discriminant ajoute un rejet dans son contexte. Une
méthode dont le contraste attendu manque peut être réfutée dans l'époque courante.
Une modification visible ne confirme ni un rôle acquis ni une loi universelle.
L'enveloppe native valide atomiquement les sauvegardes et renouvelle les mesures
et gardes après restauration. Elle reste distincte du fait source conservé par
l'appelant commun.

## Jalon historique : preuves de développement

Le développement partait de **Site 83**, commit
`bed48116585da864dd5c412ed11dd6990a950e8e`, clôture 7A/native 0.52. Les preuves
ci-dessous restent celles de ce premier jalon, distinctes du gel intégré 0.55.

| Preuve | Résultat observé | Portée |
| --- | --- | --- |
| Géométrie V5/V6 | **124/124 tests**, oracle de 121 cas sur 31 rasters | Mesures, coordonnées, doublons, multiensembles, bornes et refus |
| Interface | **78/78 tests**, huit retours d'apprentissage source | Contrastes réellement acquis, méthode à la frontière, offres, réfutations, reçus, restauration et bornes |
| Propriétaire | **73/73 tests** | Deux chemins, SRC/DRM, regroupement, garde, retour, états et enveloppe native |
| Fabrique et boucle commune | **4/4 tests** | Propriétaire unique, ordre source, sélection réelle, OP18/29/30/31, retour unique, refus après absence d'effet et restauration autoritaire |
| Sélection du cas | **100 scènes publiques**, un seul candidat : CRAF | Source froide, zéro action, zéro moteur de jeu importé |
| CRAF froid | **3 niveaux, 36 actions, 36 préfixes** | Une session normale, moteur de jeu opaque et succès officiels |
| Rejeu Python indépendant | **144/144 appels**, **432/432 contrôles exacts** | 36 propositions, 36 gardes avant, 36 retours de garde, 36 acquisitions |

Les oracles vérifient les **1 786 fichiers originaux** avant et après leur
exécution. Aucune connaissance native capturée n'est injectée dans le rejeu
Python : une instance originale froide reconstruit son propre état. Ses exports
et restaurations utilisent seulement cet état reconstruit.

Le petit guide synthétique de l'oracle est légitimement préempté par
`field_service_composition` dans la stratégie complète. Le diagnostic est conservé.
Le test positif de la fabrique utilise donc la scène initiale publique de CRAF,
où la stratégie normale choisit réellement Symbols. Son retour sans effet est
explicitement contrôlé ; ce test n'est pas confondu avec la campagne réelle.

### Contribution observée sur CRAF

| Niveau | Actions réelles | Chemin |
| --- | ---: | --- |
| 1 | 9 | Guide mesuré ; acquisition des contrastes et méthode à la frontière |
| 2 | 11 | Interface revalidée à partir de la méthode acquise |
| 3 | 16 | Interface revalidée et liaison courante |

Les **36 actions** appartiennent à Symbols, avec **36 acquisitions actives et
aucune acquisition étrangère**. La première proposition d'interface survient à
la révision 10, après acquisition d'une méthode au premier niveau.

Les contre-factuels sont calculés à partir des propres états du rejeu original,
en gardant la situation publique fixe. Retirer les méthodes supprime les
**27 propositions d'interface** ; retirer la liaison courante en supprime **18**.
Ces résultats montrent la consommation des connaissances par les décisions
suivantes. Ils ne sont pas une nouvelle campagne où le jeu aurait été rejoué
sans ces connaissances.

Le premier analyseur classe quatre effets de l'ablation du compteur de
transitions comme `decision_changed` parce que sa description de décision
comprend les références de règles. Cette étiquette ne prouve pas un clic différent.
Le script exécuté et son reçu restent conservés. Un second rejeu des mêmes
144 appels avec le validateur renforcé confirme **quatre changements de preuves
pour la même décision**, et les mêmes 27/18 propositions supprimées par ablation.
Il relie aussi chacune des 36 actions à sa proposition source et à ses gardes
ordonnées. La capture historique ne contient aucun bloc de checkpoint complet.
Elle conserve cette limite ; les nouveaux blocs du gel intégré et leurs
restaurations observées ont ensuite été vérifiés avec `--require-checkpoints`,
comme indiqué dans les résultats finaux ci-dessus.

### Identité du premier gel

Le gel de développement est identifié par
`19c42b388245a7c4c6bc515f11be40be91fbd0645f6a756f00a9b95f567c1465`
sur **284 fichiers natifs**, avec une archive de **295 fichiers**. L'étiquette de
version restait celle de la base 0.52 pendant ce développement ; ce digest
distinguait le candidat de la version publiée. Il ne désigne pas le gel final 0.55.

Les sources sont restées inchangées pendant cette campagne de développement.
À ce jalon, le cumul conservé était de **847,684697 secondes**, avec
**1 552,315303 secondes restantes**. Les vérifications intégrées et navigateur
ont repris ce même compteur sans remise à zéro ; le checkpoint final cité
ci-dessus donne le cumul courant.

<!-- LOT7B_COST_FINAL_START -->
## Coût : accepté selon le critère global pré-déclaré

La [décision globale et sa revue indépendante](lot7b-evidence/performance-integrated/owner-growth-review.json)
acceptent **2/2 jeux**, avec **3 927/3 927 contrôles**. La médiane du coût complet
reste strictement sous **+10 % pour chaque jeu**, sans compensation entre jeux.
Les huit sessions par jeu et version sont réunies avant le calcul ; les valeurs
ci-dessous reprennent l'affichage arrondi des [résultats complets](lot7b-evidence/performance-integrated/results.md).

| Jeu | Sessions A / B | Médiane A, ms | Médiane B, ms | Variation globale | Décision |
| --- | --- | ---: | ---: | ---: | --- |
| STCK | 8 / 8 | 10 885,500 | 10 643,030 | **−2,227459 %** | Accepté |
| SMLP | 8 / 8 | 16 007,482 | 16 123,439 | **+0,724394 %** | Accepté |

La [fenêtre officielle](lot7b-evidence/performance-integrated/window.json)
**A1/B1/B2/A2**, du **10 novembre 2026 à 23:32:46 UTC** au
**23:41:23 UTC**, est terminée avec statut et intégrité finale **`passed`**.
Elle conserve **32 sessions mesurées et 400 actions** ; seules les **8 chauffes
et leurs 24 actions** sont exclues. Aucune session mesurée, valeur extrême ou
cohorte défavorable n'a été retirée.

La [clôture d'isolation](lot7b-evidence/performance-integrated/coordinated-isolation-completion.json)
est `passed` : les cinq fichiers de statut des autres fils sont restés identiques
octet pour octet. Le [verrou exclusif](lot7b-evidence/performance-integrated/performance-lock-completion.json)
a couvert toutes les séries et a été libéré à **23:41:23 UTC**.

### Diagnostics défavorables conservés

L'[agrégat](lot7b-evidence/performance-integrated/owner-growth-comparison.json)
compte **16/16 diagnostics de médiane dans le seuil**. Chacune des deux cohortes
reste à **15/16**, avec son statut `budget_review_required` et son dépassement
`over_budget_with_noise_unresolved` conservé :

- Cohorte 1, STCK `known_prefix_guard` : **+13,614846 %**.
- Cohorte 2, SMLP `new_decision` : **+15,024264 %**.

Les p95 agrégés défavorables SMLP restent publiés : **+16,264866 %** pour
`known_prefix_service`, **+12,644657 %** pour `known_prefix_guard`, et
**+13,016930 %** pour `acquisition_and_persistence`. Ces diagnostics ne sont
ni supprimés par le verdict global ni une attribution causale au propriétaire
Symbols. Les [comparaisons des deux cohortes](lot7b-evidence/performance-integrated/results.md)
conservent leurs échantillons, leurs dispersions et tous leurs percentiles.

### Qualification structurelle et refus strict distinct

Le [protocole](lot7b-evidence/performance-integrated/protocol.md), la
[déclaration](lot7b-evidence/performance-integrated/declaration.json) et le
[contrat structurel](lot7b-evidence/performance-integrated/owner-growth-contract.json)
ont été fixés avant mesure. Ils lient le baseline réel Site 87/native 0.54 au
candidat gelé 0.55. La qualification fonctionnelle préalable a passé
**64/64 contrôles**, et sa
[revue indépendante](lot7b-evidence/diagnostic/final-cost-qualification-independent-review.json)
**44/44**.

L'agrégateur historique strict a réellement échoué sur l'identité des
métadonnées de travail ; son [refus et son journal](lot7b-evidence/performance-integrated/aggregation-failure.json)
restent conservés avec `exitCode: 1`. Il n'est pas présenté comme passé.
La consolidation qualifiée distincte compare **432 écarts structurels** aux
formes fixées avant mesure, sans tolérance ajoutée aux autres champs ni aux
signatures complètes au sein de chaque version. **Aucun outil, règle ou temps
n'a été corrigé après mesure.** Le [rendu des résultats](lot7b-evidence/performance-integrated/results-render.json)
confirme `inputReceiptsUnchanged: true`.

Les captures structurelles STCK/SMLP ont **zéro enregistrement actif Symbols**.
Leurs 35 deltas attribués sont 27 états du propriétaire et huit installations ;
aucun nouveau fait, événement ou fragment acquis Symbols n'y apparaît.
La mesure sur ces formes ne qualifie donc pas le coût d'une trajectoire Symbols
active telle que CRAF. Aucun résultat de cette trajectoire n'est extrapolé aux
formes de coût, ni inversement.
<!-- LOT7B_COST_FINAL_END -->

<!-- LOT7B_PUBLICATION_FINAL_START -->
## Publication 7B : résultat à consigner

Le prédécesseur effectivement publié est Site 87. Les contrôles et le build du
candidat 0.55 sont terminés, mais aucun déploiement 7B n'est revendiqué ici.
Le commit envoyé, la version Site, le statut terminal et leurs reçus seront
consignés après la publication effective.
<!-- LOT7B_PUBLICATION_FINAL_END -->

## Portée et limites conservées

La parité de tout l'appelant Python n'est pas établie par ces comparaisons de
composants. Les types Python malformés ou nominaux qui n'existent pas dans le
contrat JSON natif sont présentés séparément dans l'oracle de géométrie ; aucune
parité hors de ce domaine public n'est revendiquée. Les helpers V5 de journal
d'ajouts de cadres, non consommés par 7B, restent hors du transfert.

La [filiation détaillée](lot7b-symbol-transactions-lineage.md) relie les contrats
aux implémentations et consommateurs. Les preuves se trouvent dans
[`lot7b-evidence`](lot7b-evidence/README.md).
