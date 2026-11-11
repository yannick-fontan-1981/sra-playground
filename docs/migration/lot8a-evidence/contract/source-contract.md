# Contrat source et périmètre du lot 8A

Déclaration initiale : `2026-11-11T16:45:09.868537+00:00`. État : implémentation et preuves en cours ; aucun test réussi n'est déduit de cette déclaration.

## Source figée

- Référence : `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.
- Module : `agents/yf_arc3_v6/laya_proto/common_motif_access.py`, **290 lignes / 18 150 octets**.
- SHA-256 du module : `6f9662132299c51137531e9ae2df7df89bd079428ef465eaf3610d1dad22f346`.
- Propriétaire : `MotifAccess` ; entrée : `motif_conditioned_access`, dans l'ordre déclaré de `factored_material_return`, avant `parallel_branch_routing`.
- Dépendances réutilisées : composants et motifs encadrés observés, projection et empreinte de lignes, empreinte symbolique, domaine de points, programmes communs et magasin partagé.

Les fichiers originaux sont immuables. Les attentes de l'oracle sont séparées des entrées de production.

## Comportement conservé

Le propriétaire mesure une unique grille régulière de commandes et les cartes géométriques compatibles. Il recherche un corps bicolore carré et une cible encadrée homologue, qui demeurent des hypothèses observées. Les couleurs, tailles, commandes et positions viennent de l'observation actuelle.

La proposition conserve l'ordre source : route à partir des déplacements mesurés ; visée conditionnelle d'un rayon observé ; calibration d'une commande encore inconnue à la pose actuelle ; sélection puis activation d'un motif. Les cartes encore inconnues précèdent les cartes déjà apprises, puis les égalités sont départagées par taille et masque selon l'ordre Python. L'absence de route n'est pas une preuve d'impossibilité.

Les préfixes de déplacement et de bascule sont limités par le restant et 16 primitives, puis coupés à la première transition non vérifiée. Une activation à effet inconnu termine le préfixe. Nuance source conservée : la branche de calibration émet une seule action même si le propriétaire est appelé directement avec `remaining=0` ; le moteur conserve son propre contrôle préalable du budget d'actions.

La garde vérifie époque, progression officielle, commande disponible, référence de l'observation initiale pour la première primitive, pose et bits actuels. La comparaison après action ferme le préfixe à une frontière officielle ou à un effet non conforme / encore inconnu. Une route vide est falsy dans le Python et ne déclare jamais une réussite officielle.

## Acquisition et persistance

`record` est l'unique propriétaire des retours sélectionnés. La clé d'épisode source est `motif:{revision}`. Aucun apprentissage passif d'un retour destiné à une autre famille n'est ajouté.

Les déplacements axiaux mesurés, les obstructions liées à une projection actuelle, la validation ou la réfutation d'une bascule, l'effet du motif et les éventuelles trajectoires publiques sont retenus dans l'ordre source. `learned.body_change` signifie seulement `new != old` ; il peut être vrai lorsque le corps n'est plus mesurable, sans prouver un accès ou un succès.

`learned`, `motion`, `passed` et `events` persistent entre époques. La grille, les essais par pose, les validations de préfixe, la sélection, les références locales, l'encre, le rayon, la direction, les obstructions et la pose suivie sont réinitialisés par `start` selon la source. La restauration native doit valider puis reconstituer cet état par valeur, sans acquisition supplémentaire.

## Raccordement de stratégie

Le dernier fallback `regular_field_correspondence` conserve l'exclusion source de `strategy.py` : si `exclude_observed_control_interface` est actif, une grille de motifs unique avec un corps mesurable exclut seulement cette correction de champ. Les sous-questions antérieures et les groupes suivants restent à leur place ; ce cas n'est pas un refus global.

La proposition garde les trois faits source (`observed_regular_input_field`, `measured_card_instances`, `composite_body_observed`), une composition `information_question` avec `observed=false`, et OP18. L'admission commune, la liaison actuelle, WHY/ACT et l'autorisation d'action restent nécessaires. Aucun témoin de réussite acquise n'est inventé pour la calibration froide.

## Extension native déclarée

Le profil de production borne la recherche à **8 192 états retenus / 16 384 entrées de frontière**, avec échéance et interruption coopérative. Une recherche incomplète produit un diagnostic courant `unknown`, sans autorité d'action, sans chemin partiel et sans repli vers une autre expérience supposant que la recherche s'est achevée. Le profil source sans cette limite reste distinct pour les comparaisons différentielles. Ce profil borné n'est pas revendiqué comme une recherche Python inchangée. La limite porte sur les états, sans constituer un plafond en octets : chaque état conserve son chemin complet, dont le stockage peut croître quadratiquement au pire. Les contrôles coopératifs de délai ne prouvent pas une limite de latence pour toutes les mesures géométriques.

## Preuves attendues et limites

L'oracle porte sur des scènes synthétiques indépendantes. Il doit couvrir les géométries ambiguës, changements de pose, effets contraires, conservation puis consommation des acquis, restauration et frontières officielles. Le parcours du moteur commun doit démontrer une acquisition unique et une décision suivante effectivement influencée par le retour. Les scènes synthétiques ne sont pas présentées comme des niveaux de jeu gagnés.

La connexion d'une entrée, la validation d'un composant, le succès d'une campagne et la migration complète sont des métriques distinctes. Les six portes de migration complète restent fermées. Le routage de branches parallèles reste 8B.
