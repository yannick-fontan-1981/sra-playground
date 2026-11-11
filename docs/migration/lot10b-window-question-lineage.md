# Lot 10B : lignée du transfert WindowQuestion

## Reconstruction et statut des preuves

Cette notice décrit la reconstruction de `window_question` depuis les sources épinglées dans le dépôt récupéré sur la clôture Site 95, commit `3a70463039768f7114edae7d94d7dd33b7f36aa8`, dont le natif publié est `0.58.0`. Elle ne constitue ni un reçu de validation, ni un verdict de coût, ni une preuve de publication du candidat. Les travaux non récupérés de l'ancien espace ne sont pas utilisés comme résultats de cette reconstruction.

L'ordre de livraison coordonné reste 6A / `0.60`, suivi du lot 7 / `0.61`, puis 10B / `0.62`, puis 5C / `0.63`. Ces versions désignent une coordination prospective. Le gel final et la baseline de coût doivent correspondre aux octets et aux publications réellement observés ; le port isolé sur Site 95 n'anticipe pas leur intégration.

Les nombres de cas, tests, fichiers, membres d'archive et résultats seront lus dans les **nouveaux reçus effectivement produits**. Aucun nombre de réussite d'une tentative antérieure n'est reporté ici. La parité de l'appelant complet reste explicitement non établie : `fullCallerParity: false`.

## Sources et fichiers natifs

La référence commune est `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les chemins source ci-dessous sont relatifs à `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`.

| Source consommée | Port ou liaison native | Contrat |
| --- | --- | --- |
| `agents/yf_arc3_v6/morphology_policy/window_question/family.py` | [v6-window-question.ts](../../src/logos-engine/v6-window-question.ts) | État, scope, offres, proposition, garde, acquisition et frontière. |
| `agents/yf_arc3_v6/morphology_policy/window_question/policy.py`, `window.drm`, `window.src` | [v6-window-question-policy.ts](../../src/logos-engine/v6-window-question-policy.ts), registre DRM et interpréteur SRC communs | Priorité, coût, indice source, conditions et reçu du vrai workflow. |
| `agents/yf_arc3_v6/morphology_policy/window_question/geometry.py` | [v6-window-question-geometry.ts](../../src/logos-engine/v6-window-question-geometry.ts) | Mesure des boîtes et du mot, domaines, édition cyclique et couverture conditionnelle. |
| `agents/yf_arc3_v5/capabilities/window_processing_d.py` | [v5-window-processing.ts](../../src/logos-engine/v5-window-processing.ts) | Modèles consommés, éligibilité d'une fenêtre et projection d'un beat. |
| `agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py` | Budget consommé réutilisé depuis [v6-topological-recolor-geometry.ts](../../src/logos-engine/v6-topological-recolor-geometry.ts) | Visites, délai propre à chaque calcul et interruption sans conclusion complète. |
| `agents/yf_arc3_v6/morphology_policy/strategy.drm` et `agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py` | [v6-native-runtime.ts](../../src/logos-engine/v6-native-runtime.ts) | Position dans la sélection, propriétaire unique, acquisition active/passive et publication de l'état source. |

Le port n'exécute pas un agent Python pour prendre ses décisions. L'exporteur de référence, ses fixtures et les comparaisons différentielles relèvent d'une chaîne de validation distincte. La source V5 consommée est celle effectivement appelée par `geometry.py` ; la présence d'autres primitives V5 voisines ne constitue pas une déclaration de transfert de ces primitives.

## Contrats source conservés

### Mesure, expérience et choix

La mesure utilise les pixels publics : boîtes homologues, rangée de capacités, champs de couleur et mot régulier. Les égalités, les égalités de scores du `Counter`, l'ordre visuel des boîtes, l'ordre des produits cartésiens et l'ordre des éditions conservent leur rôle source. Une édition de second champ précède une édition de capacité, laquelle précède une édition du filtre dans une même configuration.

Une proposition exige au moins une modification de champ précédemment observée dont la signature correspond à la mesure courante. Les méthodes locales précèdent les méthodes portables, dans leur ordre retenu. Une méthode portable est une hypothèse révisable ; elle n'est jamais un permis courant. La géométrie, le budget d'actions, la disponibilité de la commande et l'absence de tentative identique sont recontrôlés pour chaque offre.

La politique classe les offres par **priorité DRM, coût, indice d'énumération**. `traversal_question` précède `setting_question`. Le workflow `v6.window_question.choose` appelle réellement `window.select` dans le même interpréteur SRC natif que les autres familles ; son reçu n'est pas synthétisé. La proposition conserve `OP18`, les preuves des méthodes, le payload pointé exact et les questions ouvertes du modèle. Une commande de lancement source n'acquiert pas artificiellement un champ `data` ; la normalisation publique reste au transport commun.

Les calculs de couverture préservent l'identité des rangs, sans compaction. Le modèle teste le premier emplacement admissible dans l'ordre déclaré et conserve les reçus ordonnés de projection. Ni l'ordre visuel, ni `ACTION5`, ni une couverture calculée ne prouvent la loi physique, le temps réel, le rôle du second champ ou la réussite du jeu.

### Garde et acquisition

`bind` exige une action unique et l'identité des trois représentations : `actions`, `steps[*].action` et l'action de l'offre. `beforeSource` vérifie l'indice nul, les trois clés de scope source (`observation_ref`, `level_epoch`, `frame_hash`), puis retrouve exactement une offre courante avec le même digest complet et la même action. Il recompose toutes les offres nécessaires à ce contrôle.

La garde source ne compare directement ni `levels_completed`, ni toutes les décorations de `point_binding`. Le transport commun conserve ses contrôles distincts de commande disponible, de point public, de préservation et d'autorité WHY/ACT. La fidélité à la garde locale ne supprime aucun de ces contrôles communs.

`after` conserve un effet encore inconnu et demande le scellement du préfixe. `recordSource` est la seule méthode d'acquisition de cette famille. Une modification est apprise seulement si la signature, le mot et les boîtes restent compatibles et si **un seul** des champs `capacity`, `filter`, `second_field` a changé. Cette observation n'exige pas que la commande précédente soit pointée ou produite par Window : un retour réel d'une autre famille peut révéler un contrôle.

Un paquet de plusieurs frames conserve séparément sa taille, son nombre de frames distinctes, le score public et la frontière. Ce paquet n'est pas converti en loi mécanique complète. À la frontière d'époque, le second raster n'est pas utilisé pour attribuer une modification de champ à l'ancienne scène. Les méthodes sont portées à la nouvelle époque uniquement lorsque des éditions existent. Le résultat de la transition est détaché avant la remise à zéro du scope courant.

Le propriétaire natif est unique : `public_window_question`. L'entrée `window_question` occupe sa position DRM dans `factored_material_return` et annote la proposition par `material_access_subquestion`. Le retour sélectionné est acquis une fois ; la passe passive l'exclut. Pour un retour étranger, cette passe appelle `recordSource` avec les observations, la commande, les deux rasters, `proposal=null`, l'indice courant et le paquet réel. Window précède l'acquisition Axial, avec les propriétaires source encore non transférés explicitement hors du périmètre de cette reconstruction.

### État et sauvegarde

Les six champs source sont exactement `epoch`, `edits`, `portable`, `launches`, `attempts`, `last`. `state()` les détache tous. `restore()` applique les champs présents sans effacer implicitement les champs absents.

Le prédicat du raisonnement source est **`edits || portable || attempts`**, exposé par `sourceStateShouldPersist()`. Des lancements seuls, ou `last` seul, ne déclenchent pas la publication de `window_question_state`. Le checkpoint natif complet est un contrat différent : il conserve les six champs, y compris ces observations isolées. Aucun champ n'est retiré pour diminuer le coût mesuré.

## Adaptations natives explicitement nommées

| Adaptation | Comportement et limite |
| --- | --- |
| `window_src_async_bridge` | `proposeSource` est asynchrone parce que le véritable interpréteur SRC natif retourne une Promise. Son calcul d'offres reste synchrone. `beforeSource`, `recordSource`, `state` et `restore` sont synchrones. Aucun reçu SRC fictif ni interpréteur parallèle n'est introduit. |
| `window_cooperative_current_execution` | `propose` et `before` reçoivent l'exécution courante. La géométrie cède entre configurations ; la famille cède aussi pendant les scans de méthodes, la construction d'offres et la garde exacte, après 32 éléments ou 8 ms selon la phase. Les contrôles finaux empêchent de publier une recherche complète après expiration ou annulation. Aucun signal, délai ou calendrier n'est conservé dans l'état appris. |
| `window_current_guard_execution` | Le cinquième argument optionnel de `NativeFamily.before` transporte le contexte courant. Le runtime doit reconstruire le restant actif lors de l'autorisation, avec son horloge et le signal de cet appel, et conserver toute limite entrante plus stricte. Un ancien contexte de proposition ne sert pas de contexte d'autorisation. |
| `window_incomplete_search_diagnostic` | Une troncature du domaine, une interruption du budget V5 ou de la coopération produit une absence de proposition, ou une garde refusée, et un diagnostic courant sans autorité. `domain_complete=false` et `status_is_not_an_acquired_refutation=true` restent explicites. Aucun plan partiel n'est proposé, aucune tentative n'est ajoutée, aucune impossibilité n'est apprise et aucun arrêt de groupe supplémentaire n'est créé. |
| `window_exact_truncated_domain_integer` | Un domaine dépassant la représentation entière sûre de JavaScript est compté avec `BigInt` puis exposé comme chaîne décimale exacte, uniquement dans une branche déjà tronquée, avec `native_domain_format='exact_decimal_integer'`. Le compte n'est ni saturé ni remplacé par l'infini. |
| `window_validated_complete_checkpoint` | L'enveloppe `native.public_window_question.v1` contient les six champs sous `source_state`. Une vue brute évite une copie préalable par `state()`. La validation JSON et une comparaison structurelle typée détectent les mutations imbriquées, y compris les différences entre booléens et nombres ou le zéro négatif. Ce contrôle reste un scan réel ; son coût doit être mesuré. L'égalité Python reste utilisée dans les calculs source. |
| `window_native_guard_refusal` | La garde native refuse une liaison ou une géométrie mal formée et recontrôle l'offre après les cessions coopératives. Le chemin `beforeSource` conserve ses erreurs source. Les autres erreurs inattendues ne sont pas transformées en succès. |
| `window_json_projection_domain` | Les constructeurs V5 consommés sont portés dans le domaine JSON et des entiers natifs sûrs annoncé par leur fichier. Les coercitions d'objets Python arbitraires et l'ensemble non consommé de l'API V5 ne sont pas revendiqués. |

Le budget source reste neuf pour chaque appel de couverture : **4 096 visites, 1 000 ms et domaine 4 096**, distinct de la borne **4 096 configurations** du modèle. La famille n'ajoute pas de délai global au chemin source synchrone et ne remplace pas les budgets V5 par le délai de l'ordonnanceur natif.

## Validation à établir sur cette reconstruction

| Preuve finale | Statut de cette notice |
| --- | --- |
| Export depuis les originaux et vérification de leurs empreintes avant/après | À produire et lier au nouvel exporteur ; nombre de cas en attente. |
| Comparaisons famille, politique, géométrie et noyau V5 | À exécuter sur les octets reconstruits ; aucun ancien compte repris. |
| Scénario froid intégré : action étrangère, acquisition passive, proposition Window, retour propre et choix suivant | À établir sans injection de mémoire apprise. |
| Garde courante, annulation, échéance, restauration et unicité d'acquisition | À établir avec les contextes réellement fournis par le runtime. |
| Tests composés, gates, build, rejeux et navigateur du candidat final | À produire après intégration des vrais prédécesseurs et nouveau gel. |
| Readiness, fenêtre de coût et publication | Non établies par cette notice. |

La décision de coût conserve l'autorisation utilisateur : pour chaque jeu de la population déclarée, la médiane des sessions complètes du candidat doit rester **strictement sous +10 %**. Une phase peut dépasser +10 % lorsque le critère global est satisfait. Aucun échantillon n'est écarté, aucun coût de propriétaire n'est retranché et une population interrompue n'est pas transformée en verdict complet.
