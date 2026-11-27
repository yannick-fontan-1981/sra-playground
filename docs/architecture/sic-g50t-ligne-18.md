# G50T · mesurer une commande nécessaire à une préparation de contact

## Contrat de la ligne 18 avant le changement

La branche part de `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. La ligne 18 compte quatorze commandes dans l’inventaire. Son témoin est G50T L1 T3 `ACTION1`, famille `linked_temporal_preparation`, type `linked_contact_experiment`. Le mode du plan est `binding`. L’inventaire historique `8ce7ee35`, le gel et `3c2d6bcf` reproduisent la famille, le tour et la commande en repartant de L1 avec le pack natif par défaut. [Catalogue](sic-v8-strategies-observees.md?plain=1#L44) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L58)

| Situation | Invariant à vérifier |
|---|---|
| T3, puis T4 | Le trajet requiert un déplacement dont la commande manque. Le porteur et le site sont liés. La famille essaie `ACTION1` dans le contexte actuel. Le pas n’a aucune destination prédite. Mesurer la position avant/après, puis vérifier la commande d’essai suivante sur la nouvelle observation. |
| Même besoin de route, preuve de commande changée | Si le premier vecteur du chemin dispose d’une commande mesurée et disponible, ouvrir un accès. Si sa mesure manque, choisir la première commande admissible encore inédite ici. Si aucune ne reste, refuser l’offre. Tenir le trajet, le site et les observations fixes dans le cas construit. |
| Une même `ACTION4` en approche et à l’arrivée | Les pas d’accès antérieurs à l’entrée sur le site peuvent être corrects sans attester d’effet distant. À l’entrée, comparer le support du pair distant. Conserver le compte, les références des pixels changés et l’absence de causalité exclusive. Vérifier la reprise au tour suivant. |
| Second contexte | Réutiliser la scène indépendante de contact déjà caractérisée dans les tests du dépôt, avec ses coordonnées et son pas propres. Vérifier l’alternative essai/accès et un retour où la région distante reste inchangée. |

La frontière envisagée est le choix local entre offre d’essai et offre d’accès pour le premier pas d’un trajet déjà préparé. La géométrie de la famille, la mesure distante, les raisons, les références et la garde restent du ressort de leurs propriétaires. Les campagnes au solveur SIC exclusif et le témoin ZIPP/1 ont leur propre portée.

## De la commande au retour physique

Le témoin est le troisième ticket depuis le chargement de L1. Le pack natif par défaut délègue les deux premiers tours à `observed_frontier`, puis à `LinkedTemporalPreparation`. Le porteur suivi a la signature `93770825…68cb5`. La petite occurrence visée se trouve en (38,8) et possède un support pair distant. La vue actuelle fournit le porteur et le site. La mémoire conserve les vecteurs mesurés par commande et les essais déjà faits à chaque position. La famille choisit le site atteignable, calcule un trajet et examine le premier vecteur requis. [Planification de la famille](../../src/logos-engine/v6-linked-temporal-contact.ts#L199) · [Signature et témoins](../../tests/sic-linked-contact-g50t.test.ts)

| Moment en G50T L1 | Offre et commande | Mesure et reprise |
|---|---|---|
| T3 | La famille prépare un essai `binding` de `ACTION1` en (14,14). Elle indique une destination inconnue. Sur le gel, P05 qualifie l’essai pour la révision 3, image `c9321e6cf1e0bb6d`. Le garde `linked_contact_receiver_bound` admet le porteur. | Le porteur arrive en (14,8), vecteur (0,−6). Le prédicat de destination reste `matched=null`. Le site (38,8) n’est pas atteint. T4 interroge `ACTION3` depuis cette nouvelle position. |
| T4 et T5 | T4 reste sur place après `ACTION3`. T5 essaie `ACTION4`, toujours en mode `binding`. | T4 laisse la commande sans vecteur. T5 conduit le porteur en (20,8) et établit (6,0) pour `ACTION4`. Cette mesure rend le premier pas du trajet exécutable. |
| T6 et T7 | Un seul plan d’accès de trois pas est libéré. Le garde traite successivement les indices 0 et 1. `ACTION4` emmène le porteur en (26,8), puis (32,8). | Chacun des deux retours concorde avec sa destination. Pour ces deux transitions, le registre du contact demeure vide. Une approche réussie ne renseigne pas encore l’effet distant. |
| T8 | Le garde admet l’indice 2 du même plan, encore `ACTION4`. Le porteur passe de (32,8) à (38,8). | L’entrée sur le site déclenche la comparaison avant/après du support distant. Le reçu `linked_contact_effect` lie 23 pixels changés, l’action et les deux observations. La cause exclusive reste indéterminée (`exclusive_cause_established=false`). Le moteur acquiert les trois transitions à la clôture du préfixe. |
| T9 et T10 | T9 prépare le départ. `ACTION3`, déjà essayée en (14,8), reste inédite en (38,8). P05 qualifie ce nouvel essai. Le plan cite la référence du contact. | Le porteur revient en (32,8). Les 23 pixels retrouvent leurs valeurs antérieures. T10 rentre sur le site avec `ACTION4` et étaye l’hypothèse d’un effet conditionnel à l’occupation. |

**Le même `ACTION4` fournit le contre-exemple dans le jeu lui-même.** Aux tours 6 et 7, la commande et sa direction sont correctes pour l’approche. Au tour 8, les mêmes commande et direction produisent la première preuve sur le support distant. La différence est l’entrée observée du porteur sur le site sélectionné. Une fois l’entrée établie, la comparaison porte sur les pixels du pair, même si aucun n’a changé. Le garde reste responsable du prochain pas et de la liaison du porteur. [Acquisition du vecteur](../../src/logos-engine/v6-linked-temporal-contact.ts#L130) · [Entrée et départ](../../src/logos-engine/v6-linked-temporal-contact.ts#L166) · [Garde et retour](../../src/logos-engine/v6-linked-temporal-contact.ts#L350)

**Second contexte construit.** Sur le petit plateau des tests, le porteur de 3 × 3 est en (7,12) et vise (12,12). Avec son vecteur de cinq pixels, `ACTION1` est proposée en accès. Retirer uniquement son vecteur sur la même observation produit la même commande en essai, avec destination inconnue. Restreindre les entrées à la commande déjà mesurée dans l’autre sens ferme l’offre. Dans un autre retour de cette scène, le porteur arrive sur le site mais le support distant demeure inchangé. La famille enregistre une comparaison vide avec ses deux références et ferme cette offre. [Variations de preuve](../../tests/v6-linked-temporal-preparation.test.ts#L186)

## Attribution et limite du découpage

| Révision | Ce qu’elle établit pour la ligne 18 |
|---|---|
| Inventaire `8ce7ee35` | L’identité de la ligne est donnée par le triplet famille/type/ticket. Les 16 commandes et leurs issues générales se retrouvent sur le gel. Le reçu historique de T3 ne publie pas le champ `missingControl`. |
| Gel `d0e7527c` et tests `ada97e9c` | Même arbre `src`. Le comportement physique, les deux types d’offres, le contre-exemple naturel et la reprise sont présents. Les tests sur le gel couvrent le préfixe jusqu’à T10 et la seconde scène. `bindMissingControlTrial → evaluateMissingControl` qualifie les essais préparés par la famille. |
| Candidat P05 `3c2d6bcf` | La qualification interne passe par `qualifyControlTrial`. Le rejeu des tests de service sur ce code conserve les témoins P05 aux tours 3, 4, 5 et 9. La famille native a préparé les commandes en amont. |
| Candidat de la ligne 18 | `selectLinkedContactStep` rend appelable le choix auparavant interne à la boucle. Il consomme la commande mesurée pour le premier pas, les commandes disponibles dans leur ordre et la preuve qu’une commande est mesurée ou déjà essayée ici. Il propose un accès si la commande mesurée est disponible, sinon un essai via `unmeasuredControls`, ou aucune offre. `LinkedTemporalContact.propose` consomme le résultat pour construire le plan correspondant. [Contrat](../../src/sic/linked-contact-step.ts#L10) · [Consommateur](../../src/logos-engine/v6-linked-temporal-contact.ts#L294) |

La famille conserve le choix du sujet et de la destination, la construction du préfixe, la mesure du support distant et les références propres à chaque mode. Un déplacement réussi et un effet distant observé gardent leurs reçus distincts. Le ticket d’accès de la ligne 18 est libéré par `linked_temporal_preparation`, autorité `native`. Le P07 attesté dans les traces au solveur SIC exclusif passe par `replay-access` et a son propre contrat. Le choix axial du candidat vectoriel n’est pas appelé sur ce chemin du gel. [Transition du solveur SIC](https://github.com/yannick-fontan-1981/sra-playground/blob/981b9ab9599ccb3e0f7cd12cd50fd070e2e582d7/docs/architecture/sic-transition-effet-acces-as66-g50t.md) · [Mesure de la famille native](../../src/logos-engine/v6-linked-temporal-contact.ts#L136)

## Reproduction et portée

La fixture contient les 17 observations et les 16 commandes du préfixe historique, graine 0, L1, pack natif par défaut, plafond de session 16 et de niveau 600. Les tours 3 à 16 reproduisent les **14 occurrences** du triplet de l’inventaire, dont quatre essais de liaison, neuf commandes d’accès et une commande de phase. Les assertions suivent en détail le premier essai, le premier contact et la réentrée, puis contrôlent la famille, le mode et les commandes du reste du préfixe. Le gel et le candidat donnent les mêmes 17 paquets, commandes et projections de décision et d’issue sur les deux captures réelles. Il s’agit d’un jeu et d’un niveau. La vérification indépendante du candidat reste distincte. [Fixture publique](../../tests/fixtures/sic-linked-contact-g50t-public.json.gz) · [Assertions du service](../../tests/sic-linked-contact-g50t.test.ts#L18)

Avec Node 24, depuis le checkout de la branche, la première commande rejoue les observations figées. Pour le jeu source, désigner le répertoire contenant `public/vendor/pyodide` et `public/python`. Chaque commande est alors transmise au jeu et chaque retour public est comparé à la fixture. Son SHA-256 est `0d6c1cec11e2cf0a2a7f2bbe309189ddcb9d9640df215c8f48218403508f11b7`.

```powershell
node --test tests/sic-linked-contact-g50t.test.ts tests/v6-linked-temporal-preparation.test.ts
$env:SIC_LINKED_GAME_ROOT = (Resolve-Path ../sic-cartographie-p05).Path
node --test tests/sic-linked-contact-g50t.test.ts tests/v6-linked-temporal-preparation.test.ts tests/v6-linked-temporal-reference.test.ts tests/sic-control-effect.test.ts tests/sic-native-resolution.test.ts
node node_modules/typescript/bin/tsc --noEmit
Remove-Item Env:SIC_LINKED_GAME_ROOT
```

Les cinq suites passent 75/75 avec le vrai jeu. Le contrôle TypeScript passe. Pour le Banc, le parent de référence est `ada97e9c234986878bb2b8d35f876d17039afd2c`. Comparer en particulier l’essai T3, le vecteur T5, les indices 0/1/2 du préfixe, les références et pixels de T8, puis la commande et le retour de T9. La ligne 1 conserve son propre candidat et son propre dénominateur.
