# OP01–OP31 — couverture du noyau TypeScript reconstruit

## Statut

Le noyau TypeScript reconstruit possède désormais une preuve ciblée de calcul
pour **OP01 à OP31**.

Cela ne signifie pas que les 31 opérations sont appelées utilement par le
runtime. Le chantier conserve la distinction :

**calcul correct → appel observé → résultat consommé → contribution à la décision**

## Couverture par lots

- C2 : OP18, OP28, OP29, OP30, OP31 ;
- C3 : OP03, OP04, OP08, OP09, OP11, OP12, OP14, OP26 ;
- C4 : OP01, OP02, OP05, OP10, OP15, OP25 ;
- C5 : OP06, OP07, OP13, OP20, OP21, OP22, OP23 ;
- C6 : OP16, OP17, OP19, OP24, OP27.

## Propriétés de régression verrouillées

Exemples :
- OP02 garde `incomplete` lorsque l'équivalence n'est pas prouvée ;
- OP03 conserve `unknown` ;
- OP07 exige une preuve d'objectif non vide selon la vérité Python ;
- OP09 exige un domaine d'alternatives complet ;
- OP12 conserve les inconnues pendant le parcours borné ;
- OP14 refuse la release si la préservation est violée ;
- OP16 ne transforme pas l'absence de deadlock fourni en preuve de sûreté ;
- OP19 s'arrête au premier pas non prouvé ;
- OP23 garde `unknown` sans cycle prouvé ;
- OP25 conserve seulement les candidats non réfutés sans déclarer leur faisabilité ;
- OP26 exige un accès vérifié vers la cible ;
- OP27 exige toutes les références protégées ;
- OP29 conserve confirmed/refuted/unknown ;
- OP30 filtre preuve/révision et reste `persisted_only` ;
- OP31 reste `information_only` sans propriétaire d'objectif démontré.

## Parité Python → TypeScript

Une divergence a été trouvée puis corrigée : la vérité des conteneurs vides.

Le helper `pythonTruthy()` aligne les chemins concernés sur le donneur Python.
Régressions ajoutées pour listes/preuves/questions vides.

## Tests

Dernière suite locale complète :
- typecheck strict : OK ;
- **56/56 tests passent**.

## Performance

Diagnostic synthétique seulement :
- instrumentation légère `counters` : aucun signal >10 % sur le dernier run ;
- trace détaillée : trop coûteuse pour le mode normal ;
- cache sans hit réel : trop coûteux pour une activation globale.

Qualification officielle :
**fonctionnellement qualifié, performance officielle à confirmer**.

Le harness STCK/SMLP et le worker SRA officiel restent absents de la
reconstruction canonique.

## Conclusion

La question « les 31 calculs sont-ils disponibles et protégés par des
régressions ? » est maintenant couverte.

La question « les 31 opérations sont-elles toutes nécessaires et utilisées
par le runtime ? » reste volontairement **non** résolue par un compteur.
Les dispositions C0–C7 continuent de décider opération par opération si le
besoin existe, s'il est couvert par une fonction spécialisée ou s'il reste
non raccordé.
