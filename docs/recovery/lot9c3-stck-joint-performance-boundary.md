# Lot 9C3 — jointure publique STCK à carte unique et frontière de performance

Date : 13 novembre 2026 (America/Recife)

Branche de travail : `recovery/lot9c3-stck-joint-boundary-20261113`

Base canonique initiale : `342d14b990169e292ec1078cef3ef297302b2baa`

Synchronisation canonique intégrée avant qualification finale :
`90cb819f028aea315fdbba9774a22fb345bcfb81`, via le merge de synchronisation
`de7c394a849e4280f6c2f6e147678a185d6fb90b`.

## Positionnement

9C2 a qualifié une première jointure réelle sur SMLP. 9C3 devait soit qualifier
une seconde jointure réelle sur STCK, soit démontrer durablement une
non-applicabilité. Le travail parallèle intégré au canonique a entre-temps établi
un propriétaire STCK volontairement strict : une action n'est autorisée que si
l'image publique contient **exactement une carte de pile visible**. Plusieurs
cartes restent ambiguës et ne sont jamais classées.

9C3 conserve ce contrat. Il ne réintroduit ni règle « carte la plus basse », ni
fallback vers un bouton shop, ni priorité cachée. Le corpus réel STCK initial est
ambigu ; un préfixe public déjà qualifié en 9B réduit d'abord cette ambiguïté,
puis la jointure 9C est exercée sur le premier état où une carte unique est
réellement démontrée.

Cette qualification ne prétend pas restaurer un ancien `joint_channels`, ne
modifie pas le compteur historique des 76 points d'entrée et ne constitue pas
encore une qualification officielle de performance 9C.

## Producteur public STCK strict

Le producteur `public_stck_unique_stack_card_target_v1` utilise la primitive
canonique `findUniqueVisibleStckStackCardTarget`.

Il lit uniquement :

- l'image publique 64x64 en indices de palette ;
- l'état terminal public ;
- la session et la révision publiques.

Il ne lit pas la disponibilité d'ACTION6. Cette responsabilité appartient au
canal séparé d'admissibilité. Il ne reçoit aucun plateau moteur, état privé,
fixture, solution préparée ou route cachée.

Règle d'admission :

1. une carte est un bloc public STCK complet, de couleur qualifiée, visible dans
   le panneau de pile ;
2. exactement une carte complète doit être détectée ;
3. zéro carte ou plusieurs cartes produisent `undefined` ;
4. aucun bouton shop n'est transformé en cible par ce producteur ;
5. aucune carte n'est choisie par position ou score.

## Deux canaux réels et non redondants

### `public_stck_action_availability_v1`

Ce canal démontre uniquement que `ACTION6` est disponible sur l'observation
courante. Il ne produit aucune géométrie de carte.

### `public_stck_visible_target_v1`

Ce canal reproduit depuis les pixels publics l'unique carte visible, son identité
de preuve et les coordonnées adressées. Il refuse une contribution dont les
pixels, la session ou la révision ne correspondent plus.

Les deux canaux ont des identités de contribution différentes, mais transmettent
le même contrat de libération OP28. Retirer l'un ou l'autre laisse la jointure
`incomplete` et supprime l'action.

## Préfixe public d'accès au corpus applicable

L'état initial réel STCK contient plusieurs cartes. Le propriétaire strict refuse
donc correctement de proposer une action.

Le qualificatif utilise alors le producteur public déjà qualifié en 9B :

`region-public-action6-probe-v1`

Ce préfixe ne lit que l'image publique. Sur le corpus retenu, il exécute trois
fois `ACTION6(x=4, y=52)`. Les changements publics observés sont respectivement :

- `211` pixels ;
- `138` pixels ;
- `95` pixels.

Après ces trois retours réels, la révision publique `3` contient exactement une
carte complète. La jointure 9C devient alors applicable sans classement caché.

Le préfixe est conservé explicitement dans le rapport ; il ne fait pas partie de
la preuve que deux canaux 9C sont nécessaires à l'action finale.

## Chaîne causale

**Besoin identifié** : une décision STCK adressée exige à la fois une action
physiquement disponible et une carte courante unique démontrée par l'image
publique.

**Données produites** : admissibilité ACTION6 d'une part, identité et coordonnées
de l'unique carte visible d'autre part.

**Appel justifié** : `JointChannelOwner` joint exactement les deux contributions
et transmet un unique bundle OP28 à l'autorité native.

**Résultat** : `ACTION6(x=4, y=50)` est libérée sur la révision publique `3`.

**Consommateur** : `CommonCampaignOwner`, puis
`V6CommonCampaignDecisionPort` et le transport public de campagne.

**Effet sur la décision** : les deux canaux présents produisent l'action ;
l'ablation de chaque canal produit zéro action ; le retour sélectionné est acquis
une fois par les deux contributeurs ; l'observation suivante ne contenant plus
une carte unique, aucune nouvelle action 9C n'est inventée.

## Qualification sur le corpus réel

Corpus :

- archive : `public/python/custom-games.zip` ;
- jeu : `STCK` ;
- instance : `stck-c0000001` ;
- niveau : 1 ;
- seed : 0 ;
- état qualifié : première révision publique à carte unique après trois actions
  du préfixe public 9B.

Résultat observé :

- révision sélectionnée : `3` ;
- preuve de cible : `public-stck-stack-card:14:48-52` ;
- action jointe : `ACTION6(x=4, y=50)` ;
- pixels publics modifiés par l'action jointe : `64` ;
- retour acquis par les deux canaux ;
- canal d'admissibilité retiré : aucune action ;
- canal de cible retiré : aucune action ;
- observation suivante : `no_unique_stack_card` ;
- aucune cible shop et aucune action suivante inventées.

Le rapport exact est conservé dans :

`docs/recovery/lot9c3-public-stck-joint-report.json`

Un test durable vérifie aussi que le rapport régénéré est strictement identique
au fichier versionné.

## Qualification GitHub Actions

### Qualification fonctionnelle initiale avant synchronisation

Le run `43363393229` a démontré le chemin de jointure sur une première version
trop permissive du producteur. Cette version sélectionnait une carte par
position et n'est pas retenue après l'intégration du propriétaire canonique
strict.

### Requalification après synchronisation canonique

Le run `43364288703`, job `131684915965`, sur le head
`dcd61f4bea28a7251f4e7470f47dd6b5548c11aa`, a établi :

- build et typecheck de production : PASS ;
- tests causaux ciblés : **7/7 PASS** ;
- qualification sur l'archive réelle après préfixe public : PASS ;
- rapport généré avec le corpus strict à carte unique : PASS ;
- comparaison avec l'ancien rapport durable : échec attendu, car le fichier
  versionné décrivait encore le producteur permissif ;
- artefact : `lot9c3-public-stck-joint-report`, ID `14010025622` ;
- digest :
  `sha256:1d15b7c20ebdb0128912e77db978d7a60f7139c3007b24e3bc094efbe11bcbac`.

Le rapport durable et son test ont ensuite été remplacés par cette preuve
stricte. La CI finale doit donc réussir à la fois la qualification réelle, la
comparaison exacte et la suite de régression complète sur le head final du lot.

## Frontière de performance atteinte

9C possède maintenant deux chemins fonctionnels réels :

- SMLP, qualifié en 9C2 ;
- STCK, qualifié dans ce lot sur une révision publique à carte unique.

La condition fonctionnelle préalable à une comparaison officielle à deux jeux
est satisfaite, mais la portée chronométrée STCK doit être figée avant toute
mesure. Les runners A et B devront appliquer **exactement la même politique de
préfixe** :

- soit le préfixe public est inclus dans la session chronométrée des deux côtés ;
- soit il est exécuté avant le chronomètre des deux côtés ;
- aucune variante ne peut chronométrer le préfixe seulement pour A ou seulement
  pour B.

La performance officielle reste donc **ouverte** jusqu'à la fixation des
identités A/B, des runners, de cette frontière temporelle et l'exécution ABBA
complète.

## Limites conservées

Ce lot ne démontre pas :

- une parité avec une implémentation historique perdue ;
- une amélioration du score ARC ;
- une loi générale de jointure applicable à tous les jeux ;
- une capacité à résoudre plusieurs cartes sans producteur supplémentaire ;
- une cible shop issue de la jointure 9C ;
- une qualification officielle sous le seuil de `+10 %` ;
- une restauration du registre historique ;
- une publication Site.

## Étape suivante

**Lot 9C4 — qualification de performance officielle.**

Figer une référence A sans jointure et un candidat B avec jointure, chacun avec
un `sourceRef` durable. Les runners STCK et SMLP doivent traverser les chemins
publics réels qualifiés en 9C2 et 9C3. La politique de préfixe STCK et la portée
chronométrée doivent être identiques pour A et B et déclarées avant les mesures.
Exécuter ensuite le protocole ABBA sans suppression d'échantillon et appliquer
le seuil strict, séparément pour chaque jeu : toute augmentation globale de
session doit rester strictement inférieure à `+10.000 %`.
