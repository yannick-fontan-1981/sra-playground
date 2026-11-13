# Lot 3D : filiation de la ligne enracinée

## Périmètre et statut

Le lot raccorde `rooted_line_plan`, quatrième branche propre de la façade `observed_composition_services`, au propriétaire commun `SharedSeriesConstraint`. Les sources sont celles du commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`** conservé dans `reference/v6`. Les deux exporteurs vérifient les **1 786 fichiers originaux avant et après** leurs appels ; aucun original n'est modifié.

La couche V6 transfère la projection de l'image, la mesure d'un effet de commande, la construction du modèle conditionnel, la proposition, les gardes et son propre journal. Son calculateur V5 transfère seulement le sous-graphe de simulation et de recherche non étagée qu'elle consomme. Les couches parentes déjà transférées restent gérées par le propriétaire commun. **La chaîne héritée originale complète, son digest et la sélection complète de l'appelant original ne sont pas certifiés.**

Ce document décrit la filiation et les contrats de composant. Les résultats de campagne, de contribution réelle, de validation formelle et de coût restent dans leurs reçus séparés. Une projection admise ou un résultat synthétique n'est pas une résolution de jeu. La façade reste partielle, à **4 branches sur 6** ; `ReceptionService` et `ReferencePopulation` restent à transférer. Ce raccord n'ajoute pas d'entrée compilée indépendante au registre de stratégie.

## Sources et cibles

| Source originale | Partie effectivement consommée | Cible native | Qualification |
| --- | --- | --- | --- |
| V6 `laya_proto/rooted_line_projection.py` | `scene`, `physical`, `configuration`, `projected`, géométrie des masques | [v6-rooted-line-observation.ts](../../src/logos-engine/v6-rooted-line-observation.ts) | Composant de projection vérifié |
| V6 `laya_proto/rooted_line_mechanics.py` | `effect`, `model`, `plan` | [v6-rooted-line-mechanics.ts](../../src/logos-engine/v6-rooted-line-mechanics.ts) | Adaptateur de composant vérifié |
| V6 `laya_proto/rooted_line_access.py` | Couche propre `RootedLineAccess`, mémoire, journal, proposition, gardes et acquisition | [v6-rooted-line-access.ts](../../src/logos-engine/v6-rooted-line-access.ts) | Transfert partiel de la classe héritée |
| V5 `capabilities/piercing_plan.py` | `_simulate_model`, clé physique, coût, `measure_piercing_goal`, branche non étagée de `search_piercing_plans` et leurs auxiliaires | [v5-piercing-plan.ts](../../src/logos-engine/v5-piercing-plan.ts) | Sous-graphe consommé ; module partiel |
| V5 `capabilities/piercing_rooted_order.py` | `measure_piercing_intersections`, matériau de tige et ordinal de contact | [v5-piercing-plan.ts](../../src/logos-engine/v5-piercing-plan.ts) | Sous-graphe consommé ; module partiel |
| V5 `capabilities/contracts.py` | Contrats JSON des configurations, effets, modèles, étapes, buts, intersections et recherches consommés | [v5-piercing-contracts.ts](../../src/logos-engine/v5-piercing-contracts.ts) | Domaine JSON fini avec entiers exacts portables |
| V6 `laya_proto/common_observed_compositions.py` | Adaptation de la branche, acquisition unique, enveloppe et restauration communes transférées | [v6-shared-series.ts](../../src/logos-engine/v6-shared-series.ts) | Façade partielle à 4/6 |
| V6 `morphology_policy/strategy.drm` | `rooted_line_question`, raisons, modèle déclaré, ordre des sondages et bornes | Configuration source de l'appelant commun | Politique source sans sélection par code de jeu |

La projection dépend aussi du calcul partagé des composantes, de la revalidation de cadres et de l'identité symbolique. Les oracles emploient les fonctions Python originales de ces dépendances. Les tests natifs comparent leurs sorties exactes sur le domaine consommé. La normalisation JSON native ne remplace ni toutes les coercitions Pydantic ni les entiers Python arbitraires.

Les recherches étagées, profils de stages, continuations, rollout et réconciliation V5 restent exclus. Les autres opérations de `piercing_rooted_order.py` — successeurs de poussée, perçage et retrait, clearance, mouvement de plusieurs tiges et enveloppe de famille — ne sont pas revendiquées comme transférées par ce lot. Les requêtes étagées et les continuations sont explicitement refusées par l'API native consommée.

## Projection et hypothèses

La source recherche un séparateur unique et deux morphologies de racine homologues de part et d'autre. Elle revalide les cadres de référence et mesure leur ordre horizontal. Les matériaux présents doivent correspondre aux types de la référence sans doublon. La bande axiale, le domaine et sa couleur de fond sont ensuite mesurés dans la même image. Les couleurs servent d'identifiants observés ; aucune couleur particulière n'est affectée à un rôle de jeu dans ce port.

La pointe mesurée s'arrête au premier intervalle où toutes les lignes axiales sont du fond. Une pièce contiguë dans cette bande peut donc prolonger la pointe observée jusqu'à son bord. Cette propriété du projecteur est conservée ; le renderer synthétique choisit des transitions dont la projection est réalisable et ne corrige pas le résultat de la source.

La configuration V5 contient un domaine observé dont **la frontière est déclarée inconnue**, la racine complète, les positions admissibles de la racine et le matériau de la tige. Un recouvrement de tige et de pièce crée une **hypothèse de support possible**, jamais un support acquis. L'ordre de référence reste une hypothèse de la bibliothèque de politique. Les lois de poussée, entrée, transport et retrait sont conditionnelles au modèle fourni ; leur succès prévu ne les transforme pas en loi universelle.

`effect` n'acquiert que la translation verticale ou le changement d'extension isolé entre deux scènes de même layout. Une translation horizontale, un changement simultané vertical et axial, l'absence de déplacement ou un changement de layout est refusé. Les noms de commandes restent opaques. `plan` réutilise une configuration acquise uniquement si sa projection physique concorde exactement avec la scène courante ; il actualise alors la référence de frame sans inventer une nouvelle observation de support.

## Calculateur conditionnel et bornes

Le calculateur V5 conserve l'ordre des prémisses et des effets de la source : entrée axiale admissible avant poussée, fermeture des chaînes mobiles, transport d'une charge seulement sous sa loi conditionnelle, maintien et arrêt inverse au retrait, obstacles, domaine fini, domaine de racine et sortie de support. Les supports possibles exigent une hypothèse complète. Une pièce manquante, une pose axiale non ordonnée, une section inconnue ou une frontière inconnue conservent leur témoin de prémisse manquante.

Les configurations prévues restent marquées comme prédites. `rooted_match` ne certifie pas une configuration seulement prévue ; `predicted_rooted_match` sert au calcul nominal. Les intersections ordonnent les pièces depuis la racine et ne confondent pas contact et appartenance au support.

La recherche en largeur trie les modèles par référence puis les effets par référence d'effet et de commande. Sa clé de visite comprend l'état physique et les relations de support, pas les nouvelles identités, les frames ou la provenance. Un cycle ne devient donc pas un état nouveau par changement de digest. Le but est testé avant la borne de profondeur : un but initial peut produire un témoin vide, que l'accès V6 n'utilise pas comme préfixe d'action.

Les bornes de nœuds, profondeur, micro-étapes et chemins témoins conservent leurs sorties incomplètes et leur frontière ouverte. `max_plans` borne les clés de chemin témoin ; plusieurs modèles peuvent partager le même chemin. Un arrêt physique avant l'extension demandée peut encore produire un successeur utile si ses prémisses sont complètes.

La source ne vérifie l'échéance physique qu'à l'entrée de `propose_graph`. L'extension native `PiercingNativeBudget` permet aussi une interruption pendant la recherche et ses calculs par `deadlineMs`, `now` ou `shouldStop`. Elle déclare `bound.native_interruption`, une recherche tronquée et une frontière ouverte. Une simulation interrompue n'est pas transformée en étape validée. Les témoins déjà complets restent distincts du travail interrompu. Les tests d'horloge native sont séparés de la parité source ; aucune égalité des compteurs dépendant du temps de machine n'est revendiquée.

## Proposition, gardes et acquisition

La proposition conserve d'abord l'ordre de calibration des contrôles disponibles déclaré par la source. Un contrôle déjà essayé sans effet exploitable n'est pas réessayé implicitement dans la même époque. Lorsque les contrôles requis sont connus, le plan reçoit tous les effets retenus ; la garde vérifie ensuite que la commande retenue est actuellement disponible. La profondeur est limitée aussi par le budget d'actions restant et le préfixe par seize actions.

Un refus de modèle contredit, de contrôle non résolu, de recherche non résolue ou d'échéance reste `unknown` avec `block_unrelated_probe`. Il n'autorise pas une sonde sans rapport. L'absence de scène ou de configuration de question délègue aux ancêtres transférés. La formation d'une proposition ne modifie pas la mémoire acquise. L'observation courante figure dans les références de preuve après déduplication, sans coupure arbitraire de l'historique.

Avant la première action, la garde lie l'identité du plan, les commandes du plan et du bundle, l'époque, le score, le layout, les pixels, la référence d'observation et la disponibilité de la commande. Pour la continuation, la projection physique précédente doit correspondre à la prédiction. Une mutation du plan, une scène absente ou un contexte périmé refuse l'action. Après l'action, une frontière d'époque ou de score, une scène inconnue ou une divergence ferme le préfixe ; une calibration n'a pas de projection prédite et ferme également ce préfixe.

L'acquisition a plusieurs distinctions source conservées explicitement :

- Une calibration sans effet observable ajoute la commande à `tried` mais ne crée pas de contrôle.
- Une prédiction physique concordante retient sa configuration ; une divergence efface `current` et mémorise la réfutation dans l'époque.
- Un changement d'époque efface `current` et `tried`, tout en conservant les contrôles, les preuves et les réfutations historiques.
- Dans `record`, la frontière est définie par l'époque seulement. Une variation isolée du score ferme le préfixe dans `after`, mais n'empêche pas l'acquisition de l'effet dans `record`.
- Dès qu'un `rooted_line_plan` existe, le retour produit son événement propre, même si la scène suivante manque ou qu'une frontière est franchie. Ce retour conserve les références d'observation sans inventer un effet ou une réfutation.

## Propriétaire commun et restauration

La chaîne source pertinente est `RootedLineAccess → PanelServiceAccess → RelationalChamberAccess → ExposedReceptionAccess → ancêtres`. `ReceptionServiceAccess` puis `ReferencePopulationAccess` sont au-dessus de RootedLine dans l'appelant source complet et restent hors de ce lot.

| Opération native transférée | Ordre et propriété |
| --- | --- |
| Proposition et gardes | RootedLine, Panel, Chamber, Exposed, puis les ancêtres transférés |
| Candidats de point | Aucun nouveau générateur RootedLine ; ordre existant conservé |
| Acquisition propre | Ancêtres transférés, Exposed, Chamber, Panel, RootedLine, puis paquet public commun |
| Journal | Un propriétaire commun ; `observed_rooted_line` est routé une seule fois vers `RootedLineMemory` |
| Digest natif | Nouvelle couche conditionnelle après Panel, avec mémoire et événements propres |
| Restauration | Réducteurs temporaires, vérification complète du digest, publication atomique après réussite |

`RootedLineMemory` possède uniquement `line_memory` et `line_events`. Son identité d'objet, sa révision et son témoin structurel participent au certificat de travail commun. Les entrées et exports sont détachés ; l'acquisition invalide les certificats correspondants. Les checkpoints réels de la publication 0.44 conservent leur digest tant que la nouvelle couche est vide. Restaurer un checkpoint ancien rétablit aussi cette couche vide et élimine ses acquisitions postérieures.

Cette compatibilité de checkpoint est une enveloppe de migration native. Dans les fixtures de composant, `parentDigest` est calculé par `PanelServiceAccess.retained_digest` original et fourni comme frontière opaque au digest propre natif. Comparer le suffixe propre avec cette frontière ne démontre pas que l'ensemble des ancêtres natifs reproduit le digest Python complet.

## Oracles et preuves

Les [reçus d'export](lot3d-evidence/diagnostic/source-oracle-export.json) lient les empreintes de chaque fixture aux fichiers source et aux 1 786 vérifications avant et après. Les exporteurs sont [V5](../../scripts/export-v5-piercing-reference.py) et [V6](../../scripts/export-v6-rooted-line-reference.py). Ils exécutent les fonctions originales, pas une réécriture de leur résultat attendu.

| Oracle | Couverture exacte conservée |
| --- | --- |
| [V5 piercing](../../tests/fixtures/v5-piercing-reference.json.gz) | 77 cas : 6 normalisations, 46 simulations, 10 mesures de but, 4 intersections, 11 recherches bornées |
| [V6 RootedLine](../../tests/fixtures/v6-rooted-line-reference.json.gz) | 53 cas de composant : scènes, physique, configuration, projection, effets, modèle, plans, propositions, acquisitions et restauration |
| Gardes source V6 | 19 cas : initial, continuation, mutants, scène absente, disponibilité, époque, score, référence et divergence |
| Projection publique initiale | 99 images déjà archivées, zéro action et zéro saut de niveau ; CWSE exclu avant chaque appel du projecteur |

Le seul code de jeu admis par la projection source dans ces 99 images est **SK48**. Ce constat choisit un cas de diagnostic ; il ne prouve ni une sélection par l'appelant commun ni une résolution. Aucun moteur de jeu, spécification ou solution n'entre dans ces exports. Le code de production ne reçoit pas le nom SK48 pour décider d'une proposition.

La revue indépendante a exécuté les deux suites de composant V6 et retrouvé **91/91 tests réussis**. Le reçu [component-review.json](lot3d-evidence/diagnostic/component-review.json) conserve la commande, les empreintes et le journal. Les tests V5, les tests d'intégration, le gel de livraison, les rejeux, la campagne et la mesure de coût ont leurs validations propres ; ils ne sont pas déduits de ce seul résultat.

## Diagnostic du trajet public SK48

Après la session native gelée 0.45, un [rejeu indépendant de son journal public](lot3d-evidence/diagnostic/sk48-public-parity.md) a été effectué depuis une mémoire propre vide. La source et le natif concordent sur les cinq propositions, douze acquisitions, vingt-quatre gardes avant/après, états propres et restauration : **126 contrôles sur 126**. La mémoire native des propositions n'amorce jamais ce rejeu.

La session atteint douze actions et aucun niveau résolu. Après sept projections conditionnelles concordantes, la huitième est contredite : les déplacements de deux pièces dépassent ceux du modèle, tandis que racine, pointe et première pièce concordent. La source et le natif ferment alors le préfixe, retiennent le même contre-exemple et retournent le même refus `conditional_contact_model_refuted`. Le diagnostic confirme la fidélité du port sur ce trajet et une limite du modèle conditionnel hérité ; il ne ferme pas la cible de résolution SK48. Aucune nouvelle session ni correction propre à ce jeu n'est ajoutée par ce diagnostic.
