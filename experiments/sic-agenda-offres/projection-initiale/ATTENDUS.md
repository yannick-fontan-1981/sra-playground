# SK48 · Plan conditionnel après calibrage · Attendus avant correction

Parent `08fa10a6b9986e7028551fbfc9d9e16eb83726b7`, code moteur identique au gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le contre-exemple public de l'opérateur est à `5804fc7d73c6b7655d97bca777aed9fb6475acef`, fiche `{"version":"sic.contact/1","couleurs":[9,14],"pack":{},"gestes":5}`.

Au choix du geste 5 de SK48 N1, quatre contrôles ont été mesurés. La cible visible, le support et les trois pièces sont mesurables. Il n'existe encore aucun témoin de réfutation ni besoin de la ligne 96. Le besoin fonctionnel est de trouver un accès conditionnel qui teste l'ordre du bandeau sur la tige. Le fournisseur ne lui attribue aucun identifiant de besoin de récupération. Avec 9↔14, sa recherche retourne `rooted_contact_plan_unresolved` à la borne de 1 000 expansions. Le service s'arrête par `frontier_unknown`. Le gel libère `ACTION1` au même point sur les couleurs originales et sur 8↔14, après 282 expansions.

| Témoin | Critère fixé |
|---|---|
| Préservation physique | Après inversion du renommage, comparer pixels, ordre visible, positions et masques des pièces, support, pointe, commandes disponibles et contrôles issus des quatre retours. Rejouer les onze effets du plan historique dans le modèle et comparer chaque projection physique. |
| Première divergence du candidat | Même préfixe de quatre actions. Pour 9↔14, au choix 5 obtenir un essai conditionnel gardé, attendu `ACTION1`. L'ordre final reste indéterminé pour deux pièces à la station 26. Ni alignement établi, ni succès officiel inféré. |
| Égalité et renommage pur | Les premières stations sont 20, 26 et 26. Sans changer la géométrie ni les types demandés, permuter seulement les identifiants des pièces, avec rebinding de toutes leurs références. Le statut de la preuve et l'admissibilité de l'essai doivent rester identiques. Dans la classe liée, l'une ou l'autre séquence demandée reste compatible et incertaine. |
| Ordre strict | Une cible qui exige une pièce de la station 26 avant celle de la station 20 est contredite. La compatibilité locale d'un sous-groupe ne peut pas couvrir cette inversion. Contrôler aussi le cas de trois stations distinctes réellement dans l'ordre. |
| Retour réel | Rejouer nominal, 8↔14 et 9↔14 depuis le départ actif. Le témoin historique refuse la projection au 12. Seules les acquisitions du jeu permettent la reprise 96 et la progression du niveau. Tester aussi le repositionnement et la preuve étrangère du lot 96, qui doit continuer à suspendre. |
| Autres producteurs | Le noyau V5 garde par défaut son contrat de référence. Seul le fournisseur du plan conditionnel de tige opte pour l'essai compatible. Vérifier le comportement historique par défaut, les tests du noyau et le résultat local de 96 indépendamment de l'accès depuis L1. |

Le reçu doit identifier l'ordre demandé, les groupes aux mêmes stations et le caractère conditionnel de la proposition. Les limites de recherche du moteur sont conservées. Aucun identifiant de couleur, de jeu ou de pièce ne détermine le nouvel ordre.
