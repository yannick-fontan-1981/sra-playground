# Lot 9C3 — jointure publique réelle STCK et frontière de performance

Date : 13 novembre 2026 (America/Recife)

Branche de travail : `recovery/lot9c3-stck-joint-boundary-20261113`

Base canonique : `342d14b990169e292ec1078cef3ef297302b2baa`

## Positionnement

9C2 a qualifié une première jointure réelle sur SMLP. 9C3 devait soit qualifier
une seconde jointure réelle sur STCK, soit démontrer durablement que STCK ne
constituait pas un corpus applicable. Le présent lot retient la première voie :
le corpus public STCK déjà qualifié en 9B fournit une décision ACTION6 qui peut
être séparée en deux contributions symboliques non redondantes.

Cette qualification ne prétend pas restaurer un ancien `joint_channels`, ne
modifie pas le compteur historique des 76 points d'entrée et ne constitue pas
encore une qualification officielle de performance 9C.

## Producteur public STCK

Le producteur `public_stck_stack_or_shop_target_v1` lit uniquement :

- l'image publique 64x64 en indices de palette ;
- la liste publique des actions disponibles ;
- la session et la révision publiques.

Il ne reçoit aucun plateau moteur, état privé, fixture, solution préparée ou
route cachée.

La sélection reproduit la frontière publique déjà exercée par le corpus 9B :

1. un segment shop visible doit être présent dans la zone publique inférieure ;
2. tant qu'une carte de pile visible existe, la carte la plus basse est visée ;
3. lorsque la pile visible est vide, le premier segment shop visible devient la
   cible ;
4. sans cible publique revalidable, aucune proposition n'est produite.

## Deux canaux réels et non redondants

### `public_stck_action_availability_v1`

Ce canal démontre uniquement que `ACTION6` est disponible sur l'observation
courante. Il ne produit aucune géométrie de cible.

### `public_stck_visible_target_v1`

Ce canal reproduit depuis les pixels publics la cible STCK, son identité de
preuve et les coordonnées adressées. Il refuse une contribution dont les pixels,
la session ou la révision ne correspondent plus.

Les deux canaux ont des identités de contribution différentes, mais transmettent
le même contrat de libération OP28. Retirer l'un ou l'autre laisse la jointure
`incomplete` et supprime l'action.

## Chaîne causale

**Besoin identifié** : une décision STCK adressée exige à la fois une action
physiquement disponible et une cible courante démontrée par l'image publique.

**Données produites** : admissibilité ACTION6 d'une part, cible visible et
coordonnées d'autre part.

**Appel justifié** : `JointChannelOwner` joint exactement les deux contributions
et transmet un unique bundle OP28 à l'autorité native.

**Résultat** : `ACTION6(x=4, y=52)` est libérée sur le premier état réel STCK.

**Consommateur** : `CommonCampaignOwner`, puis
`V6CommonCampaignDecisionPort` et le transport public de campagne.

**Effet sur la décision** : les deux canaux présents produisent l'action ;
l'ablation de chaque canal produit zéro action ; le retour sélectionné est acquis
une fois par les deux contributeurs ; l'observation suivante est remesurée avant
la décision suivante.

## Qualification sur le corpus réel

Corpus :

- archive : `public/python/custom-games.zip` ;
- jeu : `STCK` ;
- instance : `stck-c0000001` ;
- niveau : 1 ;
- seed : 0.

Résultat observé :

- première cible : `stack_card` ;
- première action : `ACTION6(x=4, y=52)` ;
- pixels publics modifiés après retour : `211` ;
- retour acquis par les deux canaux ;
- prochaine observation remesurée : nouvelle cible publique `stack_card` et
  nouvelle décision `ACTION6(x=4, y=52)` ;
- canal d'admissibilité retiré : aucune action ;
- canal de cible retiré : aucune action.

La répétition des mêmes coordonnées sur l'observation suivante n'est pas un
retour périmé : le producteur reconstruit une nouvelle identité liée à la
révision suivante et revalide la cible depuis les nouveaux pixels.

Le rapport exact est conservé dans :

`docs/recovery/lot9c3-public-stck-joint-report.json`

## Qualification GitHub Actions

Candidat source corrigé : `50b8eb855ac941cdbed78b0004d09e7742611ebb`.

Run réussi :

- workflow : `Lot 9C3 STCK joint boundary` ;
- run : `43363393229` ;
- job : `131681943602` ;
- build et typecheck de production : PASS ;
- tests causaux ciblés : **7/7 PASS** ;
- qualification sur l'archive réelle STCK : PASS ;
- suite TypeScript complète : **358/358 PASS** ;
- échecs, annulations, tests ignorés et TODO : `0` ;
- artefact : `lot9c3-public-stck-joint-report`, ID `14009386700` ;
- digest de l'archive :
  `sha256:8beb253bb7c42887c5c47df5901a1f93bcd7b7143ed9277986f3930cfa47d358`.

## Première tentative et correction

Le run initial `43363306538` a réussi le build et les 7 tests causaux, mais son
qualificatif exigeait à tort que le premier retrait de carte fasse immédiatement
apparaître le bouton shop. L'observation réelle conservait encore une carte de
pile. Le test a été corrigé pour exiger que la décision suivante corresponde à
la cible réellement reproduite depuis les nouveaux pixels, sans imposer une
alternance non démontrée. Aucun changement de moteur ou de fixture n'a été
utilisé pour faire passer la qualification.

## Frontière de performance atteinte

9C possède maintenant deux corpus fonctionnels réels :

- SMLP, qualifié en 9C2 ;
- STCK, qualifié dans ce lot 9C3.

La condition fonctionnelle préalable à une comparaison officielle à deux jeux
est donc satisfaite. La performance officielle reste cependant **ouverte** :
il faut encore figer les identités A/B, construire des runners qui exercent
réellement la jointure sur les deux corpus, définir la portée chronométrée et
exécuter le protocole ABBA complet.

## Limites conservées

Ce lot ne démontre pas :

- une parité avec une implémentation historique perdue ;
- une amélioration du score ARC ;
- une loi générale de jointure applicable à tous les jeux ;
- une qualification officielle sous le seuil de `+10 %` ;
- une restauration du registre historique ;
- une publication Site.

## Étape suivante

**Lot 9C4 — qualification de performance officielle.**

Figer une référence A sans jointure et un candidat B avec jointure, chacun avec
un `sourceRef` durable. Les runners STCK et SMLP doivent traverser les chemins
publics réels qualifiés en 9C2 et 9C3. Exécuter ensuite le protocole ABBA sans
suppression d'échantillon et appliquer le seuil strict, séparément pour chaque
jeu : toute augmentation globale de session doit rester strictement inférieure
à `+10.000 %`.
