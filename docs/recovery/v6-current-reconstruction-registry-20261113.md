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

**50 frontières de capacité reconstruites, fonctionnellement qualifiées, sans
dénominateur historique.**

Ce nombre ne signifie pas `50/76`.

## Baseline inventoriée

- dépôt : `yannick-fontan-1981/sra-playground` ;
- branche canonique : `recovery/site109-reconstruction-20261112` ;
- commit de départ de l’inventaire consolidé :
  `9e04bbd5569f6755178fa1b5276a112ca47d646b` ;
- fichier machine :
  `docs/migration/v6-entry-point-progress.json` ;
- vérificateur :
  `scripts/verify-v6-current-reconstruction-registry.mjs` ;
- garde de test :
  `tests/v6-current-reconstruction-registry.test.mjs`.

La baseline inclut le noyau de continuité de session intégré le même jour :

- checkpoint atomique de campagne et des participants ;
- restauration du `needId` et de l’action en attente ;
- conservation de la déduplication des retours ;
- codec exact du modèle, du prior et du stock FieldStock ;
- rollback si un participant refuse sa restauration.

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
| Runtime et produit | 15 |
| **Total courant** | **50** |

Autres compteurs :

- capacités avec qualification de performance explicite : **6** ;
- portes de preuve non comptées comme capacités : **6** ;
- lacunes ouvertes : **9** ;
- correspondances prouvées avec les slots historiques : **0** ;
- dénominateur appliqué au compteur courant : **aucun**.

Les trois capacités ajoutées après le premier inventaire sont :

1. le coordinateur atomique de checkpoint de campagne ;
2. le codec exact FieldStock et rétention adressée ;
3. le participant checkpoint du runtime de matériau adressé observé.

Elles sont fonctionnellement qualifiées comme noyau. Leur raccord au cycle de
vie du host et du contrôleur navigateur reste une dette séparée.

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

Le noyau de continuité est donc compté comme capacité fonctionnelle, mais ne
reçoit aucune revendication de performance produit.

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
4. raccord du checkpoint atomique au host et au contrôleur lors d’une vraie
   désactivation/réactivation Agent ;
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

La prochaine étape fonctionnelle reste le raccord du noyau de checkpoint au
host et au contrôleur navigateur, puis l’activation de Region comme propriétaire
physique du produit, sans réinterpréter le compteur historique.
