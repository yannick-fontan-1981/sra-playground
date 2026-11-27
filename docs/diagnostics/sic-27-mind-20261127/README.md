# MIND — admission du rôle de saisie acquis

Le rejeu natif strict depuis le niveau 1 termine les **six niveaux en 93 commandes**, sans reset ni annulation, sur `dc3f51ae712d2f5dc7e795d023c79d51063d647e`. Toutes les commandes sont autorisées par SIC et attribuées à `sic_verify_ordered_feedback`. Les plafonds de commandes et de temps viennent des mêmes archives que le témoin ; aucun budget n’a changé.

| Niveau | Commandes / plafond | Score public / plafond | Réconciliation après score |
| --- | ---: | ---: | ---: |
| 1 | 8 / 13 | 3,426 s / 11 s | 135 ms |
| 2 | 8 / 13 | 1,394 s / 9 s | 122 ms |
| 3 | 15 / 20 | 4,236 s / 15 s | 151 ms |
| 4 | 20 / 25 | 5,898 s / 18 s | 165 ms |
| 5 | 18 / 23 | 5,634 s / 18 s | 205 ms |
| 6 | 24 / 29 | 7,612 s / 19 s | 206 ms |

Les préfixes de commandes et de retours publics des niveaux 1 et 2 ont exactement les mêmes empreintes que le témoin `ee9dad5f`. Cela ne constitue pas une comparaison d’égalité des graphes de connaissances. La durée totale des six niveaux, réconciliations comprises, est de 29,182 secondes sur ce passage.

## Première décision bloquée

Le témoin non instrumenté `ee9dad5f8773fed3ed507ad3c575181deae5f754` gagne les niveaux 1 et 2, puis s’arrête au niveau 3 après six commandes sous son plafond de 15 secondes. La capture publique instrumentée reproduit cette séquence.

Avant la première commande du niveau 3, `sic_verify_ordered_feedback` possède les retours qui établissent la saisie dans une rangée et la validation par une commande observée. Sa preuve conservée contient le score courant, la taille des cellules, leur pas, les décalages des deux rangées par rapport à la palette, la rangée active, la commande de validation et cinq références d’observation. L’interface courante est compatible : elle comporte une case supplémentaire, avec les mêmes dimensions et décalages relatifs.

Le propriétaire n’est pourtant pas consulté à cette première décision. Le groupe `continue_observed_pressure_recovery` propose d’abord une preview via `continue_or_test_a_witnessed_effect`. Ce premier clic remplit une case. Lorsque la famille de saisie est finalement consultée, l’interface ne contient plus deux rangées uniformes vides et `initialFeedbackLayout` ne peut plus la mesurer. Le propriétaire n’a pas acquis le premier clic effectué par la preview.

Dans cette capture, les appels non productifs à `sic_legend_recolor.propose` et `sic_match_visible_example.propose` consomment respectivement 5 705,992 ms et 5 521,332 ms. Ces durées incluent l’instrumentation et ne sont pas utilisées comme comparaison de vitesse avec le candidat. Elles localisent le coût du raisonnement atteint après la perte du propriétaire de saisie.

Une re-proposition hors jeu, à partir de l’état acquis et de l’observation publique exacts de cette première décision, produit un clic de saisie et un garde `ordered_trial_bound` admis. Il ne s’agit pas d’un rejeu du moteur complet depuis un checkpoint.

## Changement et conditions de réutilisation

`feedback-trial.ts` expose une entrée gardée dans `reuse_observed_mechanics` et dans le premier groupe de continuation. La preuve doit exister ; le score courant, la taille, le pas et les décalages relatifs doivent correspondre ; la rangée active doit être unique ; la commande de validation apprise doit être disponible. Si un état de saisie existe déjà dans le niveau courant, sa rangée active et sa commande doivent encore correspondre à cette association.

La proposition ordinaire vérifie ensuite la palette, le préfixe réellement rempli et les commandes déjà bloquées. La découverte sans preuve reste dans le groupe historique. Chaque entrée attend et acquiert son retour ; les gardes et l’acquisition existants restent inchangés. La recoloration, les limites de recherche et les budgets ne sont pas modifiés. Aucun identifiant de jeu, numéro de niveau, couleur absolue ou parcours témoin n’intervient dans cette décision de production.

Le premier candidat `a53189de` ajoutait seulement l’entrée dans le groupe général de réutilisation. Son rejeu reste à 2/6 : le groupe de preview passe avant celui-ci. Le complément `dc3f51ae` ajoute la même entrée gardée après les deux propriétaires historiques du premier groupe, et avant les previews que la composition des groupes y ajoute. Le test natif utilise désormais cet ordre de production effectif.

## Validation et limites

La commande suivante passe **neuf tests** :

```sh
node --test tests/sic-ordered-feedback-transfer.test.ts tests/sic-feedback-partitions.test.ts
```

Les deux transferts natifs varient la taille, les couleurs, les positions et la commande de soumission. L’acquisition provient de tickets et de retours publics effectivement exécutés avant la frontière de niveau. Les cas de refus couvrent une rangée supplémentaire ambiguë, une forme incompatible et une commande de validation absente. Un retour contradictoire ferme le ticket et bloque l’opération concernée en conservant la preuve des succès antérieurs. Le contrôle TypeScript passe ; les deux changements de priorité ont reçu une revue indépendante favorable.

Ce lot qualifie l’admission du rôle appris. Il ne qualifie pas une nouvelle série de plusieurs commandes : le passage comporte 92 reprises entre 93 opérations unitaires. Le contrôle global `npm run test:sic-continuity` sur l’intégration et la reproduction par l’interface de la version livrée restent à faire à ce checkpoint. Aucune publication Site n’est attestée par ce dossier.

## Preuves et reproduction

- `summary.json` donne les résultats, budgets, empreintes de préfixes et empreintes SHA-256 de tous les fichiers archivés.
- `public-evidence.tar.gz` contient les deux témoins non gagnants, la capture publique progressive complète, la re-proposition de la première décision, les probes externes, ainsi que le candidat gagnant et ses manifestes avant/après. Les résultats bruts d’origine n’ont pas été modifiés.
- L’archive utilise un ordre de fichiers stable, des dates et identités tar nulles, et un en-tête gzip sans nom avec une date nulle. SHA-256 : `89ced2cb87cf233c5ca782652d36776bfe17e929a2754718f7d57b7b3b122da0`.

À partir du commit candidat et de ses dépendances déjà préparées, dans un créneau sans autre campagne chronométrée :

```sh
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json \
node scripts/check-sic-chronological.mjs MIND 6 /tmp/mind-results.jsonl 1 sic
```

Les probes sont des observateurs externes ; elles n’ont pas fait partie du passage gagnant. `mind-family-profile.mjs` se charge avec `node --import` et exige les variables `SIC_MIND_PROFILE_DIR`, `SIC_MIND_PROFILE_EXPECTED_SHA` et `SIC_MIND_PROFILE_LEVEL=3`. Après extraction, `mind-captured-entry-probe.mjs` accepte en arguments le chemin de la capture JSONL et le chemin de son rapport de re-proposition.

Branche de travail : `fix/sic-27-feedback-20261127`. Les commits de code `a53189de` puis `dc3f51ae` sont poussés sur GitHub. L’intégration à la branche canonique, le contrôle global et la livraison relèvent du lot suivant.
