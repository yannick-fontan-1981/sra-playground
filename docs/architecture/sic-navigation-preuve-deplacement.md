# Quel déplacement mesuré ouvre réellement un accès P07 ?

**FOGW fournit un second consommateur natif indépendant de G50T.** Dans les deux familles, une commande devient un moyen d’accès après observation d’un déplacement axial d’un pas du porteur. Les planificateurs utilisent ce vecteur différemment. PORT fournit le contrepoint : un reçu de mouvement y ouvre aussi P07, mais le préfixe peut employer une direction encore jamais essayée.

L’[inventaire des familles](sic-v8-family-inventory.md) rattache FOGW à la réception, et l’[étude des replis](sic-v8-generalization.md) distingue la réception d’origine de sa variante d’apprentissage. La comparaison ci-dessous porte sur les familles effectivement sélectionnées. Les sources sont celles du candidat `3c2d6bcf`. Le lot prolonge la [caractérisation G50T et AS66](sic-transition-effet-acces-as66-g50t.md) publiée en `981b9ab9`.

## Deux décisions observées

| | G50T L1 · `sic_verify_remote_replay` | FOGW L1 · `sic_reception_access` |
|---|---|---|
| Où retrouver le ticket | Tours 5 et 6, lignes 46 et 56 de `G50T-A.jsonl` dans `artifacts/sic-comparison/run-VVq4CG` du banc. | Entrées `publicEvidence` d’index 3 et 4 (champ `index`, numéroté depuis 1) du [reçu public FOGW](../diagnostics/sic-reception-transfer-20261127/fogw-arrival-boundary-a10dde47.json.gz). Ce reçu date de `a10dde47`. Le test rejoue les quatre premiers tickets avec le pack SIC complet du candidat. Celui-ci sélectionne `ACTION1/P05`, `ACTION2/P05`, `ACTION4/P05`, puis `ACTION4/P07`. |
| Qui rattache le retour au sujet ? | `actorPosition` exige une seule composante de la signature du porteur de la scène. `record` compare sa position d’arrivée à l’origine de la proposition ou du pas de préfixe exécuté, dans le même état et la même époque. | `carrier` appelle `receptionServiceCarriers` et exige une seule cellule portant le motif de quatre coins de même couleur. `record` utilise l’origine de la proposition ou du pas exécuté et cette nouvelle ancre. Au tour 1, le porteur disparaît. Au tour 2, il réapparaît mais l’origine manque. Ces deux commandes laissent la table vide. |
| Qui produit quoi ? | Au tour 5, `ACTION4` déplace le porteur de (14, 8) à (20, 8). `record` écrit `controls.ACTION4 = [6, 0]` et lie `controlEvidence.ACTION4` au retour r6, image `bd5da91d68f0d73d`. | Au tour 3, `ACTION4` déplace le porteur de (30, 42) à (34, 42). `record` écrit `controls.ACTION4 = [4, 0]`. Il garde la référence r4, image `2ef366caf5b05817`, dans l’historique récent des retours. Cette famille n’enregistre pas de référence par commande. |
| Qui consomme la mesure ? | `candidatePaths` calcule un chemin géométrique vers le contact (38, 8). `propose` recherche dans `local.controls` la commande dont le vecteur correspond au premier pas. `routeSupported` permet à `chooseLanding` de retenir P07 pour atteindre (26, 8). | `propose` filtre les contrôles disponibles dont l’essai reste admissible. `receptionServicePath` développe le chemin **à partir de ces vecteurs**, en écartant les supports concurrents. Il peut retourner un préfixe qui rapproche du support (50, 26). Son premier pas vers (38, 42) constitue l’offre d’accès à `resolveNavigationPrimitives`. |
| Combien de temps la preuve vaut-elle ? | Le vecteur peut être relu pendant l’époque. Chaque nouvelle décision retrouve le porteur et un pas praticable. Le premier geste est lié à l’observation courante. Les gestes suivants revérifient la position et le sol d’arrivée. | Le vecteur reste utilisable pendant l’époque. Un transfert après réception officielle suit une autre règle, qui revérifie notamment le pas et l’encre du support. Le premier geste est lié à l’observation. Les suivants exigent encore le même support, le porteur attendu, une arrivée admissible et l’absence d’essai rejeté dans ce contexte. |

Dans les deux cas, le garde `before` de la famille et la libération native dans `authorize` restent nécessaires à l’exécution. [Producteur et consommateur G50T](../../src/sic/replay-access.ts) · [Producteur et offres FOGW](../../src/sic/reception-access.ts) · [Détection du porteur et recherche du chemin FOGW](../../src/logos-engine/v6-reception-service-observation.ts) · [Moteur natif](../../src/logos-engine/v6-native-runtime.ts)

## Le préfixe de PORT contient déjà une commande inédite

Dans les fichiers `{A,B}.jsonl` du banc, sous `artifacts/qualification-3c2d6bcf-appelants-live/PORT`, la ligne 6 propose `ACTION2` sous P05. La ligne 9 confirme la position (11, 11). `observedStep` vérifie l’arrivée prévue et `record` ajoute la référence à `memory.evidence`. Au tour 2, ligne 16, une seule référence suffit à ouvrir P07 sur un pas ordinaire. Le préfixe proposé est **ACTION2, ACTION4, ACTION4**. Le premier `ACTION4` est effectivement autorisé ligne 21 : même révision de décision 2, index de pas 1, arrivée (15, 15). Jusqu’alors seuls des `ACTION2` ont été exécutés depuis le début du jeu.

`plan` et `shift` emploient une table fixe de quatre directions et le pas mesuré de la scène. Le nouvel accès repose sur une arrivée vérifiée, les liaisons et les gardes du préfixe. Les contacts `switchTest` de L4 tour 7 et L6 tour 6 (lignes 458 et 732) relèvent de P05. Ils éprouvent une reconfiguration. Le comparateur du banc confirme l’égalité des 844 événements sur les six niveaux, dont 116 décisions. [Plan, acquisition et garde de PORT](../../src/sic/paired-passage.ts) · [Tests des préfixes et contacts](../../tests/sic-paired-passage-continuity.test.ts)

## Ce que les contre-épreuves autorisent à factoriser

Ces interventions sont **construites en test** à partir des observations publiques. Elles utilisent les fonctions de production `record` et `propose`.

| Intervention sur `ACTION4 {}` | G50T | FOGW |
|---|---|---|
| Attribuer deux pas à une seule commande sur une première mesure | (14, 8) → (26, 8), un porteur reconnu. Aucun vecteur ni reçu dédié. La famille reprend P05. | (30, 42) → (38, 42), un porteur reconnu. Le retour reste dans l’historique, le vecteur manque. La famille reprend P05. |
| Retirer uniquement le vecteur appris, garder les références et le plateau du choix P07 | P05. Retirer seulement la référence dédiée laisse P07 disponible. | P05. La référence du retour figure encore dans l’offre. |
| Ajouter un second porteur de même aspect au moment du choix | L’ambiguïté empêche toute proposition de la famille. | L’ancre devient inconnue. P05 propose la commande inverse `ACTION3` pour retrouver le porteur. |
| Recolorer seulement le porteur au retour du pas valide | La signature attendue disparaît. La famille suspend ce parcours sans acquérir de vecteur. | Les quatre coins recolorés forment toujours l’unique porteur selon la règle de réception. La famille acquiert le vecteur et propose P07. |

**Garde déjà disponible.** `motionIntoFootprint` filtre les translations d’un reçu par l’emprise d’arrivée et vérifie leur concordance. La variante `sic_learn_reception_access` peut l’employer pour amorcer son modèle depuis une observation antérieure. Les deux producteurs étudiés ici mesurent leurs propres retours. Plus en aval, `resolveNavigationPrimitives`, déjà utilisé par FOGW et PORT, vérifie la présence d’une offre d’accès préparée. G50T passe par le workflow `chooseLanding`. Ces choix de stratégie ne vérifient pas la longueur du déplacement. [Garde d’emprise](../../src/sic/observed-translation.ts) · [Agenda de navigation](../../src/sic/navigation-primitives.ts) · [Workflow des arrivées](../../src/sic/highlighted-route-card.ts)

**Premier découpage justifié.** Limiter une éventuelle extraction aux deux branches `record` qui viennent de retrouver le porteur. Avec les deux positions en coordonnées écran et le pas positif de cette scène, calculer le vecteur signé et le rendre seulement si un seul axe change d’exactement un pas. Sans origine ou arrivée reconnue, l’appelant s’abstient de mesurer. Un retour stationnaire, diagonal ou trop long ne fournit aucune nouvelle mesure. Chaque famille garde sa définition du sujet, la liaison à la commande exécutée, l’écriture des références, le traitement des mesures antérieures, la cible, le chemin et le choix du prochain essai. Le contre-exemple de recoloration explique pourquoi la reconnaissance du sujet doit précéder cette opération commune.

## Vérification

Depuis la racine du dépôt, avec Node 24 :

```sh
node --test tests/sic-control-to-access.test.ts tests/sic-paired-passage-continuity.test.ts tests/sic-reception-control-transfer.test.ts
```

Les quatre cas de la [caractérisation des accès](../../tests/sic-control-to-access.test.ts) comprennent le rejeu des tickets FOGW avec l’ensemble des familles actives du pack SIC, sans sélection forcée. Les [cas de transfert de réception](../../tests/sic-reception-control-transfer.test.ts) couvrent aussi la révision d’une commande contredite et le refus d’un support incompatible.
