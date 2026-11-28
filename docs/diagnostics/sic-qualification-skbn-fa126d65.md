# SKBN et KEYD · ligne 38, accès repris et preuve périmée admise

**Qualification partielle au gel.** Le harnais `fa126d653aa5e123f9de78c220e9e6129a6436a2` a le même arbre moteur que `d0e7527c`. Les reçus SKBN et KEYD sont identiques entre ces deux SHA. Les deux jeux recapturent 18 des 31 occurrences historiques dans la fenêtre catalogue de 16 gestes. Critères `f1d9d890`. [Contrôles](sic-skbn-fa126d65/banc.json) · [Reçus](sic-skbn-fa126d65/recus.zip)

**SKBN.** Aux T14 et T16 le corps rejoint la même case, de rôle inconnu. Le retour mesuré `changed_endpoint_reached` garde les références exactes de chaque geste. Le changement de 16 pixels hors des régions attendues contredit les deux préfixes. Aucun accès n'est acquis. Le service rend ensuite ACTION3 sous `observed_frontier` puis `pre_score_contact` en prolongation. À la même vue de T14, faire déclarer la case déjà visitée provoque le vrai repli ACTION2.

**KEYD.** Les 16 tickets du catalogue relèvent de la famille d'inventaire. Le T5 ACTION5 teste la source, avec `matched:null`. Les T6–T8 sondent l'accès. Le vrai T8 acquiert `local_access_return` avec la paire de révisions 8→9. Dès le T9, les offres de capacité l'utilisent pour choisir une nouvelle occurrence.

| KEYD N1/T9 à même vue | Offre autorisée | Références en révisions | Action et retour |
|---|---|---|---|
| Nominal | `capacity_probe_candidate` | Courante 9, acquis 8→9 | ACTION4, `matched:true` |
| Retrait de ce seul acquis | `endpoint_approach_candidate` | Courante 9 | Même ACTION4, même paquet officiel |
| Remplacement de la fin de l'acquis par l'ancienne référence de même époque | `capacity_probe_candidate` | Courante 9, paire altérée 8→6 | Même ACTION4, même paquet officiel |

Le retrait démontre la reprise effective de l'acquis. La substitution démontre que le service continue à admettre cette offre avec une référence authentique d'un autre mouvement. Cette faille de provenance garde 38 hors du compteur strict. KEYD ne gagne aucun niveau dans cette fenêtre. La recherche ciblée a trouvé la même famille sur KEYD et SKBN. CRAF et LKEY ne la donnent pas sous ce budget. Les autres occurrences historiques restent hors du rejeu.

Depuis le banc, avec Node 24 et Pyodide local, `$g` et `$p` désignent des checkouts propres du gel et de la preuve. Utiliser de nouvelles sorties. Le rejeu SKBN de contrôle prolonge le budget jusqu'à 19 pour observer T17. KEYD conserve le plafond catalogue de 16 et l'horloge moteur déterministe.

```powershell
foreach ($sha in 'd0e7527c','fa126d65') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $skbn --game SKBN --game-root $g
}
node scripts/sic-recapture-strategy-inventory.mjs $g "$keyd/inventaire.json" --offer public_observed_inventory public_observed_inventory public_inventory_composition KEYD SKBN CRAF LKEY
node scripts/sic-qualify-keyd-inventory.mjs $g "$keyd/keyd-causal.json"
node scripts/sic-qualify-keyd-inventory.mjs $p "$keyd/keyd-preuve.json"
py -3.11 scripts/check-sic-inventory-provenance.py $skbn $keyd
```
