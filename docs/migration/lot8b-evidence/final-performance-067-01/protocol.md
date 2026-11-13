# Lot 8B : coût prospectif de native 0.67

Déclaré le 2026-11-12T12:30:14.928991+00:00. Référence A : Site107/native0.66, commit 4ff7bf45286a8a19d34401988adca587253ae41e. Candidat B : native0.67, digest c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a.

La fenêtre conserve A1/B1/B2/A2, STCK10 puis SMLP15, quatre sessions froides par jeu et série. Les 32 sessions mesurées (400 actions) et huit chauffes distinctes (24 actions) sont toutes conservées. Seules les chauffes sont exclues des médianes. Huit durées complètes sont groupées par jeu/version. La médiane B doit être strictement inférieure à 1,1 fois A pour chacun des deux jeux, sans compensation ni exclusion. Les phases au-dessus de 10% restent visibles et peuvent être admises si les deux globaux passent.

Les durées proviennent uniquement du runner conservé. session_elapsed mesure le parcours complet du contrôleur jusqu'au dernier retour acquis, pauses/reprises incluses. Le démarrage worker, begin, les inspections terminales et close restent hors de cette durée ; le moteur de jeu, le réseau et le rendu navigateur ne sont pas mesurés. Les phases sont imbriquées et ne s'additionnent pas. Aucun p95 pour huit durées.

Les cas et la politique sont copiés octet pour octet depuis3H ; leurs anciens commentaires ne désignent pas les versions de cette fenêtre. Les cas fonctionnels sont reliés par les six champs exacts déclarés, pas par une fausse égalité de leurs fichiers. Les quatre formes finales sont copiées sans modifier leurs valeurs. Chaque future session et chauffe doit correspondre à sa propre forme. Tous les autres champs de workSignature, phases, pauses et placements doivent rester identiques entre versions et dans chaque version. Seuls observations[*].nodeCount, inspection[*].graphNodes, final.nodeCount et final.graphRevision admettent les valeurs exactes prouvées avant mesure. Aucun autre écart n'est accepté.

La comparaison stricte historique est réellement exécutée et conservée. Le lecteur complémentaire8B accepte uniquement un refus de métadonnées de travail observé, sans sortie, puis vérifie indépendamment le contrat limité ci-dessus. Il ne transforme pas ce refus en succès. Les deux comparaisons de paires et tous les temps bruts restent conservés ; leur statut de phase ne tranche pas le global. Le calculateur JavaScript réutilise les fonctions historiques inchangées. Le reviewer Python recalcule les effectifs, formes, signatures, phases et seuil strict depuis les rapports bruts.

La préparation n'établit ni readiness ni isolation. Le contrôleur externe doit acquérir une exclusivité non bloquante, superviser le groupe entier et libérer son propre descripteur sans supprimer le verrou. Le plafond proposé est1800s actives ; les réserves exactes de fermeture et de conservation sont fixées prospectivement par le plan du contrôleur. Aucun prérequis de disponibilité ou de publication des autres lots ne s'applique au travail ordinaire. Les analyses suivent la libération du verrou. Aucun nouveau jeu ni LKEY n'est exécuté.

Commande mesurée, uniquement sous le contrôleur déclaré :

```json
["python", "-B", "scripts/run-native-cost-window.py", "/workspace/sites/sra-lot8b-baseline066-20261112", "docs/migration/lot8b-evidence/final-performance-067-01", "docs/migration/lot8b-evidence/final-version-067-01/baseline-native.json", "docs/migration/lot8b-evidence/final-version-067-01/candidate-native.json"]
```
