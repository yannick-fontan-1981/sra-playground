# Diagnostic HPDL : intervalle monotone dédié

Statut : rédaction et revue statique seulement. Aucune commande ci-dessous n’a
été exécutée par cette préparation. Aucun résultat du writer ou du comparateur
partiel n’est présumé.

## Ordre obligatoire

1. Conserver la copie réelle de la levée 6A avec `quiet_requested=false` et son
   horodatage réellement observé.
2. Inscrire effectivement le débit conservateur de 451 secondes avec
   `record-hpdl-conservative-case-work.py`. Ce helper et ses exigences restent
   inchangés : il doit encore suivre immédiatement HPDL01 dans le ledger.
3. Après cette inscription, admettre le diagnostic ci-dessous. Le nouveau
   wrapper refuse toute admission sans ce débit réel. Pour les diagnostics
   ultérieurs, le débit doit être présent, sans devoir rester la dernière
   entrée.
4. Garder les octets natifs de HPDL01 jusqu’à la fin de sa comparaison partielle.
   Le correctif d’horloge décrit dans `deadline-clock-draft.md` sera appliqué
   ensuite par le root avec un nouveau gel et les contrôles correspondants.

Une permission temporaire pendant `quiet_requested=true` ne remplace pas le
premier prérequis. L’ancien intervalle HPDL01, ses 47 préfixes scellés, ses 48
retours publics et son absence de campagne finale restent distincts de ce
diagnostic sans jeu.

## Commande proposée pour HPDL01

Depuis la racine du checkout, après levée et admission réelles :

```bash
python3 -B docs/migration/lot10b-evidence/run-hpdl-clocked-diagnostic.py \
  --mode writer-parity \
  --directory docs/migration/lot10b-evidence/recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-01 \
  --checkpoint docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-01/hpdl-checkpoint.json \
  --journal docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-01/hpdl-actual-public-journal.jsonl.gz \
  --execution-receipt docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-01/execution-hpdl.json \
  --timeout-seconds 180
```

Le répertoire de sortie doit être nouveau. Le mode `writer-parity` prévoit deux
phases séquentielles dans **le même intervalle global** :

- `node --max-old-space-size=1536 --expose-gc` exécute uniquement
  `check-stream-evidence-json.mjs` avec le checkpoint brut, le reçu réel et une
  sortie JSON exclusive.
- Le même interpréteur Python que le wrapper, avec `-B`, exécute uniquement
  `scripts/compare-window-question-checkpoint-parity.py` avec ce même checkpoint,
  le journal réel, le reçu d’exécution et une nouvelle sortie `PARTIAL.json.gz`.

Les modes fermés `writer` et `parity` permettent aussi une admission séparée si
le root la demande. `--journal` est requis exactement pour les modes comprenant
la parité. Une phase qui échoue, expire ou est interrompue empêche la suivante.
Aucun argument de commande shell libre n’est accepté.

## Temps et rétention

Le temps monotone commence dans le processus parent avant le chargement du
lecteur partagé. Les 180 secondes incluent préparation, enfants et capture.
Une réserve de capture de 30 secondes est retranchée de ce plafond : les
enfants sont arrêtés au plus tard au contrôle de 149,5 secondes ; les grandes
lectures et empreintes de rétention s’arrêtent au contrôle de 179,5 secondes.
Les latences d’arrêt, de collecte et de clôture effectivement observées restent
débitées ; aucune durée n’est tronquée pour faire rentrer un résultat dans la
limite annoncée. L’admission demande aussi 30 secondes de marge disponible dans
le budget cumulatif pour la clôture. Cette marge n’est ni un débit fictif ni un
remboursement : seul le temps réellement mesuré est chargé.

Le wrapper tient le verrou de performance partagé, le verrou HPDL exclusif et
le verrou de mutation du ledger. Les outils enfants peuvent reprendre le
verrou de performance partagé. Le ledger `hpdl-clock.json` reçoit une entrée
`running` durable avant les empreintes de préparation et avant tout enfant.
Une interruption du parent qui empêche sa clôture laisse cette entrée ouverte
et bloque les admissions suivantes.

Les groupes enfants reçoivent un arrêt au délai ou au signal, puis sont
récoltés. Chaque phase conserve sa commande déclarée, ses bornes observées, son
code de retour et son journal. Les petits helpers utilisés sont copiés dans
`retained-inputs` et liés aux empreintes avant/après des fichiers réellement
exécutés. Les checkpoints et journaux historiques restent en place. Toute
rétention incomplète est déclarée explicitement ; aucun fichier brut n’est
supprimé.

## Reçu et lecteur

Le nouveau reçu porte le schéma
`logos-engine.lot10b.hpdl-clocked-diagnostic.v1` et `kind=case_diagnostic`.
`finalize-hpdl-case-budget-review.py` accepte ce quatrième schéma dans une
branche distincte : elle contrôle admission, durée monotone, ordre des phases,
commandes fixes, empreintes et absence de nouvelle prétention de gameplay.
Elle préserve séparément la vérification exacte des 451 secondes du travail
passé. Les compteurs d’actions et de niveaux du diagnostic restent `null` et
`campaignPassedEstablished` reste `false`.

`diagnosticEvidenceComplete` décrit l’intégrité du diagnostic et les retours
des processus déclarés. Les résultats source et writer restent dans leurs
propres reçus, avec leur portée exacte. Le reçu partiel n’acquiert pas le
quarante-huitième retour et ne devient pas un rapport de campagne finale.

Le nouveau wrapper figure dans les `generator_inputs` du finalizer. Pour le
prochain gel, conserver aussi le vérificateur writer, son serializer, le runner
qu’il lit, les deux comparateurs et le lecteur cumulatif. L’archive de HPDL01
ne doit pas être réécrite : la comparaison historique vérifie ses anciens
helpers dans cette archive et les octets natifs encore identiques.
