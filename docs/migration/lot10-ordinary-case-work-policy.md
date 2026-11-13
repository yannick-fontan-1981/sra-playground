# Lot 10 : compléments ordinaires pour les cas et les revues

Ce complément conserve la politique utilisateur : aucun verrou global pour le travail fonctionnel ordinaire, les revues, les commits et les pushs de branche. Il ne modifie aucun helper historique ni aucune preuve existante.

## Inventaire ciblé

| Helper historique | Mécanisme observé | Usage futur |
| --- | --- | --- |
| `run-clocked-proof.py` | Verrou global de performance SH ou EX, puis verrou propre au cas | Utiliser `run-ordinary-clocked-proof.py`, qui garde seulement le verrou du cas. |
| `case-activity.py` | Verrou EX non bloquant propre au cas, par exemple `recr.lock` | Conserver ce mécanisme pour sérialiser les débits du registre. Son import du helper historique n'appelle pas son `main()` et ne prend aucun verrou global. |
| `review-test-batches.py` | Lecture des statuts de calme et verrou global SH avant une revue sans tests | Utiliser `review-ordinary-test-batches.py` pour les nouveaux reçus ordinaires. |
| `test-development-batch-metadata.py`, `test-development-batch-process-group.py` | Gardes globales de l'ancien protocole de vérification | Outils historiques conservés ; les nouveaux contrôles courts ordinaires n'empruntent pas leur admission globale. |
| `admit-case.py` | Recherche de provenance et détection d'un registre déjà existant, aucun verrou global acquis | Conserver l'interdiction de réadmettre ou remettre à zéro un cas existant. Ce mécanisme n'est pas une attente des autres publications. |

## Campagnes fonctionnelles ordinaires

```bash
python -B docs/migration/lot10c-evidence/run-ordinary-clocked-proof.py \
  --directory NOUVELLE_TENTATIVE \
  --source-manifest GEL/source-manifest.json \
  --timeout-seconds 300
```

Le nouveau wrapper retire le verrou global et l'option `--exclusive-resources`. Il conserve le verrou EX non bloquant du cas, le même contrat, le même registre cumulatif, les délais, les réserves de conservation, les protections du processus enfant et tous les débits. Une contention du verrou de cas reste un refus ; aucun fichier verrou n'est supprimé ou remplacé.

Le nouveau wrapper doit figurer dans l'archive du gel fourni. Un ancien gel qui ne le contient pas est refusé ; aucune empreinte historique n'est réécrite. Le freezer complet existant inclut les helpers du dossier. Son ancien raccourci `--campaign-only` ne suffit pas à archiver ce nouveau wrapper. L'absence de verrou global n'établit ni coût officiel ni isolation.

Le helper `case-activity.py` reste adapté pour les intervalles diagnostic/navigateur : il protège seulement le registre propre au cas. L'absence de nouvelle activité ne nécessite aucun appel à ce helper. La création de cette entrée ordinaire n'autorise ni ne déclenche une nouvelle tentative.

## Revue des groupes ordinaires

```bash
python -B docs/migration/lot10c-evidence/review-ordinary-test-batches.py GEL \
  --batch-manifest docs/migration/lot10c-evidence/prepared-test-partition.json \
  --extra-tests docs/migration/lot10c-evidence/integrated-extra-test-scope.json \
  --output NOUVELLE_SYNTHESE.json
```

Cette revue conserve les quatre groupes, leurs comparaisons et leurs empreintes. Elle attend comme générateur `run-ordinary-release-checks.py` et comme validateur pur capturé `review-test-batches.py`, conformément au nouveau runner déjà livré. Elle ne relit aucun statut de calme, ne prend aucun verrou global et ne transforme pas ces groupes de développement en acceptation de livraison.

Contrôles courts, sans campagne, lecture du vrai registre ni revue des preuves volumineuses :

```bash
python -B docs/migration/lot10c-evidence/test-ordinary-case-and-review.py
```

Les helpers de performance officielle et de publication restent inchangés. Leurs exclusivités courtes ne s'étendent pas à la préparation fonctionnelle. La qualification du coût contre la vraie référence publiée 0.65 et les limites cumulatives des cas sont conservées.
