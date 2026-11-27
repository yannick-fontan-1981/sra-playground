# Relancer les 107 jeux sur un commit figé

`scripts/prepare-sic-107-rerun.py` reprend le workflow du run 46047191373. Il remplace le SHA, l’arbre et le préfixe des noms de branche et d’artefact. Il vérifie l’identité des 107 codes, des 692 niveaux et des trois fichiers qui déterminent leurs budgets. Les 24 lots conservent le même partitionnement à partir de la campagne de référence.

Une fois le SHA combiné fourni, exécuter ces commandes dans un checkout de qualification. La première commande de préparation affiche le plan. Le push de la branche contenant le workflow déclenche la campagne.

```powershell
$source = '<SHA complet du commit combiné>'
$prepare = '<chemin absolu vers scripts/prepare-sic-107-rerun.py>'
$plan = python $prepare --source $source | ConvertFrom-Json
git switch -c $plan.branch $source
python $prepare --source $source --write
git add -- .github/workflows/sic-campaign-107.yml
git diff --cached --check
git commit -m 'Run SIC 107 on the frozen combined source'
git push -u origin $plan.branch
gh run list --branch $plan.branch --limit 1
```

Le workflow de référence `9d730b984b88268162f6de4e51615422e727750a` doit être présent dans le dépôt local. Le [run 46047191373](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46047191373) a utilisé ce workflow et le runner canonique de son propre SHA source.

## Pièces de comparaison

| Mesure | Pièce |
| --- | --- |
| Temps par jeu et par niveau | `aggregate/results.jsonl.gz`, champs `levelStats[].ms`, `scoredMs` et `settlementMs` |
| Temps des jobs et des étapes de rejeu, pic de concurrence | [timing.json](timing.json) |
| Liste des jeux et allocation des lots | [plan](plan/plan.json) |
| Provenance, mode, nombre de workers et références effectivement lus | `shard-NN/manifest.json` et [receipt-index.json](receipt-index.json) |
| Compteurs de récupération et verdicts | [rapport CI](aggregate/summary.json) et [audit indépendant](independent-audit.json) |
| Frontières HOLE et SNAR et écart à la baseline | [baseline-delta.json](baseline-delta.json) |

Le pic mesuré est de 20 jobs, pour 606 s entre le premier et le dernier rejeu. Le shard LF52 a pris 463 s en rejeu. Les shards 02 et 07 ont attendu davantage avant de démarrer et ont fermé la campagne. Un partitionnement recalibré par les temps moyens a donné un mur simulé plus long sous 20 slots avec 65 s de préparation par job. Les mesures servent à relire les durées du prochain run.
