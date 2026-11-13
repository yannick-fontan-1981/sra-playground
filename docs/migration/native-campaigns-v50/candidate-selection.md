# v50 · Prochaine capacité candidate : composition de services entre champs

## Sélection sur les seules vues publiques conservées

Cette sélection relit les **100 écrans initiaux publics** du
[corpus v47](../../../tests/fixtures/v6-linked-packet-initial-public.json.gz),
dont le SHA-256 est `3f82fb0b60a104095623216023054ef438ca4cc516941c671c385ebcbf1e54f2`. Elle ne charge aucun hôte de jeu,
n'exécute aucune action, aucun proposer d'agent et aucune acquisition simulée.
Les métadonnées du corpus déclarent zéro action et zéro saut de niveau.

Les **1786 fichiers** du source épinglé au commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` sont
vérifiés avant et après les mesures. Les seuls appels source sont
`geometric_observer.components`, `geometric_observer.framed_patterns` et
`field_service_access.paired_controls`. Le filtre initial de motif compact
et le filtre géométrique de contraste reprennent les critères de la politique
source ; ils produisent des mesures, sans proposition exécutable.

Les résultats des motifs sélectionnés et des paires concordent exactement
avec les 100 mesures readonly déjà conservées en v49. Le
[script reproductible](../../../scripts/select-v50-next-candidate.py) et les
[mesures complètes](candidate-selection.json) conservent les empreintes,
les critères, les références d'observation et toutes les alternatives.
L'[audit des entrées](../v6-entry-point-progress.json) confirme que
`field_service_composition` est encore `pending`.

| Critère visuel courant | Vues admises |
| --- | ---: |
| Unique plus petit motif compact dans une enceinte carrée fermée | 11 |
| Au moins une paire de motifs réfléchis de même apparence | 22 |
| Coexistence de ces deux mesures | 2 : KEYD et VALV |
| Ces deux mesures et une unique enceinte distincte de même dimension | 1 : **VALV** |

Les vues admettant le motif compact sont SKBN, CLRS, SWCH, SEQN, MIND, KEYD, VALV, ESCT, FITE, GIGO, DAME. Sur VALV,
l'observateur mesure **8 paires de motifs**.
La conjonction de mesures justifie ce candidat pour le transfert de la chaîne
source. Elle ne prouve ni qu'un motif est une commande, ni qu'un champ
représente une ressource, ni qu'une action conduira à un progrès officiel.

## Capacité retenue : `field_service_composition`, évaluée sur VALV

Le nom du jeu sert uniquement à identifier l'évaluation. La sélection vient
des mesures courantes et la future logique devra conserver les conditions
génériques suivantes :

1. Mesurer un motif compact et acquérir son retour réel. Séparer les changements
   locaux et distants, sans lui attribuer un rôle physique au départ.
2. Acquérir des champs persistants à partir des différences effectivement
   observées, puis comparer leurs étendues en pixels après une répétition.
3. Tester une enceinte courante distincte et constater réellement une
   restauration avant d'examiner une composition de service.
4. Relier le remplacement observé, un champ corrélé et une paire mesurée ;
   tester l'isolation et le service, en conservant les inconnus et les refus.
5. Après une frontière officielle, rattacher les rôles retenus à la géométrie
   actuelle et revalider leurs effets avant une réutilisation entre époques.

Le périmètre propre attendu comprend `nested_control_access.py`,
`envelope_fill_observation.py`, `envelope_fill_access.py`,
`field_service_access.py`, `service_transfer_access.py` et
`common_field_service.py`, avec leurs dépendances réellement appelées.
Leur mémoire hérite de la couche Radial déjà transférée : son ordre,
son digest et ses gardes devront être respectés. Les événements
`nested_control_response`, `envelope_fill_context`, `field_service_context`
et `field_service_transfer` devront provenir des retours réellement acquis.

La mesure initiale ne remplace pas les préconditions source de restauration,
de changement de contenu et de confirmation officielle. Une enceinte
apparemment pleine conserve un statut d'hypothèse ; les volumes, capacités,
seuils, durées et lois de passage restent inconnus tant qu'ils ne sont pas
étayés. Aucun contexte appris n'est créé par cette sélection.

**Prochain objectif : transférer cette capacité générique, puis évaluer une
session froide continue de VALV visant au moins ses trois premiers niveaux.**
Cette note ne revendique aucune action exécutée, aucun niveau terminé et
aucune victoire de VALV.
