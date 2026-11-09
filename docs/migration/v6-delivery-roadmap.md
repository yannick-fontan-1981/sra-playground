# Feuille de route V5/V6 vers Logos Engine TypeScript

## Contrat et état de départ

Cette feuille de route reprend le plan demandé le 9 novembre 2026. Le chantier doit retrouver progressivement les capacités V5/V6 dans le runtime TypeScript commun, avec une mémoire persistante, une décision compréhensible et des temps de réponse maîtrisés. Une connaissance doit provenir d'une observation, influer sur une décision, puis être révisée à partir du retour réel.

La **base historique du plan est la publication 58**, commit `b946570afa44714424e2a1d67de338c4a7bd6c12`. La **base effective du lot 1 est la publication 59**, commit `f7b9a56af5488c8d4cebd5d912262a541f4fe403`. La mise à jour intermédiaire porte sur Motivation, sa génération et sa documentation ; elle est conservée. Le jalon natif V57 et ses preuves publiés dans V58 gardent leur identité.

L'[audit du registre](v6-entry-point-progress.json), le [bilan de migration](v6-native-transfer.md) et le [rapport du jalon V57](v57-topological-recolor-and-motion-questions.md) établissent le point de départ suivant :

| Élément | État vérifié à l'ouverture du lot 1 |
| --- | --- |
| Quatre listes d'entrées DRM | **50 raccordées sur 76**, 26 restantes |
| `topological_recolor` | Déjà raccordé, mémoire et contrats source conservés |
| Questions de contraste de mouvement | Déjà raccordées au chemin commun des questions d'information |
| Bundle V6 | **37 workflows compilés** ; compilation et consommation effective restent deux mesures distinctes |
| `morphology`, `attention_parent_return`, `acquire_control_for_target` | Fournisseurs communs encore incomplets, hors du dénominateur 76 |
| `OP01` à `OP31` | Implémentations présentes ; leur utilité est à établir par leurs producteurs et consommateurs réels |
| Migration globale | En cours ; aucune annonce de parité complète |

Le mandat initial autorisait **la livraison du lot 1 uniquement**. Cette livraison a été publiée en version **60**, commit `9be3d0434f6f8ff91236d61a51eafa4017c3a082`. La demande suivante « OK, continuez avec la prochaine étape » autorise maintenant le **lot 2A**, sur cette base publiée vérifiée. Les autres sous-lots conservent leur statut propre.

## Priorités, dépendances et statuts

Une dépendance désigne un contrat réellement consommé. Les numéros indiquent la priorité proposée, pas une obligation de terminer tous les lots précédents. Les familles autonomes peuvent être préparées dès que leurs propres contrats sont disponibles.

| Lot | Résultat attendu | Entrées restantes | Dépendance nécessaire | Statut courant |
| --- | --- | ---: | --- | --- |
| 1 | Cible conservée, sous-question, retour et reprise | Hors compteur | Runtime commun et familles existantes | **Livré, moteur `0.32.0`** |
| 2 | Stratégie morphologique et fournisseurs communs | Hors compteur | Cycle validé du lot 1, mesures et mémoire courantes | **2A livré dans son domaine courant, moteur `0.33.0`** ; lot global ouvert, 2B/2C planifiés |
| 3 | Mémoire commune et compositions | 4 | Propriétaire commun, acquisition et contrats de continuation | Planifié |
| 4 | Exemples, correspondances et retours discriminants | 3 | Observations, callbacks SRC et gardes | Planifié |
| 5 | Temps, adressage et liaisons | 3 | Historique public ; contrat de conservation pour les consommateurs concernés | Planifié |
| 6 | Pièces rigides, cargaisons et stabilisation commune | 4 | Géométrie, contrôles, recherche bornée et interruption | Planifié |
| 7 | Ateliers et transactions symboliques | 2 | Interfaces mesurées, SRC et mémoire des méthodes | Planifié |
| 8 | Accès conditionné et routage de branches | 2 | Calibration des commandes et préfixes gardés | Planifié |
| 9 | Navigation, régions et canaux | 3 | Graphes, retours publics et budgets courants | Planifié ; Recolor déjà acquis |
| 10 | Questions d'axe, de fenêtre, d'ordre et de temps | 5 | Observations, séquences et méthodes revalidées | Planifié |
| 11 | Consolidation, couverture et lisibilité | Hors compteur | Résultats et preuves des lots précédents | Planifié |

La réconciliation avec le registre de la base 59 donne **26 noms planifiés, 26 noms distincts, aucun nom absent et aucun nom supplémentaire**. Les entrées sont détaillées ci-dessous. Les chemins directs et les fournisseurs communs gardent leur propre bilan hors registre.

## Règles communes de livraison

Les sources originales de référence restent celles du commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Réutiliser les mesures, états, callbacks, SRC/DRM et acquisitions existants lorsque leur contrat convient. Conserver les priorités, alternatives et refus de la source. Une amélioration de coordination propre au TypeScript doit être nommée comme extension native et justifiée par une observation.

Chaque état métier possède un propriétaire. Chaque transition lui est acquise une fois, dans l'ordre prévu par son contrat. Une acquisition passive n'est pas assimilée à une acquisition réservée à la proposition sélectionnée. Une méthode historique reste conditionnelle ; son usage exige les preuves et les gardes du contexte courant. Les décisions du moteur ne peuvent dépendre d'un nom de jeu, numéro de niveau, rôle de couleur fixé, coordonnée préparée ou solution enregistrée.

Un lot peut comprendre des sous-lots techniques vérifiables. Il reste ouvert tant que tous ses critères annoncés ne sont pas satisfaits. Une dépendance partagée est transférée au niveau effectivement consommé, avec ses limites explicites.

Chaque comportement ajouté exige un cas de contribution positive, un cas contraire/ambigu/hors portée et une vérification de la connaissance conservée puis consommée. Lorsque pertinent, les attentes proviennent des originaux Python inchangés et restent séparées des entrées du moteur de production. L'intégration doit couvrir sélection, gardes, autorisation, action, acquisition, restauration et décision suivante.

Une campagne intégrée pertinente est prévue par lot, de préférence sur plusieurs niveaux. Un nouveau jeu de trois niveaux par entrée n'est plus obligatoire. Une campagne déjà réussie avant la modification prouve une non-régression ; elle ne suffit pas à attribuer le succès à la nouvelle capacité. Utiliser les traces de contribution et une ablation ciblée lorsque nécessaire. Un blocage de jeu conserve son identité, son diagnostic et son horloge : après 40 minutes, passer à un autre cas sans remettre artificiellement le compteur à zéro.

## Lot 1 : conserver la cible et consommer le retour

**Périmètre :** une boucle complète dans l'appelant commun : cible conservée → condition manquante → sous-question → expérience → retour réel → révision → reprise ou suspension du parent.

Le chemin retenu est `typed_pose_dependency` de `typed_material_flow`. Ses mesures, propositions de pose, connaissances et retours existent déjà dans le [jalon V50](v50-typed-material-and-returned-inquiries.md). La reproduction a isolé une lacune de conservation de la requête parent : un retour étranger déplaçant cette requête permet au composant V59 de proposer une nouvelle cible tout en gardant son contexte de pose acquis. Le lot reste limité à cette boucle.

Le [diagnostic reproductible](lot1-evidence/ablation/parent-scope-gap.json.gz), produit par [prove-native-parent-scope-gap.mjs](../../scripts/prove-native-parent-scope-gap.mjs), exécute le composant V59 immuable après **34 préfixes et 34 actions acquis à froid** depuis les paquets publics archivés. Il lui fournit ensuite un retour étranger explicitement contrefactuel, avec une commande `ACTION6` copiée du contrôle actuellement mesuré, disponible et admis. La cible change ; le garde, le témoin de connaissance et la liaison de contribution restent admis ; les événements de réponse pose restent à **1 avant et 1 après**, sans modification de l'état matériel. C'est une preuve de composant, pas un échec de jeu live ni une action libérée par tout l'appelant commun.

L'implémentation est gelée sous **`logos-engine.typescript.v6.native-migration/0.32.0`**, inventaire natif SHA-256 **`8a67b57947364dab988c7081e35eb6a923beee2305eb4b8a8a89c2fc86ebea57`**. L'extension native nommée `retained_typed_material_request_parent` réutilise l'attention de composition existante. Elle conserve l'identité de la requête, l'occurrence enfant, le contrôle et le modèle de comparaison ; elle référence les retours déjà acquis par `SharedSeries.material`, puis consomme leur résultat dans la question suivante. La sélection de famille reste à sa position source ; la nouvelle façade contraint la question matérielle à la requête retenue. Les gardes de famille, de point et WHY/ACT restent obligatoires.

Le même diagnostic contient un **contrat séparé du nouveau module**, utilisant les mêmes états acquis et le même retour étranger : l'identité du parent et sa requête sont conservées, et la reprise est suspendue avec `parent_request_changed_or_ambiguous`. Aucun réducteur matériel n'est appelé une seconde fois. Le témoin de marquage local issu du vrai retour de sélection est également conservé comme condition de liaison courante : sa disparition invalide la reprise. La [filiation du lot 1](lot1-composition-return-lineage.md) détaille les producteurs, consommateurs et limites de ces ajouts.

Conserver l'identité du parent, son propriétaire, sa portée, ses preuves et son manque précis. Relier la question enfant à ce manque. L'expérience doit passer par les propositions, gardes et autorisations communes. Le propriétaire existant acquiert le retour réel ; la décision suivante consomme cette révision. Une trace courte doit rendre la chaîne compréhensible. L'attention de mouvement et l'attention de composition gardent leurs statuts et conditions distincts.

**Critères de fin vérifiés dans le périmètre annoncé :**

1. Une exécution du runtime commun montre toute la chaîne jusqu'à la décision qui suit le retour.
2. Deux retours différents conduisent à deux suites pertinentes différentes.
3. Une contradiction, une preuve périmée ou une identité ambiguë empêche une reprise injustifiée.
4. Interruption, restauration et frontière de niveau conservent ou invalident correctement cible et autorisations.
5. Connaissances et contre-exemples restent conservés, sans propriétaire ni acquisition en double.
6. Les coûts avant/après sont mesurés sur le chemin modifié et sur des chemins habituels non concernés.

Le compteur demeure **50/76, avec 26 entrées restantes** : aucune entrée de registre supplémentaire n'est revendiquée par cette extension de coordination. Ce lot ne complète pas les fournisseurs `morphology`, `attention_parent_return` et `acquire_control_for_target`. **Le lot 1 est livré avec le moteur `0.32.0`**, sur la base V59 confirmée et l'inventaire natif indiqué ci-dessus.

### Preuves de livraison du lot 1

| Vérification | Résultat et portée | Reçu |
| --- | --- | --- |
| Tests ciblés du changement | **241/241**, huit fichiers ; boucle parent, références matérielles, Kernel, attention, caller, autorité, intégration et contrôleur | [Exécution des tests](lot1-evidence/final/validation/delta-tests-run.json) |
| Contrôles du projet | Typecheck, audit des entrées, audit de migration, contrôle du diff et build réussis ; source native inchangée | [Contrôles](lot1-evidence/final/validation/checks-run.json) |
| Boucle parent commune | Deux parents suivis sur 49 actions et trois niveaux ; état restauré depuis le graphe ; acquisition unique et décision suivante liée au retour | [Contrat positif](lot1-evidence/final/contracts/common-positive.json) |
| Retours différents et refus | Retour de pose à 270° menant à deux contrôles supplémentaires ; demande inaccessible suspendue ; contradiction conservée et parent réfuté | [Retour alternatif](lot1-evidence/final/contracts/common-alternative.json), [suspension](lot1-evidence/final/contracts/unreachable-parent.json), [réfutation](lot1-evidence/final/contracts/refuted-parent.json) |
| Campagne LIFE réelle | Une session froide, trois niveaux naturels en **15 + 15 + 19 = 49 actions**, 47 préfixes, 49 acquisitions et deux reprises de frontière ; arrivée au niveau 4 en `NOT_FINISHED` | [Exécution](lot1-evidence/final/execution-life.json), [trace publique](lot1-evidence/final/life-public-trace.json.gz), [rapport fractionné](lot1-evidence/final/life-campaign.json.gz.parts.json) |
| Contrôle navigateur | Session continue : 49 actions, trois niveaux, 47 plans ; Pause initiale à zéro action, arrêts aux actions 46 et 47 puis reprise du préfixe | [Reçu navigateur](lot1-evidence/final/life-browser-verification.json), [capture](lot1-evidence/final/life-browser.png) |
| Coût des chemins non concernés | **16 métriques STCK/SMLP dans le budget observé de +10 %**, maximum +6,43 % ; comparaison `passed`, aucun dépassement non résolu | [Comparaison avant/après](lot1-evidence/performance/comparison.json) |

LIFE avait déjà été résolu historiquement : cette campagne établit l'intégration et la non-régression, et ne constitue pas une première résolution ni la preuve que chaque action dépend du nouveau parent. Le retour à 270° produisait déjà la même suite pertinente en V59 ; le nouvel apport comprend sa filiation explicite. Le déplacement de requête reproduit séparément la différence de conservation du parent. La campagne réelle a terminé **231,44 secondes après la sélection du cas**, avant l'échéance de 40 minutes conservée dans le [reçu de sélection](lot1-evidence/campaign-selection.json).

### Coûts et limites mesurés

Les médianes de session sur trois répétitions passent de **13,721 à 12,642 s** pour STCK, de **30,941 à 29,066 s** pour SMLP et de **141,865 à 138,513 s** pour LIFE. Le budget annoncé s'applique aux chemins non concernés STCK/SMLP. Sur LIFE, qui contient la nouvelle validation de parent, certains coûts augmentent :

| Mesure du chemin LIFE | Avant | Après | Variation et effectif |
| --- | ---: | ---: | --- |
| Garde de continuation | 13,64 ms | 30,49 ms | +123,52 %, 6 échantillons |
| Continuation complète du service | 60,03 ms | 67,51 ms | +12,46 %, 6 échantillons |
| Nouvelle décision de pose sélectionnée | 828,98 ms | 873,21 ms | +5,34 %, 12 échantillons |
| Restauration des familles, toutes décisions LIFE | 8,78 ms | 10,76 ms | +22,56 %, 282 échantillons ; dispersion entre répétitions élevée après modification |

Ces hausses font partie du bilan du chemin modifié. Les médianes globales plus faibles ne les annulent pas. La [méthode](lot1-evidence/performance/README.md) retient les échantillons, les extrêmes et le bruit observé ; les mesures imbriquées ne s'additionnent pas. Aucun p95 n'est annoncé sous 20 échantillons. L'inspection mesurée concerne service et transport, sans acceptation/clonage du contrôleur ni rendu de l'inspecteur. Pause est mesurée aux deux points initiaux du protocole ; le contrôle navigateur ajoute une interruption de préfixe, sans établir de borne de préemption pour toute recherche. La session LIFE reste finie et ne prouve pas une stabilité de mémoire sur plusieurs heures.

## Lot 2 : stratégie morphologique et mesures réelles

**Dépendances :** cycle du lot 1, observations, historique des transitions et contrats de mesure. Organiser le travail en **2A**, producteurs de mesures/paires/routes/prévisions ; **2B**, état de décision `morph.last` et raccord de `acquire_control_for_target`/`attention_parent_return` ; **2C**, continuation, réarmement et extension de cible requis par le périmètre source annoncé.

**Sous-lot 2A livré, moteur `0.33.0`, sur la base V60.** Les producteurs morphologiques alimentent la politique existante au rang source du chemin commun. Le domaine comprend les mesures courantes, les paires, les routes, les expériences d'accès et les prédictions d'une station réellement acquise, avec `station_method` absent. Une méthode non nulle, courante ou historique, reste explicitement hors domaine. **2B et 2C restent planifiés** ; ce raccord ne clôt pas les critères du lot global 2.

Le [rapport du lot 2A](lot2a-current-morphology.md) et sa [filiation](lot2a-morphology-lineage.md) établissent les producteurs, propriétaires, gardes, acquisitions et limites. Le delta gelé passe **532 tests**. Les originaux inchangés concordent sur **291 appels morphologiques réels**, 678 appels de contexte et 82 checkpoints de LS20. Ce jeu réussit son premier niveau en 28 actions, dont les 11 dernières viennent de la nouvelle morphologie, puis échoue au niveau 2 après 144 actions. Le passage à TR87 intervient après moins de huit minutes ; TR87 réussit ses **trois premiers niveaux en 105 actions et 30 préfixes** par `word_interface`, sans attribution de ce succès à la morphologie. Les contrôles navigateur, mesures de coûts et reçus complets sont détaillés dans le rapport.

**Prochaine étape : 2B.** Transmettre la décision conservée `morph.last`, raccorder `acquire_control_for_target`, puis consommer `attention_parent_return` pour la paire, le parent et la portée effectivement établis. Le propriétaire courant reste unique et les branches incomplètes conservent leurs refus. Les méthodes de station et d'entrée, le réarmement et les continuations conditionnelles restant au périmètre 2C ne sont pas annoncés acquis.

**Critères de fin :** faits produits réellement et courants ; décision morphologique utilisée par une proposition ou une sous-question ; retour d'attention consommé pour la bonne paire, le bon parent et la bonne portée ; ordre et refus source vérifiés ; preuves positives, refus et restauration pour chaque fournisseur ; branches absentes encore identifiées, sans déclaration de complétude avant leur couverture. Les questions d'information respectent la conservation du parent et les possibilités de retour. Les familles indépendantes n'attendent pas la fin de ce lot.

## Lot 3 : mémoire commune et compositions

**Entrées :** `observed_composition_services`, `framed_window_composition`, `coupled_prefix_reference`, `recurrent_series`.

**Dépendances :** mémoire commune existante, événements, restauration et continuation. Étendre le propriétaire déjà employé ; réutiliser programmes, supports, occurrences et services acquis. Le lot n'attend pas les lots 4 à 10. `observed_composition_services` conserve des branches internes distinctes.

**Critères de fin :** chaque entrée contribue à une sélection ou continuation pertinente ; confirmation soutenant la composition et contradiction mémorisée la révisant/suspendant ; références et préfixes revalidés ; restauration préservant les autres acquis du propriétaire partagé ; preuves adaptées à chaque branche interne revendiquée.

## Lot 4 : exemples et retours discriminants

**Entrées :** `observed_feedback_sequence`, `relative_arrangement`, `facet_example`.

**Dépendances :** mesures d'interface, callbacks natifs, SRC et retours. Le lot 3 complet n'est pas requis. Raccorder les workflows déjà compilés à leurs producteurs et consommateurs effectifs.

**Critères de fin :** un retour de séquence élimine/sélectionne une hypothèse et change l'essai suivant ; un arrangement relatif vérifie déplacement et préservation des autres participants ; un exemple de facette produit puis révise une correspondance ; reconnaissances et refus interrompant la source conservés ; méthodes rappelées après frontière revalidées avant usage.

## Lot 5 : temps, adressage et objets

**Entrées :** `linked_temporal_preparation`, `observed_addressed_material`, `observed_object_binding`.

**Dépendances :** transitions, phases et identités publiques. `observed_object_binding` consomme le contrat de conservation/retour de composition du lot 1. Mutualiser seulement les observations compatibles ; un helper partagé ne crée pas une dépendance à tout un moteur temporel.

**Critères de fin :** reprise depuis la phase observée et arrêt sur divergence ; adressage lié à l'objet/contexte courants ; ancienne liaison invalidée par ambiguïté, déplacement pertinent ou nouvelle portée ; parent conservé jusqu'à effet attesté, réfutation ou frontière, avec effet sur la décision suivante ; interruption/restauration préservant connaissances et obligations.

## Lot 6 : pièces rigides, cargaisons et stabilisation

**Entrées :** `preview_packing`, `selected_rigid`, `observed_rigid_cargo`, `shared_settlement`.

**Dépendances :** géométrie, commandes acquises, effets vérifiés, primitives V5 consommées et recherche interruptible. Le lot 5 peut fournir des contrats, sans constituer un prérequis global.

**Critères de fin :** chaque moteur influence une décision à partir des mesures/contrôles actuels ; méthodes historiques éprouvées ; écart de pose/collision/cargaison/préservation interrompant le préfixe et révisant la connaissance ; recherche interrompue conservée comme inconnue/différée et jamais comme impossibilité prouvée ; plusieurs pièces mesurées avec mémoire maîtrisée et Pause réactive.

## Lot 7 : ateliers et transactions

**Entrées :** `observed_ranked_workshop`, `observed_symbol_transaction`.

**Dépendances :** interfaces, SRC/DRM, gardes exactes et mémoire des méthodes. Les lots de transport/routage ne sont pas des prérequis globaux. Garder les propriétaires distincts lorsque la source les distingue.

**Critères de fin :** mode observé ou méthode revalidée donnant une proposition sélectionnée ; transaction liée à l'entité/point courants ; retour révisant méthode/conditions/réfutation et décision suivante ; absence d'effet ou contexte changé empêchant la répétition aveugle ; méthodes transportables conservées aux frontières avec autorisations renouvelées.

## Lot 8 : accès conditionné et branches

**Entrées :** `motif_conditioned_access`, `parallel_branch_routing`.

**Dépendances :** calibration, géométrie, préfixes gardés, acquisition et persistance. Le workflow de stratégie peut appeler leur logique native sans invention d'un workflow supplémentaire.

**Critères de fin :** relation motif/commande/effet acquise servant l'accès ; contributeurs et branches terminales source pris en compte ; pose/effet changé invalidant la continuation ; recherche combinatoire bornée et interruptible avec qualification de l'incomplet ; plausibilité géométrique et accomplissement officiel conservés séparément.

## Lot 9 : navigation, régions et canaux

**Entrées restantes :** `chart_navigation`, `region_intervention`, `joint_channels`.

**Dépendances :** cartes, régions, transitions, images intermédiaires pertinentes et budgets. `topological_recolor` est acquis à la base V58 et doit rester vérifié sur les contrats affectés. Traiter aussi `discrete_network` s'il demeure absent de l'appelant commun, **hors compteur 76**, à sa position source. Une prévision de canaux absente ou périmée conserve le comportement source prévu.

**Critères de fin :** transition révisant positions/chemins/affectations possibles ; intervention mesurant régions touchées et conservant les effets contraires ; affectation réfutée modifiant le plan ; prévisions limitées à leur portée valide ; contribution réelle, restauration et recherche bornée de chaque chemin ; non-régression de Recolor.

## Lot 10 : axe, fenêtre, ordre et temps

**Entrées :** `axial_question`, `window_question`, `ordered_recruitment`, `temporal_selection`, `invited_endpoints`.

**Dépendances :** observations, commandes, retours de séquence, méthodes revalidées et contrats communs. La ressemblance des noms n'établit pas une dépendance : `window_question` n'attend pas automatiquement `framed_window_composition`.

**Critères de fin :** questions dérivées des mesures et retours modifiant méthode/proposition ; recrutement déterminé par marqueurs/files/relations observés ; changement d'ordre/configuration invalidant la continuation ; sélection temporelle distinguant sélection, arrangement et lancement avec images attribuées aux bons niveaux ; invitations courantes et arrivée vérifiée ; tentatives, méthodes et réfutations restaurées sans permis périmé.

## Lot 11 : consolidation et lisibilité

**Dépendances :** résultats intégrés des lots 1 à 10. Réconcilier positions, propriétaires, branches et preuves ; bilan séparé des fournisseurs communs et chemins hors registre ; situation des 31 opérations ; correspondance entre chemins, workflows et arbre ; régressions, restauration, sessions longues et coûts.

**Critères de fin :** chaque entrée annoncée possède producteur, consommateur et preuve de contribution ; couverture adaptée à chaque capacité revendiquée ; bilan propre des chemins hors registre ; écarts bloquants corrigés et vérifiés ; contrôles de migration complète cohérents avec les preuves ; trace humaine expliquant cible, manque, hypothèse, expérience, retour et suite, avec détails accessibles à la demande ; budgets de performance respectés.

**76/76 clôt le raccordement du registre.** La parité globale V5/V6 exige les contrôles portant sur tout le comportement requis.

## Opérations, arbre et performances

Pour chaque opération touchée, documenter entrées, producteur, appel, consommateur, décision influencée et limites. Le lot 1 examine `OP03`, `OP08`, `OP12`, `OP26` lorsqu'une dépendance mesurée les justifie et réutilise `OP18`, `OP28`, `OP29`, `OP30`, `OP31` selon les chemins réellement parcourus. Aucune obligation de tout appeler à chaque décision ; liste vide, donnée absente et impossibilité prouvée restent distinctes. Vérifier consommateurs, compatibilité et sémantique avant suppression/remplacement.

La correspondance conservée est : **référence de raisonnement → contrat/workflow source → TypeScript → décision → preuve d'exécution**. Les références documentaires, wrappers, calculs, choix stratégiques et workflows effectivement appelés ne sont pas assimilés. La [filiation du lot 1](lot1-composition-return-lineage.md) note aussi les inventaires historiques demandés mais absents du snapshot local ; leur inventaire complet ne bloque pas ce lot borné.

Avant modification, mesurer continuation connue, nouvelle décision, acquisition/persistance, restauration, session prolongée et Pause. Après modification, reprendre les mêmes conditions, séparer calcul agent/jeu/inspection, donner médiane et percentile élevé lorsque l'effectif le permet et calibrer le bruit. Le budget initial est d'environ **+10 % maximum sur les chemins maîtrisés non concernés**, après cette calibration. Calculs à la demande, mesures encore valides, invalidation par dépendances/révisions, deltas et traces compactes doivent préserver preuves, contre-exemples, gardes et transactions. Un arrêt de calcul conserve son statut incomplet.

## Journal et prochain lot

| Étape | État | Preuve ou condition |
| --- | --- | --- |
| Plan préparé sur V58 | Conservé | Commit historique indiqué ci-dessus ; jalon natif V57 |
| Réconciliation sur V59 | Acquise | 26/26 entrées restantes concordantes ; groupes communs incomplets conservés |
| Lacune du lot 1 | Reproduite sur V59 immuable | [Ablation ciblée](lot1-evidence/ablation/parent-scope-gap.json.gz) : requête remplacée avec garde admis sans nouvelle réponse pose acquise |
| Implémentation du lot 1 | Gelée, version native `0.32.0` | Extension `retained_typed_material_request_parent` ; digest natif indiqué ci-dessus ; même retour refusé par le contrat séparé du parent |
| Livraison du lot 1 | **Livré, moteur `0.32.0`** | 241 tests, contrôles du projet, campagne LIFE et navigateur, coût des 16 métriques non concernées validés ; limites du chemin modifié documentées |
| Lot 2A | **Livré dans le domaine courant, moteur `0.33.0`** | Producteurs réels raccordés ; 532 tests, comparaison source des appels réels, contribution LS20 et trois niveaux TR87 confirmés au navigateur ; 16 médianes STCK/SMLP dans le budget +10 %, limites et hausses de p95 conservées dans le [rapport](lot2a-current-morphology.md) |
| Lots 2B et 2C | Planifiés, non réalisés | Fournisseurs communs, état de décision, continuation et extension de cible restent à raccorder selon leurs contrats |
| Lots 3 à 10 | Planifiés et conditionnellement éligibles | Préparation autonome possible selon les contrats réellement disponibles |

Le sous-lot 2A clôt cette livraison bornée. La migration globale demeure ouverte : **37 workflows**, **50/76 entrées**, fournisseurs communs incomplets et **six conditions de migration complète encore fausses**. Les audits répertorient 150 transferts de composant, **126 transferts partiels**, **1 093 éléments en attente** et aucun élément déclaré `fully_transferred`. Ces catégories ne doivent pas être assimilées au compteur des 76 entrées. La prochaine étape proposée est 2B ; cette livraison conserve les résultats et preuves historiques des lots précédents.
