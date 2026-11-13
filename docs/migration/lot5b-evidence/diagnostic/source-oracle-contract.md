# Contrat de l’oracle indépendant AddressedMaterial

## Résultat obtenu et portée

L’export canonique exécute les sources Python originales immuables et conserve **14 helpers, 19 chaînes froides et 522 opérations**, sans exception source dans ce corpus. Les **1 786 fichiers** du manifeste original sont vérifiés avant et après l’exécution. Le [reçu d’export](source-oracle-export.json) contient leurs empreintes, celles des imports réellement consommés et celles de l’exporteur et de la fixture.

La [seconde exécution du test de référence](addressed-reference-tests-attempt-02.log) passe **35 tests sur 35**. Pour chaque opération de chaîne, elle compare le retour et toutes les variables source sur trois propriétaires : un propriétaire continu, un propriétaire reconstruit par `state`/`restore`, et un propriétaire reconstruit par `nativeState`/`restoreNative`. Après chaque opération, deux propriétaires détachés vérifient également les propositions et les obligations après les deux voies de restauration. Ces appels détachés ne changent pas les propriétaires qui rejouent le corpus original.

Les images sont des données publiques synthétiques déclarées. Ces résultats prouvent les contrats de composants couverts et les extensions de restauration. La sélection effective par l’appelant commun, sa conservation exactement une fois et la contribution en jeu ont leurs preuves séparées. Aucune réussite de jeu réel ni mesure de vitesse ne découle de cet oracle.

## Autorité source

La référence est `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les imports directs sont `common_addressed_material`, `common_addressed_field`, `common_field_stock` et `common_linked_preparation`. Les quatorze modules originaux réellement importés sont ceux-ci :

- `common_addressed_field`, `common_addressed_material`, `common_containment`, `common_field_stock` ;
- `common_linked_contact`, `common_linked_preparation`, `common_multiscale_constraints`, `common_phase_relations` ;
- `common_visible_identity`, `geometric_observer`, `neutral_observer`, `observed_input_domain` ;
- `terminal_composition`, `typed_material_observations`.

Leurs fichiers et empreintes figurent dans `importedOriginalModules` du reçu. Les sources originales ne sont ni copiées dans une réimplémentation d’oracle ni modifiées. Aucun moteur de jeu, aucune spécification cachée, aucune solution et aucun résultat TypeScript ne fournit une attente Python.

## Couverture des retours publics

| Groupe | Évidence dans les chaînes originales |
|---|---|
| Acquisition froide | Proposition initiale inconnue ; commande `ACTION1` disponible, sans effet ; disponibilité publique ensuite limitée à `ACTION6` ; premier clic avec témoin stationnaire et homologue unique. |
| Calibration | Contraste non colinéaire ; comparaison des hypothèses rivales ; contour transitoire ; essai hors contour sans effet ; essai sur le contour avec effet ; passage à la navigation. |
| Chemin | Proposition de navigation contenant au moins deux clics ; gardes avant et après chaque retour ; budget nul. |
| Liaison courante | Observations complètes et protocolaires ; référence périmée ; niveau, score, action disponible, corps, exemplaire ou homologue modifié. |
| Refus et réfutation | Plusieurs résidus possibles ; deux homologues ; exemplaire manquant ; données d’adresse incomplètes ou supplémentaires ; action différente ; déplacement non aligné ; absence d’effet à distance déjà acceptée. |
| Frontière | Rappel des hypothèses après score officiel ; création paresseuse du stock à partir du contexte acquis ; refus du stock sans borne rejetée ou sans enceinte compatible. |
| Stock | Échelle de types, requêtes, allocations, obligations de compte, fusions indépendantes, déplacement du produit, conservation des occurrences non sélectionnées, fusion exacte sans effet, contradiction confirmée, règle rappelée à revalider et changement d’ordre des types. |
| Transformation de représentation | Translation de la scène et permutation de palette, avec acquisition et réutilisation après frontière. |

`cold-stock-source-selected` commence par le même apprentissage froid. Après la frontière, chaque commande exécutée vient d’une proposition de l’original. Les réponses sont définies uniquement par les corps publics déclarés et la commande : un seuil synthétique de distance au support, déplacement d’un corps, ou fusion de deux types égaux. L’identité du propriétaire, ses offres et ses prédictions ne sont jamais consultées pour produire le retour.

Cette chaîne acquiert **deux fusions et neuf déplacements en onze commandes sélectionnées**, sous une borne déclarée de 48 commandes. Ses gardes et acquisitions originales sont enregistrées. La table publique correspondante peut alimenter la preuve séparée de la boucle commune ; elle ne garantit pas, à elle seule, que le sélecteur commun choisira ces commandes.

## Sérialisation et restauration

Les arguments et retours publics utilisent le transport JSON : tuples devenus tableaux, clés numériques d’objets devenues chaînes et ensembles représentés par des tableaux triés. L’ordre d’insertion des objets est conservé dans la fixture. Cet ordre est consommé notamment lorsque l’original parcourt `rival_predictions` pour produire les listes de rivaux compatibles ou réfutés.

`sourceState` est une projection distincte des variables originales. Les dictionnaires à clés non textuelles deviennent des entrées ordonnées. Les mappings `demands`, `rules`, `lineages` et `minimums` du stock sont toujours des entrées, même vides. `prior.observed_rules` conserve l’ordre et le type réel des clés. Les ensembles `motion_types` et `failures` sont triés selon leur ordre structurel source. Les templates à clés textuelles restent des objets.

L’attribut `current_observation` est **absent à froid**, comme dans `vars` du Python original. Il apparaît uniquement lorsque `before` ou `after` le crée. Le test ne remplace pas cette absence par `null`.

Le Python original ne définit pas de checkpoint pour cette famille. Les schémas natifs et leurs restaurations sont donc des extensions explicitement séparées de la parité des méthodes source. La proposition appartient au caller et reste extérieure au checkpoint du propriétaire. Pour vérifier `bind`, le test conserve la proposition native précédemment calculée et ses alias entre `steps` et `field_plan.steps`, puis compare ses valeurs publiques avant et après liaison. Une désérialisation JSON seule détruirait ces alias sans représenter le comportement d’un appel direct original.

## Rejeu indépendant des journaux de boucle commune

L’option `--journal` accepte le schéma `logos-engine.addressed-material-public-operations.v1`, avec des opérations contenant `method`, `input`, éventuellement `useLatestSourceProposal`, et un champ `native` réservé aux résultats observés du port. Les journaux doivent être conservés dans `docs/migration/lot5b-evidence` ; leur chemin et leur empreinte sont inscrits dans le nouvel export.

L’original commence froid. Le replay ne lit jamais `native` pour dériver une proposition, un retour ou un état. `propose` calcule la proposition Python locale. Pour `bind`, `before`, `after` et l’acquisition sélectionnée, `useLatestSourceProposal` transmet uniquement cette proposition locale. L’acquisition passive utilise `proposal=None`. Les observations, commandes et références de l’appelant sont conservées ; aucune normalisation générale des références n’est appliquée.

Le replay refuse l’injection d’un état initial, d’une restauration ou d’une proposition native. Les résultats Python et leurs états sont exportés avant toute comparaison avec le port. Le caller peut enrichir la proposition native de métadonnées de stratégie : une comparaison de liaison doit nommer précisément les champs consommés ou les `point_binding` comparés, et conserver séparément la proposition native entière. Elle ne doit pas présenter une projection partielle comme une égalité intégrale de l’appelant.

Les premières comparaisons des journaux de développement donnent les résultats suivants. Elles gardent le gel natif propre à chaque campagne et ne remplacent pas une revalidation sur le futur gel de livraison.

| Journal public | Comparaison originale indépendante | Portée |
|---|---|---|
| [Positif 02](../development/common-positive-02/original-comparison.json) | **169/169**, 54 opérations, 15 retours dont cinq sélectionnés et dix passifs | Boucle commune synthétique terminée, avec deux clics du même préfixe de navigation. |
| [Négatif 01](../development/common-negative-01/original-comparison.json) | **164/164**, 52 opérations, 14 retours dont quatre sélectionnés et dix passifs | Absence d’effet effectivement reçue, réfutation du modèle, puis changement de décision commune. |
| [Stock 01, trajectoire partielle](../development/common-stock-01/partial-original-comparison.json) | **384/384**, 63 opérations, 16 retours, deux commandes stock sélectionnées | **La boucle commune reste `failed`** sur `frontier_preservation_conflict`. Une fusion `(24,14)` puis un déplacement `(24,18)` sont acquis ; aucune clôture de la boucle complète n’est revendiquée. |

Le diagnostic partiel du stock compare les inputs réels, retours, propositions et variables source sans réécrire le statut de l’essai. Son champ `completionClaimed` reste faux. Le refus n’est contourné ni par un changement de prior ou d’obligation, ni par une action imposée.

## Tentatives antérieures conservées

Les journaux `source-oracle-export-attempt-01.log` et `source-oracle-export-attempt-02.log` conservent le premier refus de la scène synthétique. Une enceinte fine laissait une couronne de fond elle-même mesurée comme deuxième enceinte centrée. L’original restait donc correctement sans modèle. L’état partiel de la reproduction est conservé dans `source-oracle-export-failure-001.json.gz`. La correction a porté uniquement sur le raster synthétique : une enceinte épaisse de même taille conserve un seul intérieur homologue.

Le troisième export a produit toutes les chaînes, mais sa sérialisation alphabétique des clés modifiait l’ordre consommé des rivaux dans les inputs. Le premier test de parité et le premier test d’extensions ont révélé ce défaut d’export. Le script, la fixture et le reçu de cet export restent disponibles sous `source-oracle-export-key-sorted.py`, `addressed-reference-key-sorted.json.gz` et `source-oracle-export-key-sorted.json`. Leurs chemins historiques inscrits dans le reçu ne sont pas réécrits ; ces copies préservent les octets de la tentative. Le premier journal de tests reste `addressed-reference-tests-attempt-01.log`.

Le quatrième export conserve l’ordre source et produit la fixture canonique actuelle. La correction ne change aucune règle originale ni aucune implémentation native. Les tentatives antérieures ne sont pas reclassées en validations réussies.

## Contribution en jeu

Le catalogue public et les métadonnées existantes consultés n’établissent pas de jeu avec contribution propre de cette famille. Une enveloppe passive `addressed_material_event`, même présente, n’est pas une preuve de sélection ni de résolution. Aucune campagne réelle n’a été lancée pour cet oracle ; le budget cumulatif WEAV déjà épuisé n’a pas été remis à zéro.
