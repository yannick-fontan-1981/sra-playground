# Lot 5B : plan de preuve indépendante

État : conception et lecture des sources uniquement. Aucune exécution d'agent original, de test, de jeu, de build ou de profilage n'a été lancée pour ce plan. Les valeurs géométriques proposées ci-dessous doivent être confirmées par l'exporteur original, et ne sont pas des résultats de test.

## Autorité et portée

Référence immuable : `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, sources d'agents V5/V6 seulement. `AddressedMaterial` complète l'observation dans `before` et `after`, puis délègue à `AddressedField`. La branche de réutilisation consommée est `FieldStock`, créée paresseusement après une frontière ayant retenu un champ calibré, son enceinte et un contexte de requête. La preuve ne doit pas s'arrêter au premier déplacement.

L'oracle utilisera les méthodes originales sans réécriture : `propose`, `bind`, `before`, `after`, `record`, `preservation_obligations`, ainsi que les helpers géométriques consommés. Les 1 786 fichiers originaux seront vérifiés avant et après l'exécution autorisée. Les imports transitifs seront fingerprintés. Aucun résultat TypeScript ne fournira une attente Python.

Les résultats et arguments publics seront représentés par leur transport JSON : clés numériques de dictionnaire converties en chaînes, tuples convertis en tableaux. L'état source aura une représentation distincte : mappings à clés non-string en entrées ordonnées, ensembles triés selon l'ordre Python. Cela conserve notamment `Counter`, les règles et lignées de `FieldStock`. `current_observation` reste absent de l'état initial original ; son apparition après `before` ou `after` sera conservée. Le snapshot TypeScript est une extension native, pas une API de checkpoint définie par Python.

## Chaîne froide du champ

Grille synthétique proposée de 28 × 24 pixels : corps et exemplaire stationnaire carrés de 2 × 2 pixels, même palette ; homologue de même masque, autre palette, centré dans une enceinte de 6 × 6 située strictement à l'intérieur du cadre. Aucune palette ne reçoit un sens dans le moteur de production.

Premiers retours publics proposés : corps `(2,8)` vers `(5,8)` après clic `(6,9)`, contour transitoire de rayon mesuré 4 ; contraste `(6,5)` vers `(5,4)` ; essai extérieur `(11,5)` sans mouvement ; essai de bord `(10,5)` vers `(9,4)`. Le code original devrait alors produire un intervalle empirique `lower_squared=16`, `upper_squared=25`, puis un chemin vers l'homologue aux points `(14,5)` et `(18,5)`. Ces coordonnées sont uniquement des données de fixture synthétique, jamais un correctif de production ni une solution de jeu.

Les variantes doivent conserver : absence initiale de modèle ; transition non adressée ; absence d'indicateur ; correspondance résiduelle ambiguë ; deux homologues candidats ; témoin stationnaire manquant ; point hors du nouveau corps ; donnée de commande supplémentaire ; limite de budget ; référence ou homologue modifié ; adresse devenue périmée ; déplacement non aligné ; absence d'effet à distance déjà acceptée ; frontière officielle ; observations complètes et protocolaires complétées par le wrapper.

## Réutilisation du stock

Après la frontière, une grille publique neuve contient une échelle de carrés typés régulièrement espacés, des requêtes distinctes sur la ligne retenue, des enceintes dont l'enveloppe est compatible et des occurrences libres. La création du stock doit provenir du `prior` acquis par la chaîne froide.

Branches à couvrir : déplacement d'un type demandé ; conservation des autres occurrences ; demande satisfaite déjà réservée ; fusion de deux occurrences avec un produit inconnu puis second témoin indépendant ; apprentissage de l'alignement d'un produit ; absence d'effet mémorisée pour une fusion précise ; transformation contradictoire après confirmations ; contradiction d'une règle seulement rappelée sans confirmation locale ; changement d'ordre à la frontière ; absence de lieu commun ; séparation préparatoire ; arrêt du chemin sur résultat inconnu ou sur un futur pixel d'adresse déjà modifié ; obligations de compte conservées après déplacement et restauration.

Les appels de composants avec état synthétique explicite restent séparés des chaînes froides et ne comptent pas comme acquisition en boucle commune.

## Boucle commune

Root doit utiliser la factory native complète, son ordre original et WHY/ACT, sans owner forcé, sans injection de connaissance et sans remplacement d'action. Une table de retours publics doit dépendre uniquement du cadre courant et de la commande émise. Les commandes non décrites reçoivent une image inchangée. Un marqueur public au premier locus peut rendre celui-ci échantillonnable ; sa sélection effective n'est pas encore prouvée.

Le journal doit distinguer la calibration acquise passivement et les actions du propriétaire sélectionné. L'original écrit un statut `addressed_material_event` même quand `events=[]` : ce dict reste vrai. Le passif doit être sauté pour le retour déjà acquis par le même propriétaire. La comparaison source suit chaque retour, puis vérifie la décision suivante après un effet positif et un contre-exemple. La restauration doit reconstruire les mêmes propositions et obligations depuis un propriétaire natif neuf.

Les observations et commandes réellement capturées peuvent alimenter une nouvelle exécution indépendante de l'original, sans importer l'état natif ni ses résultats attendus. Un changement de références d'observation dû à des sondages préalables ne doit pas être masqué par une normalisation générale : l'original doit recevoir ces références réelles.

## Dépendances et limites

Imports directs : `common_addressed_material`, `common_addressed_field`, `common_field_stock`, `common_linked_preparation`. Dépendances consommées : `common_containment.filled`, `common_visible_identity`, `common_multiscale_constraints` (dont NumPy), `geometric_observer`, `neutral_observer`, `ObservedInputDomain`, `typed_material_observations.child_present`, `terminal_composition.identity`, puis les imports transitifs de LinkedPreparation/PhaseRelations. Le manifeste réel d'import sera capturé à l'exécution, sans supposer qu'une liste statique est exhaustive.

Aucun cas de jeu réel avec contribution AddressedField/FieldStock n'est établi par les seules métadonnées consultées. La présence de `addressed_material_event` dans un journal passif n'est pas une preuve de sélection ou de contribution. Les fixtures synthétiques ne seront pas comptées comme un nouveau jeu réussi. Le budget cumulatif WEAV déjà épuisé n'est pas rouvert.
