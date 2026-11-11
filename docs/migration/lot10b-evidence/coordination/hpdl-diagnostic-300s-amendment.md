# Diagnostic HPDL : amendement prospectif du plafond configurable

Cet amendement prolonge le [contrat initial](hpdl-diagnostic-clock-contract.md)
après le diagnostic 01 effectivement exécuté. Il ne modifie aucun reçu, journal,
helper conservé ou débit de cette tentative. Sa rédaction n’est pas une nouvelle
exécution et n’établit aucun résultat de parité.

## Motif observé

Le [contrôle du writer](../recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-01/writer-check.json)
a rendu `status=passed`. La phase de parité était encore active lorsque le
plafond partagé de préparation et d’activité a été atteint. Le
[reçu réel du diagnostic 01](../recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-01/execution-hpdl-diagnostic.json)
conserve `attemptOutcome=activity_timeout`, une demande d’arrêt à
149,500268677 secondes et le code de retour recueilli `-9` pour cette phase.
`diagnosticEvidenceComplete` reste `false`. Aucun point chaud précis ni défaut
de parité n’est déduit de cette interruption.

Le ledger conserve le débit intégral de **149,720413432 secondes** pour cette
tentative. À sa clôture, le cumul était de **1 075,8581646789917 secondes** et le
reste de **1 324,1418353210083 secondes**. Ces valeurs proviennent de l’entrée
terminale du [même ledger HPDL](../recovery-20261111/hpdl-clock.json). Aucun coût
de writer, d’échec ou de rétention n’est retranché et aucune tentative n’est
remplacée.

## Changement autorisé pour les admissions futures

Le maximum configurable de `run-hpdl-clocked-diagnostic.py` passe de 180 à
**300 secondes**. Le défaut reste **180 secondes** grâce à une constante
distincte `DEFAULT_SECONDS`. Le lecteur final accepte désormais cette borne
supérieure, avec les contrôles inchangés du plafond propre à chaque tentative.

| Contrôle | Diagnostic 01 conservé | Prochaine admission proposée |
| --- | --- | --- |
| Mode | `writer-parity` | `parity` |
| Plafond global déclaré | 180 s | 300 s |
| Réserve de capture à l’intérieur du plafond | 30 s | 30 s |
| Marge d’arrêt | 0,5 s | 0,5 s |
| Contrôle de fin de préparation et des enfants | 149,5 s | 269,5 s |
| Contrôle de fin des grandes captures | 179,5 s | 299,5 s |

Les égalités entre reçu, admission et entrée du ledger restent exigées. Les
bornes monotones, la formule `plafond − 30,5`, les commandes fermées, l’ordre des
phases, les empreintes et les copies historiques des helpers restent vérifiés.
La lecture de la tentative 01 utilise donc toujours son plafond de 180 secondes
et son activité de 149,5 secondes ; la nouvelle limite n’est pas appliquée
rétroactivement à ses fichiers.

Les contrôles de signal, la collecte des groupes enfants, l’entrée `running`
avant lancement, les verrous et le débit du temps effectivement consommé ne
changent pas. L’admission vérifie le solde réel du ledger et exige toujours
30 secondes supplémentaires disponibles pour la clôture, sans les débiter
fictivement. La limite cumulée reste strictement **2 400 secondes**, sans reset,
sans remboursement et avec le débit conservateur de 451 secondes déjà inscrit.

## Prochaine commande proposée, non exécutée par cet amendement

La prochaine tentative ne relance pas le writer déjà contrôlé. Depuis la racine
du checkout, après validation du root et avec les octets natifs de HPDL01 encore
identiques :

```bash
python3 -B docs/migration/lot10b-evidence/run-hpdl-clocked-diagnostic.py \
  --mode parity \
  --directory docs/migration/lot10b-evidence/recovery-20261111/hpdl-analysis-after01/clocked-diagnostic-02 \
  --checkpoint docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-01/hpdl-checkpoint.json \
  --journal docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-01/hpdl-actual-public-journal.jsonl.gz \
  --execution-receipt docs/migration/lot10b-evidence/recovery-20261111/hpdl-live-01/execution-hpdl.json \
  --timeout-seconds 300
```

Oracle prépare séparément des messages légers de progression et un relevé
périodique des piles par `faulthandler`. Aucun appel source, restauration,
ablation ou élément du domaine comparé n’est retiré. Leurs octets réellement
utilisés seront conservés dans cette nouvelle tentative ; ceux du diagnostic 01
restent dans son répertoire immuable.

La prochaine campagne de jeu réelle, si elle est admise ensuite par le root,
sera distincte et bornée à 300 secondes afin de conserver du budget pour la QA
et la parité. Cet amendement ne lance pas cette campagne et ne modifie pas son
runner. Chaque admission future doit satisfaire à nouveau le budget cumulatif
réel ; aucun résultat ni temps futur n’est présumé.
