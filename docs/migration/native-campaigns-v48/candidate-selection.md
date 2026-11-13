# v48 · Choix du composant et candidat suivant

## Périmètre de cette sélection

Cette note décrit une sélection de capacités à partir de vues publiques
initiales. Elle ne démontre aucune nouvelle réussite en jeu. Les campagnes
réelles, leurs reçus et leurs limites sont conservés séparément.

La recherche réutilise les **100 écrans initiaux publics** déjà enregistrés
dans le [corpus de découverte v47](../../../tests/fixtures/v6-linked-packet-initial-public.json.gz).
Son SHA-256 est
`3f82fb0b60a104095623216023054ef438ca4cc516941c671c385ebcbf1e54f2`.
Le corpus déclare zéro action et zéro saut de niveau. Cette nouvelle lecture
ne lance aucun jeu et ne consulte aucun moteur, état privé ou solution.

Les fonctions originales exécutées viennent du commit épinglé
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les **1 786 fichiers** de son
manifest ont été vérifiés avant import. Les mesures Queued Field sont
également conservées dans la
[référence indépendante v48](../../../tests/fixtures/v6-queued-field-reference.json.gz).

## Composant retenu pour v48

L'observateur original `queued_field_observation.measure` mesure un quadrillage
sur neuf vues. **COLM est la seule vue qui présente simultanément une enveloppe
active mesurée et des prévisions compatibles.** Ce constat choisit un cas
d'évaluation pour `queued_field_composition` ; le nom du jeu ne choisit aucune
règle de production.

La capacité apprend les effets de commandes scalaires sur des membres ordonnés,
puis distingue préparation, réception et phases automatiques à partir des
paquets réellement renvoyés. Plusieurs modèles de fermeture peuvent rester
compatibles. Une estimation de contribution et une relation portable demeurent
conditionnelles ; les gardes et le retour officiel restent nécessaires.

Les sources examinées sont `queued_field_observation.py`,
`queued_field_methods.py`, `queued_field_models.py`, `queued_field_search.py`,
`queued_field_access.py` et `common_queued_field.py`. Les méthodes mécaniques
utilisent seulement la projection nécessaire de `queued_alignment_cascade.py`
et de `mechanical_contracts_b.py`. Le statut des transferts complets de ces
deux derniers fichiers reste explicitement partiel.

## Prochaine capacité candidate : catalogue partiellement visible

Sur le même corpus, l'observateur original
`occluded_catalogue_observation.measure` accepte **une seule vue : GRIL**.
Il y mesure un champ encadré, trois cartes de même étendue native **8 × 8**
et deux contrôles alignés. Ces structures sont des hypothèses de rôles,
sans signification imposée aux couleurs. La signature géométrique mesurée est
`622132fb7ecf157b73ea4362dfd65bc26b288acea14b6fe2201be380423c6fbf`.

Le SHA-256 du fichier observateur source est
`3564eda2c868b7ff9f614aa16837f2ade1ee4630d6f30360a36cd70183eae51f`.
Le composant `framed_window_access.measure`, également examiné sur ces vues,
ne trouve aucune correspondance unique initiale. Cela ne démontre pas son
inutilité sur des vues ultérieures.

La prochaine investigation proposée porte sur l'entrée DRM
`occluded_catalogue_composition` et ses sources :

- `occluded_catalogue_observation.py` : cartes, champ, poses compatibles et
  pixels dont l'absence est effectivement étayée ;
- `occluded_catalogue_methods.py` et le sous-kernel V5
  `occluded_catalogue_projection_d.py` : comparaison conditionnelle des
  projections, avec les autres valeurs laissées inconnues ;
- `occluded_catalogue_access.py`, `catalogue_view_memory.py` et
  `common_occluded_catalogue.py` : acquisition, sélection, réponses et
  demande d'une nouvelle vue fondée sur un effet précédemment observé.

**Le point à résoudre avant de revendiquer trois niveaux est l'acquisition
initiale d'une vue utile.** `CatalogueViewMemory` ne reçoit pas d'emblée une
commande de déplacement connue : une demande de nouvelle vue s'appuie sur un
retour acquis qui a modifié le champ en conservant sa structure. Les valeurs
de fond ne deviennent des indices d'absence qu'après un remplacement
réciproque observé. Une combinaison de réponses sans progression officielle
n'est pas comptée comme correcte.

L'étape suivante doit donc vérifier le parcours froid du caller commun et ses
acquisitions, préserver les contradictions et l'ambiguïté, puis effectuer un
transfert TypeScript avec comparaison indépendante. Aucune campagne GRIL,
victoire, réussite de niveau ou généralisation inter-jeux n'est annoncée par
cette seule mesure initiale.
