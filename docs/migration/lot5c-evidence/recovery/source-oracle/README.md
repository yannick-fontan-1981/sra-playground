# Oracle original 5C — nouvelle preuve de reprise

L’ancien espace de travail non publié est absent. Ce dossier contient des **preuves nouvellement exécutées**, sans réemploi de résultats historiques.

## Résultat effectivement achevé

[Export 01](export-01.json) : **PASS**, avec **82 helpers**, **14 chaînes froides**, **un contrat isolé de restauration source**, **845 opérations**, **deux exceptions source** pour des binders invalides et **14 écritures d’attention**. L’inventaire original compte **1 786 fichiers avant et après**, sans changement ; le reçu liste **726 modules originaux effectivement importés**.

La [fixture indépendante](../../../../../tests/fixtures/v6-observed-binding-reference.json.gz) contient 3 453 990 octets compressés. Son SHA-256 est `8ea3768c3f240707c8c0d6988125fe525709414f008484baa9816174928ea3a8`.

L’[exécution bornée sous verrou partagé](export-01-execution.json) a terminé avec le code 0 en 16,835 secondes. Les [logs bruts](export-01.log) et [compressés](export-01.log.gz) sont conservés intégralement. La [copie exacte de l’exporteur](export-01-exporter-source.py) a été faite après l’exécution et vérifiée contre son reçu ; le [reçu de conservation](export-01-source-preservation.json) précise cette chronologie. Il ne s’agit pas d’une archive retrouvée de l’ancien environnement.

## Étapes non encore attestées

Les tests de référence natifs et le reviewer commun sont reconstruits. Leur préparation ne constitue pas un succès de parité. Les rejeux communs, les validations intégrées, les coûts et la publication restent à exécuter ou à établir séparément.

Les contrats, extensions et critères de fin figurent dans [la filiation 5C](../../../lot5c-observed-object-binding-lineage.md). Le [plan commun nouveau](../common/common-plan.json) déclare les scénarios synthétiques et distingue les extensions natives de la parité source.

## Commandes

Toute exécution exige une fenêtre fonctionnelle autorisée, le verrou partagé `/workspace/shared/sra-coordination/performance.lock`, un timeout et des chemins de sortie encore absents. Conserver stdout/stderr, code de sortie, source exécutée et chaque échec.

```bash
python3 scripts/export-observed-binding-reference.py \
  --fixture NOUVELLE_FIXTURE.json.gz \
  --receipt NOUVEAU_RECU.json

node --test tests/v6-observed-binding-reference.test.ts

python3 scripts/export-observed-binding-reference.py \
  --journal DOSSIER_COMMUN/actual-operations.json \
  --fixture DOSSIER_COMMUN/original-replay.json.gz \
  --receipt DOSSIER_COMMUN/original-export.json

python3 scripts/review-observed-binding-common-replay.py DOSSIER_COMMUN
```

L’exporteur n’importe aucun TypeScript. Les appels sélectionnés du journal utilisent la dernière proposition calculée par l’original. L’attention source exécute ses méthodes réelles sur un enregistreur get/put déclaré ; les écritures sont cumulatives dans la fixture et comparées aux deltas natifs exacts. Le reviewer conserve sa source exacte avec son résultat et refuse d’écraser un reçu antérieur.
