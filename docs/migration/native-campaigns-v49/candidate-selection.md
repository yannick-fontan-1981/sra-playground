# v49 · Prochaine capacité candidate : circulation de matière typée

## Une sélection sur des vues déjà publiques

Cette sélection relit les **100 écrans initiaux publics** du
[corpus v47](../../../tests/fixtures/v6-linked-packet-initial-public.json.gz).
Elle n'exécute aucun jeu, aucune commande ni aucune proposition. Aucun moteur,
état privé, oracle ou fichier de solution n'est consulté.

Le corpus a pour SHA-256
`3f82fb0b60a104095623216023054ef438ca4cc516941c671c385ebcbf1e54f2`.
Ses métadonnées déclarent zéro action et zéro saut de niveau. Les
**1 786 fichiers** du source épinglé au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` ont été vérifiés avant l'import des
fonctions originales. Les mesures complètes, les noms de fonctions et les
empreintes des sources sont conservés dans
[candidate-selection.json](candidate-selection.json).

Deux entrées encore non connectées ont été examinées :
`typed_material_flow` et `field_service_composition`. Il s'agit d'un examen
borné de leur point de départ visuel, pas d'un classement des 100 jeux selon
leur difficulté ou leurs chances de réussite.

| Mesure originale appelée | Vues initiales acceptées | Portée du constat |
| --- | ---: | --- |
| `typed_carrier_scene.measure` | **1 : LIFE** | Quatre supports denses, avec marques internes typées et apparences mesurées |
| `NestedControlAccess.nested_question` | 11 | Une question sur le plus petit motif compact sous une enceinte carrée |
| `field_service_access.paired_controls` | 22 | Présence d'au moins une paire de motifs symétriques, sans rôle de commande acquis |

Les onze vues qui admettent la question de motif compact sont SKBN, CLRS,
SWCH, SEQN, MIND, KEYD, VALV, ESCT, FITE, GIGO et DAME. VALV présente aussi
huit paires de motifs. Une telle coexistence ne suffit pas à établir la
composition de service : le composant attend des changements et une
restauration effectivement observés dans les champs concernés.

## Candidat retenu : `typed_material_flow`, évalué sur LIFE

**LIFE est la seule vue initiale acceptée par l'observateur de supports à
marques typées dans ce corpus.** La politique source demande des supports
denses contenant plusieurs marques internes clairsemées et au moins deux
occurrences partageant une partie du vocabulaire de marques. L'observateur
en mesure quatre ici. Les valeurs de palette, les positions et les rôles ne
sont pas sélectionnés par le nom LIFE.

La prochaine étape doit transférer la chaîne de raisonnement suivante :

1. Mesurer les supports et leurs marques, puis acquérir l'effet d'une sélection
   ou d'une interaction avec un autre support.
2. Vérifier si un remplacement conserve des sous-structures typées observées,
   et si une nouvelle interaction fait apparaître des occurrences issues de
   ce remplacement.
3. Comparer ces occurrences aux requêtes actuellement visibles, sous une
   hypothèse d'apparence ou une association antérieure explicitement rappelée.
4. Acquérir une association seulement après une consommation effectivement
   observée avec changement de la requête, ou après une frontière officielle.
5. Examiner les orientations et contrôles courants lorsque la comparaison
   directe ne suffit plus, avec gardes de pose et préservation de l'extérieur.

Le périmètre source attendu comprend `typed_carrier_scene.py`,
`typed_carrier_access.py`, `typed_material_observations.py`,
`typed_material_flow.py`, `typed_pose_access.py` et
`common_typed_material_flow.py`, avec leurs dépendances réellement appelées.
La première action doit venir du caller commun froid et de ses mesures,
puis être acquise comme une expérience. Une règle de production, de filiation,
de destination ou de rotation ne peut pas être déclarée connue au départ.

**Objectif de validation suivant : une campagne froide de LIFE visant ses
trois premiers niveaux.** Cette note identifie un candidat pour la prochaine
capacité ; elle ne démontre aucune action réussie, aucun niveau terminé et
aucune victoire de LIFE.
