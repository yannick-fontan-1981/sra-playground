# C3 complément — OP04 / OP09 / OP11 / OP14

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Source examinée : runtime Python V6 publié au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

## OP04 — Ouvertures

Calcul générique :
- pour le focus, retourne les compositions dont au moins une exigence est
  satisfaite par un effet déclaré du focus.

Limite :
- un seul lien effet→exigence suffit au calcul ;
- cela ne prouve pas la réalisabilité de la suite.

Recouvrement spécialisé :
- `CompositionTargetTree.extend_target()` construit des dérivations bornées
  liées à un parent justifié ;
- seules les routes possédant des actions deviennent éligibles ;
- alternatives, preuves et limites sont conservées ;
- `bind()` revalide ensuite les conditions de l'enfant et la route courante.

Qualification :
**recouvrement spécialisé fort, mais pas équivalence générique.**
Le target tree consomme des ouvertures dans ses familles avec davantage de
preuves. Aucun consommateur OP04 transversal n'est démontré.

## OP09 — Obligatoires

Calcul générique :
- exige `alternatives_complete is True` et un domaine non vide ;
- sinon retourne `status=incomplete` et `mandatory=None`;
- seulement avec domaine complet, calcule l'intersection des alternatives.

Recouvrement spécialisé :
- le target tree conserve des `alternatives`, mais rien n'établit qu'elles
  représentent **toutes** les solutions possibles ;
- la sélection spécialisée ne revendique donc pas de prérequis « obligatoire »
  global à partir de ces alternatives.

Qualification :
**aucun équivalent OP09 démontré.**
C'est une bonne barrière sémantique : les alternatives connues du runtime ne
doivent pas être promues en domaine complet.

Disposition :
- besoin générique non raccordé ;
- ne pas appeler OP09 sans preuve explicite de complétude du domaine.

## OP11 — Déblocages

Calcul générique :
- construit pour chaque composition les autres compositions ouvertes par ses
  effets.

Recouvrement spécialisé :
- le target tree relie parent, enfant, route et `child.requires` ;
- `extend_target()` utilise des dérivations observées et routes éligibles ;
- `bind()` refuse un enfant si ses conditions courantes ne sont pas satisfaites.

Qualification :
**recouvrement spécialisé familial, pas graphe générique de déblocage.**
Le runtime sait déjà rattacher certains préparatifs à une cible précise.
Aucun besoin n'est démontré pour reconstruire tout le réseau OP11.

## OP14 — Contraintes / préservation

Calcul générique :
- ne conserve que les compositions prêtes ;
- pour chaque propriété à préserver, compare l'effet déclaré ou, si absent,
  reprend le fait courant.

Risque :
- une propriété absente de `effect` n'est pas une preuve physique d'absence
  d'effet secondaire.

Consommation réelle du donneur :
- `operation_admission()` possède un contrat physique explicite pour OP14,
  au même titre qu'OP18 et OP28 ;
- l'outcome guard doit sélectionner la composition attendue ;
- la release exige à la fois `validate_bundle()` et cette admission par résultat.

Mécanisme spécialisé de préservation :
- `common_preservation.py` lie les obligations à des témoins ;
- une modification nécessite une révision autorisée ;
- changement d'époque → refus ;
- condition changée ou occluse/inconnue → préfixe scellé ;
- `validate_bundle()` exige toutes les `preserve_refs` avec preuves.

Qualification :
**OP14 possède une consommation réelle de garde dans le donneur, complétée par une couche spécialisée de préservation plus forte.**

Disposition :
- OP14 : calcul + consommation de garde démontrés dans le donneur ;
- ne pas considérer l'OP seule comme preuve de sûreté ;
- la preuve physique reste portée par les obligations/témoins et leur revalidation.

## Synthèse C3 complète

| OP | Disposition donneuse |
| --- | --- |
| OP03 | garde booléenne spécialisée ; tri-état générique encore distinct |
| OP04 | ouvertures spécialisées via target tree ; usage générique non démontré |
| OP08 | prédécesseurs spécialisés par familles ; producteur générique non démontré |
| OP09 | aucun équivalent ; exige domaine complet prouvé |
| OP11 | déblocages spécialisés par target tree ; réseau générique non démontré |
| OP12 | inconnues d'accès spécialisées ; dépendances génériques distinctes |
| OP14 | consommation réelle de garde + préservation spécialisée forte |
| OP26 | admission d'accès spécialisée ; filtre multi-accès générique non démontré |

Aucun appel artificiel n'est ajouté.
