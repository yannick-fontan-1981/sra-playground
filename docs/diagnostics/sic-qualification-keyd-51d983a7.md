# KEYD et SKBN · ligne 38, provenance du retour d'accès

**Correctif qualifié sur `51d983a7243289d2ebb2cef365dd536cbeaf59b1`.** Parent caractérisé `f710f2e13f252ca0ec1b7de7e25768e13a5e5bf4`. Les seize décisions et vrais retours KEYD nominaux concordent. Les quatre tests KEYD passent. Les deux fins d'approche SKBN gardent zéro acquisition d'accès, avec deux tests par SHA. [Contrôles](sic-keyd-provenance-51d983a7/banc.json) · [Reçus](sic-keyd-provenance-51d983a7/recus.zip)

Au vrai T8 de KEYD, le service retient la transition 8→9 pour `local_access_return` et `G_official_completion`. Le signe détenu disparaît et onze pixels du compartiment changent en dehors du corps. T9 exploite cet accès pour sonder la capacité d'une autre occurrence. Le correctif corrobore le reçu de travail avec l'événement acquis par le propriétaire dans `observed_inventory_event:8`.

| Entrée à vue identique en N1/T9 | Parent | Correctif |
|---|---|---|
| Vraie paire 8→9 | `capacity_probe_candidate` | Même type, mêmes preuves |
| Retrait du seul reçu | `endpoint_approach_candidate` | Même type et même justification |
| Fin remplacée par l'ancienne référence 8→6 | `capacity_probe_candidate` | `endpoint_approach_candidate` |
| Paire du mouvement précédent 7→8 | `capacity_probe_candidate` | `endpoint_approach_candidate` |

La première différence est l'offre à T9. Les gardes approuvent le ticket valide dans chaque scénario. Les variantes jouent le même ACTION4 au T9 puis le même ACTION2 au T10. Les mêmes paquets officiels confirment les gestes et le score reste à zéro. Le contrôle SKBN retrouve T14 et T16 contredits et scellés, sans reçu d'accès.

Départ N1, pack natif et graine implicite 0. KEYD reçoit 16 gestes et SKBN 19 pour suivre T17, avec 600 gestes par niveau et horloge déterministe. Exécuter avec Node 24, Pyodide local et nouveaux dossiers. `$p` et `$c` sont les checkouts propres du parent et du correctif. `$g` contient les actifs du gel. Depuis le Banc :

```powershell
node scripts/sic-qualify-keyd-inventory.mjs $p "$out/f710f2e1.json" --both-pairs
node scripts/sic-qualify-keyd-inventory.mjs $c "$out/51d983a7.json" --both-pairs
foreach ($sha in 'f710f2e1','51d983a7') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha "$out/SKBN" --game SKBN --game-root $g
}
py -3.11 scripts/check-sic-keyd-provenance.py $out
```
