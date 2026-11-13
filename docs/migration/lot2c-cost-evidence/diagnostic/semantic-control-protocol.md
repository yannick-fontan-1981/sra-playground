# Contrôle sémantique distinct après le diagnostic de coût

## Motif et déclaration avant exécution

Le premier profil a conservé le graphe par empreintes de valeur, son snapshot final et quatre états de propriétaires. Sa comparaison stricte ne concorde pas : les identités de version et de graphe diffèrent, ainsi que les empreintes de 24 nœuds `reasoning:trace`. Les corps complets de ces traces manquent dans cette première collecte. Il est donc impossible d'y vérifier que les différences portent seulement sur les horloges ou la provenance. Les deux profils restent conservés intégralement, avec leur comparaison stricte et ses différences.

Ce contrôle supplémentaire résout cette lacune précise. Il ne constitue pas une nouvelle mesure de performance et ne sélectionne pas un résultat plus rapide. Le script `capture-native-loop-semantics.mjs` et ce protocole sont copiés à l'identique dans le checkout V63 isolé. **Un replay V63 et un replay 0.36**, séquentiels, utilisent les mêmes dix retours publics STCK. Le root donne le signal de départ après les tests/builds en cours.

## Exécution et capture

Le véritable service et le runtime commun commencent avec une mémoire vide. Chaque commande recalculée doit correspondre exactement à la trace publique avant que son retour soit fourni. Le script ne lit aucune implémentation de jeu, spécification, oracle ou solution. Les compteurs et les dix acquisitions finales sont contrôlés. Il n'ajoute aucun wrapper de chronométrage et ne rapporte aucune métrique de performance.

Les deux sources natives restent gelées : V63 `3cd17565b114a40ed71870bf8d7875a1b91102440b92d14a9258bfa98d4f7779` ; version 0.36 `ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b`. Leurs empreintes ainsi que celles du script, du protocole, des déclarations, du manifeste et de la trace sont vérifiées avant/après.

Chaque reçu conserve le **graphe encodé intégral**, tous ses nœuds, leurs valeurs et les deltas, le snapshot final, les commandes/requêtes, les quatre états de propriétaires et les **24 traces de raisonnement décodées intégralement**. Ces valeurs décodées permettent de relier un Float64 encodé différent au chemin de feuille exact. Les archives gzip sont vérifiées par décompression exacte et ne remplacent aucun reçu antérieur.

## Comparaison annoncée

La comparaison stricte rapporte toutes les différences. Une qualification séparée peut identifier les champs de provenance de version et les champs d'horloge **uniquement après observation de leurs chemins et valeurs exacts**. Le calcul du `sourceDigest`, son inclusion dans l'identité d'exécution et les origines du graphe doivent être vérifiés contre leurs contrats.

Les valeurs de tous les autres nœuds, les propositions, observations, révisions, commandes et états de propriétaires doivent rester identiques. Toute différence métier demeure un écart bloquant. Aucune normalisation par nom générique, suppression de sous-arbre ou tolérance numérique n'est autorisée. Les différences de chaîne sont conservées ; elles ne deviennent pas une identité binaire revendiquée.

Commande de référence :

```sh
node scripts/capture-native-loop-semantics.mjs docs/migration/lot2c-evidence/performance/stck-followup/cases.json STCK docs/migration/lot2c-cost-evidence/diagnostic/semantic-baseline.json.gz 3cd17565b114a40ed71870bf8d7875a1b91102440b92d14a9258bfa98d4f7779
```

La correction emploie `semantic-after.json.gz` et son digest gelé. Les fichiers capturés reçoivent chacun un reçu externe d'exécution et leurs empreintes. Aucun résultat de performance du contrôle officiel n'est déduit de cette vérification sémantique.
