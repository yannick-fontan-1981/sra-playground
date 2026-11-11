Revue consignée : 2026-11-11T16:16:23.110455+00:00

# Revue source du contrôle avant publication 10B

Revue des sources des recorders10B/10A et du planificateur de transport, sans exécuter de validateur, Git, hash, archive, runtime ou mesure. La version10A confirme la même interface et le même contrat avec ses identifiants propres. Aucun helper gelé modifié.

## Interface exacte

```text
python3 -B docs/migration/lot10b-evidence/record-publication-inputs.py BASELINE_CHECKOUT FINAL_DIRECTORY PERFORMANCE_DIRECTORY VALIDATION_DIRECTORY [--browser-evidence FILE] [--game-evidence FILE] [--contribution-reserve FILE]
```

Les quatre répertoires sont des arguments positionnels obligatoires. BASELINE_CHECKOUT doit être absolu, canonique, distinct du candidat, sans relation ancêtre/enfant avec lui. VALIDATION_DIRECTORY doit se trouver dans FINAL_DIRECTORY. Les options browser et game sont répétables; contribution-reserve est unique. Ces preuves optionnelles sont seulement fingerprintées, pas réinterprétées.

La sortie exclusive est FINAL_DIRECTORY/publication-inputs.json, de schéma `logos-engine.lot10b-publication-inputs.v1`, statut `passed`. Le recorder n'a pas de mode verify-only ni d'option pour écraser une sortie.

## Prérequis réellement contrôlés

- Intégrité commune préalable `logos-engine.native-delivery-integrity.v1`, passed, mêmes final/validation/digest, générateur inchangé, tous les reçus formels inclus et toujours identiques.
- Gels natifs A/B, membres source/tests/build,768entrées d'archive, worker natif compilé et résumé des rejeux toujours conformes aux preuves terminées.
- Contrat owner-growth-contract.v2, agrégat owner-cost-consolidation.v2 et revue owner-cost-review.v2 pour10B, achevés et liés aux mêmes inputs.
- Acceptation réelle des deux jeux, population physique32sessions/400actions et8chauffes/24actions, ABBA intégral A1/B1/B2/A2 passed avec sources et journaux inchangés.
- Tous les inputs de la revue et de la readiness, ainsi que les watchedExternalInputs de la revue, revérifiés sur leurs bytes. L'intégrité de livraison existante n'est pas réécrite.
- Refus réel du comparateur historique conservé : failure receipt `logos-engine.retained-tool-failure.v1`, code non nul, inputsUnchanged, outputExists false et sortie stricte absente. Aucune anticipation de ce refus ni de l'acceptation indépendante n'est autorisée.

## Fusion documentaire après le coût

Le recorder peut servir de contrôle réel après fusion documentaire de l'actuel prédécesseur Site101, sans changer le gel fonctionnel. Il faut attendre la fin de la mesure puis intégrer le commit complet réellement observé; ne pas changer le checkout de référence A ni ses déclarations.

Conserver les contenus de tous les768inputs gelés, les reçus et outils liés à la readiness/revue, les sources/tests/build et les sorties compilées. La seule étiquette « documentaire » ne suffit pas : certains documents et scripts de preuve appartiennent aux inputs contrôlés. Toute différence dans ces ensembles doit être traitée comme un vrai changement; ne pas éditer les empreintes pour les faire passer.

Exécuter le recorder après la fusion et les mises à jour documentaires finales, avant de figer le commit à transporter. Il revérifie les entrées de l'intégrité déjà passée; aucun nouvel appel du vérificateur commun exclusif sur02 n'est nécessaire si ses reçus sont conservés.

Le recorder ne consulte pas l'hébergement, ne vérifie pas HEAD ou l'ascendance Git et n'enregistre pas le commit final. Il faut un reçu séparé de réconciliation : Site101/version/deployment réellement observés, SHA complet du prédécesseur, HEAD avant/après, liste des changements, intégrité des inputs et identité de l'application conservée. Après synchronisation, le résultat du helper Sites doit lier commit réellement poussé et archive réellement produite; ne pas confondre le commit d'ascendance du gel avec le commit livré.

## Transport éventuel

```text
python3 -B docs/migration/lot10b-evidence/plan-bounded-source-transport.py --base FULL_ACTUALLY_PUBLISHED_PREDECESSOR_COMMIT --target HEAD --output ABSOLUTE_NEW_PATH_OUTSIDE_CHECKOUT --window-receipt PERF/window.json
```

L'option explicite --window-receipt est nécessaire lorsque le coût n'est pas dans le chemin historique par défaut. Le planificateur exige la fenêtre passée et un HEAD final commité avec checkout propre. Il ne pousse pas et ne publie pas. Sa promesse vérifiée par le plan est un arbre final exactement égal à l'arbre cible et un transport ordinaire descendant du prédécesseur; elle n'autorise aucune modification des sources validées. Les preuves volumineuses doivent avoir été préparées sans perte avant le commit final.

## Qualification

Cette revue ne constate encore aucun coût10B accepté, aucune fusion101 réalisée, aucun nouveau commit de publication et aucun déploiement. Elle documente seulement les interfaces et conditions présentes dans les sources lues.
