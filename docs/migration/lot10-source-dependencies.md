# Lot 10 : dépendances et contrats de reprise

Cette note conserve la lecture des cinq familles du lot 10 au commit V6
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Elle prépare les livraisons successives ;
elle ne revendique aucun port supplémentaire au-delà du périmètre 10A documenté
séparément. Les chemins ci-dessous sont relatifs à
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`.

## Primitives effectivement consommées

| Sous-lot | Dépendances observées dans la source | Conséquence pour le transfert |
| --- | --- | --- |
| 10A `axial_question` | `topological_recolor.geometry.components` ; V5 `axial_field_configuration._state`, `_direct` ; `DWorkBudget` | Porter les mesures et pivots effectivement appelés. Ni moteur complet de force ni achèvement d'une autre famille ne sont requis. |
| 10B `window_question` | `topological_recolor.geometry.components` ; V5 `window_processing_d.TrainRankD`, `WindowReceiverD`, `WindowBeatStateD`, `_window_eligibility`, `_process_one_beat` ; `DWorkBudget` | Couverture conditionnelle avec identités de rang, peinture/capture et bornes propres. Aucun import de `framed_window_composition` n'apparaît dans cette famille. |
| 10C `ordered_recruitment` | `topological_recolor.geometry.components` ; V5 `ordered_front_reduction_d` : occurrences, règles, requête et `measure_ordered_front_reduction_d` ; `DMechanicalScope` | La réduction des têtes est un calcul conditionnel borné. Le cache de réduction est local à la recherche. Une relation ou une recherche incomplète n'établit pas l'impossibilité. |
| 10D `temporal_selection` | `region_intervention.geometry.components`, `digest` ; V5 `station_gated_cargo._rotate_point` | Réutiliser ces contrats géométriques précis. Le port de la famille entière RegionIntervention ou StationCargo n'est pas une dépendance automatique. |
| 10E `invited_endpoints` | V5 `contracts.FrameGrid`, `PeriodicCellGridInput`, `frame.enumerate_periodic_cell_grids` ; `endpoint_navigation_d.LandingNodeD`, `LandingRelationModelD`, `_relation` | Mesure d'une grille et d'une relation entre arrivées. Ni invitation ni projection n'autorisent les cases intermédiaires. L'argument `forecast` existe mais n'est pas exploité par la proposition source. |

Les cinq politiques exécutent leur SRC original par un callback propre :
`axial.select`, `window.select`, `recruitment.select`, `selection.select` et
`endpoints.select`. Les cinq propositions portent `OP18`. Une compilation SRC
préexistante ne démontre ni l'installation du propriétaire ni son exécution.

## Choix distincts

| Famille | Ordre source du choix |
| --- | --- |
| Axial | Priorité DRM, distance en quarts de tour, préférence au contrôle rappelé, commande, indice source. |
| Window | Priorité DRM, coût, indice source. |
| Recruitment | Priorité DRM, coût, nombre de survivants décroissant, indice source. |
| TemporalSelection | Meilleur couple priorité DRM/distance ; abstention si plusieurs indices partagent ce meilleur couple. |
| InvitedEndpoints | Choix principal : priorité DRM, centre comparé lexicographiquement, indice. Choix de reconfiguration : coût d'accès courant puis coût résiduel hypothétique, avec un seul meilleur plan. |

La règle d'unicité n'est donc pas une règle commune à ces cinq familles. Les
gardes revalidant une offre ou une commande sont également distinctes des règles
qui départagent les propositions.

## Acquisitions et conditions source de sauvegarde

Dans `agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py`, chaque acquisition
passive est exclue si ce même propriétaire vient de traiter activement le retour.
Les images avant/après et le paquet public sont transmis. L'événement et l'état
persisté suivent des conditions différentes :

| Famille | Condition de publication de l'état source |
| --- | --- |
| Axial | `selection` ou `rotations` ou `portable` |
| Window | `edits` ou `portable` ou `attempts` |
| Recruitment | `methods` ou `portable` ou `attempts` |
| TemporalSelection | Publication inconditionnelle de l'état après acquisition |
| InvitedEndpoints | `events` ou `portable` |

Les checkpoints natifs complets ne doivent pas être confondus avec ces
publications sémantiques. En particulier, Axial ne publie pas son état source pour
`attempts` ou `last` seuls, et Window ne le publie pas pour `launches` seuls.

## Points à préserver lors des reprises

**10B.** Un champ modifié observé fournit la méthode d'entrée. La proposition
distingue le premier réglage du plan et son lancement. L'action pointée est liée
à la boîte, à sa valeur courante et au payload exact. Le domaine de configurations
est borné à 4 096 ; les projections V5 ont leurs budgets propres. Les paquets de
lancement attestent une animation, sans acquérir un modèle mécanique complet.
À la frontière, la source transporte les éditions et leurs lancements seulement
si les éditions sont présentes, puis efface le contexte courant.

**10C.** Une continuation est admissible si son prochain contexte attendu,
sa légende et son ordre correspondent exactement aux mesures actuelles. Un retour
compatible conserve le suffixe ; divergence et frontière l'effacent. La recherche
conserve son état tronqué, et les hypothèses de file, d'ajout et d'égalité restent
distinctes des relations effectivement calibrées par un retour.

**10D.** Les méthodes de lancement et les examens de frontière survivent à
`scope`, contrairement aux mesures, sélections, tentatives et réponses courantes.
Un lancement réutilise la commande acquise complète et n'a pas de liaison pointée.
L'examen de l'ancien niveau utilise les images compatibles avec ses ancres ;
l'image canonique du nouveau niveau ne doit pas devenir une preuve de l'ancien
effet. Cette conservation doit rester compatible avec le nettoyage du lot 5.

**10E.** La mémoire source omet le cache de mesure ; la restauration le vide.
Les méthodes transportées ne rétablissent pas une permission courante. Une arrivée
sous l'acteur, une visite et la disparition d'un marqueur après le départ ont des
statuts différents. La continuation doit retrouver l'acteur attendu, la cible et
une invitation actuelle ; le contexte de corps repose sur la couche publique
observée. Les deux sélections, principale et reconfiguration, restent séparées.

## Ordre de stratégie

`agents/yf_arc3_v6/morphology_policy/strategy.drm` place Axial après
`topological_recolor`, puis Window et Recruitment. TemporalSelection et
InvitedEndpoints viennent après `reactive_contact`, `ordered_reaction`,
`chart_navigation` et `region_intervention`. L'ordre de livraison 10A à 10E ne
permet pas de déplacer ces entrées dans la stratégie. L'ordre d'acquisition du
caller est un contrat distinct et doit être réconcilié séparément.

Sources de cette note : `family.py`, `geometry.py`, `policy.py`, SRC et DRM des
cinq dossiers sous `agents/yf_arc3_v6/morphology_policy/`, plus
`ordered_recruitment/projection.py`, `temporal_selection/response.py`,
`strategy.py`, `strategy.drm` et `laya_proto/common_frontier_runtime.py`.
