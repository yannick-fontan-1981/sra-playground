# Banc indépendant du composeur de pression sur c515ea14

La référence `0aef4289e97ce094782dfd03f5a79ace6eae5fd2` est comparée à `c515ea1464387c940b06e93f3ad7ecd73f782f60`. Le portage remplace la recherche dans `choosePressureReserve`. Le fournisseur et le moteur natif continuent à confronter chaque commande et sa projection au retour. [Contrat et critères](https://github.com/yannick-fontan-1981/sra-playground/blob/c515ea1464387c940b06e93f3ad7ecd73f782f60/docs/diagnostics/sic-pressure-composer-port.md)

| Épreuve | Verdict apparié |
|---|---|
| SS05 autonome depuis N1, `sic`, cible 1 | Niveau gagné en 36 gestes sur les deux SHA. Même reçu observable. Ce parcours autonome emploie le chemin de portage local. |
| SS11 autonome depuis N1, `sic`, cible 1 | 80 gestes et arrêt `session_action_budget` sur les deux SHA, sans niveau gagné. Même reçu observable. |
| SS05, passage avant fermeture | Acquis au T6 puis T14. Les 32 commandes après reprise gagnent N1. Empreintes des commandes et projections identiques. |
| SS05, fermeture avant passage | Acquis au T6 puis T12 avec permutation de palette. Même verdict sur les 32 commandes après reprise. |

Les deux reprises ciblées jouent le fournisseur de réserve avec les vrais retours de SS05. Chaque bras confirme les trois objectifs `reserve_weight`, `build_crossing` et `cross_to_exit`. Le seul retrait de la preuve de fermeture retire la route de récupération. Une projection changée face au même paquet réel donne `pressure_projection_contradicted` et scelle la décision. Le fournisseur refuse alors la transition à cette pose et conserve les autres preuves. Les deux variantes exercent un même mécanisme. Les quatre tests du composeur, dont l'ouverture à fenêtre finie construite, passent également.

Depuis le Banc, `$a` et `$b` désignent les checkouts exacts de la référence et du portage. Garder un dossier neuf pour les reçus locaux. Utiliser Node 24.22.3.

```powershell
$sha = 'c515ea1464387c940b06e93f3ad7ecd73f782f60'
py -3.11 scripts/test-sic-pressure-composer-port.py $a $b $sha artifacts/sic-after-98/pressure-recontrole
$h = (Resolve-Path scripts/check-sic-chronological.mjs).Path
$out = (New-Item -ItemType Directory artifacts/sic-after-98/pressure-autonome-recontrole).FullName
$env:SIC_REPLAY_REFERENCES = (Resolve-Path docs/architecture/sic-replay-reference-levels-20261126.json).Path
Push-Location $a
node $h SS05,SS11 1 "$out/A.jsonl" 1 sic
Pop-Location
Push-Location $b
node $h SS05,SS11 1 "$out/B.jsonl" 1 sic
node scripts/compare-sic-pressure-composer.mjs "$out/A.jsonl" "$out/B.jsonl"
node --test tests/sic-effect-composer.test.ts
Pop-Location
```
