# Oracle original 5C — nouvelle preuve de reprise

L’ancien espace de travail non publié est absent. Ce dossier contient des **preuves nouvellement exécutées**, sans réemploi de résultats historiques.

## Résultats effectivement achevés

[Export 02](export-02.json) : **PASS**, avec **82 helpers**, **14 chaînes froides**, **un contrat isolé de restauration source**, **845 opérations**, **deux exceptions source** pour des binders invalides et **14 écritures d’attention**. L’inventaire original compte **1 786 fichiers avant et après**, sans changement ; le reçu liste **726 modules originaux effectivement importés**.

La [fixture indépendante courante](../../../../../tests/fixtures/v6-observed-binding-reference.json.gz) contient **3 454 135 octets compressés**. Son SHA-256 est `eacefcf58171fbaa4c9bce248210ab0fb105a067ec92981ca2d21f0a057747d9`. La [promotion de la fixture](export-02-canonical-promotion.json) vérifie sa copie exacte depuis l’export original neuf et conserve la version précédente.

L’[exécution bornée sous verrou partagé](export-02-execution.json) a terminé avec le code 0 en 16,998 secondes. Le [log compressé](export-02.log.gz) est intégral. La [source exacte de l’exporteur](export-02-exporter-source.py) a été conservée avant cette exécution et liée au reçu.

La [parité native 02](parity-02-execution.json) passe **98 tests sur 98**, avec zéro échec, annulation, test ignoré ou tâche restante. Le passage a terminé avec le code 0 en 6,848 secondes ; ses entrées sont inchangées avant et après. Le [log intégral](parity-02.log.gz) et les sources exécutées dans `parity-02-inputs/` sont conservés. Les 14 chaînes froides sont comparées en continu, avec restauration source après chaque opération, puis avec restauration native et rechargement de l’attention depuis les faits réellement écrits. Le contrat isolé de restauration Python est comparé en continu et avec restauration source ; il reste hors du schéma natif fermé.

Ces durées servent à documenter les exécutions bornées ; elles ne sont pas des mesures de performance officielles.

## Premier échec conservé

Le [premier export](export-01.json) a terminé avec le code 0, mais la [parité 01](parity-01-execution.json) a échoué à **93/98**, avec cinq échecs. Son [log](parity-01.log.gz), sa [fixture exacte](fixture-export-01.json.gz), les sources natives exécutées dans `parity-01-inputs/` et la [source de l’exporteur](export-01-exporter-source.py) restent conservés. Cette dernière copie a été faite après l’export puis vérifiée contre son reçu, comme le précise le [reçu de conservation](export-01-source-preservation.json).

Le [diagnostic](export-01-projection-incident.json) distingue deux causes. Le natif supprimait une clé supplémentaire lors de `reset`, alors que l’original réassigne seulement ses champs connus sans vider `__dict__` : le natif a été corrigé. Les quatre autres échecs provenaient d’une entrée de helper dans l’exporteur : des tuples issus du masque d’observation avaient été fournis à `locate` avant d’être sérialisés en listes JSON. Le propriétaire original consommé construit pourtant ses `offsets` en listes de listes. L’export 02 invoque l’original avec cette forme exacte. La comparaison des deux fixtures établit que seuls les quatre résultats de `locate` sont régénérés différemment ; **les 78 autres helpers, toutes les chaînes et tous les autres champs sont identiques**. Aucun attendu n’a été copié depuis le TypeScript.

## Étapes non encore attestées

Le premier [rejeu commun positif](../common/common-01/positive/original-export.json) a exporté **124 appels**, sans exception source. Le [reviewer correspondant](../common/common-01/positive/original-comparison.json) reste **failed : 1 852 contrôles, 121 écarts**, tous sur l’ordre des mappings. Les valeurs, retours et écritures d’attention comparés dans ce passage ne présentaient pas d’écart. L’exporteur omettait le véritable aller-retour du caller `state → Memory.put → Memory.get → restore`, conditionné par `core` ou `methods`. Le JSON de la mémoire Python trie les clés ; cette étape influence les ordres consommés après restauration.

Le nouveau contrat explicite `sourceStateRetention=core_or_methods_memory_roundtrip` fait exécuter cette branche par la classe `Memory` originale dans une base SQLite en mémoire, sans injection d’état natif. Les états avant stockage, réellement relus et restaurés sont conservés. La capture native enrichie documente ses projections avant/après restauration et le reviewer exige toujours l’ordre exact après restauration et à chaque appel source. La [syntaxe des deux outils](tools-syntax-02.json) est passée ; aucun résultat du nouveau passage commun n’est anticipé. Le premier échec et ses sources exactes restent conservés dans `common-01/positive/`.

Les rejeux communs corrigés, les validations intégrées, les coûts et la publication restent à exécuter ou à établir séparément. Le calme de mesure de l’autre conversation est respecté avant toute nouvelle exécution.

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
