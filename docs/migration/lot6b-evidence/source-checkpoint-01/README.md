# Sauvegarde source du développement 6B

Le commit fonctionnel `e1f42dac8eb4226f8a3bc78d89d6bee6f463da1e` reste dans l'ascendance de la branche `lot6b-selected-rigid-checkpoint-20261111`. Le [plan de transport](transport-plan.json) et son [reçu](transport-receipt.json) établissent que le dernier commit de transport a exactement le même arbre. Les commits suivants ne modifient que la documentation et les reçus.

Le refus initial de 111,2 Mio pour une limite de 64 Mio par envoi est conservé. Après récupération de l'historique distant, trois envois contenant chacun au maximum 24 Mio bruts de fichiers ont réussi, suivis d'une jonction conservant le commit validé. La branche a été vérifiée à chaque étape. Aucun push forcé, suppression de preuve, enregistrement de version Site ni déploiement n'a été effectué.

## Reproduction depuis un checkout neuf

Depuis la racine du dépôt, avant les audits ou les tests :

```bash
python -B scripts/evidence-byte-parts.py restore tests/fixtures
```

Les deux fixtures héritées `v6-feedback-sequences-reference.json.gz` et `v6-relative-arrangements-reference.json.gz` sont volontairement ignorées sous leur forme complète. Leurs six fichiers `.parts.json`, `.part000` et `.part001` sont suivis. Le script existant vérifie l'ordre des parties, leurs tailles et leurs empreintes, puis l'empreinte du résultat ; il crée les fichiers absents, conserve ceux déjà identiques et refuse les fichiers divergents. Les commandes npm de tests et de build ne lancent pas automatiquement cette reconstruction.

Cette précision provient d'une lecture des métadonnées Git et des scripts existants. Elle n'ajoute ni nouvelle exécution de test, ni nouvelle campagne de jeu, ni nouvelle preuve de coût. La [restauration effectivement exécutée](../fixture-restoration/attempt-01/recovery.json) et le [nouvel audit réussi](../audit-guard/restored-inventory.json) restent les preuves de développement retenues.

## Portée du checkpoint

Le gel natif provient de Site97 / native0.60, avec 0.64 réservée. Il reste à intégrer les prédécesseurs effectivement publiés, puis à qualifier le gel intégré, les régressions, le navigateur, les graphes communs et le coût final de 6B. L'[observation du Site](published-site-observation.json) après transport confirme Site101, sans publication 6B.

Une phase supérieure à +10 % est admissible si la médiane de la session complète reste strictement sous +10 % pour chaque jeu. Aucun pourcentage de coût 6B n'est revendiqué ici.
