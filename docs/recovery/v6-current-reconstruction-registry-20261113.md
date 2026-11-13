# V6 — registre courant de la reconstruction canonique

Date : 13 novembre 2026 (America/Recife)

## Objet

Ce registre remplace l’absence du fichier
`docs/migration/v6-entry-point-progress.json` par un inventaire vérifiable de la
reconstruction réellement présente sur GitHub.

Il ne restaure pas artificiellement le compteur historique `70/76`. Aucun
registre par slot de Site 109 / native 0.68 n’a été retrouvé et la source
historique `d90ce5b64fffa53cca201e2a6a49450fd123f299` reste non résolue.

La sortie courante est donc exprimée comme :

**47 frontières de capacité reconstruites, fonctionnellement qualifiées, sans
dénominateur historique.**

Ce nombre ne signifie pas `47/76`.

## Baseline inventoriée

- dépôt : `yannick-fontan-1981/sra-playground` ;
- branche canonique : `recovery/site109-reconstruction-20261112` ;
- commit de départ de l’inventaire :
  `81f56ce74a3413d3835bd4b30b9c3fd14570aabc` ;
- fichier machine :
  `docs/migration/v6-entry-point-progress.json` ;
- vérificateur :
  `scripts/verify-v6-current-reconstruction-registry.mjs` ;
- garde de test :
  `tests/v6-current-reconstruction-registry.test.mjs`.

## Unité de comptage

Une entrée courante représente une frontière sémantique :

- possédée ou appelable indépendamment ;
- durablement implémentée sur la branche canonique ;
- couverte par au moins une preuve fonctionnelle ;
- distincte d’un simple helper interne.

Ne sont pas comptés :

- les tests, fixtures, workflows et harness de benchmark ;
- les documents historiques sans code courant ;
- les branches de récupération non intégrées ;
- les 31 opérations OP01 à OP31 comme 31 anciens slots V6.

OP01 à OP31 forment une seule entrée agrégée du registre courant. Le détail de
chaque opération reste dans le suivi OP01–OP31.

## Résultat courant

| Catégorie | Capacités qualifiées |
| --- | ---: |
| Moteur symbolique | 12 |
| Apprentissage adressé | 11 |
| Perception publique | 9 |
| Region | 3 |
| Runtime et produit | 12 |
| **Total courant** | **47** |

Autres compteurs :

- capacités avec qualification de performance explicite : **6** ;
- portes de preuve non comptées comme capacités : **6** ;
- lacunes ouvertes : **9** ;
- correspondances prouvées avec les slots historiques : **0** ;
- dénominateur appliqué au compteur courant : **aucun**.

## Frontières de performance

La performance est qualifiée uniquement là où une preuve officielle durable
existe :

- Region : modèle, owner, caller et liaison de preuve publique ;
- canaux conjoints publics SMLP ;
- canaux conjoints publics STCK.

Les preuves restent les protocoles ABBA stricts existants. Les composants
fonctionnels du produit dont le coût global n’a pas été mesuré séparément
conservent `performanceStatus: open` ou
`not-required-for-current-claim`. Le registre ne transforme pas une preuve
fonctionnelle en preuve de performance.

## Séparation avec l’historique

Le registre conserve séparément :

- Site 109 ;
- native 0.68 ;
- la revendication historique `70/76` ;
- le SHA historique non résolu ;
- l’absence de correspondance individuelle.

Chaque capacité courante porte donc une correspondance historique
`unresolved`, avec zéro identifiant de slot revendiqué.

Une future correspondance ne pourra être ajoutée qu’avec une preuve par entrée,
pas par ressemblance de nom ou proximité fonctionnelle.

## Gardes automatiques

Le vérificateur échoue si :

- un chemin d’implémentation ou de preuve disparaît ;
- les compteurs du résumé ne correspondent pas aux entrées ;
- une preuve de performance qualifiée manque ;
- le catalogue OP01–OP31 est transformé en compteur artificiel ;
- le compteur courant reçoit le dénominateur 76 ;
- une capacité revendique un ancien slot sans mapping prouvé ;
- l’identité historique est déclarée résolue sans nouvelle preuve.

Le workflow
`.github/workflows/v6-current-reconstruction-registry.yml` exécute aussi :

- le vérificateur du registre ;
- les tests négatifs du garde ;
- le typecheck ;
- toute la régression TypeScript ;
- le build de production.

## Lacunes explicitement ouvertes

Le registre ne masque pas les dettes suivantes :

1. mapping individuel des 76 slots historiques ;
2. résolution de la source exacte Site 109 / native 0.68 ;
3. reconstruction courante de `chart_navigation` ;
4. snapshot et restauration atomiques entre activations produit ;
5. Region comme propriétaire physique actif dans le produit navigateur ;
6. propriétaire d’objectif réel pour OP31 ;
7. intégration du Lot 10 temporal selection ;
8. récupération d’une source Lot 8 autoritative ;
9. publication Site depuis cette nouvelle baseline.

## Conséquence

Le projet possède maintenant un compteur courant reproductible et honnête.
Les prochaines capacités pourront être ajoutées seulement avec :

**implémentation durable → preuve fonctionnelle → statut de performance
explicite → validation automatique → mise à jour calculée du compteur.**

La prochaine étape fonctionnelle reste la fermeture des lacunes produit, en
commençant par la persistance atomique de campagne et le propriétaire physique
Region, sans réinterpréter le compteur historique.
