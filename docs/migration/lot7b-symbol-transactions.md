# Lot 7B — transactions symboliques

## État : développement vérifié, intégration finale à faire

Le propriétaire `public_symbol_transaction` est porté et raccordé à l'entrée
`observed_symbol_transaction`. Le développement part de **Site 83**, commit
`bed48116585da864dd5c412ed11dd6990a950e8e`, qui clôt 7A/native 0.52.
Le candidat 7B n'est pas encore publié : il doit intégrer les publications
effectives de 5A et 4B, passer ses contrôles finaux et sa fenêtre de coût.

La campagne de développement CRAF réussit **trois niveaux en 36 actions**,
toutes sélectionnées par le nouveau propriétaire. Les connaissances acquises au
premier niveau permettent ensuite 27 propositions d'interface. Cette contribution
est établie séparément de la fidélité des composants et du contrôle de coût à venir.

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

## Preuves de développement

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
Le script exécuté et son reçu restent conservés. Le validateur final préparé
sépare le choix physique, la méthode et le but des changements de justification.

### Identité du premier gel

Le gel de développement est identifié par
`19c42b388245a7c4c6bc515f11be40be91fbd0645f6a756f00a9b95f567c1465`
sur **284 fichiers natifs**, avec une archive de **295 fichiers**. L'étiquette de
version reste celle de la base 0.52 pendant ce développement ; ce digest distingue
le candidat de la version publiée. Aucun numéro de livraison 7B n'est encore revendiqué.

Les sources sont restées inchangées pendant CRAF. Le temps de cas cumulé conservé
est de **383,465343 secondes**, avec **2 016,534657 secondes restantes** sur le
plafond de 40 minutes. Le compteur est suspendu pendant le travail général
d'intégration et de livraison, et sera repris sans remise à zéro pour les
vérifications supplémentaires du cas.

## Limites et étapes encore nécessaires

La réussite est actuellement celle du candidat de développement sur la base
publiée 7A. Les changements communs de 5A et 4B doivent être intégrés depuis leurs
commits réellement publiés avant la validation finale. Les suites requises et
les régressions des prédécesseurs seront préservées, puis exécutées sur ce candidat.
La vérification navigateur et les captures complètes des états et faits Symbols
après chaque préfixe restent à produire sur ce gel final.

La mesure de coût n'a pas commencé. Elle comparera le candidat au dernier
prédécesseur publié, dans une fenêtre exclusive. Le protocole conservera les
32 sessions mesurées et exigera une augmentation de la médiane complète
strictement inférieure à 10 % pour chacun des jeux de référence. Les phases
défavorables et les percentiles élevés resteront publiés.

La parité de tout l'appelant Python n'est pas établie par ces comparaisons de
composants. Les types Python malformés ou nominaux qui n'existent pas dans le
contrat JSON natif sont présentés séparément dans l'oracle de géométrie ; aucune
parité hors de ce domaine public n'est revendiquée. Les helpers V5 de journal
d'ajouts de cadres, non consommés par 7B, restent hors du transfert.

La [filiation détaillée](lot7b-symbol-transactions-lineage.md) relie les contrats
aux implémentations et consommateurs. Les preuves se trouvent dans
[`lot7b-evidence`](lot7b-evidence/README.md).
