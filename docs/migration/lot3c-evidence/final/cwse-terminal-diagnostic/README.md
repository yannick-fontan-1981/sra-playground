# CWSE — diagnostic du refus terminal de 0.43

Le port Exposed et la source Python conservée produisent **la même proposition complète, la même identité et le même refus** sur le dernier paquet public de la campagne. La garde `unbound_action_set` refuse parce que `bundle_template.evidence` ne contient pas l'observation courante. Les actions de la proposition et du bundle sont identiques.

## Chaîne observée

| Paquet public après l'action | Scène Exposed, source et native | Conséquence vérifiée |
| --- | --- | --- |
| 19 | Admise, petite projection | Dernier événement propre acquis ; son évidence se termine à la révision 20. |
| 20 | Absente dans les deux projecteurs | Le dernier retour du préfixe Exposed ne produit aucun événement propre ; son état reste inchangé. |
| 21 | Admise, petite projection | Après l'action étrangère `pre_score_contact`, le nouveau plan est lié à l'observation de révision 22, mais réutilise l'évidence de l'état propre arrêté au paquet 19. |

La mémoire propre est restaurée exclusivement à partir des **19 événements Exposed réels** capturés dans la campagne. La proposition terminale utilise ensuite le dernier raster réel, les commandes disponibles du paquet, la configuration originale et le budget restant calculé depuis le journal. Aucune proposition future ne sert à initialiser sa mémoire.

La source `ExposedReceptionAccess.propose_graph` conserve `reception_state` lorsque son époque et sa disposition correspondent à la scène courante. Elle compose l'évidence du bundle à partir de cet état conservé. Son `record` ne crée pas d'événement propre si l'une des deux scènes est absente. Ces deux règles expliquent la provenance ancienne après le retour non mesurable puis l'action étrangère. La garde originale `CompositionTargetTree.bind` et son port refusent alors l'évidence incomplète avant leurs contrôles spécifiques de morphologie.

## Portée de la conclusion

Cette preuve établit une limite de rattachement de l'évidence déjà présente dans les composants source conservés. Elle ne démontre ni une divergence du port Exposed, ni un défaut de la branche de morphologie, ni la nécessité d'EphemeralMap pour ce refus précis. Elle ne prétend pas que le caller original complet aurait suivi la même trajectoire : seuls les composants Exposed et TargetTree sont comparés sur la trajectoire publique effectivement conservée.

La campagne reste à **2 niveaux résolus, 21 actions et 13 préfixes**, avec arrêt au niveau 3. Le diagnostic ne transforme pas cette limite en réussite du troisième niveau. Il n'exécute aucun hôte, aucune nouvelle campagne et aucune commande dans le jeu, et ne consulte aucun code de jeu ni solution. Le code gelé de 0.43 reste inchangé.

## Reproduction

Depuis la racine du dépôt :

```sh
python -B docs/migration/lot3c-evidence/final/cwse-terminal-diagnostic/source-check.py
node docs/migration/lot3c-evidence/final/cwse-terminal-diagnostic/native-check.mjs
```

`source-check.py` vérifie les empreintes de tous les fichiers de la référence originale avant et après ses appels. Il conserve les trois scènes, le non-événement, la proposition complète et le refus dans `source-result.json`. `native-check.mjs` compare ces sorties aux composants natifs et écrit `native-result.json`. Les deux entrées de campagne sont désignées par leur chemin et leur SHA-256 dans le résultat source ; le résultat natif lie son résultat source par SHA-256 et désigne le digest gelé de 0.43.

Une première exécution du script de diagnostic s'est arrêtée avant la comparaison sur un champ de checkpoint inexistant (`after_rows`). Le script utilise désormais l'empreinte `after_rows_sha256` effectivement conservée et le raster du journal public. Aucun résultat de campagne, source ou fixture n'a été modifié pour résoudre cette erreur d'outillage.
